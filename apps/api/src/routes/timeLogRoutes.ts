import express from 'express';
import { uploadTimeLog, getTimeLogs } from '../controllers/timeLogController';
import { upload } from '../controllers/taskController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = express.Router();

/**
 * POST /api/timelogs
 * Upload a screenshot and activity data
 * Body: { taskId, keyboardCount, mouseCount, activeSeconds, recordedAt }
 * File: screenshot
 */
router.post('/', authenticateUser, upload.single('screenshot'), uploadTimeLog);

/**
 * GET /api/timelogs
 * Fetch logs for a user/task/date (with signed URLs)
 * Query: ?date=YYYY-MM-DD & taskId=... & employeeId=...
 */
router.get('/', authenticateUser, getTimeLogs);

export default router;
