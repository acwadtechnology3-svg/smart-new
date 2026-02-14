
import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';
import { isProduction } from '../config/env';

/**
 * Global error handler middleware
 */
export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const statusCode = err.status || err.statusCode || 500;

    // Categorize errors for better mapping if they are known types
    let errorCode = err.code || 'INTERNAL_ERROR';
    let message = isProduction && statusCode === 500 ? 'Internal server error' : err.message;

    // Specific mapping for common error patterns
    if (err.name === 'UnauthorizedError') {
        errorCode = 'UNAUTHORIZED';
    } else if (err.name === 'ValidationError' || err.code === 'VALIDATION_ERROR') {
        errorCode = 'VALIDATION_ERROR';
    }

    // Log the error with all context
    logger.error({
        msg: `Error handling request: ${err.message}`,
        event: 'unhandled_error',
        error: {
            type: err.name,
            message: err.message,
            stack: isProduction ? undefined : err.stack,
            code: errorCode,
            ...err, // Capture other properties if present
        },
        req: {
            method: req.method,
            url: req.originalUrl,
        },
    });

    // Return safe response
    res.status(statusCode).json({
        success: false,
        error: {
            code: errorCode,
            message,
            ...(isProduction ? {} : { details: err.details, stack: err.stack }),
        },
    });
};

/**
 * Graceful shutdown handler
 * Closes services in reverse dependency order:
 * 1. Stop accepting new connections (server.close)
 * 2. Stop background services (location feed, workers)
 * 3. Close Redis connection
 * 4. Exit process
 */
export const setupGracefulShutdown = (server: any) => {
    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
        if (isShuttingDown) return; // Prevent double shutdown
        isShuttingDown = true;

        logger.info({ msg: `Received ${signal}, shutting down gracefully`, event: 'server_shutdown_started' });

        // Force shutdown after 15s if graceful fails
        const forceTimer = setTimeout(() => {
            logger.error({ msg: 'Could not close connections in time, forceful shutdown', event: 'server_shutdown_forced' });
            process.exit(1);
        }, 15000);

        try {
            // 1. Stop accepting new connections
            await new Promise<void>((resolve) => {
                server.close(() => resolve());
            });
            logger.info({ msg: 'HTTP server closed', event: 'server_closed' });

            // 2. Stop background services
            const { adminLocationFeed } = await import('../services/AdminLocationFeed');
            await adminLocationFeed.stop();

            const { stopLocationSync } = await import('../workers/locationSyncWorker');
            await stopLocationSync();

            // 3. Close Redis
            const { closeRedis } = await import('../config/redis');
            await closeRedis();

            logger.info({ msg: 'Graceful shutdown completed', event: 'server_shutdown_completed' });
        } catch (err) {
            logger.error({ msg: 'Error during graceful shutdown', event: 'server_shutdown_error', error: err });
        } finally {
            clearTimeout(forceTimer);
            process.exit(0);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
        logger.error({
            msg: 'Unhandled Rejection',
            event: 'unhandled_rejection',
            error: reason instanceof Error ? {
                message: reason.message,
                stack: reason.stack
            } : { reason }
        });
    });

    process.on('uncaughtException', (error) => {
        logger.fatal({
            msg: 'Uncaught Exception',
            event: 'uncaught_exception',
            error: {
                message: error.message,
                stack: error.stack
            }
        });
        shutdown('UNCAUGHT_EXCEPTION');
    });
};
