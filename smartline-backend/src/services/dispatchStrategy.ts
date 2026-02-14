import { matchingService, TripRequest, ScoredDriver } from './matchingService';
import { driverFilter } from './driverFilter';
import redis, { checkRedisConnection } from '../config/redis';

export enum DispatchStrategy {
  FIRST_ACCEPT = 'FIRST_ACCEPT', // Send to top drivers, first to accept wins
  BROADCAST_BID = 'BROADCAST_BID', // Send to many, collect bids, customer chooses
  SEQUENTIAL = 'SEQUENTIAL', // Send to drivers one by one
  SCHEDULED = 'SCHEDULED', // For future trips
}

export interface DispatchConfig {
  strategy: DispatchStrategy;
  maxDrivers?: number; // Max drivers to notify
  timeoutSeconds?: number; // Timeout for each round
  rounds?: number; // Number of retry rounds
}

export interface DispatchResult {
  strategy: DispatchStrategy;
  driverIds: string[];
  notifiedAt: string;
  expiresAt: string;
}

/**
 * Dispatch Strategy Service - Implements different driver notification strategies
 */
export class DispatchStrategyService {
  /**
   * FIRST_ACCEPT Strategy
   * Send trip request to top N drivers simultaneously
   * First driver to accept gets the trip
   * Ideal for: Urgent trips, high driver availability
   */
  async dispatchFirstAccept(
    tripRequest: TripRequest,
    tripId: string,
    config: { maxDrivers?: number; timeoutSeconds?: number } = {}
  ): Promise<DispatchResult> {
    const maxDrivers = config.maxDrivers || 5;
    const timeoutSeconds = config.timeoutSeconds || 15;

    // Find best drivers
    const drivers = await matchingService.findOptimalDrivers(
      tripRequest,
      maxDrivers
    );

    if (drivers.length === 0) {
      throw new Error('No eligible drivers found');
    }

    const driverIds = drivers.map((d) => d.driverId);

    // Store pending trip offers in Redis
    const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);
    await this.storePendingOffers(tripId, driverIds, expiresAt);

    // TODO: Send push notifications to all drivers
    // This will be implemented in Phase 5 with event system

