import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

const BALANCE_CACHE_TTL_MS = 15 * 60 * 1000;
const walletBalanceCache = new Map<string, { balance: number; updatedAt: number }>();

function toMoney(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function isSupabaseMissingRow(error: any): boolean {
  return error?.code === 'PGRST116';
}

function isSupabaseMissingTable(error: any): boolean {
  return error?.code === '42P01';
}

function isTransientSupabaseError(error: any): boolean {
  const combined = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    combined.includes('fetch failed') ||
    combined.includes('econnreset') ||
    combined.includes('connect timeout') ||
    combined.includes('timed out') ||
    combined.includes('und_err_connect_timeout')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withSupabaseRetry(
  label: string,
  operation: () => any,
  attempts = 3
): Promise<{ data: any; error: any }> {
  let lastResult: { data: any; error: any } | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await operation();
      lastResult = result;

      if (!result.error) {
        return result;
      }

      if (!isTransientSupabaseError(result.error) || attempt === attempts) {
        return result;
      }

      await sleep(attempt * 150);
    } catch (error: any) {
      lastResult = { data: null, error };
      if (!isTransientSupabaseError(error) || attempt === attempts) {
        return { data: null, error };
      }
      await sleep(attempt * 150);
    }
  }

  return lastResult || { data: null, error: new Error(`[Wallet] ${label} failed`) };
}

function getCachedBalance(userId: string): number | null {
  const cached = walletBalanceCache.get(userId);
  if (!cached) return null;
  if (Date.now() - cached.updatedAt > BALANCE_CACHE_TTL_MS) {
    walletBalanceCache.delete(userId);
    return null;
  }
  return cached.balance;
}

function setCachedBalance(userId: string, balance: number): void {
  walletBalanceCache.set(userId, { balance, updatedAt: Date.now() });
}

