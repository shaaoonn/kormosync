import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import { getStats } from '../controllers/dashboardController';

const router = Router();

// Dashboard Stats (Protected)
router.get('/stats', authenticateUser, getStats);

export default router;
