import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';
import sharp from 'sharp';

export const getDriverSummary = async (req: Request, res: Response) => {
  try {
    const driverId = req.user!.id;

    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, profile_photo_url, status, rating, users!inner(full_name)')
      .eq('id', driverId)
      .single();

    if (driverError || !driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('balance')
      .eq('id', driverId)
      .single();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: trips } = await supabase
      .from('trips')
      .select('final_price')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .gte('created_at', todayStart.toISOString());

    const dailyEarnings = (trips || []).reduce(
      (sum, t: any) => sum + (t.final_price || 0),
      0
    );

    res.json({
      driver,
      balance: user?.balance || 0,
      dailyEarnings,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Save uploaded driver file locally and return path
export const uploadDriverFile = async (req: Request, res: Response) => {
  try {
    const driverId = req.user!.id;
    const { base64, filename: bodyFilename, field: bodyField } = req.body as {
      base64?: string;
      filename?: string;
      field?: string;
    };

    if (!base64) {
      return res.status(400).json({ error: 'No base64 payload provided' });
    }

    const baseUploadDir = process.env.DRIVER_UPLOAD_DIR || 'C:/Users/Ezzat/Desktop/smartline-fromislam/smart-new/driver-images';
    const driverFolder = path.join(baseUploadDir, driverId);
    await fsp.mkdir(driverFolder, { recursive: true });

    const field = bodyField || 'file';
    const filenameNoExt = `${driverId}_${field}_${Date.now()}`;
    const destPath = path.join(driverFolder, `${filenameNoExt}.webp`);

    const buffer = Buffer.from(base64, 'base64');

    // Compress to WebP at 90% quality
    const webpBuffer = await sharp(buffer).webp({ quality: 90 }).toBuffer();
    await fsp.writeFile(destPath, webpBuffer);

    const relativePath = path.relative(process.cwd(), destPath);
    res.json({ path: relativePath });
  } catch (err: any) {
    console.error('uploadDriverFile error', err);
    res.status(500).json({ error: err.message });
  }
};

export const getDriverMe = async (req: Request, res: Response) => {
  try {
    const driverId = req.user!.id;

    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    // Check for pending or rejected vehicle change requests
    const { data: request } = await supabase
      .from('vehicle_change_requests')
      .select('*')
      .eq('driver_id', driverId)
      .neq('status', 'approved') // Only interested in pending or rejected to show status
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    res.json({ driver: { ...data, pendingRequest: request } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getDriverStatus = async (req: Request, res: Response) => {
  try {
    const driverId = req.user!.id;
    const { data, error } = await supabase
      .from('drivers')
      .select('status')
      .eq('id', driverId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    res.json({ status: data.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const registerDriver = async (req: Request, res: Response) => {
  try {
    const driverId = req.user!.id;
    const {
      national_id,
      city,
      vehicle_type,
      vehicle_model,
      vehicle_plate,
      profile_photo_url,
      id_front_url,
      id_back_url,
      license_front_url,
      license_back_url,
      vehicle_license_front_url,
      vehicle_license_back_url,
      vehicle_front_url,
      vehicle_back_url,
      vehicle_right_url,
      vehicle_left_url,
      is_travel_captain_request,
    } = req.body;

    const { error } = await supabase
      .from('drivers')
      .upsert(
        {
          id: driverId,
          national_id,
          city,
          vehicle_type,
          vehicle_model,
          vehicle_plate,
          status: 'pending',
          profile_photo_url,
          id_front_url,
          id_back_url,
          license_front_url,
          license_back_url,
          vehicle_license_front_url,
          vehicle_license_back_url,
          vehicle_front_url,
          vehicle_back_url,
          vehicle_right_url,
          vehicle_left_url,
          is_travel_captain: is_travel_captain_request || false,
          travel_captain_status: is_travel_captain_request ? 'pending' : 'none',
        },
        { onConflict: 'id' }
      );

    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }


};

export const requestVehicleChange = async (req: Request, res: Response) => {
  try {
    const driverId = req.user!.id;
    const {
      new_vehicle_type,
      new_vehicle_model,
      new_vehicle_plate,
      new_vehicle_front_url,
      new_vehicle_back_url,
      new_vehicle_left_url,
      new_vehicle_right_url,
      new_vehicle_license_front_url,
      new_vehicle_license_back_url,
    } = req.body;

    // Basic Validation
    if (!new_vehicle_type || !new_vehicle_model || !new_vehicle_plate) {
      return res.status(400).json({ error: 'Missing required vehicle information' });
    }

    // Get current vehicle info to store in history
    const { data: currentDriver } = await supabase
      .from('drivers')
      .select('vehicle_type, vehicle_model, vehicle_plate')
      .eq('id', driverId)
      .single();

    const { data, error } = await supabase
      .from('vehicle_change_requests')
      .insert({
        driver_id: driverId,
        current_vehicle_type: currentDriver?.vehicle_type,
        current_vehicle_model: currentDriver?.vehicle_model,
        current_vehicle_plate: currentDriver?.vehicle_plate,
        new_vehicle_type,
        new_vehicle_model,
        new_vehicle_plate,
        new_vehicle_front_url,
        new_vehicle_back_url,
        new_vehicle_left_url,
        new_vehicle_right_url,
        new_vehicle_license_front_url,
        new_vehicle_license_back_url,
        status: 'pending'
      });

    if (error) throw error;

    res.json({ success: true, message: 'Request submitted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getDriverPublic = async (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;
    const { tripId } = req.query as { tripId?: string };

    if (!tripId) {
      return res.status(400).json({ error: 'tripId is required' });
    }

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('customer_id')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.customer_id !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // 1. Fetch Driver Profile
    const { data: driverData, error: driverError } = await supabase
      .from('drivers')
      .select('id, vehicle_model, vehicle_plate, rating, profile_photo_url, current_lat, current_lng')
      .eq('id', driverId)
      .single();

    if (driverError) {
      console.error('Error fetching driver profile:', driverError);
      return res.status(404).json({ error: 'Driver profile fetch failed: ' + driverError.message });
    }

    if (!driverData) {
      return res.status(404).json({ error: 'Driver not found in DB' });
    }

    // 2. Fetch User Details (Name, Phone)
    // We do this separately to avoid issues if the FK relationship is not correctly configured in Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('full_name, phone')
      .eq('id', driverId)
      .single();

    if (userError) {
      console.warn('Error fetching user details for driver:', userError);
      // Don't fail completely, just return what we have (or defaults)
    }

    const driver = {
      ...driverData,
      users: userData || { full_name: 'Driver', phone: '' }
    };

    res.json({ driver });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
