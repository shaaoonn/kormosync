import { Router } from 'express';
import { createPayment, handleCallback } from '../controllers/paymentController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = Router();

// Create Payment (Protected)
router.post('/create', authenticateUser, createPayment);

// Callback (Public - bKash calls this)
router.get('/callback', handleCallback);

export default router;
