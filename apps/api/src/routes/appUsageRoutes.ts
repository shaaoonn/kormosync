import express from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import {
    logAppUsage,
    getUserAppUsage,
    getAppCategories,
    upsertAppCategory,
    deleteAppCategory,
} from '../controllers/appUsageController';

const router = express.Router();

// Desktop app: bulk upload app usage data
router.post('/log', authenticateUser, logAppUsage);

// Admin: get app usage for a specific user
router.get('/user/:userId', authenticateUser, getUserAppUsage);

// App categories (CRUD)
router.get('/categories', authenticateUser, getAppCategories);
router.post('/categories', authenticateUser, upsertAppCategory);
router.delete('/categories/:id', authenticateUser, deleteAppCategory);

export default router;
