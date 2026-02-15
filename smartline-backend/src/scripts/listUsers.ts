
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

async function listUsers() {
    console.log("--- Recent Users ---");
    const { data: users } = await supabase
        .from('users')
        .select('id, full_name, email, phone, balance, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
    
    users?.forEach(u => {
        console.log(`[${u.created_at}] ${u.full_name || 'No Name'} (${u.email}) | Bal: ${u.balance} | ID: ${u.id}`);
    });
}

listUsers();
