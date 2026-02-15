
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

async function debug() {
    console.log("--- Last 5 Users ---");
    const { data: users } = await supabase
        .from('users')
        .select('id, email, phone, balance, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
    console.table(users);

    console.log("\n--- Last 10 Transactions ---");
    const { data: txs } = await supabase
        .from('wallet_transactions')
        .select('id, user_id, amount, type, status, created_at, description')
        .order('created_at', { ascending: false })
        .limit(10);

    // console.table(txs);
    txs?.forEach(tx => {
        console.log(`[${tx.created_at}] ${tx.type} | ${tx.status} | ${tx.amount} | User: ${tx.user_id}`);
        console.log(`Desc: ${tx.description}\n`);
    });
}

debug();
