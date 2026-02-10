import express from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import {
    submitForReview,
    reviewTask,
    getReviewHistory,
} from '../controllers/reviewController';

const router = express.Router();

// POST /api/review/:taskId/submit — Employee submits task for review
router.post('/:taskId/submit', authenticateUser, submitForReview);

// POST /api/review/:taskId/review — Reviewer approves/requests changes
router.post('/:taskId/review', authenticateUser, reviewTask);

// GET /api/review/:taskId/history — Get review history
router.get('/:taskId/history', authenticateUser, getReviewHistory);

export default router;
