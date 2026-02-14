import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';
import { getActiveRoutes, generateRouteSummary, getTripHistory } from '../controllers/tripRouteController';
import { getLiveLocations } from '../controllers/adminLocationController';
import { getSystemStats } from '../controllers/monitoringController';
import { z } from 'zod';
import { validateParams } from '../middleware/validate';
import { uuidSchema } from '../validators/schemas';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Phase 2: Live Location Feed
router.get('/locations/live', getLiveLocations);

// Monitoring
router.get('/monitoring/stats', getSystemStats);

// Phase 1: Trip Route Management
router.get('/trips/active-routes', getActiveRoutes);
router.get('/trips/history', getTripHistory);

router.post(
    '/trips/:tripId/route/generate-summary',
    validateParams(z.object({ tripId: uuidSchema })),
    generateRouteSummary
);

export default router;
