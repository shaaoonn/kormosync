import express from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import { submitProofForm, getTaskSubmissions, getMySubmissions } from '../controllers/submissionController';

const router = express.Router();

// Submit proof form answers
router.post('/submit', authenticateUser, submitProofForm);

// Get submissions for a task (admin/manager view)
router.get('/task/:taskId', authenticateUser, getTaskSubmissions);

// Get my submissions (employee view)
router.get('/my', authenticateUser, getMySubmissions);

export default router;
