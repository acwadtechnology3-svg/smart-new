import { Router } from 'express';
import {
  createTrip,
  getTripStatus,
  acceptTripOffer,
  updateTripStatus,
  getTripDetail,
  cancelTrip,
  getTripParticipants,
  getDriverTripHistory,
  getPassengerTripHistory,
  getActiveTrip,
  getRequestedTrips,
} from '../controllers/tripController';
import {
  getTripRoute,
  getTripRouteSummary
} from '../controllers/tripRouteController';
import { authenticate } from '../middleware/auth';
import { requireCustomer, requireDriver } from '../middleware/rbac';
import { validateBody, validateParams } from '../middleware/validate';
import { createTripSchema, acceptOfferSchema, updateTripStatusSchema, uuidSchema } from '../validators/schemas';
import { z } from 'zod';

const router = Router();

// Customer routes - require customer role
router.post(
  '/create',
  authenticate,
  // requireCustomer, // Allow drivers to request rides too for testing/flexibility
  validateBody(createTripSchema),
  createTrip
);

router.post(
  '/accept-offer',
  authenticate,
  requireCustomer,
  validateBody(acceptOfferSchema),
  acceptTripOffer
);

// Driver routes - require driver role
router.post(
  '/update-status',
  authenticate,
  requireDriver,
  validateBody(updateTripStatusSchema),
  updateTripStatus
);

// Driver trip history
router.get(
  '/driver/history',
  authenticate,
  requireDriver,
  getDriverTripHistory
);

// Passenger trip history
router.get(
  '/passenger/history',
  authenticate,
  requireCustomer,
  getPassengerTripHistory
);

// Active trip for current user
router.get(
  '/active',
  authenticate,
  getActiveTrip
);

// Requested trips nearby (for drivers)
router.get(
  '/requested',
  authenticate,
  requireDriver,
  getRequestedTrips
);

// Route endpoints from Phase 1
router.get(
  '/:tripId/route',
  authenticate,
  validateParams(z.object({ tripId: uuidSchema })),
  getTripRoute
);

router.get(
  '/:tripId/route/summary',
  authenticate,
  validateParams(z.object({ tripId: uuidSchema })),
  getTripRouteSummary
);

// Trip detail (includes customer info)
router.get(
  '/:tripId/detail',
  authenticate,
  validateParams(z.object({ tripId: uuidSchema })),
  getTripDetail
);

// Trip participants
router.get(
  '/:tripId/participants',
  authenticate,
  validateParams(z.object({ tripId: uuidSchema })),
  getTripParticipants
);

// Customer cancel trip
router.post(
  '/:tripId/cancel',
  authenticate,
  // requireCustomer, // Allow creator (even driver) to cancel
  validateParams(z.object({ tripId: uuidSchema })),
  cancelTrip
);

// Both customer and driver can view trip status
router.get(
  '/:tripId',
  authenticate,
  validateParams(z.object({ tripId: uuidSchema })),
  getTripStatus
);

export default router;
