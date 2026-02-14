import redis, { checkRedisConnection } from '../config/redis';

const DRIVER_LOCATIONS_KEY = 'driver:locations'; // Geo set for all driver locations
const DRIVER_META_PREFIX = 'driver:'; // Hash for driver metadata
const DRIVER_ONLINE_PREFIX = 'driver:'; // String for online status with TTL

export interface DriverLocation {
  driverId: string;
  lat: number;
  lng: number;
  distance?: number;
}

export interface DriverMetadata {
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp: string;
  vehicleType?: string;
  rating?: number;
}

export interface NearbyDriver extends DriverLocation {
  metadata?: DriverMetadata;
}

/**
 * Location Cache Service - High-performance location storage using Redis
 * Uses Redis Geospatial data structures for sub-millisecond queries
 */
export class LocationCacheService {
  /**
   * Update driver location in Redis
   * @returns true if successful
   */
  async updateDriverLocation(
    driverId: string,
    lat: number,
    lng: number,
    metadata?: Partial<DriverMetadata>
  ): Promise<boolean> {
    if (!(await checkRedisConnection())) return false;
    try {
      const pipeline = redis.pipeline();

      // Add/update location in geospatial set
      pipeline.geoadd(DRIVER_LOCATIONS_KEY, lng, lat, driverId);

      // Store metadata in hash
      if (metadata) {
        const metaKey = `${DRIVER_META_PREFIX}${driverId}:meta`;
        const metaData = {
          ...metadata,
          timestamp: metadata.timestamp || new Date().toISOString(),
        };
        pipeline.hmset(metaKey, metaData as any);
        pipeline.expire(metaKey, 300); // 5 minutes TTL
      }

      // Mark driver as online with TTL (auto-expires if no updates)
      const onlineKey = `${DRIVER_ONLINE_PREFIX}${driverId}:online`;
      pipeline.set(onlineKey, '1', 'EX', 120); // 120 seconds TTL (supports low battery mode)

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Failed to update driver location:', error);
      return false;
    }
  }

