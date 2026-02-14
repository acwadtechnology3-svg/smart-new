import { Request, Response } from 'express';
import { getPoolStats } from '../config/database';
import redis from '../config/redis';
import { adminLocationFeed } from '../services/AdminLocationFeed';
import { tripRouteRecorder } from '../services/TripRouteRecorder';
import os from 'os';

export const getSystemStats = async (req: Request, res: Response) => {
    try {
        const memory = process.memoryUsage();

        // Redis Stats
        const redisInfo = await redis.info();
        // Parse some basic redis info if needed, or just get specific keys
        const redisMemory = await redis.info('memory');

        // DB Stats
        const dbStats = getPoolStats();

        // Application Stats
        const activeTripIds = await redis.keys('trip:route:*:recording');
        const bufferKeys = await redis.keys('trip:route:*:buffer');

        let totalBufferedPoints = 0;
        // This could be slow if many keys, optimize for production
        if (bufferKeys.length > 0) {
            // Sample or count pipeline?
            // For monitoring, maybe just count keys
        }

        const stats = {
            system: {
                uptime: process.uptime(),
                memory: {
                    rss: memory.rss,
                    heapTotal: memory.heapTotal,
                    heapUsed: memory.heapUsed,
                },
                os: {
                    loadavg: os.loadavg(),
                    freemem: os.freemem(),
                    totalmem: os.totalmem()
                }
            },
            services: {
                database: {
                    pool: dbStats,
                    status: 'connected' // Assuming connected if reachable
                },
                redis: {
                    status: 'connected',
                    // memory_human: ... parsing redisInfo
                },
                locationFeed: {
                    running: adminLocationFeed.isRunning(),
                    // lastSnapshotTime: ... add getter to service?
                },
                tripRecorder: {
                    activeRecordings: activeTripIds.length,
                    bufferedTrips: bufferKeys.length
                }
            },
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get monitoring stats error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
