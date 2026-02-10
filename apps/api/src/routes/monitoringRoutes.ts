import express from 'express';
import { getTaskMonitoring } from '../controllers/monitoringController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/task/:taskId', authenticateUser, getTaskMonitoring);

export default router;