  /**
   * Get nearby drivers within radius
   * Uses pipelining for O(1) round trips instead of O(n)
   */
  async getNearbyDrivers(
    lat: number,
    lng: number,
    radiusKm: number = 5,
    limit: number = 50
  ): Promise<NearbyDriver[]> {
    if (!(await checkRedisConnection())) return [];
    try {
      const results = await redis.georadius(
        DRIVER_LOCATIONS_KEY,
        lng,
        lat,
        radiusKm,
        'km',
        'WITHDIST',
        'WITHCOORD',
        'ASC',
        'COUNT',
        limit
      );

      if (!results || results.length === 0) {
        return [];
      }

      // Parse geo results
      const candidates = (results as any[]).map(result => {
        const [driverId, distance, coordinates] = result as [string, string, [string, string]];
        return { driverId, distance, coordinates };
      });

      // Pipeline: check online status + get metadata for all drivers at once
      const pipeline = redis.pipeline();
      for (const c of candidates) {
        pipeline.exists(`${DRIVER_ONLINE_PREFIX}${c.driverId}:online`);
        pipeline.hgetall(`${DRIVER_META_PREFIX}${c.driverId}:meta`);
      }
      const pipeResults = await pipeline.exec();
      if (!pipeResults) return [];

      const drivers: NearbyDriver[] = [];
      const staleDriverIds: string[] = [];

      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const isOnline = pipeResults[i * 2]?.[1] === 1;
        const metadata = (pipeResults[i * 2 + 1]?.[1] as any) || {};

        if (!isOnline) {
          staleDriverIds.push(c.driverId);
          continue;
        }

        drivers.push({
          driverId: c.driverId,
          lat: parseFloat(c.coordinates[1]),
          lng: parseFloat(c.coordinates[0]),
          distance: parseFloat(c.distance) * 1000,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        });
      }

      // Clean up stale drivers in background (don't await)
      if (staleDriverIds.length > 0) {
        Promise.all(staleDriverIds.map(id => this.removeDriver(id))).catch(() => {});
      }

      return drivers;
    } catch (error) {
      console.error('Failed to get nearby drivers:', error);
      return [];
    }
  }

  /**
   * Get specific driver's location
   */
  async getDriverLocation(driverId: string): Promise<DriverLocation | null> {
    if (!(await checkRedisConnection())) return null;
    try {
      const result = await redis.geopos(DRIVER_LOCATIONS_KEY, driverId);

      if (!result || !result[0]) {
        return null;
      }

      const [lng, lat] = result[0];

      return {
        driverId,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      };
    } catch (error) {
      console.error('Failed to get driver location:', error);
      return null;
    }
  }

  /**
   * Get driver metadata
   */
  async getDriverMetadata(driverId: string): Promise<DriverMetadata | null> {
    if (!(await checkRedisConnection())) return null;
    try {
      const metaKey = `${DRIVER_META_PREFIX}${driverId}:meta`;
      const metadata = await redis.hgetall(metaKey);

      if (Object.keys(metadata).length === 0) {
        return null;
      }

      return metadata as any;
    } catch (error) {
      console.error('Failed to get driver metadata:', error);
      return null;
    }
  }

  /**
   * Remove driver from location cache
   */
  async removeDriver(driverId: string): Promise<boolean> {
    if (!(await checkRedisConnection())) return false;
    try {
      const pipeline = redis.pipeline();

      // Remove from geo set
      pipeline.zrem(DRIVER_LOCATIONS_KEY, driverId);

      // Remove metadata
      pipeline.del(`${DRIVER_META_PREFIX}${driverId}:meta`);

      // Remove online status
      pipeline.del(`${DRIVER_ONLINE_PREFIX}${driverId}:online`);

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Failed to remove driver:', error);
      return false;
    }
  }

  /**
   * Get count of drivers in cache
   */
  async getDriverCount(): Promise<number> {
    if (!(await checkRedisConnection())) return 0;
    try {
      const count = await redis.zcard(DRIVER_LOCATIONS_KEY);
      return count;
    } catch (error) {
      console.error('Failed to get driver count:', error);
      return 0;
    }
  }

  /**
   * Get all online driver IDs (uses SCAN, production-safe)
   */
  async getOnlineDriverIds(): Promise<string[]> {
    if (!(await checkRedisConnection())) return [];
    try {
      const keys: string[] = [];
      let cursor = '0';
      do {
        const result = await redis.scan(cursor, 'MATCH', `${DRIVER_ONLINE_PREFIX}*:online`, 'COUNT', '100');
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      return keys.map(key => key.replace(`${DRIVER_ONLINE_PREFIX}`, '').replace(':online', ''));
    } catch (error) {
      console.error('Failed to get online driver IDs:', error);
      return [];
    }
  }

  /**
   * Cleanup stale drivers (for maintenance) - uses pipeline for efficiency
   */
  async cleanupStaleDrivers(): Promise<number> {
    if (!(await checkRedisConnection())) return 0;
    try {
      const allDrivers = await redis.zrange(DRIVER_LOCATIONS_KEY, 0, -1);
      if (allDrivers.length === 0) return 0;

      // Pipeline check all online statuses at once
      const pipeline = redis.pipeline();
      for (const driverId of allDrivers) {
        pipeline.exists(`${DRIVER_ONLINE_PREFIX}${driverId}:online`);
      }
      const results = await pipeline.exec();
      if (!results) return 0;

      const staleIds: string[] = [];
      allDrivers.forEach((driverId, idx) => {
        if (results[idx]?.[1] !== 1) {
          staleIds.push(driverId);
        }
      });

      // Remove stale drivers
      for (const driverId of staleIds) {
        await this.removeDriver(driverId);
      }

      if (staleIds.length > 0) {
        console.log(`Cleaned up ${staleIds.length} stale drivers`);
      }
      return staleIds.length;
    } catch (error) {
      console.error('Failed to cleanup stale drivers:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const locationCache = new LocationCacheService();
