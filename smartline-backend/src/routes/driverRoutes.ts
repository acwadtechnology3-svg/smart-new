import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireDriver } from '../middleware/rbac';
import {
  getDriverSummary,
  getDriverMe,
  getDriverStatus,
  registerDriver,
  getDriverPublic,
  requestVehicleChange,
  uploadDriverFile,
} from '../controllers/driverController';

const router = Router();

router.get('/summary', authenticate, requireDriver, getDriverSummary);
router.get('/me', authenticate, requireDriver, getDriverMe);
router.get('/status', authenticate, requireDriver, getDriverStatus);
router.post('/register', authenticate, requireDriver, registerDriver);
router.post('/request-change-vehicle', authenticate, requireDriver, requestVehicleChange);
router.post('/upload', authenticate, requireDriver, uploadDriverFile);

router.get('/public/:driverId', authenticate, getDriverPublic);

export default router;
