import { driverPresence } from './driverPresence';
import { DriverRepository } from '../repositories/DriverRepository';
import redis, { checkRedisConnection } from '../config/redis';

const driverRepo = new DriverRepository();

export interface FilterCriteria {
  requiredVehicleType?: string;
  minRating?: number;
  maxDistance?: number; // meters
  excludeDriverIds?: string[];
  customerId?: string; // For blocked drivers check
}

/**
 * Driver Filter Service - Determines driver eligibility for trips
 */
export class DriverFilterService {
  private readonly LOCATION_FRESHNESS_SECONDS = 60; // Max age of last location update
  private readonly COOLDOWN_PERIOD_SECONDS = 60; // Cooldown after completing trip

  /**
   * Filter drivers based on eligibility criteria
   */
  async filterEligibleDrivers(
    driverIds: string[],
    criteria: FilterCriteria = {}
  ): Promise<string[]> {
    const eligibleDrivers: string[] = [];

    for (const driverId of driverIds) {
      const isEligible = await this.isDriverEligible(driverId, criteria);
      if (isEligible) {
        eligibleDrivers.push(driverId);
      }
    }

    return eligibleDrivers;
  }

  /**
   * Check if a single driver is eligible
   */
  async isDriverEligible(
    driverId: string,
    criteria: FilterCriteria = {}
  ): Promise<boolean> {
    try {
      // 1. Must be online (checked via presence TTL)
      const isOnline = await driverPresence.isOnline(driverId);
      if (!isOnline) {
        return false;
      }

      // 2. Get driver data from database
      const driver = await driverRepo.findById(driverId);
      if (!driver) {
        return false;
      }

      // 3. Must be approved
      if (driver.status !== 'approved') {
        return false;
      }

      // 4. Location must be fresh (updated recently)
      const lastUpdate = new Date(driver.last_location_update);
      const secondsSinceUpdate =
        (Date.now() - lastUpdate.getTime()) / 1000;

      if (secondsSinceUpdate > this.LOCATION_FRESHNESS_SECONDS) {
        return false;
      }

      // 5. Check vehicle type if specified
      if (
        criteria.requiredVehicleType &&
        !this.isVehicleTypeMatch(driver.vehicle_type, criteria.requiredVehicleType)
      ) {
        return false;
      }

      // 6. Check minimum rating
      if (criteria.minRating && driver.rating < criteria.minRating) {
        return false;
      }

      // 7. Must not be on active trip
      const hasActiveTrip = await this.hasActiveTrip(driverId);
      if (hasActiveTrip) {
        return false;
      }

      // 8. Must not be in cooldown period
      const isInCooldown = await this.isInCooldown(driverId);
      if (isInCooldown) {
        return false;
      }

      // 9. Must not be in excluded list
      if (criteria.excludeDriverIds?.includes(driverId)) {
        return false;
      }

      // 10. Must not be blocked by customer
      if (criteria.customerId) {
        const isBlocked = await this.isBlockedByCustomer(
          driverId,
          criteria.customerId
        );
        if (isBlocked) {
          return false;
        }
      }

      // 11. Account must be in good standing
      const isInGoodStanding = await this.isInGoodStanding(driverId);
      if (!isInGoodStanding) {
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error checking driver eligibility ${driverId}:`, error);
      return false;
    }
  }

  /**
   * Check if vehicle type matches or is acceptable substitute
   */
  private isVehicleTypeMatch(
    driverVehicle: string,
    requestedVehicle: string
  ): boolean {
    // Exact match
    if (driverVehicle === requestedVehicle) {
      return true;
    }

    // Vehicle tier hierarchy (higher tier can fulfill lower tier request)
    const tiers = ['economy', 'comfort', 'premium', 'xl'];
    const driverTier = tiers.indexOf(driverVehicle);
    const requestedTier = tiers.indexOf(requestedVehicle);

    // Higher tier vehicle can accept lower tier request
    return driverTier > requestedTier;
  }

  /**
   * Check if driver has an active trip
   */
  private async hasActiveTrip(driverId: string): Promise<boolean> {
    if (!(await checkRedisConnection())) return false;
    try {
      // Check Redis for active trip marker
      const activeTripKey = `driver:${driverId}:active_trip`;
      const hasTrip = await redis.exists(activeTripKey);
      return hasTrip === 1;
    } catch (error) {
      console.error('Error checking active trip:', error);
      return false;
    }
  }

  /**
   * Check if driver is in cooldown period (after completing trip)
   */
  private async isInCooldown(driverId: string): Promise<boolean> {
    if (!(await checkRedisConnection())) return false;
    try {
      const cooldownKey = `driver:${driverId}:cooldown`;
      const inCooldown = await redis.exists(cooldownKey);
      return inCooldown === 1;
    } catch (error) {
      console.error('Error checking cooldown:', error);
      return false;
    }
  }

  /**
   * Set driver cooldown period
   */
  async setCooldown(driverId: string, durationSeconds?: number): Promise<void> {
    if (!(await checkRedisConnection())) return;
    try {
      const cooldownKey = `driver:${driverId}:cooldown`;
      await redis.setex(
        cooldownKey,
        durationSeconds || this.COOLDOWN_PERIOD_SECONDS,
        '1'
      );
    } catch (error) {
      console.error('Error setting cooldown:', error);
    }
  }

  /**
   * Check if driver is blocked by specific customer
   */
  private async isBlockedByCustomer(
    driverId: string,
    customerId: string
  ): Promise<boolean> {
    if (!(await checkRedisConnection())) return false;
    try {
      // Check Redis set of blocked drivers for this customer
      const blockedKey = `customer:${customerId}:blocked_drivers`;
      const isBlocked = await redis.sismember(blockedKey, driverId);
      return isBlocked === 1;
    } catch (error) {
      console.error('Error checking blocked status:', error);
      return false;
    }
  }

  /**
   * Check if driver account is in good standing
   */
  private async isInGoodStanding(driverId: string): Promise<boolean> {
    if (!(await checkRedisConnection())) return true;
    try {
      // Check for fraud flags or account issues
      const flagKey = `driver:${driverId}:fraud_flag`;
      const hasFraudFlag = await redis.exists(flagKey);

      if (hasFraudFlag === 1) {
        return false;
      }

      // Additional checks can be added here
      // - Recent cancellations rate
      // - Customer complaints
      // - Payment issues

      return true;
    } catch (error) {
      console.error('Error checking good standing:', error);
      return true; // Default to true on error
    }
  }

  /**
   * Mark driver as having active trip
   */
  async setActiveTrip(driverId: string, tripId: string): Promise<void> {
    if (!(await checkRedisConnection())) return;
    try {
      const activeTripKey = `driver:${driverId}:active_trip`;
      await redis.set(activeTripKey, tripId);
    } catch (error) {
      console.error('Error setting active trip:', error);
    }
  }

  /**
   * Clear driver's active trip marker
   */
  async clearActiveTrip(driverId: string): Promise<void> {
    if (!(await checkRedisConnection())) return;
    try {
      const activeTripKey = `driver:${driverId}:active_trip`;
      await redis.del(activeTripKey);
    } catch (error) {
      console.error('Error clearing active trip:', error);
    }
  }

  /**
   * Get eligibility report for debugging
   */
  async getEligibilityReport(driverId: string): Promise<any> {
    const isOnline = await driverPresence.isOnline(driverId);
    const driver = await driverRepo.findById(driverId);
    const hasActiveTrip = await this.hasActiveTrip(driverId);
    const isInCooldown = await this.isInCooldown(driverId);
    const isInGoodStanding = await this.isInGoodStanding(driverId);

    return {
      driverId,
      isOnline,
      status: driver?.status,
      rating: driver?.rating,
      lastLocationUpdate: driver?.last_location_update,
      hasActiveTrip,
      isInCooldown,
      isInGoodStanding,
      overall: await this.isDriverEligible(driverId),
    };
  }
}

// Export singleton instance
export const driverFilter = new DriverFilterService();
