require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    console.log('Checking users table...');
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    if (users && users.length > 0) {
        const user = users[0];
        console.log('User keys:', Object.keys(user));
        if ('preferences' in user) {
            console.log('✅ preferences column exists');
        } else {
            console.log('❌ preferences column MISSING');
        }
    } else {
        console.log('No users found to check schema');
    }
}

check();
