import { Request, Response, NextFunction } from 'express';
import { checkRedisConnection } from '../config/redis';

/**
 * Optional middleware that returns 503 if Redis is unavailable.
 * Currently not wired to routes — OTP controller handles Redis
 * degradation gracefully. Can be re-enabled on specific routes
 * if a hard Redis gate is ever needed.
 */
export async function requireRedis(req: Request, res: Response, next: NextFunction) {
  const available = await checkRedisConnection();
  if (!available) {
    return res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'OTP service is temporarily unavailable. Please try again later.',
    });
  }
  next();
}
