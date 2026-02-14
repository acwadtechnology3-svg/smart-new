
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load env just in case, but we will define URL manually
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testConnection() {
    const projectRef = 'sxadrmfixlzsettqjntf';
    // Password must be URL encoded in connection string if special chars exist
    const password = 'Sklans2003ezzat%40';
    const directUrl = `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;

    console.log('Testing direct connection to:', directUrl.replace(/:[^:@]*@/, ':****@'));

    const client = new Client({
        connectionString: directUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
    });

    try {
        await client.connect();
        console.log('✅ Connection successful!');
        const res = await client.query('SELECT NOW()');
        console.log('Server time:', res.rows[0]);
        await client.end();
    } catch (err: any) {
        console.error('❌ Connection failed:', err);
        if (err.code) console.error('Error code:', err.code);
    }
}

testConnection();
