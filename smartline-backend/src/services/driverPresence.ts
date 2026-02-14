import redis, { checkRedisConnection } from '../config/redis';
import { locationCache } from './locationCache';

const ONLINE_KEY_PREFIX = 'driver:';
const ONLINE_KEY_SUFFIX = ':online';
const PRESENCE_TTL = 120; // 120 seconds - matches locationCache online TTL

/**
 * Driver Presence Service - Manages driver online/offline status
 * Uses Redis keys with TTL for automatic offline detection
 */
export class DriverPresenceService {
  /**
   * Mark driver as online
   * Refreshes TTL on each call
   */
  async setOnline(driverId: string): Promise<boolean> {
    if (!(await checkRedisConnection())) return false;
    try {
      const key = `${ONLINE_KEY_PREFIX}${driverId}${ONLINE_KEY_SUFFIX}`;
      await redis.set(key, '1', 'EX', PRESENCE_TTL);
      return true;
    } catch (error) {
      console.error('Failed to set driver online:', error);
      return false;
    }
  }

  /**
   * Explicitly mark driver as offline
   * Removes from location cache
   */
  async setOffline(driverId: string): Promise<boolean> {
    if (!(await checkRedisConnection())) return false;
    try {
      const key = `${ONLINE_KEY_PREFIX}${driverId}${ONLINE_KEY_SUFFIX}`;
      await redis.del(key);

      // Also remove from location cache
      await locationCache.removeDriver(driverId);

      return true;
    } catch (error) {
      console.error('Failed to set driver offline:', error);
      return false;
    }
  }

  /**
   * Check if driver is currently online
   */
  async isOnline(driverId: string): Promise<boolean> {
    if (!(await checkRedisConnection())) return false;
    try {
      const key = `${ONLINE_KEY_PREFIX}${driverId}${ONLINE_KEY_SUFFIX}`;
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('Failed to check driver online status:', error);
      return false;
    }
  }

  /**
   * Get TTL remaining for driver's online status
   * Returns -1 if key doesn't exist or has no expiry
   */
  async getTimeRemaining(driverId: string): Promise<number> {
    if (!(await checkRedisConnection())) return -1;
    try {
      const key = `${ONLINE_KEY_PREFIX}${driverId}${ONLINE_KEY_SUFFIX}`;
      const ttl = await redis.ttl(key);
      return ttl;
    } catch (error) {
      console.error('Failed to get TTL:', error);
      return -1;
    }
  }

  /**
   * Refresh driver's online TTL (extend online time)
   * Called on each location update
   */
  async refreshPresence(driverId: string): Promise<boolean> {
    if (!(await checkRedisConnection())) return false;
    try {
      const key = `${ONLINE_KEY_PREFIX}${driverId}${ONLINE_KEY_SUFFIX}`;
      const exists = await redis.exists(key);

      if (exists) {
        await redis.expire(key, PRESENCE_TTL);
        return true;
      }

      // If key doesn't exist, create it
      await this.setOnline(driverId);
      return true;
    } catch (error) {
      console.error('Failed to refresh presence:', error);
      return false;
    }
  }

  /**
   * Scan for online driver keys using SCAN (production-safe, non-blocking)
   */
  private async scanOnlineKeys(): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const result = await redis.scan(cursor, 'MATCH', `${ONLINE_KEY_PREFIX}*${ONLINE_KEY_SUFFIX}`, 'COUNT', '100');
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');
    return keys;
  }

  /**
   * Get count of currently online drivers
   */
  async getOnlineCount(): Promise<number> {
    if (!(await checkRedisConnection())) return 0;
    try {
      const keys = await this.scanOnlineKeys();
      return keys.length;
    } catch (error) {
      console.error('Failed to get online count:', error);
      return 0;
    }
  }

  /**
   * Get all online driver IDs
   */
  async getOnlineDriverIds(): Promise<string[]> {
    if (!(await checkRedisConnection())) return [];
    try {
      const keys = await this.scanOnlineKeys();
      return keys.map(key =>
        key
          .replace(ONLINE_KEY_PREFIX, '')
          .replace(ONLINE_KEY_SUFFIX, '')
      );
    } catch (error) {
      console.error('Failed to get online driver IDs:', error);
      return [];
    }
  }

  /**
   * Batch check online status for multiple drivers
   */
  async areManyOnline(driverIds: string[]): Promise<Map<string, boolean>> {
    if (!(await checkRedisConnection())) return new Map();
    try {
      const pipeline = redis.pipeline();
      const statusMap = new Map<string, boolean>();

      for (const driverId of driverIds) {
        const key = `${ONLINE_KEY_PREFIX}${driverId}${ONLINE_KEY_SUFFIX}`;
        pipeline.exists(key);
      }

      const results = await pipeline.exec();

      if (results) {
        driverIds.forEach((driverId, index) => {
          const [err, exists] = results[index];
          statusMap.set(driverId, !err && exists === 1);
        });
      }

      return statusMap;
    } catch (error) {
      console.error('Failed to check multiple drivers:', error);
      return new Map();
    }
  }

  /**
   * Cleanup expired drivers from location cache
   * Should be called periodically by a background job
   */
  async cleanupStaleDrivers(): Promise<number> {
    if (!(await checkRedisConnection())) return 0;
    try {
      return await locationCache.cleanupStaleDrivers();
    } catch (error) {
      console.error('Failed to cleanup stale drivers:', error);
      return 0;
    }
  }

  /**
   * Get presence statistics
   */
  async getStats() {
    if (!(await checkRedisConnection())) return null;
    try {
      const onlineCount = await this.getOnlineCount();
      const locationCount = await locationCache.getDriverCount();

      return {
        onlineDrivers: onlineCount,
        driversWithLocation: locationCount,
        presenceTTL: PRESENCE_TTL,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get presence stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const driverPresence = new DriverPresenceService();
