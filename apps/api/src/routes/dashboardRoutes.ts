import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import { getStats, getEmployeeStats } from '../controllers/dashboardController';

const router = Router();

// Dashboard Stats (Protected)
router.get('/stats', authenticateUser, getStats);
router.get('/employee-stats', authenticateUser, getEmployeeStats);

export default router;
