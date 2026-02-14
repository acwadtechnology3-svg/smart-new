import { Pool, PoolConfig } from 'pg';
import { config } from './env';

export const DIRECT_DB_DISABLED_CODE = 'DIRECT_DB_DISABLED';

// Connection pool configuration
const poolConfig: PoolConfig | null = config.DATABASE_URL ? {
  connectionString: config.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  min: 5, // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Fail fast if can't connect within 10 seconds

  // SSL configuration (required for Supabase and production)
  ssl: config.DATABASE_URL?.includes('localhost') || config.DATABASE_URL?.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false },
} : null;

// Create connection pool (only if DATABASE_URL is set)
export const pool = poolConfig ? new Pool(poolConfig) : null;
let directDatabaseDisabledReason: string | null = null;

if (!pool) {
  console.warn('⚠️  DATABASE_URL not set - Direct database queries will fail. Using Supabase REST API only.');
}

// Handle pool errors
if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
  });
}

function shouldDisableDirectDatabase(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const pgError = error as { code?: string; message?: string };
  const message = (pgError.message || '').toLowerCase();

  if (message.includes('tenant or user not found')) {
    return true;
  }

  return pgError.code === '28P01' || pgError.code === '3D000';
}

function disableDirectDatabase(reason: string) {
  if (directDatabaseDisabledReason) {
    return;
  }

  directDatabaseDisabledReason = reason;
  console.warn(
    `Direct PostgreSQL disabled: ${reason}. Falling back to Supabase REST queries.`
  );
}

function createDirectDatabaseDisabledError(): Error & { code: string } {
  const error = new Error(
    directDatabaseDisabledReason
      ? `Direct database disabled: ${directDatabaseDisabledReason}`
      : 'Direct database disabled'
  ) as Error & { code: string };
  error.code = DIRECT_DB_DISABLED_CODE;
  return error;
}

export function isDirectDatabaseEnabled(): boolean {
  return !!pool && !directDatabaseDisabledReason;
}

// Connection health check
export async function checkDatabaseConnection(): Promise<boolean> {
  if (!pool || directDatabaseDisabledReason) return false;
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Get pool statistics
export function getPoolStats() {
  if (!pool) return { total: 0, idle: 0, waiting: 0 };
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    console.log('Database pool closed');
  }
}

// Query helper with timeout
export async function query(text: string, params?: any[], timeout: number = 10000) {
  if (!pool) {
    throw new Error('Database pool not initialized. Set DATABASE_URL in environment variables.');
  }
  if (directDatabaseDisabledReason) {
    throw createDirectDatabaseDisabledError();
  }

  const start = Date.now();

  try {
    const client = await pool.connect();

    try {
      // Set statement timeout
      await client.query(`SET statement_timeout = ${timeout}`);

      const result = await client.query(text, params);
      const duration = Date.now() - start;

      // Log slow queries
      if (duration > 1000) {
        console.warn(`Slow query (${duration}ms):`, text);
      }

      return result;
    } finally {
      client.release();
    }
  } catch (error: any) {
    const duration = Date.now() - start;

    if (shouldDisableDirectDatabase(error)) {
      disableDirectDatabase(error.message || 'Direct database authentication failed');
      throw createDirectDatabaseDisabledError();
    }

    console.error(`Query error (${duration}ms):`, error.message);
    throw error;
  }
}

// Transaction helper
export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  if (!pool) {
    throw new Error('Database pool not initialized. Set DATABASE_URL in environment variables.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
