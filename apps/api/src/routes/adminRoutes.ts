import express from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import { requireSuperAdmin } from '../middlewares/roleMiddleware';
import { getDashboardStats, getAllCompanies, getCompanyDetails, toggleCompanyStar, updateCompanyStatus, updateCompanyFeatures, deleteCompany, getPayments, getRevenueChart, getGlobalAnalytics, getSystemHealth, getCompanyActivity } from '../controllers/adminController';

const router = express.Router();

// All routes here are protected by Auth AND Super Admin Role
router.use(authenticateUser, requireSuperAdmin);

router.get('/stats', getDashboardStats);
router.get('/companies', getAllCompanies);
router.get('/companies/:id', getCompanyDetails);

// Company Actions
router.patch('/companies/:id/star', toggleCompanyStar);
router.patch('/companies/:id/status', updateCompanyStatus);
router.put('/companies/:id/features', updateCompanyFeatures);
router.delete('/companies/:id', deleteCompany);

// Financial Reports
router.get('/payments', getPayments);
router.get('/revenue/chart', getRevenueChart);

// Phase 5: Enhanced Analytics
router.get('/analytics', getGlobalAnalytics);
router.get('/system-health', getSystemHealth);
router.get('/companies/:id/activity', getCompanyActivity);

export default router;
