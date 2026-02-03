import { Router } from 'express';
import { syncUser } from '../controllers/authController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = Router();

// Protected route to sync authentication state
router.post('/sync', authenticateUser, syncUser);

export default router;
