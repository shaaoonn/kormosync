import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import { getStats, getEmployeeStats, getBadgeCounts } from '../controllers/dashboardController';

const router = Router();

// Dashboard Stats (Protected)
router.get('/stats', authenticateUser, getStats);
router.get('/employee-stats', authenticateUser, getEmployeeStats);
router.get('/badge-counts', authenticateUser, getBadgeCounts);

export default router;
