import redis from '../config/redis';
import { query } from '../config/database';

export interface DriverLocationSnapshot {
    driverId: string;
    name: string;
    vehicleType: string;
    location: {
        lat: number;
        lng: number;
        heading?: number;
        speed?: number;
    };
    status: 'idle' | 'on_trip';
    activeTrip?: {
        tripId: string;
        customerId: string;
        customerName: string;
        pickup: { lat: number; lng: number; address: string };
        destination: { lat: number; lng: number; address: string };
        status: string;
        startedAt: string;
    };
    lastUpdate: string;
}

class AdminLocationFeed {
    private static instance: AdminLocationFeed;
    private updateInterval: NodeJS.Timeout | null = null;
    private readonly SNAPSHOT_INTERVAL = 30000; // 30 seconds
    private readonly CACHE_KEY = 'admin:location-feed:latest';
    private isRunningState = false;

    private constructor() { }

    public static getInstance(): AdminLocationFeed {
        if (!AdminLocationFeed.instance) {
            AdminLocationFeed.instance = new AdminLocationFeed();
        }
        return AdminLocationFeed.instance;
    }

    async start(): Promise<void> {
        if (this.isRunningState) return;
        this.isRunningState = true;

        // Initial snapshot
        this.generateSnapshot().catch(console.error);

        this.updateInterval = setInterval(() => {
            this.generateSnapshot().catch(console.error);
        }, this.SNAPSHOT_INTERVAL);

        console.log('✅ Admin location feed service started');
    }

    async stop(): Promise<void> {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.isRunningState = false;
        console.log('🛑 Admin location feed service stopped');
    }

    public isRunning(): boolean {
        return this.isRunningState;
    }

    async getLatestSnapshot(): Promise<DriverLocationSnapshot[]> {
        const cached = await redis.get(this.CACHE_KEY);
        if (cached) {
            return JSON.parse(cached);
        }
        return [];
    }

