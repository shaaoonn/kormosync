import express from 'express';
import { getPendingAssignments, acceptAssignment, rejectAssignment, getTaskAssignments } from '../controllers/assignmentController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = express.Router();

// Employee endpoints
router.get('/pending', authenticateUser, getPendingAssignments);
router.post('/:assignmentId/accept', authenticateUser, acceptAssignment);
router.post('/:assignmentId/reject', authenticateUser, rejectAssignment);

// Admin endpoint
router.get('/task/:taskId', authenticateUser, getTaskAssignments);

export default router;
