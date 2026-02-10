import express from 'express';
import { submitProof, getTaskProofs, getMyProofs } from '../controllers/proofController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/submit', authenticateUser, submitProof);
router.get('/my', authenticateUser, getMyProofs);
router.get('/task/:taskId', authenticateUser, getTaskProofs);

export default router;
