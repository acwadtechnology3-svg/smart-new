import { Request, Response } from 'express';
import { adminLocationFeed, DriverLocationSnapshot } from '../services/AdminLocationFeed';

export const getLiveLocations = async (req: Request, res: Response) => {
    try {
        const { status, vehicleType, bounds, page = '1', limit = '100' } = req.query;

        if (!adminLocationFeed.isRunning()) {
            await adminLocationFeed.start();
        }

        // 1. Get cached snapshot
        let drivers: DriverLocationSnapshot[] = await adminLocationFeed.getLatestSnapshot();
        // Fallback: generate snapshot on demand if cache is empty/stale or feed is not running.
        if (drivers.length === 0) {
            drivers = await adminLocationFeed.generateSnapshot();
        }

        // 2. Apply filters
        if (status) {
            drivers = drivers.filter(d => d.status === status);
        }

        if (vehicleType) {
            drivers = drivers.filter(d => d.vehicleType === vehicleType);
        }

        if (bounds) {
            const [neLat, neLng, swLat, swLng] = (bounds as string).split(',').map(Number);
            if (!isNaN(neLat) && !isNaN(neLng) && !isNaN(swLat) && !isNaN(swLng)) {
                drivers = drivers.filter(d =>
                    d.location.lat <= neLat && d.location.lat >= swLat &&
                    d.location.lng <= neLng && d.location.lng >= swLng
                );
            }
        }

        // 3. Pagination
        const pageNum = parseInt(page as string);
        const limitNum = Math.min(parseInt(limit as string), 500); // Cap at 500
        const total = drivers.length;
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedDrivers = drivers.slice(startIndex, endIndex);

        // 4. Response
        res.set('Cache-Control', 'public, max-age=15'); // 15s cache
        res.json({
            success: true,
            data: {
                drivers: paginatedDrivers,
                metadata: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    hasMore: endIndex < total,
                    snapshotAge: 0, // TODO: calculate age
                    lastRefresh: new Date().toISOString() // TODO: store this in feed
                }
            }
        });

    } catch (error) {
        console.error('Get live locations error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
