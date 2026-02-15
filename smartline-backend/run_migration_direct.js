require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse original connection string to extract password
const original = process.env.DATABASE_URL;
const passwordMatch = original.match(/:([^:@]+)@/);
const password = passwordMatch ? passwordMatch[1] : '';
// The password might be URL encoded in the original string?
// Sklans2003ezzat%40 -> Sklans2003ezzat@
const decodedPassword = decodeURIComponent(password);

// Construct direct connection string
const projectRef = 'sxadrmfixlzsettqjntf';
const directConnectionString = `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;

console.log('Trying direct connection:', directConnectionString.replace(password, '****'));

const pool = new Pool({
    connectionString: directConnectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const sqlFile = process.argv[2];
    if (!sqlFile) {
        console.error('Usage: node run_migration_direct.js <filename>');
        process.exit(1);
    }

    const sqlPath = path.resolve(__dirname, 'src/db/migrations', sqlFile);
    console.log('Running migration:', sqlFile);

    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('COMMIT');
            console.log('✅ Migration successful');
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('❌ Migration failed:', e);
        } finally {
            client.release();
        }
    } catch (e) {
        console.error('Error reading/executing:', e);
    } finally {
        pool.end();
    }
}

run();
