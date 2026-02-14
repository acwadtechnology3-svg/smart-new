
import { supabase } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';

export class ReferralService {

    /**
     * Generates a unique, human-readable referral code.
     * Format: 3 letters (random) + 4 numbers. Upper case.
     * Collision check is performed.
     */
    static async generateReferralCode(userId: string): Promise<string> {
        let unique = false;
        let code = '';

        // Safety break after 10 tries
        let attempts = 0;
        while (!unique && attempts < 10) {
            code = this.createRandomCode();
            // Check collision
            const { data } = await supabase
                .from('users')
                .select('id')
                .eq('referral_code', code)
                .single();

            if (!data) {
                unique = true;
            }
            attempts++;
        }

        if (!unique) throw new Error('Failed to generate unique referral code');

        // Save to user
        const { error } = await supabase
            .from('users')
            .update({ referral_code: code })
            .eq('id', userId);

        if (error) throw error;

        return code;
    }

    private static createRandomCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed O, I
        const nums = '23456789'; // Removed 0, 1

        let result = '';
        for (let i = 0; i < 3; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        for (let i = 0; i < 4; i++) result += nums.charAt(Math.floor(Math.random() * nums.length));

        return result;
    }

    /**
     * Attributes a referral when a user signs up or enters a code.
     */
    static async applyReferral(refereeId: string, code: string, channel: string = 'app'): Promise<any> {
        // 1. Validate code
        const { data: referrer, error: referrerError } = await supabase
            .from('users')
            .select('id, role')
            .eq('referral_code', code)
            .single();

        if (!referrer || referrerError) throw new Error('Invalid referral code');
        if (referrer.id === refereeId) throw new Error('Cannot refer yourself');

        // 2. Check if user already referred
        const { data: existing } = await supabase
            .from('referrals')
            .select('id')
            .eq('referee_id', refereeId)
            .single();

        if (existing) throw new Error('User already referred');

        // 3. Find active program for this pair (Referrer -> Referee)
        // For now, get the default active program for the REFERRER's type or generic
        const { data: program } = await supabase
            .from('referral_programs')
            .select('*')
            .eq('is_active', true)
            .eq('user_type', referrer.role === 'driver' ? 'driver' : 'rider')
            .gte('end_date', new Date().toISOString())
            .single();

        if (!program) {
            console.warn('No active referral program found, but recording the link.');
        }

        // 4. Create Referral Record
        const referralData = {
            referrer_id: referrer.id,
            referee_id: refereeId,
            program_id: program?.id || null,
            status: 'pending',
            channel: channel,
            metadata: { os: 'unknown' }
        };

        const { data: referral, error: refError } = await supabase
            .from('referrals')
            .insert(referralData)
            .select()
            .single();

        if (refError) throw refError;

        // 5. Update user table for quick lookup
        await supabase.from('users').update({ referred_by: referrer.id }).eq('id', refereeId);

        return referral;
    }

    /**
     * Use this to get the code. Generates one if it doesn't exist.
     */
    static async getUserReferralCode(userId: string): Promise<string> {
        const { data } = await supabase
            .from('users')
            .select('referral_code')
            .eq('id', userId)
            .single();

        if (data?.referral_code) return data.referral_code;
        return this.generateReferralCode(userId);
    }

    static async getReferralStats(userId: string) {
        const { count } = await supabase
            .from('referrals')
            .select('id', { count: 'exact' })
            .eq('referrer_id', userId);

        const { data: earnings } = await supabase
            .from('referral_rewards')
            .select('amount')
            .eq('user_id', userId);

        const totalEarned = earnings?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

        return {
            referralCount: count,
            totalEarned
        };
    }

    /**
     * Checks if a user's referral should be qualified based on an event (e.g., trip completion).
     * Should be called when a trip is completed.
     */
    static async checkQualification(userId: string, eventType: 'trip_completion'): Promise<void> {
        // 1. Find pending referral where this user is the referee
        const { data: referral } = await supabase
            .from('referrals')
            .select('id, program_id, referrer_id, referee_id')
            .eq('referee_id', userId)
            .eq('status', 'pending')
            .single();

        if (!referral) return; // No pending referral or already qualified

        // 2. Get Program Rules
        const { data: program } = await supabase
            .from('referral_programs')
            .select('rules_config, rewards_config')
            .eq('id', referral.program_id)
            .single();

        if (!program) return;

        // 3. Evaluate Rules (Simplistic example: 1st trip qualifies)
        // In production, check total trip count from DB
        const { count } = await supabase
            .from('trips')
            .select('id', { count: 'exact' })
            .eq('customer_id', userId)
            .eq('status', 'completed');

        const minTrips = program.rules_config.min_trips || 1;

        // logic: if this was the Nth trip that meets the criteria
        if ((count || 0) >= minTrips) {
            // QUALIFY!
            await this.qualifyReferral(referral, program);
        }
    }

    private static async qualifyReferral(referral: any, program: any) {
        // 1. Update Status
        await supabase
            .from('referrals')
            .update({ status: 'qualified', qualified_at: new Date().toISOString() })
            .eq('id', referral.id);

        // 2. Issue Rewards
        // Referrer Reward
        if (program.rewards_config.referrer) {
            await this.issueReward(
                referral.referrer_id,
                referral.id,
                program.id,
                program.rewards_config.referrer,
                'referrer'
            );
        }
        // Referee Reward - use referee_id from the referral, not the referral's own ID
        if (program.rewards_config.referee) {
            await this.issueReward(
                referral.referee_id,
                referral.id,
                program.id,
                program.rewards_config.referee,
                'referee'
            );
        }
    }

    private static async issueReward(
        userId: string,
        referralId: string,
        programId: string,
        rewardConfig: any,
        recipientType: string
    ) {
        const { type, amount } = rewardConfig;
        const numericAmount = Number(amount);

        // Log Reward
        await supabase.from('referral_rewards').insert({
            referral_id: referralId,
            user_id: userId,
            program_id: programId,
            type: type,
            amount: numericAmount,
            status: 'processed'
        });

        // Credit User Wallet atomically using RPC or increment pattern
        if (type === 'wallet_credit') {
            // Use Supabase's ability to do atomic increment via raw SQL
            // Fallback: read-update with optimistic approach
            const { data: user } = await supabase
                .from('users')
                .select('balance')
                .eq('id', userId)
                .single();

            if (user) {
                const currentBalance = user.balance || 0;
                const { error } = await supabase
                    .from('users')
                    .update({ balance: currentBalance + numericAmount })
                    .eq('id', userId)
                    .eq('balance', currentBalance); // Optimistic lock: only update if balance hasn't changed

                if (error) {
                    // Retry once on conflict
                    const { data: freshUser } = await supabase
                        .from('users')
                        .select('balance')
                        .eq('id', userId)
                        .single();
                    if (freshUser) {
                        await supabase
                            .from('users')
                            .update({ balance: (freshUser.balance || 0) + numericAmount })
                            .eq('id', userId);
                    }
                }

                // Log wallet transaction
                await supabase.from('wallet_transactions').insert({
                    user_id: userId,
                    amount: numericAmount,
                    type: 'referral_bonus',
                    description: `Referral Reward (${recipientType})`
                });
            }
        }
    }
}
