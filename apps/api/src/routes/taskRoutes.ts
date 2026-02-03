import express from 'express';
import { createTask, getTasks, getTaskById, updateTask, deleteTask, approveTask, startTask, stopTask } from '../controllers/taskController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/create', authenticateUser, createTask);
router.get('/list', authenticateUser, getTasks);
router.post('/start', authenticateUser, startTask);
router.post('/stop', authenticateUser, stopTask);
router.get('/:taskId', authenticateUser, getTaskById);
router.put('/:taskId', authenticateUser, updateTask);
router.delete('/:taskId', authenticateUser, deleteTask);
router.put('/:taskId/approve', authenticateUser, approveTask);

export default router;
