import fs from 'fs';
import path from 'path';
import { pool, query } from '../config/database';

// Migration tracking table
const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

// Get all migration files
function getMigrationFiles(): string[] {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir);

  return files
    .filter(file => file.endsWith('.sql'))
    .sort(); // Ensures migrations run in order
}

// Check if migration has been executed
async function isMigrationExecuted(name: string): Promise<boolean> {
  const result = await query(
    'SELECT COUNT(*) FROM schema_migrations WHERE name = $1',
    [name]
  );
  return parseInt(result.rows[0].count) > 0;
}

// Record migration execution
async function recordMigration(name: string): Promise<void> {
  await query(
    'INSERT INTO schema_migrations (name) VALUES ($1)',
    [name]
  );
}

// Execute a single migration
async function executeMigration(filename: string): Promise<void> {
  const migrationPath = path.join(__dirname, 'migrations', filename);
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log(`Running migration: ${filename}...`);

  try {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }
    // Execute migration in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        [filename]
      );
      await client.query('COMMIT');
      console.log(`✅ Migration ${filename} completed successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error(`❌ Migration ${filename} failed:`, error.message);
    throw error;
  }
}

// Main migration function
export async function runMigrations(): Promise<void> {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 Starting database migrations...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Create migrations tracking table
    await query(MIGRATIONS_TABLE);

    // Get all migration files
    const migrationFiles = getMigrationFiles();

    if (migrationFiles.length === 0) {
      console.log('No migrations found');
      return;
    }

    console.log(`Found ${migrationFiles.length} migration(s)\n`);

    let executed = 0;
    let skipped = 0;

    // Execute each migration
    for (const filename of migrationFiles) {
      const isExecuted = await isMigrationExecuted(filename);

      if (isExecuted) {
        console.log(`⏭️  Skipping ${filename} (already executed)`);
        skipped++;
        continue;
      }

      await executeMigration(filename);
      executed++;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Migrations completed!`);
    console.log(`   Executed: ${executed}`);
    console.log(`   Skipped: ${skipped}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Migration failed:', error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    throw error;
  }
}

// List executed migrations
export async function listMigrations(): Promise<void> {
  try {
    await query(MIGRATIONS_TABLE);

    const result = await query(
      'SELECT name, executed_at FROM schema_migrations ORDER BY executed_at DESC'
    );

    console.log('\n📋 Executed migrations:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (result.rows.length === 0) {
      console.log('No migrations have been executed yet');
    } else {
      result.rows.forEach(row => {
        const date = new Date(row.executed_at).toLocaleString();
        console.log(`✅ ${row.name} (${date})`);
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error: any) {
    console.error('Error listing migrations:', error.message);
    throw error;
  }
}

// Rollback last migration (dangerous - use with caution)
export async function rollbackLastMigration(): Promise<void> {
  console.warn('⚠️  WARNING: Rollback functionality is not implemented');
  console.warn('   Migrations should be written to be idempotent');
  console.warn('   Manual rollback may be required\n');
}

// CLI execution
if (require.main === module) {
  const command = process.argv[2];

  (async () => {
    try {
      switch (command) {
        case 'up':
        case 'run':
          await runMigrations();
          break;
        case 'list':
          await listMigrations();
          break;
        case 'rollback':
          await rollbackLastMigration();
          break;
        default:
          console.log('Usage: npm run migrate [up|list|rollback]');
      }
      process.exit(0);
    } catch (error) {
      process.exit(1);
    }
  })();
}
