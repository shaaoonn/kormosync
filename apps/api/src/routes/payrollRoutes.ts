import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import {
    getPayrollSummary,
    getEmployeePayroll,
    getCurrentEarnings,
    getUserCurrentEarnings,
    getCompanyEarnings,
} from '../controllers/payrollController';

const router = Router();

// Payroll summary for company (admin/owner)
router.get('/summary', authenticateUser, getPayrollSummary);

// Current earnings — real-time "since last pay"
router.get('/current-earnings', authenticateUser, getCurrentEarnings);
router.get('/current-earnings/:userId', authenticateUser, getUserCurrentEarnings);
router.get('/company-earnings', authenticateUser, getCompanyEarnings);

// Individual employee payroll details
router.get('/employee/:userId', authenticateUser, getEmployeePayroll);

export default router;
