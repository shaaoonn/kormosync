import { Router } from 'express';
import { syncUser, getMe } from '../controllers/authController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = Router();

// Protected route to sync authentication state
// Protected route to sync authentication state
router.post('/sync', authenticateUser, syncUser);
router.get('/me', authenticateUser, getMe);

export default router;
