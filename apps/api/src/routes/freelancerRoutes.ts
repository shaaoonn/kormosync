import express from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import { togglePublicProfile, searchFreelancers, getPublicFreelancerProfile } from '../controllers/freelancerController';

const router = express.Router();

// Toggle Public/Private (Freelancer Only)
router.put('/me/visibility', authenticateUser, togglePublicProfile);

// Public Search (Admin/Owner Only ideally, or Public?)
// User prompt says "Administrator... search". So auth required.
router.get('/search', authenticateUser, searchFreelancers);

// View Public Profile (Admin/Owner)
router.get('/:id', authenticateUser, getPublicFreelancerProfile);

export default router;
