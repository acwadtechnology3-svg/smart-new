import { Request, Response } from 'express';
import { query } from '../config/database';
import redis from '../config/redis';
import { z } from 'zod';

// Types
interface RoutePoint {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
    recordedAt: string;
}

// Schemas
const tripIdSchema = z.string().uuid();

export const getTripRoute = async (req: Request, res: Response) => {
    try {
        const { tripId } = req.params;
        const { simplified, format } = req.query;

        // Validate tripId
        const parseResult = tripIdSchema.safeParse(tripId);
        if (!parseResult.success) {
            return res.status(400).json({ success: false, error: 'Invalid trip ID' });
        }

        // Check cache first
        const cacheKey = `trip:route:${tripId}:full`;
        const cachedRoute = await redis.get(cacheKey);

        if (cachedRoute) {
            const data = JSON.parse(cachedRoute);
            return res.json({ success: true, data });
        }

        // Query DB
        const result = await query(
            `SELECT latitude as lat, longitude as lng, heading, speed, accuracy, recorded_at as "recordedAt"
       FROM trip_route_points
       WHERE trip_id = $1
       ORDER BY recorded_at ASC`,
            [tripId]
        );

        let points = result.rows;

        if (points.length === 0) {
            const bufferKey = `trip:route:${tripId}:buffer`;
            const bufferPoints = await redis.lrange(bufferKey, 0, -1);
            if (bufferPoints.length > 0) {
                const buffered = bufferPoints.map(p => {
                    const parsed = JSON.parse(p);
                    return {
                        lat: parsed.lat,
                        lng: parsed.lng,
                        heading: parsed.heading,
                        speed: parsed.speed,
                        accuracy: parsed.accuracy,
                        recordedAt: parsed.timestamp
                    };
                });
                points = buffered;
            }
        } else {
            const tripStatusRes = await query(`SELECT status FROM trips WHERE id = $1`, [tripId]);
            if (tripStatusRes.rows.length > 0 && tripStatusRes.rows[0].status === 'started') {
                const bufferKey = `trip:route:${tripId}:buffer`;
                const bufferPointsStr = await redis.lrange(bufferKey, 0, -1);
                const bufferPoints = bufferPointsStr.map(p => {
                    const parsed = JSON.parse(p);
                    return {
                        lat: parsed.lat,
                        lng: parsed.lng,
                        heading: parsed.heading,
                        speed: parsed.speed,
                        accuracy: parsed.accuracy,
                        recordedAt: parsed.timestamp
                    };
                });

                const lastDbPoint = points[points.length - 1];
                if (lastDbPoint) {
                    const lastDbTime = new Date(lastDbPoint.recordedAt).getTime();
                    const newPoints = bufferPoints.filter(p => new Date(p.recordedAt).getTime() > lastDbTime);
                    points = points.concat(newPoints);
                } else {
                    points = bufferPoints;
                }
            }
        }

        if (simplified === 'true' && points.length > 100) {
            points = simplifyPoints(points, 0.0001);
        }

        const summary = calculateSummary(points);

        const responseData = {
            tripId,
            points,
            summary
        };

        if (format === 'geojson') {
            return res.json({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: points.map((p: any) => [p.lng, p.lat])
                    },
                    properties: {
                        tripId,
                        ...summary
                    }
                }]
            });
        }

        const tripRes = await query(`SELECT status FROM trips WHERE id = $1`, [tripId]);
        if (tripRes.rows.length > 0 && ['completed', 'cancelled'].includes(tripRes.rows[0].status)) {
            await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 300);
        }

        res.json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('Get trip route error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const getTripRouteSummary = async (req: Request, res: Response) => {
    try {
        const { tripId } = req.params;

        const summaryRes = await query(
            `SELECT * FROM trip_route_summary WHERE trip_id = $1`,
            [tripId]
        );

        if (summaryRes.rows.length > 0) {
            return res.json({ success: true, data: summaryRes.rows[0] });
        }

        const result = await query(
            `SELECT latitude as lat, longitude as lng, recorded_at as "recordedAt"
       FROM trip_route_points WHERE trip_id = $1 ORDER BY recorded_at ASC`,
            [tripId]
        );

        const summary = calculateSummary(result.rows);
        res.json({ success: true, data: summary });

    } catch (error) {
        console.error('Get route summary error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const getActiveRoutes = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
        const offset = (page - 1) * limit;

        const sql = `
      SELECT t.id, t.status, t.driver_id, d.first_name || ' ' || d.last_name as name, 
             (
               SELECT json_agg(json_build_object('lat', rp.latitude, 'lng', rp.longitude) ORDER BY rp.recorded_at)
               FROM trip_route_points rp
               WHERE rp.trip_id = t.id
             ) as route
      FROM trips t
      JOIN users d ON t.driver_id = d.id
      WHERE t.status = 'started'
      ORDER BY t.created_at DESC
      LIMIT $1 OFFSET $2
    `;

        const result = await query(sql, [limit, offset]);

        res.json({
            success: true,
            data: result.rows,
            meta: { page, limit }
        });
    } catch (error) {
        console.error('Get active routes error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const getTripHistory = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const status = req.query.status as string;
        const search = req.query.search as string;

        const offset = (page - 1) * limit;

        let whereClause = '1=1';
        let params: any[] = [];
        let paramIdx = 1;

        if (status && status !== 'all') {
            whereClause += ` AND t.status = $${paramIdx}`;
            params.push(status);
            paramIdx++;
        }

        if (search) {
            whereClause += ` AND (
                t.id::text ILIKE $${paramIdx} OR 
                u_driver.first_name ILIKE $${paramIdx} OR 
                u_driver.last_name ILIKE $${paramIdx} OR
                u_cust.first_name ILIKE $${paramIdx} OR 
                u_cust.last_name ILIKE $${paramIdx}
            )`;
            params.push(`%${search}%`);
            paramIdx++;
        }

        // Count total
        const countRes = await query(
            `SELECT COUNT(*) 
             FROM trips t
             LEFT JOIN users u_driver ON t.driver_id = u_driver.id
             LEFT JOIN users u_cust ON t.customer_id = u_cust.id
             WHERE ${whereClause}`,
            params
        );
        const total = parseInt(countRes.rows[0].count);

        // Fetch Data
        params.push(limit, offset);
        const dataRes = await query(
            `SELECT 
                t.id, 
                t.created_at as "createdAt", 
                t.status, 
                t.price as fare, 
                t.final_price,
                t.driver_id as "driverId",
                u_driver.first_name || ' ' || u_driver.last_name as "driverName",
                t.customer_id as "customerId",
                u_cust.first_name || ' ' || u_cust.last_name as "customerName",
                t.pickup_desc as "pickupAddress",
                t.pickup_lat, t.pickup_lng,
                t.dest_desc as "destAddress",
                t.dest_lat, t.dest_lng,
                t.payment_status as "paymentStatus"
             FROM trips t
             LEFT JOIN users u_driver ON t.driver_id = u_driver.id
             LEFT JOIN users u_cust ON t.customer_id = u_cust.id
             WHERE ${whereClause}
             ORDER BY t.created_at DESC
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
            params
        );

        // Transform
        const trips = dataRes.rows.map(row => ({
            id: row.id,
            createdAt: row.createdAt,
            driverId: row.driverId,
            driverName: row.driverName,
            customerId: row.customerId,
            customerName: row.customerName,
            pickup: {
                address: row.pickupAddress,
                lat: parseFloat(row.pickup_lat),
                lng: parseFloat(row.pickup_lng)
            },
            destination: {
                address: row.destAddress,
                lat: parseFloat(row.dest_lat),
                lng: parseFloat(row.dest_lng)
            },
            distance: 0,
            duration: 0,
            fare: parseFloat(row.final_price || row.fare),
            status: row.status,
            paymentStatus: row.paymentStatus
        }));

        res.json({
            success: true,
            data: {
                trips,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get trip history error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const generateRouteSummary = async (req: Request, res: Response) => {
    try {
        const { tripId } = req.params;

        const result = await query(
            `SELECT latitude as lat, longitude as lng, recorded_at as "recordedAt"
       FROM trip_route_points WHERE trip_id = $1 ORDER BY recorded_at ASC`,
            [tripId]
        );

        const points = result.rows;
        if (points.length === 0) {
            return res.status(404).json({ success: false, error: 'No points found' });
        }

        const summary = calculateSummary(points);

        try {
            await query(
                `INSERT INTO trip_route_summary 
            (trip_id, total_distance, total_duration, points_count, start_location, end_location)
            VALUES ($1, $2, $3, $4, 
                    ST_SetSRID(ST_MakePoint($5, $6), 4326), 
                    ST_SetSRID(ST_MakePoint($7, $8), 4326))
            ON CONFLICT (trip_id) DO UPDATE SET
            total_distance = EXCLUDED.total_distance,
            total_duration = EXCLUDED.total_duration,
            points_count = EXCLUDED.points_count,
            start_location = EXCLUDED.start_location,
            end_location = EXCLUDED.end_location`,
                [
                    tripId,
                    summary.totalDistance,
                    summary.totalDuration,
                    summary.pointsCount,
                    points[0].lng, points[0].lat,
                    points[points.length - 1].lng, points[points.length - 1].lat
                ]
            );
        } catch (e) {
            console.warn('Failed to save geometry, maybe PostGIS not active', e);
        }

        res.json({ success: true, data: summary });
    } catch (error) {
        console.error('Generate summary error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

function calculateSummary(points: any[]) {
    if (points.length < 2) {
        return {
            totalDistance: 0,
            totalDuration: 0,
            pointsCount: points.length,
            startTime: points[0]?.recordedAt || null,
            endTime: points[points.length - 1]?.recordedAt || null
        };
    }

    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
        totalDistance += getDistanceFromLatLonInKm(
            points[i - 1].lat, points[i - 1].lng,
            points[i].lat, points[i].lng
        );
    }

    const startTime = new Date(points[0].recordedAt);
    const endTime = new Date(points[points.length - 1].recordedAt);
    const totalDuration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

    return {
        totalDistance: parseFloat(totalDistance.toFixed(2)),
        totalDuration,
        pointsCount: points.length,
        startTime: points[0].recordedAt,
        endTime: points[points.length - 1].recordedAt
    };
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371;
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

function simplifyPoints(points: any[], epsilon: number) {
    if (points.length <= 2) return points;

    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
        const d = perpendicularDistance(points[i], points[0], points[end]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }

    if (dmax > epsilon) {
        const results1 = simplifyPoints(points.slice(0, index + 1), epsilon);
        const results2 = simplifyPoints(points.slice(index), epsilon);
        return results1.slice(0, results1.length - 1).concat(results2);
    } else {
        return [points[0], points[end]];
    }
}

function perpendicularDistance(point: any, lineStart: any, lineEnd: any) {
    let dx = lineEnd.lng - lineStart.lng;
    let dy = lineEnd.lat - lineStart.lat;

    let mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 0.0) {
        dx /= mag;
        dy /= mag;
    }

    const pvx = point.lng - lineStart.lng;
    const pvy = point.lat - lineStart.lat;

    const pvdot = pvx * dx + pvy * dy;
    const ax = pvx - pvdot * dx;
    const ay = pvy - pvdot * dy;

    return Math.sqrt(ax * ax + ay * ay);
}
