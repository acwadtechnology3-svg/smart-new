import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

function normalizeVehicleType(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

const CAR_DRIVER_TYPES = new Set(['car', 'saver', 'comfort', 'vip', 'sedan', 'hatchback', 'suv', 'van']);
const SCOOTER_DRIVER_TYPES = new Set(['scooter', 'motorcycle', 'bike', 'motorbike', 'moto']);
const TAXI_DRIVER_TYPES = new Set(['taxi']);

function isTripDriverTypeCompatible(tripTypeRaw: unknown, driverTypeRaw: unknown): boolean {
  const tripType = normalizeVehicleType(tripTypeRaw);
  const driverType = normalizeVehicleType(driverTypeRaw);

  if (!tripType || !driverType) return true;

  if (tripType === 'saver' || tripType === 'comfort' || tripType === 'vip' || tripType === 'car') {
    return CAR_DRIVER_TYPES.has(driverType);
  }
  if (tripType === 'scooter' || tripType === 'motorcycle' || tripType === 'bike') {
    return SCOOTER_DRIVER_TYPES.has(driverType);
  }
  if (tripType === 'taxi') {
    return TAXI_DRIVER_TYPES.has(driverType);
  }

  return tripType === driverType;
}

export const createTripOffer = async (req: Request, res: Response) => {
  try {
    const driverId = req.user!.id;
    const { tripId, offerPrice } = req.body;

    if (!tripId || offerPrice === undefined || offerPrice === null) {
      return res.status(400).json({ error: 'Missing tripId or offerPrice' });
    }

    const parsedOfferPrice = Number(offerPrice);
    if (!Number.isFinite(parsedOfferPrice) || parsedOfferPrice <= 0) {
      return res.status(400).json({ error: 'Invalid offerPrice' });
    }

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, status, car_type')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.status !== 'requested') {
      return res.status(409).json({ error: 'Trip is no longer available' });
    }

    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('vehicle_type, status, is_online')
      .eq('id', driverId)
      .single();

    if (driverError || !driver) {
      return res.status(403).json({ error: 'Driver profile not found' });
    }

    if (driver.status !== 'approved' || !driver.is_online) {
      return res.status(403).json({ error: 'Driver is not eligible to receive offers' });
    }

    if (!isTripDriverTypeCompatible(trip.car_type, driver.vehicle_type)) {
      return res.status(403).json({ error: 'This trip category does not match your vehicle type' });
    }

    const { data: existingOffer } = await supabase
      .from('trip_offers')
      .select('id, trip_id, driver_id, offer_price, status, created_at')
      .eq('trip_id', tripId)
      .eq('driver_id', driverId)
      .in('status', ['pending', 'accepted'])
      .limit(1)
      .maybeSingle();

    if (existingOffer) {
      return res.status(200).json({ offer: existingOffer, duplicate: true });
    }

    const { data, error } = await supabase
      .from('trip_offers')
      .insert({
        trip_id: tripId,
        driver_id: driverId,
        offer_price: parsedOfferPrice,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ offer: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const rejectTripOffer = async (req: Request, res: Response) => {
  try {
    const { offerId } = req.params;

    const { data: offer, error: offerError } = await supabase
      .from('trip_offers')
      .select('id, trip_id')
      .eq('id', offerId)
      .single();

    if (offerError || !offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('customer_id')
      .eq('id', offer.trip_id)
      .single();

    if (tripError || !trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.customer_id !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .from('trip_offers')
      .update({ status: 'rejected' })
      .eq('id', offerId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getTripOffers = async (req: Request, res: Response) => {
  try {
    const tripId = req.query.tripId as string;
    if (!tripId) {
      return res.status(400).json({ error: 'Missing tripId' });
    }

    // 1. Verify Authorization (User must be the Customer of the trip)
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

    // 2. Fetch Offers with Driver Details
    const { data: offers, error: offersError } = await supabase
      .from('trip_offers')
      .select(`
                *,
                driver:drivers!inner (
                    id,
                    vehicle_model,
                    vehicle_plate,
                    rating,
                    profile_photo_url,
                    users!inner (
                        full_name,
                        phone
                    )
                )
            `)
      .eq('trip_id', tripId)
      .eq('status', 'pending');

    if (offersError) throw offersError;

    // 3. Format Response for Frontend
    const formattedOffers = offers.map((offer: any) => ({
      id: offer.id,
      trip_id: offer.trip_id,
      driver_id: offer.driver_id,
      offer_price: offer.offer_price,
      status: offer.status,
      created_at: offer.created_at,
      driver: {
        id: offer.driver.id,
        name: offer.driver.users?.full_name || 'Driver',
        phone: offer.driver.users?.phone,
        rating: offer.driver.rating || '5.0',
        image: offer.driver.profile_photo_url,
        car: offer.driver.vehicle_model,
        plate: offer.driver.vehicle_plate,
        color: '' // Field does not exist in DB
      }
    }));

    res.json({ offers: formattedOffers });

  } catch (err: any) {
    console.error('Get Trip Offers Error:', err);
    res.status(500).json({ error: err.message });
  }
};
