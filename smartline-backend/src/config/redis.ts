import Redis from 'ioredis';
import { config } from './env';
import { Worker, Queue } from 'bullmq';

// Track connection state to avoid log spam
let loggedDisconnect = false;

// Redis connection configuration
const redisConfig: any = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ compatibility
  enableReadyCheck: true,
  retryStrategy(times: number) {
    if (times === 1) {
      console.warn('⚠️  Redis unavailable - running without Redis (location features disabled)');
    }
    // Retry every 30s in case Redis comes online later
    return 30000;
  },
  reconnectOnError(err: Error) {
    // Reconnect on connection reset or read-only errors
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    return targetErrors.some(e => err.message.includes(e));
  },
};

// Create Redis client instance
export const redis = config.REDIS_URL
  ? new Redis(config.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true })
  : new Redis(redisConfig);

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('ready', () => {
  loggedDisconnect = false;
  console.log('✅ Redis ready to accept commands');
});

redis.on('error', (err) => {
  if (!loggedDisconnect) {
    console.warn('⚠️  Redis error:', err.message);
    loggedDisconnect = true;
  }
});

redis.on('close', () => {
  if (!loggedDisconnect) {
    console.warn('⚠️  Redis connection closed - will attempt reconnection');
    loggedDisconnect = true;
  }
});

let lastHealthCheck: { time: number; result: boolean } | null = null;
const HEALTH_CHECK_CACHE_MS = 5000;

/**
 * Check if Redis is ready to accept commands.
 * Uses cached result within 5s window to avoid hammering Redis with pings.
 */
export async function checkRedisConnection(): Promise<boolean> {
  const now = Date.now();
  const status = (redis as any).status;

  // Fast path: if status is 'ready', connection is good
  if (status === 'ready') {
    // Still cache to avoid excessive checks
    if (lastHealthCheck && (now - lastHealthCheck.time) < HEALTH_CHECK_CACHE_MS) {
      return lastHealthCheck.result;
    }
    lastHealthCheck = { time: now, result: true };
    return true;
  }

  // If reconnecting or connecting, return false without error
  if (status === 'reconnecting' || status === 'connecting' || status === 'connect') {
    lastHealthCheck = { time: now, result: false };
    return false;
  }

  // If closed/end, return false
  if (status === 'end' || status === 'close' || status === 'wait') {
    lastHealthCheck = { time: now, result: false };
    return false;
  }

  // Return cached result if valid
  if (lastHealthCheck && (now - lastHealthCheck.time) < HEALTH_CHECK_CACHE_MS) {
    return lastHealthCheck.result;
  }

  // Unknown status - try a ping with timeout
  try {
    const pong = await Promise.race([
      redis.ping(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
    ]);
    const result = pong === 'PONG';
    lastHealthCheck = { time: now, result };
    return result;
  } catch {
    lastHealthCheck = { time: now, result: false };
    return false;
  }
}

// Get Redis info
export async function getRedisInfo() {
  try {
    const info = await redis.info('stats');
    const memory = await redis.info('memory');
    return { stats: info, memory };
  } catch (error) {
    console.error('Failed to get Redis info:', error);
    return null;
  }
}

// Graceful shutdown
export async function closeRedis(): Promise<void> {
  await redis.quit();
  console.log('Redis connection closed gracefully');
}

// Helper: Set with expiration
export async function setWithExpiry(
  key: string,
  value: string,
  expirySeconds: number
): Promise<void> {
  await redis.setex(key, expirySeconds, value);
}

// Helper: Get and parse JSON
export async function getJSON<T>(key: string): Promise<T | null> {
  const value = await redis.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Helper: Set JSON with expiration
export async function setJSON(
  key: string,
  value: any,
  expirySeconds?: number
): Promise<void> {
  const json = JSON.stringify(value);
  if (expirySeconds) {
    await redis.setex(key, expirySeconds, json);
  } else {
    await redis.set(key, json);
  }
}

export default redis;
