
import { Router } from 'express';
import { getMyCode, enterCode, getStats, createProgram, getPrograms, getAdminStats } from '../controllers/referralController';
import { authenticate } from '../middleware/auth'; // Assuming this exists

const router = Router();

// User Routes
router.get('/my-code', authenticate, getMyCode);
router.post('/enter', authenticate, enterCode);
router.get('/stats', authenticate, getStats);

// Admin Routes (Ideally protected by admin middleware)
router.post('/programs', authenticate, createProgram);
router.get('/programs', authenticate, getPrograms);
router.get('/admin-stats', authenticate, getAdminStats);

export default router;
