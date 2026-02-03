import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import {
    logActivity,
    getTaskActivity,
    getUserActivity,
    getTodayStats,
    getCompanyActivity
} from '../controllers/activityController';

const router = Router();

// Activity Logging (from desktop app)
router.post('/log', authenticateUser, logActivity);

// Activity Retrieval
router.get('/task/:taskId', authenticateUser, getTaskActivity);
router.get('/user/:userId', authenticateUser, getUserActivity);
router.get('/today', authenticateUser, getTodayStats);
router.get('/company', authenticateUser, getCompanyActivity);

export default router;
