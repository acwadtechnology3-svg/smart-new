import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    getSavedLocations,
    addSavedLocation,
    deleteSavedLocation,
    updateSavedLocation,
    getSearchHistory,
    addSearchHistory,
    clearSearchHistory
} from '../controllers/savedLocationController';

const router = Router();

// Search History
router.get('/history', authenticate, getSearchHistory);
router.post('/history', authenticate, addSearchHistory);
router.delete('/history', authenticate, clearSearchHistory);

// Saved Locations
router.get('/', authenticate, getSavedLocations);
router.post('/', authenticate, addSavedLocation);
router.put('/:id', authenticate, updateSavedLocation);
router.delete('/:id', authenticate, deleteSavedLocation);

export default router;
