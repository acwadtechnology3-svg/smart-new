import redis from '../config/redis';
import { query } from '../config/database';

interface RoutePoint {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
    timestamp: string;
}

class TripRouteRecorder {
    private static instance: TripRouteRecorder;
    private readonly BUFFER_TTL = 86400; // 24 hours
    private readonly FLUSH_INTERVAL = 30000; // 30 seconds
    private readonly MIN_POINT_INTERVAL = 10000; // 10 seconds between points

    private constructor() {
        this.startPeriodicFlush();
    }

    public static getInstance(): TripRouteRecorder {
        if (!TripRouteRecorder.instance) {
            TripRouteRecorder.instance = new TripRouteRecorder();
        }
        return TripRouteRecorder.instance;
    }

    /**
     * Start recording points for a trip
     */
    async startRecording(tripId: string): Promise<void> {
        try {
            const recordingKey = `trip:route:${tripId}:recording`;
            await redis.set(recordingKey, '1', 'EX', this.BUFFER_TTL);
            console.log(`Started recording route for trip ${tripId}`);
        } catch (error) {
            console.error(`Failed to start recording trip ${tripId}:`, error);
        }
    }

    /**
     * Add a location point to the buffer
     */
    async addRoutePoint(tripId: string, point: RoutePoint): Promise<void> {
        try {
            const recordingKey = `trip:route:${tripId}:recording`;
            const isRecording = await redis.exists(recordingKey);

            if (!isRecording) {
                return; // Trip not active or recording not started
            }

            const lastPointKey = `trip:route:${tripId}:last-point`;
            const lastPointTime = await redis.get(lastPointKey);

            // Throttling: Check if enough time has passed since last point
            if (lastPointTime) {
                const lastTime = new Date(lastPointTime).getTime();
                const currentTime = new Date(point.timestamp).getTime();
                if (currentTime - lastTime < this.MIN_POINT_INTERVAL) {
                    return; // Skip point to save space
                }
            }

            const bufferKey = `trip:route:${tripId}:buffer`;
            await redis.rpush(bufferKey, JSON.stringify(point));
            await redis.expire(bufferKey, this.BUFFER_TTL);

            // Update last point timestamp
            await redis.set(lastPointKey, point.timestamp, 'EX', this.BUFFER_TTL);

        } catch (error) {
            console.error(`Failed to add route point for trip ${tripId}:`, error);
        }
    }

    /**
     * Stop recording and flush remaining points
     */
    async stopRecording(tripId: string): Promise<void> {
        try {
            const recordingKey = `trip:route:${tripId}:recording`;
            await redis.del(recordingKey);

            // Final flush
            await this.flushToDatabase(tripId);

            // Cleanup buffer keys (after successful flush)
            const bufferKey = `trip:route:${tripId}:buffer`;
            const lastPointKey = `trip:route:${tripId}:last-point`;
            await redis.del(bufferKey, lastPointKey);

            console.log(`Stopped recording route for trip ${tripId}`);
        } catch (error) {
            console.error(`Failed to stop recording for trip ${tripId}:`, error);
        }
    }

    /**
     * Flush buffered points to PostgreSQL
     */
    async flushToDatabase(tripId: string): Promise<number> {
        try {
            const bufferKey = `trip:route:${tripId}:buffer`;

            // Get all points from buffer
            // Use lrange 0 -1 to get all, but we should probably pop them carefully
            // To ensure atomicity appropriately without Lua, let's read then delete
            // But for simplicity and robustness, we can read, insert, then trim.

            const pointsStrs = await redis.lrange(bufferKey, 0, -1);

            if (!pointsStrs || pointsStrs.length === 0) {
                return 0;
            }

            const points: RoutePoint[] = pointsStrs.map(s => JSON.parse(s));

            // Construct batch insert query
            const values: string[] = [];
            const params: any[] = [];
            let paramIdx = 1;

            points.forEach(p => {
                values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6})`);
                params.push(
                    tripId,
                    p.lat,
                    p.lng,
                    p.heading || null,
                    p.speed || null,
                    p.accuracy || null,
                    p.timestamp
                );
                paramIdx += 7;
            });

            const insertQuery = `
        INSERT INTO trip_route_points 
        (trip_id, latitude, longitude, heading, speed, accuracy, recorded_at)
        VALUES ${values.join(',')}
      `;

            await query(insertQuery, params);

            // Clear the flushed points from Redis
            // ltrim to remove the processed elements. 
            // Since we read 0 to -1, we can delete the key or ltrim 
            // But new points might have arrived.
            // Better approach: multi/exec.

            // Actually with LPOP count (Redis 6.2+) it would be easier.
            // Assuming standard Redis commands available.
            // Let's safe-trim. 
            // But wait, if we use lrange 0 -1, we read everything.
            // If we confirm insert, we can ltrim data out.

            /* 
               Potential race condition: new points added while we are inserting.
               We captured `points.length` items.
               So we should ltrim starting from `points.length` to keep new ones.
               LTRIM key start stop.
               We want to keep from index `points.length` to end.
               LTRIM key points.length -1
            */

            if (points.length > 0) {
                await redis.ltrim(bufferKey, points.length, -1);
            }

            console.log(`Flushed ${points.length} points for trip ${tripId}`);
            return points.length;

        } catch (error) {
            console.error(`Failed to flush to database for trip ${tripId}:`, error);
            return 0;
        }
    }

    /**
     * Get currently buffered points (for debug/viewing)
     */
    async getBufferedPoints(tripId: string): Promise<RoutePoint[]> {
        try {
            const bufferKey = `trip:route:${tripId}:buffer`;
            const points = await redis.lrange(bufferKey, 0, -1);
            return points.map(p => JSON.parse(p));
        } catch (error) {
            console.error(`Failed to get buffered points for trip ${tripId}:`, error);
            return [];
        }
    }

    /**
     * Periodic flush for all active recordings
     * Note: In a distributed system, this might flush overlapping trips if not handled carefully.
     * But for single instance or if we iterate active keys, it's fine.
     * The prompt says "Automatically flush buffer to PostgreSQL every 30 seconds".
     * This could be per trip or a global loop.
     * A global loop finding active trips is better than setting timeouts per trip.
     */
    private startPeriodicFlush() {
        setInterval(async () => {
            try {
                // Scan for recording keys
                // SCAN 0 MATCH trip:route:*:recording
                let cursor = '0';
                do {
                    const result = await redis.scan(cursor, 'MATCH', 'trip:route:*:recording', 'COUNT', '100');
                    cursor = result[0];
                    const keys = result[1];

                    for (const key of keys) {
                        // key is trip:route:{tripId}:recording
                        const parts = key.split(':');
                        if (parts.length === 4) {
                            const tripId = parts[2];
                            await this.flushToDatabase(tripId);
                        }
                    }
                } while (cursor !== '0');

            } catch (error) {
                console.error('Error in periodic flush:', error);
            }
        }, this.FLUSH_INTERVAL);
    }

    /**
     * Cleanup stale buffers (e.g. if server crashed)
     */
    async cleanupStaleBuffers(): Promise<void> {
        // Implementation for cleanup if needed
    }
}

export const tripRouteRecorder = TripRouteRecorder.getInstance();
