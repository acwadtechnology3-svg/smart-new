import { locationCache, NearbyDriver } from './locationCache';
import { driverPresence } from './driverPresence';
import { DriverRepository } from '../repositories/DriverRepository';
import { supabase } from '../config/supabase';

const driverRepo = new DriverRepository();

// Haversine distance calculation (meters)
function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export interface TripRequest {
  customerId: string;
  pickupLat: number;
  pickupLng: number;
  destLat: number;
  destLng: number;
  vehicleType: string;
  pickupAddress: string;
  destAddress: string;
}

export interface ScoredDriver {
  driverId: string;
  score: number;
  distance: number; // meters
  lat: number;
  lng: number;
  rating: number;
  acceptanceRate: number;
  completionRate: number;
  vehicleType: string;
  vehicleModel: string;
  breakdown: {
    distanceScore: number;
    ratingScore: number;
    acceptanceScore: number;
    completionScore: number;
    vehicleMatchScore: number;
    repeatCustomerScore: number;
  };
}

/**
 * Matching Service - Intelligent driver matching and ranking
 * Uses multi-factor scoring to find optimal drivers for trips
 */
export class MatchingService {
  // Scoring weights (must sum to 1.0)
  private readonly WEIGHTS = {
    DISTANCE: 0.40, // 40% - Proximity is most important
    RATING: 0.20, // 20% - Driver quality
    ACCEPTANCE_RATE: 0.15, // 15% - Reliability
    COMPLETION_RATE: 0.10, // 10% - Trip completion success
    VEHICLE_MATCH: 0.10, // 10% - Exact vehicle type match
    REPEAT_CUSTOMER: 0.05, // 5% - Previous positive interaction
  };

  private readonly MAX_SEARCH_RADIUS_KM = 10; // Maximum search radius
  private readonly MIN_RATING = 3.0; // Minimum acceptable rating

  /**
   * Find and rank optimal drivers for a trip request
   */
  async findOptimalDrivers(
    tripRequest: TripRequest,
    limit: number = 10
  ): Promise<ScoredDriver[]> {
    try {
      // Step 1: Try to get nearby drivers from Redis (fast geospatial query)
      let nearbyDrivers = await locationCache.getNearbyDrivers(
        tripRequest.pickupLat,
        tripRequest.pickupLng,
        this.MAX_SEARCH_RADIUS_KM,
        50
      );

      // Step 1b: If Redis fails (empty result), fallback to database PostGIS query
      if (nearbyDrivers.length === 0) {
        console.log('[MatchingService] Redis cache empty, using database fallback');
        const dbDrivers = await driverRepo.findNearbyOnlineDrivers(
          tripRequest.pickupLat,
          tripRequest.pickupLng,
          this.MAX_SEARCH_RADIUS_KM,
          tripRequest.vehicleType,
          50
        );
        
        // Convert to NearbyDriver format
        nearbyDrivers = dbDrivers.map(d => ({
          driverId: d.driver_id,
          lat: d.current_lat,
          lng: d.current_lng,
          distance: d.distance_meters,
        }));
      }

      if (nearbyDrivers.length === 0) {
        return [];
      }

      // Step 2: Enrich with database data and calculate scores
      const scoredDrivers: ScoredDriver[] = [];

      for (const nearbyDriver of nearbyDrivers) {
        // Get full driver data from database
        const driverData = await driverRepo.findById(nearbyDriver.driverId);

        if (!driverData) continue;

        // Apply filters
        if (!this.isEligible(driverData, tripRequest)) {
          continue;
        }

        // Calculate score
        const scored = await this.calculateDriverScore(
          nearbyDriver,
          driverData,
          tripRequest
        );

        scoredDrivers.push(scored);
      }

      // Step 3: Sort by score (highest first) and limit
      scoredDrivers.sort((a, b) => b.score - a.score);

      return scoredDrivers.slice(0, limit);
    } catch (error) {
      console.error('Error finding optimal drivers:', error);
      return [];
    }
  }

  /**
   * Calculate comprehensive score for a driver
   */
  private async calculateDriverScore(
    nearbyDriver: NearbyDriver,
    driverData: any,
    tripRequest: TripRequest
  ): Promise<ScoredDriver> {
    // 1. Distance Score (0-1, closer = higher)
    const maxDistance = this.MAX_SEARCH_RADIUS_KM * 1000; // meters
    const distanceScore = Math.max(
      0,
      1 - (nearbyDriver.distance || 0) / maxDistance
    );

    // 2. Rating Score (0-1, normalized from 1-5)
    const ratingScore = (driverData.rating - 1) / 4; // Convert 1-5 to 0-1

    // 3. Acceptance Rate Score (0-1)
    // TODO: Get from driver stats table
    const acceptanceRate = 0.85; // Placeholder - implement stats tracking
    const acceptanceScore = acceptanceRate;

    // 4. Completion Rate Score (0-1)
    // TODO: Get from driver stats table
    const completionRate = 0.92; // Placeholder - implement stats tracking
    const completionScore = completionRate;

    // 5. Vehicle Match Score (0 or 1)
    const vehicleMatchScore =
      driverData.vehicle_type === tripRequest.vehicleType ? 1.0 : 0.5;

    // 6. Repeat Customer Score (0 or 1)
    // TODO: Check if driver has completed trips for this customer before
    const repeatCustomerScore = 0; // Placeholder

    // Calculate weighted total score
    const totalScore =
      distanceScore * this.WEIGHTS.DISTANCE +
      ratingScore * this.WEIGHTS.RATING +
      acceptanceScore * this.WEIGHTS.ACCEPTANCE_RATE +
      completionScore * this.WEIGHTS.COMPLETION_RATE +
      vehicleMatchScore * this.WEIGHTS.VEHICLE_MATCH +
      repeatCustomerScore * this.WEIGHTS.REPEAT_CUSTOMER;

    return {
      driverId: nearbyDriver.driverId,
      score: totalScore,
      distance: nearbyDriver.distance || 0,
      lat: nearbyDriver.lat,
      lng: nearbyDriver.lng,
      rating: driverData.rating,
      acceptanceRate,
      completionRate,
      vehicleType: driverData.vehicle_type,
      vehicleModel: driverData.vehicle_model,
      breakdown: {
        distanceScore: distanceScore * this.WEIGHTS.DISTANCE,
        ratingScore: ratingScore * this.WEIGHTS.RATING,
        acceptanceScore: acceptanceScore * this.WEIGHTS.ACCEPTANCE_RATE,
        completionScore: completionScore * this.WEIGHTS.COMPLETION_RATE,
        vehicleMatchScore: vehicleMatchScore * this.WEIGHTS.VEHICLE_MATCH,
        repeatCustomerScore: repeatCustomerScore * this.WEIGHTS.REPEAT_CUSTOMER,
      },
    };
  }

