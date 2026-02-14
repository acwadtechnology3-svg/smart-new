import { BaseRepository } from './BaseRepository';
import { DIRECT_DB_DISABLED_CODE, isDirectDatabaseEnabled, query } from '../config/database';
import { supabase } from '../config/supabase';

export interface Driver {
  id: string;
  national_id: string;
  city: string;
  vehicle_type: string;
  vehicle_model: string;
  vehicle_plate: string;
  status: 'pending' | 'approved' | 'rejected' | 'banned';
  is_online: boolean;
  current_lat: number;
  current_lng: number;
  last_location_update: Date;
  rating: number;
  created_at: Date;
}

export interface NearbyDriver {
  driver_id: string;
  distance_meters: number;
  current_lat: number;
  current_lng: number;
  vehicle_type: string;
  vehicle_model: string;
  rating: number;
  last_location_update: Date;
}

export class DriverRepository extends BaseRepository<Driver> {
  constructor() {
    super('drivers');
  }

  /**
   * Find nearby online drivers using PostGIS
   */
  async findNearbyOnlineDrivers(
    lat: number,
    lng: number,
    radiusKm: number = 5,
    vehicleType?: string,
    limit: number = 50
  ): Promise<NearbyDriver[]> {
    const result = await query(
      `SELECT * FROM find_nearby_drivers($1, $2, $3, $4, $5)`,
      [lat, lng, radiusKm * 1000, vehicleType, limit] // Convert km to meters
    );
    return result.rows;
  }

  /**
   * Update driver location
   */
  async updateLocation(
    driverId: string,
    lat: number,
    lng: number
  ): Promise<boolean> {
    if (!isDirectDatabaseEnabled()) {
      const { error: supabaseError } = await supabase
        .from('drivers')
        .update({
          current_lat: lat,
          current_lng: lng,
          last_location_update: new Date().toISOString(),
        })
        .eq('id', driverId);

      if (supabaseError) throw supabaseError;
      return true;
    }

    try {
      const result = await query(
        `UPDATE drivers
         SET current_lat = $2,
             current_lng = $3,
             last_location_update = NOW()
         WHERE id = $1`,
        [driverId, lat, lng]
      );
      return (result.rowCount || 0) > 0;
    } catch (error: unknown) {
      // Fallback to Supabase if direct query fails
      const dbError = error as { code?: string; message?: string };
      if (dbError.code !== DIRECT_DB_DISABLED_CODE) {
        console.warn('Direct query failed, using Supabase:', dbError.message || error);
      }
      const { error: supabaseError } = await supabase
        .from('drivers')
        .update({
          current_lat: lat,
          current_lng: lng,
          last_location_update: new Date().toISOString(),
        })
        .eq('id', driverId);

      if (supabaseError) throw supabaseError;
      return true;
    }
  }

  /**
   * Set driver online status
   */
  async setOnlineStatus(driverId: string, isOnline: boolean): Promise<boolean> {
    if (!isDirectDatabaseEnabled()) {
      const { error: supabaseError } = await supabase
        .from('drivers')
        .update({ is_online: isOnline })
        .eq('id', driverId);

      if (supabaseError) throw supabaseError;
      return true;
    }

    try {
      const result = await query(
        `UPDATE drivers SET is_online = $2 WHERE id = $1`,
        [driverId, isOnline]
      );
      return (result.rowCount || 0) > 0;
    } catch (error: unknown) {
      // Fallback to Supabase if direct query fails
      const dbError = error as { code?: string; message?: string };
      if (dbError.code !== DIRECT_DB_DISABLED_CODE) {
        console.warn('Direct query failed, using Supabase:', dbError.message || error);
      }
      const { error: supabaseError } = await supabase
        .from('drivers')
        .update({ is_online: isOnline })
        .eq('id', driverId);

      if (supabaseError) throw supabaseError;
      return true;
    }
  }

  /**
   * Find online approved drivers by city
   */
  async findOnlineByCity(city: string, limit: number = 100): Promise<Driver[]> {
    const result = await query(
      `SELECT * FROM drivers
       WHERE city = $1
       AND status = 'approved'
       AND is_online = true
       AND last_location_update > NOW() - INTERVAL '2 minutes'
       LIMIT $2`,
      [city, limit]
    );
    return result.rows;
  }

  /**
   * Get count of online drivers
   */
  async getOnlineCount(city?: string): Promise<number> {
    const sql = city
      ? `SELECT COUNT(*) FROM drivers
         WHERE status = 'approved'
         AND is_online = true
         AND city = $1
         AND last_location_update > NOW() - INTERVAL '2 minutes'`
      : `SELECT COUNT(*) FROM drivers
         WHERE status = 'approved'
         AND is_online = true
         AND last_location_update > NOW() - INTERVAL '2 minutes'`;

    const result = city
      ? await query(sql, [city])
      : await query(sql);

    return parseInt(result.rows[0].count);
  }

  /**
   * Find driver by user ID
   */
  async findByUserId(userId: string): Promise<Driver | null> {
    const result = await query(
      `SELECT * FROM drivers WHERE id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update driver rating
   */
  async updateRating(driverId: string, newRating: number): Promise<boolean> {
    const result = await query(
      `UPDATE drivers SET rating = $2 WHERE id = $1`,
      [driverId, newRating]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Find stale drivers (haven't updated location recently)
   */
  async findStaleDrivers(minutesThreshold: number = 5): Promise<Driver[]> {
    const result = await query(
      `SELECT * FROM drivers
       WHERE is_online = true
       AND last_location_update < NOW() - INTERVAL '${minutesThreshold} minutes'`,
      []
    );
    return result.rows;
  }
}
