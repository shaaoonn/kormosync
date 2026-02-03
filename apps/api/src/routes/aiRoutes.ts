import express from 'express';
import { generateTaskPreview } from '../controllers/aiController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/generate-preview', authenticateUser, generateTaskPreview);

export default router;