  /**
   * Check if driver is eligible for the trip
   */
  private async isEligible(driverData: any, tripRequest: TripRequest): Promise<boolean> {
    // Must be approved
    if (driverData.status !== 'approved') {
      return false;
    }

    // Must be online (checked by location cache, but double-check)
    if (!driverData.is_online) {
      return false;
    }

    // Must have minimum rating
    if (driverData.rating < this.MIN_RATING) {
      return false;
    }

    // Check destination preference mode
    const destMatch = await this.checkDestinationMatch(driverData.id, tripRequest);
    if (!destMatch) {
      return false;
    }

    // Vehicle type must match or be higher tier
    // TODO: Implement vehicle tier hierarchy (economy < comfort < premium)

    return true;
  }

  /**
   * Check if driver's destination preferences match the trip
   * Returns true if:
   * - Driver doesn't have preference mode enabled
   * - Trip destination is within radius of any preferred destination
   * - Trip destination is within deviation corridor of route to preferred destination
   */
  private async checkDestinationMatch(
    driverId: string,
    tripRequest: TripRequest
  ): Promise<boolean> {
    try {
      // Quick check using drivers table column (avoids extra query if disabled)
      const { data: driver } = await supabase
        .from('drivers')
        .select('dest_preference_enabled')
        .eq('id', driverId)
        .single();

      if (!driver || !driver.dest_preference_enabled) {
        return true; // Preference mode not enabled
      }

      // Get preference settings and destinations
      const { data: prefs } = await supabase
        .from('driver_destination_preferences')
        .select('id, max_deviation_meters')
        .eq('driver_id', driverId)
        .single();

      if (!prefs) {
        return true; // No preferences record, treat as disabled
      }

      const { data: destinations } = await supabase
        .from('driver_preferred_destinations')
        .select('*')
        .eq('preference_id', prefs.id);

      if (!destinations || destinations.length === 0) {
        return true; // No destinations set, treat as disabled
      }

      // Check if trip destination matches any preferred destination
      for (const dest of destinations) {
        // Check 1: Trip destination within radius of preferred destination
        const distanceToDest = getDistanceMeters(
          tripRequest.destLat,
          tripRequest.destLng,
          dest.lat,
          dest.lng
        );

        if (distanceToDest <= dest.radius_meters) {
          return true; // Trip ends near preferred destination
        }

        // Check 2: Trip destination along route (deviation check)
        // Simple check: distance from pickup to preferred dest vs pickup to trip dest + trip dest to preferred dest
        const pickupToPreferred = getDistanceMeters(
          tripRequest.pickupLat,
          tripRequest.pickupLng,
          dest.lat,
          dest.lng
        );

        const pickupToTrip = getDistanceMeters(
          tripRequest.pickupLat,
          tripRequest.pickupLng,
          tripRequest.destLat,
          tripRequest.destLng
        );

        const tripToPreferred = getDistanceMeters(
          tripRequest.destLat,
          tripRequest.destLng,
          dest.lat,
          dest.lng
        );

        // If going to trip dest then to preferred dest is not much longer than going directly
        const viaTripDistance = pickupToTrip + tripToPreferred;
        const directDistance = pickupToPreferred;
        const extraDistance = viaTripDistance - directDistance;

        if (extraDistance <= prefs.max_deviation_meters) {
          return true; // Trip is along the way
        }
      }

      // No match found
      return false;
    } catch (err) {
      console.error('[MatchingService] Destination match check error:', err);
      return true; // Fail open - don't block on errors
    }
  }

  /**
   * Get single best driver for trip
   */
  async findBestDriver(tripRequest: TripRequest): Promise<ScoredDriver | null> {
    const drivers = await this.findOptimalDrivers(tripRequest, 1);
    return drivers.length > 0 ? drivers[0] : null;
  }

  /**
   * Re-rank drivers after one declines
   */
  async reRankDrivers(
    tripRequest: TripRequest,
    excludeDriverIds: string[]
  ): Promise<ScoredDriver[]> {
    const allDrivers = await this.findOptimalDrivers(tripRequest, 20);

    // Filter out excluded drivers
    return allDrivers.filter((d) => !excludeDriverIds.includes(d.driverId));
  }
}

// Export singleton instance
export const matchingService = new MatchingService();
