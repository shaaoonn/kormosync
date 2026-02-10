import express from 'express';
import { createTask, getTasks, getTaskById, updateTask, deleteTask, approveTask, startTask, stopTask, toggleTaskActive } from '../controllers/taskController';
import { addDependency, removeDependency, getDependencies } from '../controllers/dependencyController';
import { authenticateUser } from '../middlewares/authMiddleware';
import { getTaskAuditLogs } from '../services/auditService';

const router = express.Router();

router.post('/create', authenticateUser, createTask);
router.get('/list', authenticateUser, getTasks);
router.post('/start', authenticateUser, startTask);
router.post('/stop', authenticateUser, stopTask);
router.get('/:taskId', authenticateUser, getTaskById);
router.put('/:taskId', authenticateUser, updateTask);
router.delete('/:taskId', authenticateUser, deleteTask);
router.put('/:taskId/approve', authenticateUser, approveTask);
router.put('/:taskId/toggle-active', authenticateUser, toggleTaskActive);

// Dependency endpoints
router.get('/:taskId/dependencies', authenticateUser, getDependencies);
router.post('/:taskId/dependencies', authenticateUser, addDependency);
router.delete('/dependencies/:dependencyId', authenticateUser, removeDependency);

// Audit Log endpoint
router.get('/:taskId/audit', authenticateUser, async (req, res) => {
    try {
        const { taskId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const logs = await getTaskAuditLogs(taskId, limit);
        res.json({ success: true, auditLogs: logs });
    } catch (error) {
        console.error('Get Audit Logs Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
    }
});

export default router;
