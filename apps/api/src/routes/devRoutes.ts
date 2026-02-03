import { Router } from 'express';
import { getDevUsers, createMockToken } from '../controllers/devController';

const router = Router();

// ⚠️ DEV ONLY - These routes are for development testing only
// Remove or disable in production!

// Get users for dev testing
router.get('/users', getDevUsers);

// Create mock token
router.post('/mock-token', createMockToken);

export default router;
