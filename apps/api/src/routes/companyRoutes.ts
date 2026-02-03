import express from 'express';
import { getMembers, createInvite, getInviteLink, acceptInvite, removeMember } from '../controllers/companyController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/members', authenticateUser, getMembers);
router.post('/invite', authenticateUser, createInvite);
router.get('/invite-link', authenticateUser, getInviteLink);
router.post('/accept-invite', authenticateUser, acceptInvite);
router.delete('/members/:memberId', authenticateUser, removeMember);

export default router;
