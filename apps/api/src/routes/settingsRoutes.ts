import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import { getCompanySettings, updateCompanySettings, getPayrollSettings, updatePayrollSettings } from '../controllers/settingsController';

const router = Router();

router.get('/company', authenticateUser, getCompanySettings);
router.put('/company', authenticateUser, updateCompanySettings);

router.get('/payroll', authenticateUser, getPayrollSettings);
router.put('/payroll', authenticateUser, updatePayrollSettings);

export default router;
