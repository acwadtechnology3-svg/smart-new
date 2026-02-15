require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL is not defined in .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
    const sqlFile = process.argv[2];
    if (!sqlFile) {
        console.error('Usage: node run_migration_manual.js <filename>');
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
