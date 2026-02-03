import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import {
    createTaskBundle,
    addSubTask,
    validateSchedule,
    publishTask,
    getTaskBundle,
    updateSubTask,
    deleteSubTask
} from '../controllers/taskBundleController';

const router = Router();

// Task Bundle CRUD
router.post('/bundle', authenticateUser, createTaskBundle);
router.get('/:taskId', authenticateUser, getTaskBundle);
router.post('/:taskId/subtasks', authenticateUser, addSubTask);
router.post('/:taskId/validate-schedule', authenticateUser, validateSchedule);
router.patch('/:taskId/publish', authenticateUser, publishTask);

// SubTask CRUD
router.patch('/subtasks/:subTaskId', authenticateUser, updateSubTask);
router.delete('/subtasks/:subTaskId', authenticateUser, deleteSubTask);

export default router;