    return {
      strategy: DispatchStrategy.FIRST_ACCEPT,
      driverIds,
      notifiedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * BROADCAST_BID Strategy
   */
  async dispatchBroadcastBid(
    tripRequest: TripRequest,
    tripId: string,
    config: { maxDrivers?: number; biddingTimeSeconds?: number } = {}
  ): Promise<DispatchResult> {
    const maxDrivers = config.maxDrivers || 10;
    const biddingTimeSeconds = config.biddingTimeSeconds || 30;

    // Find drivers
    const drivers = await matchingService.findOptimalDrivers(
      tripRequest,
      maxDrivers
    );

    if (drivers.length === 0) {
      throw new Error('No eligible drivers found');
    }

    const driverIds = drivers.map((d) => d.driverId);
    const expiresAt = new Date(Date.now() + biddingTimeSeconds * 1000);

    // Mark as bidding mode
    if (await checkRedisConnection()) {
      try {
        await redis.setex(`trip:${tripId}:bidding`, biddingTimeSeconds, '1');
        await this.storePendingOffers(tripId, driverIds, expiresAt);
      } catch (e) {
        console.error('Redis error in dispatchBroadcastBid:', e);
      }
    }

    return {
      strategy: DispatchStrategy.BROADCAST_BID,
      driverIds,
      notifiedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * SEQUENTIAL Strategy
   */
  async dispatchSequential(
    tripRequest: TripRequest,
    tripId: string,
    config: { timeoutSeconds?: number; maxRounds?: number } = {}
  ): Promise<DispatchResult> {
    const timeoutSeconds = config.timeoutSeconds || 10;
    const maxRounds = config.maxRounds || 5;

    // Find top drivers
    const drivers = await matchingService.findOptimalDrivers(
      tripRequest,
      maxRounds
    );

    if (drivers.length === 0) {
      throw new Error('No eligible drivers found');
    }

    // Start with first driver
    const firstDriverId = drivers[0].driverId;
    const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);

    if (await checkRedisConnection()) {
      try {
        // Store sequence in Redis
        await redis.setex(
          `trip:${tripId}:sequence`,
          maxRounds * timeoutSeconds,
          JSON.stringify(drivers.map((d) => d.driverId))
        );

        await redis.setex(
          `trip:${tripId}:current_round`,
          timeoutSeconds,
          '0' // Start at index 0
        );

        // Notify first driver
        await this.storePendingOffers(tripId, [firstDriverId], expiresAt);
      } catch (e) {
        console.error('Redis error in dispatchSequential:', e);
      }
    }

    return {
      strategy: DispatchStrategy.SEQUENTIAL,
      driverIds: [firstDriverId],
      notifiedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Get next driver in sequential dispatch
   */
  async getNextSequentialDriver(tripId: string): Promise<string | null> {
    if (!(await checkRedisConnection())) return null;

    try {
      const sequence = await redis.get(`trip:${tripId}:sequence`);
      const currentRound = await redis.get(`trip:${tripId}:current_round`);

      if (!sequence || !currentRound) {
        return null;
      }

      const driverIds = JSON.parse(sequence);
      const nextIndex = parseInt(currentRound) + 1;

      if (nextIndex >= driverIds.length) {
        return null; // No more drivers
      }

      // Update current round
      await redis.setex(`trip:${tripId}:current_round`, 60, nextIndex.toString());

      return driverIds[nextIndex];
    } catch (e) {
      console.error('Redis error in getNextSequentialDriver:', e);
      return null;
    }
  }

  /**
   * SCHEDULED Strategy
   */
  async dispatchScheduled(
    tripRequest: TripRequest,
    tripId: string,
    scheduledTime: Date
  ): Promise<DispatchResult> {
    // Calculate when to dispatch (15 minutes before)
    const dispatchTime = new Date(scheduledTime.getTime() - 15 * 60 * 1000);

    if (await checkRedisConnection()) {
      try {
        // Store scheduled dispatch job
        await redis.set(
          `trip:${tripId}:scheduled`,
          JSON.stringify({
            tripRequest,
            dispatchTime: dispatchTime.toISOString(),
            scheduledTime: scheduledTime.toISOString(),
          })
        );
      } catch (e) {
        console.error('Redis error in dispatchScheduled:', e);
      }
    }

    // TODO: Schedule job in BullMQ to run at dispatchTime
    // This will be implemented in Phase 5

    return {
      strategy: DispatchStrategy.SCHEDULED,
      driverIds: [],
      notifiedAt: dispatchTime.toISOString(),
      expiresAt: scheduledTime.toISOString(),
    };
  }

  /**
   * Retry dispatch with expanded radius
   */
  async retryDispatch(
    tripRequest: TripRequest,
    tripId: string,
    previousDriverIds: string[]
  ): Promise<DispatchResult> {
    // Expand search and exclude previous drivers
    const drivers = await matchingService.reRankDrivers(
      tripRequest,
      previousDriverIds
    );

    if (drivers.length === 0) {
      throw new Error('No additional drivers found');
    }

    const driverIds = drivers.slice(0, 5).map((d) => d.driverId);
    const expiresAt = new Date(Date.now() + 15 * 1000);

    if (await checkRedisConnection()) {
      await this.storePendingOffers(tripId, driverIds, expiresAt);
    }

    return {
      strategy: DispatchStrategy.FIRST_ACCEPT,
      driverIds,
      notifiedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Store pending offers in Redis
   */
  private async storePendingOffers(
    tripId: string,
    driverIds: string[],
    expiresAt: Date
  ): Promise<void> {
    if (!(await checkRedisConnection())) return;

    try {
      const ttlSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

      // Store set of pending drivers for this trip
      const key = `trip:${tripId}:pending_drivers`;
      await redis.sadd(key, ...driverIds);
      await redis.expire(key, ttlSeconds);

      // Store reverse mapping (driver -> pending trips)
      for (const driverId of driverIds) {
        const driverKey = `driver:${driverId}:pending_trips`;
        await redis.sadd(driverKey, tripId);
        await redis.expire(driverKey, ttlSeconds);
      }
    } catch (e) {
      console.error('Redis error in storePendingOffers:', e);
    }
  }

  /**
   * Get pending drivers for a trip
   */
  async getPendingDrivers(tripId: string): Promise<string[]> {
    if (!(await checkRedisConnection())) return [];
    try {
      const key = `trip:${tripId}:pending_drivers`;
      return await redis.smembers(key);
    } catch (e) {
      return [];
    }
  }

  /**
   * Remove driver from pending offers
   */
  async removePendingDriver(tripId: string, driverId: string): Promise<void> {
    if (!(await checkRedisConnection())) return;
    try {
      await redis.srem(`trip:${tripId}:pending_drivers`, driverId);
      await redis.srem(`driver:${driverId}:pending_trips`, tripId);
    } catch (e) { }
  }

  /**
   * Clear all pending offers for a trip
   */
  async clearPendingOffers(tripId: string): Promise<void> {
    if (!(await checkRedisConnection())) return;

    try {
      const driverIds = await this.getPendingDrivers(tripId);

      // Remove from all driver sets
      for (const driverId of driverIds) {
        await redis.srem(`driver:${driverId}:pending_trips`, tripId);
      }

      // Remove trip set
      await redis.del(`trip:${tripId}:pending_drivers`);
    } catch (e) { }
  }

  /**
   * Check if driver has pending trip offer
   */
  async hasPendingOffer(driverId: string, tripId: string): Promise<boolean> {
    if (!(await checkRedisConnection())) return false;
    try {
      const isMember = await redis.sismember(
        `driver:${driverId}:pending_trips`,
        tripId
      );
      return isMember === 1;
    } catch (e) { return false; }
  }
}

// Export singleton instance
export const dispatchStrategy = new DispatchStrategyService();
