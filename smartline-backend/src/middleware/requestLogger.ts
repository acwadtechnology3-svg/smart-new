
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import { requestContext } from '../utils/requestContext';
import { config } from '../config/env';

/**
 * Middleware to intercept requests and log them with request context
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    const startTime = process.hrtime();

    // Create context for this request
    const context = {
        requestId,
        path: req.originalUrl,
        method: req.method,
        startTime,
    };

    // Run the rest of the request within the context
    requestContext.run(context, () => {
        // Add requestId to response header
        res.setHeader('X-Request-ID', requestId);

        // DEBUG: Log to file
        const fs = require('fs');
        const path = require('path');
        const logFile = path.resolve(__dirname, '../../backend_requests.log');
        const timestamp = new Date().toISOString();

        fs.appendFile(logFile, `[${timestamp}] REQ: ${req.method} ${req.originalUrl}\n`, (err: any) => {
            if (err) console.error("Failed to write log", err);
        });

        // Log request start
        logger.debug({
            msg: 'Incoming request',
            event: 'http_request_started',
            req: {
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userAgent: req.get('user-agent'),
            },
        });

        // Hook into response finish to log the result
        res.on('finish', () => {
            const diff = process.hrtime(startTime);
            const durationMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);
            const duration = parseFloat(durationMs);

            // Determine log level based on status and duration
            const isServerError = res.statusCode >= 500;
            const isClientError = res.statusCode >= 400;
            const isSlow = duration > config.SLOW_REQUEST_MS;

            let level: string = 'info';
            if (isServerError) level = 'error';
            else if (isClientError) level = 'warn';
            else if (isSlow) level = 'warn';

            // Retrieve userId if it was attached to the request by auth middleware
            const userId = (req as any).user?.id || (req as any).userId || requestContext.getUserId();

            // DEBUG: Log completion to file
            const statusLog = `[${new Date().toISOString()}] RES: ${res.statusCode} (User: ${userId || 'Unauth'}) ${durationMs}ms - ${req.originalUrl}\n`;
            fs.appendFile(logFile, statusLog, (err: any) => { });

            (logger as any)[level]({
                msg: `HTTP ${req.method} ${req.originalUrl} completed with ${res.statusCode} in ${durationMs}ms`,
                event: 'http_request_completed',
                req: {
                    method: req.method,
                    url: req.originalUrl,
                    query: req.query,
                    params: req.params,
                    // Log body only for server errors to assist debugging
                    ...(isServerError ? { body: req.body } : {}),
                },
                res: {
                    statusCode: res.statusCode,
                    contentLength: res.get('content-length'),
                },
                userId,
                duration_ms: duration,
            });
        });

        next();
    });
};
