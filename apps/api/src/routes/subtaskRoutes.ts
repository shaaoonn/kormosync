import express from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import {
    startSubTask,
    stopSubTask,
    completeSubTask,
    autoStopSubTask,
    getActiveSubTask,
    getSubTasksForTask
} from '../controllers/subtaskController';

const router = express.Router();

// Start tracking a sub-task (auto-pauses any active one)
router.post('/:subTaskId/start', authenticateUser, startSubTask);

// Stop tracking a sub-task (pause without completing)
router.post('/:subTaskId/stop', authenticateUser, stopSubTask);

// Auto-stop sub-task (when scheduled time ends, with proof of work)
router.post('/:subTaskId/auto-stop', authenticateUser, autoStopSubTask);

// Complete a sub-task (mark as done)
router.post('/:subTaskId/complete', authenticateUser, completeSubTask);

// Get currently active sub-task for user
router.get('/active', authenticateUser, getActiveSubTask);

// Get all sub-tasks for a task with time info
router.get('/task/:taskId', authenticateUser, getSubTasksForTask);

export default router;

