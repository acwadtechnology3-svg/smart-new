import redis from '../config/redis';

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
   * @param lat Latitude
   * @param lng Longitude
   * @param radiusKm Radius in kilometers
   * @param limit Maximum number of results
   * @returns Array of nearby drivers sorted by distance
   */
  async getNearbyDrivers(
    lat: number,
    lng: number,
    radiusKm: number = 5,
    limit: number = 50
  ): Promise<NearbyDriver[]> {
    try {
      // Use GEORADIUS to find nearby drivers
      const results = await redis.georadius(
        DRIVER_LOCATIONS_KEY,
        lng,
        lat,
        radiusKm,
        'km',
        'WITHDIST',
        'WITHCOORD',
        'ASC', // Sort by distance ascending
        'COUNT',
        limit
      );

      if (!results || results.length === 0) {
        return [];
      }

      // Format results
      const drivers: NearbyDriver[] = [];

      for (const result of results) {
        const [driverId, distance, coordinates] = result as [string, string, [string, string]];

        // Check if driver is still online (key exists and not expired)
        const onlineKey = `${DRIVER_ONLINE_PREFIX}${driverId}:online`;
        const isOnline = await redis.exists(onlineKey);

        if (!isOnline) {
          // Driver's TTL expired, remove from geo set
          await this.removeDriver(driverId);
          continue;
        }

        // Get metadata
        const metaKey = `${DRIVER_META_PREFIX}${driverId}:meta`;
        const metadata = await redis.hgetall(metaKey);

        drivers.push({
          driverId,
          lat: parseFloat(coordinates[1]),
          lng: parseFloat(coordinates[0]),
          distance: parseFloat(distance) * 1000, // Convert km to meters
          metadata: Object.keys(metadata).length > 0 ? (metadata as any) : undefined,
        });
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
    try {
      const count = await redis.zcard(DRIVER_LOCATIONS_KEY);
      return count;
    } catch (error) {
      console.error('Failed to get driver count:', error);
      return 0;
    }
  }

  /**
   * Get all online driver IDs
   */
  async getOnlineDriverIds(): Promise<string[]> {
    try {
      const keys = await redis.keys(`${DRIVER_ONLINE_PREFIX}*:online`);
      return keys.map(key => key.replace(`${DRIVER_ONLINE_PREFIX}`, '').replace(':online', ''));
    } catch (error) {
      console.error('Failed to get online driver IDs:', error);
      return [];
    }
  }

  /**
   * Cleanup stale drivers (for maintenance)
   */
  async cleanupStaleDrivers(): Promise<number> {
    try {
      let cleanedCount = 0;
      const allDrivers = await redis.zrange(DRIVER_LOCATIONS_KEY, 0, -1);

      for (const driverId of allDrivers) {
        const onlineKey = `${DRIVER_ONLINE_PREFIX}${driverId}:online`;
        const isOnline = await redis.exists(onlineKey);

        if (!isOnline) {
          await this.removeDriver(driverId);
          cleanedCount++;
        }
      }

      console.log(`Cleaned up ${cleanedCount} stale drivers`);
      return cleanedCount;
    } catch (error) {
      console.error('Failed to cleanup stale drivers:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const locationCache = new LocationCacheService();
