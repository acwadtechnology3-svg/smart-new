
// MUST BE FIRST: Patch Redis version check for Windows compatibility
import './config/redis-patch';
// Force restart for env update

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { logger } from './logger';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, setupGracefulShutdown } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import tripRoutes from './routes/tripRoutes';
import paymentRoutes from './routes/paymentRoutes';
import locationRoutes from './routes/locationRoutes';
import userRoutes from './routes/userRoutes';
import driverRoutes from './routes/driverRoutes';
import tripOfferRoutes from './routes/tripOfferRoutes';
import messageRoutes from './routes/messageRoutes';
import pricingRoutes from './routes/pricingRoutes';
import sosRoutes from './routes/sosRoutes';
import walletRoutes from './routes/walletRoutes';
import supportRoutes from './routes/supportRoutes';
import supportAdminRoutes from './routes/supportAdminRoutes';
import dashboardAuthRoutes from './routes/dashboardAuthRoutes';
import popupRoutes from './routes/popupRoutes';
import surgeRoutes from './routes/surgeRoutes';
import driverPreferenceRoutes from './routes/driverPreferenceRoutes';
import chatbotRoutes from './routes/chatbotRoutes';
import intercityRoutes from './routes/intercityRoutes';
import bannerRoutes from './routes/bannerRoutes';
import notificationRoutes from './routes/notificationRoutes';
import referralRoutes from './routes/referralRoutes';
import savedLocationRoutes from './routes/savedLocationRoutes';
import configRoutes from './routes/configRoutes';
import adminRoutes from './routes/adminRoutes'; // Phase 1 & 2
import { checkDatabaseConnection } from './config/database';
import { checkRedisConnection } from './config/redis';
import { startLocationSync } from './workers/locationSyncWorker';
import { startRealtimeServer } from './realtime/realtimeServer';
import { adminLocationFeed } from './services/AdminLocationFeed'; // Phase 2
import { tripRouteRecorder } from './services/TripRouteRecorder'; // Phase 1
import { initializeSocketServer } from './socket/socketServer'; // Moved to top

const app = express();
const PORT = config.PORT;

// ===== Security Middleware =====

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS - Configure based on environment
const corsOptions = {
  origin: config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(','),
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Disable X-Powered-By header
app.disable('x-powered-by');

// ===== Structured Request Logging =====
app.use(requestLogger);

// ===== Routes =====

// Helper to mount routes at both /api/... and /... (for compatibility)
const mount = (path: string, route: any) => {
  app.use([`/api${path}`, path], route);
};

mount('/auth', authRoutes);
mount('/dashboard/auth', dashboardAuthRoutes);
mount('/trips', tripRoutes);
mount('/payment', paymentRoutes);
mount('/location', locationRoutes);
mount('/users', userRoutes);
mount('/drivers', driverRoutes);
mount('/trip-offers', tripOfferRoutes);
mount('/messages', messageRoutes);
mount('/pricing', pricingRoutes);
mount('/sos', sosRoutes);
mount('/wallet', walletRoutes);
mount('/support', supportRoutes);
mount('/admin', adminRoutes); // Mount admin routes (Phase 1 & 2)
mount('/admin/support', supportAdminRoutes);
mount('/popups', popupRoutes);
mount('/surge', surgeRoutes);
mount('/drivers/preferences', driverPreferenceRoutes);
mount('/chatbot', chatbotRoutes);
mount('/intercity', intercityRoutes);
mount('/banners', bannerRoutes);
mount('/notifications', notificationRoutes);
mount('/referrals', referralRoutes);
mount('/saved-locations', savedLocationRoutes);
mount('/config', configRoutes);

// ===== Health Check =====
app.get('/health', async (req, res) => {
  const dbHealthy = await checkDatabaseConnection();
  const redisHealthy = await checkRedisConnection();

  // DB is critical, Redis is optional (degraded mode)
  const status = !dbHealthy ? 'unhealthy' : (redisHealthy ? 'ok' : 'degraded');
  const statusCode = !dbHealthy ? 503 : 200;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: config.NODE_ENV,
    services: {
      database: dbHealthy ? 'healthy' : 'unhealthy',
      redis: redisHealthy ? 'healthy' : 'unavailable',
      locationFeed: adminLocationFeed.isRunning() ? 'running' : 'stopped'
    },
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'SmartLine Backend API',
    version: '1.0.0',
    environment: config.NODE_ENV,
  });
});

// ===== 404 Handler =====
app.use((req, res) => {
  logger.warn({
    msg: `Route not found: ${req.method} ${req.originalUrl}`,
    event: 'route_not_found',
    req: { method: req.method, url: req.originalUrl },
  });
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// ===== Global Error Handler =====
app.use(errorHandler);

// ===== Start Server =====
const server = http.createServer(app);
startRealtimeServer(server);
initializeSocketServer(server);

// Register graceful shutdown handlers
setupGracefulShutdown(server);

server.listen(PORT, '0.0.0.0', async () => {
  logger.info({
    msg: `SmartLine Backend Server Started on port ${PORT}`,
    event: 'server_started',
    port: PORT,
    environment: config.NODE_ENV,
    logLevel: config.LOG_LEVEL,
  });

  // Start Admin Location Feed (Phase 2)
  adminLocationFeed.start().catch(err =>
    logger.error({ msg: 'Failed to start admin location feed', error: err })
  );

  // Buffer Cleanup Job (Phase 1)
  setInterval(() => {
    tripRouteRecorder.cleanupStaleBuffers();
  }, 3600000); // 1 hour

  // Initialize background workers
  // Initialize background workers
  try {
    await startLocationSync();
    logger.info({ msg: 'Background workers initialized', event: 'workers_started' });
  } catch (error) {
    logger.error({ msg: 'Failed to initialize background workers', event: 'workers_start_failed', error });
  }
});
