import express from 'express';
import { getProfile, updateProfile, getEmployeeProfile } from '../controllers/profileController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/me', authenticateUser, getProfile);
router.put('/me', authenticateUser, updateProfile);
router.get('/employee/:userId', authenticateUser, getEmployeeProfile);

export default router;