    async generateSnapshot(): Promise<DriverLocationSnapshot[]> {
        const startTime = Date.now();
        try {
            // 1. Scan for online drivers
            const onlineDrivers: string[] = [];
            let cursor = '0';
            do {
                const result = await redis.scan(cursor, 'MATCH', 'driver:*:online', 'COUNT', '1000');
                cursor = result[0];
                const keys = result[1];
                keys.forEach(key => {
                    const driverId = key.split(':')[1];
                    if (driverId) onlineDrivers.push(driverId);
                });
            } while (cursor !== '0');

            if (onlineDrivers.length === 0) {
                await redis.set(this.CACHE_KEY, '[]');
                return [];
            }

            // 2. Fetch locations and metadata in pipeline
            const pipeline = redis.pipeline();
            onlineDrivers.forEach(driverId => {
                pipeline.geopos('driver:locations', driverId);
                pipeline.hgetall(`driver:${driverId}:meta`);
                pipeline.get(`driver:${driverId}:active-trip`);
            });

            const results = await pipeline.exec();

            if (!results) {
                return [];
            }

            const snapshots: DriverLocationSnapshot[] = [];
            const driversOnTrip: { index: number; tripId: string }[] = [];

            // 3. Prepare initial snapshots
            for (let i = 0; i < onlineDrivers.length; i++) {
                const driverId = onlineDrivers[i];
                const locationRes = results[i * 3 + 0]; // geopos
                const metaRes = results[i * 3 + 1]; // hgetall
                const activeTripRes = results[i * 3 + 2]; // get trip

                const location = (locationRes?.[1] as any)?.[0]; // [lng, lat]
                const metadata = (metaRes?.[1] as any) || {};
                const activeTripId = (activeTripRes?.[1] as string) || null;

                if (!location) continue; // Skip if no location found

                const snapshot: DriverLocationSnapshot = {
                    driverId,
                    name: 'Unknown Driver', // Placeholder
                    vehicleType: metadata.vehicleType || 'sedan',
                    location: {
                        lat: parseFloat(location[1]),
                        lng: parseFloat(location[0]),
                        heading: metadata.heading ? parseFloat(metadata.heading) : undefined,
                        speed: metadata.speed ? parseFloat(metadata.speed) : undefined
                    },
                    status: (activeTripId && activeTripId !== 'none') ? 'on_trip' : 'idle',
                    lastUpdate: metadata.timestamp || new Date().toISOString(),
                    activeTrip: undefined
                };

                snapshots.push(snapshot);

                if (activeTripId && activeTripId !== 'none') {
                    // Store index to update activeTrip later
                    driversOnTrip.push({ index: snapshots.length - 1, tripId: activeTripId });
                }
            }

            // 4. Enrich with Profiles (Cache Strategy)
            if (snapshots.length > 0) {
                const pipelineProfile = redis.pipeline();
                snapshots.forEach(s => {
                    pipelineProfile.get(`driver:${s.driverId}:profile`);
                });

                const cachedProfilesRes = await pipelineProfile.exec();
                const missingProfileIds: string[] = [];
                const driverProfiles = new Map<string, { name: string, vehicle: string }>();

                snapshots.forEach((s, idx) => {
                    const cached = cachedProfilesRes?.[idx]?.[1];
                    if (cached) {
                        try {
                            const profile = JSON.parse(cached as string);
                            driverProfiles.set(s.driverId, profile);
                        } catch (e) {
                            missingProfileIds.push(s.driverId);
                        }
                    } else {
                        missingProfileIds.push(s.driverId);
                    }
                });

                // Fetch missing from DB
                if (missingProfileIds.length > 0) {
                    // Use unique IDs only
                    const uniqueMissingIds = [...new Set(missingProfileIds)];

                    const dbRes = await query(
                        `SELECT id, first_name, last_name, vehicle_details FROM users WHERE id = ANY($1)`,
                        [uniqueMissingIds]
                    );

                    if (dbRes.rows.length > 0) {
                        const pipelineSave = redis.pipeline();

                        dbRes.rows.forEach(row => {
                            const vehicleInfo = row.vehicle_details as any;
                            const profile = {
                                name: `${row.first_name} ${row.last_name}`,
                                vehicle: vehicleInfo?.model || 'Unknown Vehicle'
                            };
                            driverProfiles.set(row.id, profile);
                            // Cache for 1 hour
                            pipelineSave.set(`driver:${row.id}:profile`, JSON.stringify(profile), 'EX', 3600);
                        });

                        await pipelineSave.exec();
                    }
                }

                // Apply profiles
                snapshots.forEach(s => {
                    const profile = driverProfiles.get(s.driverId);
                    if (profile) {
                        s.name = profile.name;
                        // Determine vehicle type priority
                        if (s.vehicleType === 'sedan' && profile.vehicle !== 'Unknown Vehicle') {
                            // Only override default 'sedan' if profile has specific info?
                            // Or maybe vehicleType from metadata is more live/accurate (e.g. if driver switched vehicles)?
                            // Metadata usually comes from driver app login.
                            // Let's trust metadata first, but update name.
                        }
                    }
                });
            }

            // 5. Fetch active trip details
            if (driversOnTrip.length > 0) {
                const tripIds = driversOnTrip.map(d => d.tripId);
                // Unique IDs
                const uniqueTripIds = [...new Set(tripIds)];

                const tripsRes = await query(
                    `SELECT t.id, t.status, t.created_at as "startedAt",
                      t.customer_id, 
                      u.first_name || ' ' || u.last_name as "customerName",
                      t.pickup_lat, t.pickup_lng, t.pickup_desc,
                      t.dest_lat, t.dest_lng, t.dest_desc
               FROM trips t
               JOIN users u ON t.customer_id = u.id
               WHERE t.id = ANY($1)`,
                    [uniqueTripIds]
                );

                const tripMap = new Map(tripsRes.rows.map(t => [t.id, t]));

                driversOnTrip.forEach(({ index, tripId }) => {
                    const trip = tripMap.get(tripId);
                    if (trip) {
                        snapshots[index].activeTrip = {
                            tripId: trip.id,
                            customerId: trip.customer_id,
                            customerName: trip.customerName,
                            pickup: {
                                lat: parseFloat(trip.pickup_lat),
                                lng: parseFloat(trip.pickup_lng),
                                address: trip.pickup_desc || 'Unknown Pickup'
                            },
                            destination: {
                                lat: parseFloat(trip.dest_lat),
                                lng: parseFloat(trip.dest_lng),
                                address: trip.dest_desc || 'Unknown Destination'
                            },
                            status: trip.status,
                            startedAt: trip.startedAt
                        };
                    }
                });
            }

            // 6. Save snapshot to Redis
            await redis.set(this.CACHE_KEY, JSON.stringify(snapshots), 'EX', 60);

            const duration = Date.now() - startTime;
            // Only log if we found drivers to reduce noise
            if (snapshots.length > 0) {
                console.log(`📸 Location snapshot generated: ${snapshots.length} drivers in ${duration}ms`);
            }

            return snapshots;

        } catch (error) {
            console.error('Failed to generate location snapshot:', error);
            return [];
        }
    }
}

export const adminLocationFeed = AdminLocationFeed.getInstance();
