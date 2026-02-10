import express from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import { bulkSync } from '../controllers/syncController';

const router = express.Router();

router.use(authenticateUser);

// POST /api/sync/bulk - Accept mixed offline queue items
router.post('/bulk', bulkSync);

export default router;
