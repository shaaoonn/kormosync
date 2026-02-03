import express from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import { requireSuperAdmin } from '../middlewares/roleMiddleware';
import { getDashboardStats, getAllCompanies, getCompanyDetails, toggleCompanyStar, updateCompanyStatus, deleteCompany } from '../controllers/adminController';

const router = express.Router();

// All routes here are protected by Auth AND Super Admin Role
router.use(authenticateUser, requireSuperAdmin);

router.get('/stats', getDashboardStats);
router.get('/companies', getAllCompanies);
router.get('/companies/:id', getCompanyDetails);

// Company Actions
router.patch('/companies/:id/star', toggleCompanyStar);
router.patch('/companies/:id/status', updateCompanyStatus);
router.delete('/companies/:id', deleteCompany);

export default router;