export const getWalletSummary = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user?.role;

    // 1. Get users.balance (current primary source)
    const { data: user, error: userError } = await withSupabaseRetry(
      'users.balance',
      () =>
        supabase
          .from('users')
          .select('balance')
          .eq('id', userId)
          .maybeSingle()
    );

    const usersBalance = toMoney(user?.balance);
    const usersReadFailed = !!(userError && !isSupabaseMissingRow(userError));
    if (userError && !isSupabaseMissingRow(userError)) {
      console.warn('[Wallet] Failed to load users.balance:', userError.message);
    }
    if (!user && !userError) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. Compatibility source: wallets.balance (legacy deployments)
    let walletsBalance: number | null = null;
    let walletsReadFailed = false;
    try {
      const { data: walletRow, error: walletError } = await withSupabaseRetry(
        'wallets.balance',
        () =>
          supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle()
      );

      if (walletError && !isSupabaseMissingRow(walletError) && !isSupabaseMissingTable(walletError)) {
        walletsReadFailed = true;
        console.warn('[Wallet] Failed to load wallets.balance:', walletError.message);
      } else if (!walletError) {
        walletsBalance = toMoney(walletRow?.balance);
      }
    } catch (walletReadError: any) {
      walletsReadFailed = true;
      console.warn('[Wallet] wallets fallback query failed:', walletReadError?.message || walletReadError);
    }

    // 3. Resolve balance robustly.
    // Prefer non-zero value when one source is zero and the other is not.
    let balance = 0;
    if (usersBalance !== null && walletsBalance !== null) {
      if (usersBalance === 0 && walletsBalance !== 0) {
        balance = walletsBalance;
      } else if (walletsBalance === 0 && usersBalance !== 0) {
        balance = usersBalance;
      } else {
        balance = usersBalance;
      }
    } else if (usersBalance !== null) {
      balance = usersBalance;
    } else if (walletsBalance !== null) {
      balance = walletsBalance;
    }

    // If all data sources are unavailable due transient infra issues, never lie with 0.
    if (usersBalance === null && walletsBalance === null && (usersReadFailed || walletsReadFailed)) {
      const cachedBalance = getCachedBalance(userId);
      if (cachedBalance !== null) {
        balance = cachedBalance;
      } else {
        return res.status(503).json({ error: 'Wallet service temporarily unavailable' });
      }
    }

    if (usersBalance !== null && walletsBalance !== null && usersBalance !== walletsBalance) {
      console.warn(
        `[Wallet] Balance mismatch for user ${userId}: users=${usersBalance}, wallets=${walletsBalance}, resolved=${balance}`
      );
    }

    // Keep users.balance aligned when we resolved a different valid source.
    if (balance !== 0 && balance !== usersBalance) {
      const { error: syncError } = await supabase
        .from('users')
        .update({ balance })
        .eq('id', userId);
      if (syncError) {
        console.warn('[Wallet] Failed to sync users.balance:', syncError.message);
      }
    }
    if (Number.isFinite(balance)) {
      setCachedBalance(userId, balance);
    }

    // 4. Get Wallet Transactions (Payments, Earnings)
    const { data: txs, error: txError } = await withSupabaseRetry(
      'wallet_transactions.list',
      () =>
        supabase
          .from('wallet_transactions')
          .select('*') // Simplified query to avoid join errors for now
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20)
    );

    if (txError) {
      console.warn('[Wallet] Failed to load wallet transactions:', txError.message);
    }

    // 5. Get Withdrawal Requests (driver only). Customers shouldn't fail on this.
    let withdrawals: any[] = [];
    if (userRole === 'driver') {
      const { data: wdRows, error: wdError } = await withSupabaseRetry(
        'withdrawal_requests.list',
        () =>
          supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('driver_id', userId)
            .order('created_at', { ascending: false })
            .limit(10)
      );

      if (wdError) {
        console.warn('[Wallet] Failed to load withdrawal requests:', wdError.message);
      } else {
        withdrawals = wdRows || [];
      }
    }

    // 4. Normalize & Merge
    // We want a unified list for the frontend.
    // Withdrawals in 'withdrawal_requests' might duplicate 'wallet_transactions' if we insert there too on approval.
    // However, pending requests are ONLY in withdrawal_requests.
    // So we should map them carefully.

    const normalTxs = (txs || []).map((t: any) => ({
      id: t.id,
      amount: t.amount,
      type: t.type, // 'trip_earnings', 'payment', etc.
      status: t.status,
      created_at: t.created_at,
      description: t.description || (t.trips ? `Trip to ${t.trips.pickup_address}` : '')
    }));

    const normalWithdrawals = (withdrawals || []).map((w: any) => ({
      id: w.id,
      amount: -w.amount, // Withdrawals are negative flows usually, or just show as red
      type: 'withdrawal_request',
      status: w.status, // 'pending', 'approved', 'rejected'
      created_at: w.created_at,
      description: `Withdrawal via ${w.method} (${w.status})`
    }));

    // Merge and Sort
    const allTransactions = [...normalTxs, ...normalWithdrawals].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // 4. Calculate Today's Earnings
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayTxs, error: todayError } = await withSupabaseRetry(
      'wallet_transactions.today_earnings',
      () =>
        supabase
          .from('wallet_transactions')
          .select('amount')
          .eq('user_id', userId)
          .eq('type', 'trip_earnings')
          .gte('created_at', today.toISOString())
    );

    if (todayError) console.error('Error fetching today earnings:', todayError);

    const todayEarnings = todayTxs?.reduce(
      (sum: number, tx: any) => sum + Number(tx.amount),
      0
    ) || 0;

    res.json({
      balance,
      today_earnings: todayEarnings,
      transactions: allTransactions.slice(0, 50), // Return last 50 combined
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const requestWithdrawal = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount, method, account_number } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }

    if (!method || !account_number) {
      return res.status(400).json({ error: 'Payment method and account number are required' });
    }

    // Get current balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    const currentBalance = Number(user?.balance || 0);

    // Check if user has sufficient balance
    if (currentBalance < amount) {
      return res.status(400).json({
        error: 'Insufficient balance',
        current_balance: currentBalance,
        requested_amount: amount
      });
    }

    // Create withdrawal request
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('withdrawal_requests')
      .insert({
        driver_id: userId,
        amount,
        method,
        account_number,
        status: 'pending'
      })
      .select()
      .single();

    if (withdrawalError) throw withdrawalError;

    res.json({
      success: true,
      withdrawal,
      message: 'Withdrawal request submitted successfully'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
