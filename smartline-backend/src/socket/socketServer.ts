
import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { locationCache } from '../services/locationCache';
import { tripRouteRecorder } from '../services/TripRouteRecorder';
import { query } from '../config/database';
import redis from '../config/redis';

// driverPresence handled by locationCache directly

// Fallback to env config if not available
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface AuthSocket extends Socket {
    userId?: string;
    userRole?: string;
}

export class SocketServer {
    private io: Server;
    private connectedDrivers: Map<string, string> = new Map(); // driverId -> socketId

    constructor(httpServer: HTTPServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: '*', // Configure properly for production
                methods: ['GET', 'POST'],
            },
            transports: ['websocket', 'polling'],
        });

        this.setupMiddleware();
        this.setupEventHandlers();
    }

    /**
     * Setup authentication middleware
     */
    private setupMiddleware() {
        this.io.use(async (socket: AuthSocket, next) => {
            try {
                const token = socket.handshake.auth.token;

                if (!token) {
                    return next(new Error('Authentication error: No token provided'));
                }

                // Verify JWT token
                // Use config.JWT_SECRET if available, otherwise fallback
                const secret = config.JWT_SECRET || JWT_SECRET;

                try {
                    const decoded = jwt.verify(token, secret) as any;
                    socket.userId = decoded.id;
                    socket.userRole = decoded.role;

                    console.log(`[Socket] ✅ Authenticated: ${socket.userId} (${socket.userRole})`);
                    next();
                } catch (e) {
                    // If verification fails, try decoding without verification just to inspect (for debugging)
                    // But throw auth error
                    console.error('[Socket] Token verification failed:', e);
                    next(new Error('Authentication error: Invalid Token'));
                }
            } catch (error) {
                console.error('[Socket] Authentication error:', error);
                next(new Error('Authentication error'));
            }
        });
    }

    /**
     * Setup event handlers
     */
    private setupEventHandlers() {
        this.io.on('connection', (socket: AuthSocket) => {
            console.log(`[Socket] Client connected: ${socket.id} (User: ${socket.userId})`);

            // Store driver connection
            if (socket.userRole === 'driver' && socket.userId) {
                this.connectedDrivers.set(socket.userId, socket.id);
                console.log(`[Socket] Driver ${socket.userId} connected`);
            }

            // Handle location update
            socket.on('location:update', async (data) => {
                await this.handleLocationUpdate(socket, data);
            });

            // Handle batch location update
            socket.on('location:batch-update', async (data) => {
                await this.handleBatchLocationUpdate(socket, data);
            });

            // Handle disconnect
            socket.on('disconnect', async () => {
                await this.handleDisconnect(socket);
            });
        });
    }

    /**
     * Helper to check if driver has active trip (with caching)
     */
    private async getDriverActiveTrip(driverId: string): Promise<string | null> {
        try {
            const cacheKey = `driver:${driverId}:active-trip`;
            const cachedTripId = await redis.get(cacheKey);

            if (cachedTripId) {
                // If we cached 'none', return null
                return cachedTripId === 'none' ? null : cachedTripId;
            }

            // Query database for trip where driver_id = driverId AND status = 'started'
            const result = await query(
                `SELECT id FROM trips WHERE driver_id = $1 AND status = 'started' LIMIT 1`,
                [driverId]
            );

            if (result.rows.length > 0) {
                const tripId = result.rows[0].id;
                // Cache result for 60 seconds
                await redis.set(cacheKey, tripId, 'EX', 60);
                return tripId;
            } else {
                // Cache 'none' to avoid repeated DB queries for idle drivers
                await redis.set(cacheKey, 'none', 'EX', 60);
                return null;
            }
        } catch (error) {
            console.error('Failed to check active trip:', error);
            // On error, assume no active trip to be safe/non-blocking
            return null;
        }
    }

    /**
     * Handle single location update
     */
    private async handleLocationUpdate(socket: AuthSocket, data: any) {
        try {
            if (!socket.userId) return;

            const { lat, lng, heading, speed, accuracy, timestamp } = data;

            // Generate timestamp if missing
            const currentTimestamp = timestamp || new Date().toISOString();

            // 1. Update in Redis cache (Live Tracking)
            const updated = await locationCache.updateDriverLocation(
                socket.userId,
                lat,
                lng,
                {
                    heading,
                    speed,
                    accuracy,
                    timestamp: currentTimestamp,
                }
            );

            // 2. Route Recording Integration
            // If location update successful, check for active trip and record point
            if (updated) {
                const activeTripId = await this.getDriverActiveTrip(socket.userId);
                if (activeTripId) {
                    // Add point to route recorder
                    // We don't await this to keep socket response fast
                    tripRouteRecorder.addRoutePoint(activeTripId, {
                        lat,
                        lng,
                        heading,
                        speed,
                        accuracy,
                        timestamp: currentTimestamp
                    }).catch(err => console.error('Error recording route point:', err));
                }
            }

            if (updated) {
                // Acknowledge update
                socket.emit('location:updated', {
                    success: true,
                    timestamp: new Date().toISOString(),
                });
            } else {
                socket.emit('location:updated', {
                    success: false,
                    error: 'Failed to update location',
                });
            }
        } catch (error) {
            console.error('[Socket] Location update error:', error);
            socket.emit('location:updated', {
                success: false,
                error: 'Internal error',
            });
        }
    }

    /**
     * Handle batch location update (for offline sync)
     */
    private async handleBatchLocationUpdate(socket: AuthSocket, data: any) {
        try {
            if (!socket.userId) return;

            const { locations } = data;

            if (!Array.isArray(locations) || locations.length === 0) {
                socket.emit('location:batch-updated', {
                    success: false,
                    error: 'Invalid locations array',
                });
                return;
            }

            // Process most recent location for live map
            const sortedLocations = locations.sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            const mostRecent = sortedLocations[0];

            await locationCache.updateDriverLocation(
                socket.userId,
                mostRecent.lat,
                mostRecent.lng,
                {
                    heading: mostRecent.heading,
                    speed: mostRecent.speed,
                    accuracy: mostRecent.accuracy,
                    timestamp: mostRecent.timestamp,
                }
            );

            // Process route recording for active trip
            const activeTripId = await this.getDriverActiveTrip(socket.userId);
            if (activeTripId) {
                // For batch updates, we should process all points
                // Sort by time ascending for proper recording order
                const chronologicalLocs = [...locations].sort(
                    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );

                for (const loc of chronologicalLocs) {
                    tripRouteRecorder.addRoutePoint(activeTripId, {
                        lat: loc.lat,
                        lng: loc.lng,
                        heading: loc.heading,
                        speed: loc.speed,
                        accuracy: loc.accuracy,
                        timestamp: loc.timestamp
                    }).catch(err => console.error('Error recording batch route point:', err));
                }
            }

            socket.emit('location:batch-updated', {
                success: true,
                count: locations.length,
                latestTimestamp: mostRecent.timestamp,
            });

            console.log(`[Socket] Batch update: ${locations.length} locations for driver ${socket.userId}`);
        } catch (error) {
            console.error('[Socket] Batch location update error:', error);
            socket.emit('location:batch-updated', {
                success: false,
                error: 'Internal error',
            });
        }
    }

    /**
     * Handle client disconnect
     */
    private async handleDisconnect(socket: AuthSocket) {
        console.log(`[Socket] Client disconnected: ${socket.id}`);

        if (socket.userRole === 'driver' && socket.userId) {
            this.connectedDrivers.delete(socket.userId);
            console.log(`[Socket] Driver ${socket.userId} disconnected`);

            // Don't immediately set driver offline - let TTL handle it
            // This prevents brief disconnects from going offline
        }
    }

    /**
     * Emit trip request to nearby drivers
     */
    public emitTripToNearbyDrivers(trip: any, driverIds: string[]) {
        console.log(`[Socket] Emitting trip ${trip.id} to ${driverIds.length} drivers`);

        for (const driverId of driverIds) {
            const socketId = this.connectedDrivers.get(driverId);
            if (socketId) {
                this.io.to(socketId).emit('trip:new', trip);
                console.log(`[Socket] Sent trip to driver ${driverId}`);
            }
        }
    }

    /**
     * Emit offer update to driver
     */
    public emitOfferUpdate(driverId: string, data: any) {
        const socketId = this.connectedDrivers.get(driverId);
        if (socketId) {
            this.io.to(socketId).emit('trip:offer-update', data);
            console.log(`[Socket] Sent offer update to driver ${driverId}`);
        }
    }

    /**
     * Emit trip update to customer
     */
    public emitTripUpdateToCustomer(customerId: string, trip: any) {
        // Find customer's socket (you may need to track customer sockets similarly)
        // For now, we'll use socket rooms
        this.io.to(`customer:${customerId}`).emit('trip:update', trip);
    }

    /**
     * Get Socket.IO instance
     */
    public getIO(): Server {
        return this.io;
    }

    /**
     * Get connected driver count
     */
    public getConnectedDriverCount(): number {
        return this.connectedDrivers.size;
    }
}

// Export singleton (initialized in server.ts)
export let socketServer: SocketServer;

export function initializeSocketServer(httpServer: HTTPServer): SocketServer {
    socketServer = new SocketServer(httpServer);
    console.log('[Socket] ✅ Socket.IO server initialized');
    return socketServer;
}
