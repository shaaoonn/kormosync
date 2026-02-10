import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import { getCompanySettings, updateCompanySettings } from '../controllers/settingsController';

const router = Router();

router.get('/company', authenticateUser, getCompanySettings);
router.put('/company', authenticateUser, updateCompanySettings);

export default router;
