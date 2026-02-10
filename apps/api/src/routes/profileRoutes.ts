import express from 'express';
import { getProfile, updateProfile, getEmployeeProfile, getSalaryConfig, updateSalaryConfig, getDutyProgress, getDaysOff, toggleDayOff, getAssignedTasks } from '../controllers/profileController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/me', authenticateUser, getProfile);
router.put('/me', authenticateUser, updateProfile);
router.get('/employee/:userId', authenticateUser, getEmployeeProfile);

// Salary & Duty Configuration
router.get('/employee/:userId/salary-config', authenticateUser, getSalaryConfig);
router.put('/employee/:userId/salary-config', authenticateUser, updateSalaryConfig);
router.get('/duty-progress', authenticateUser, getDutyProgress);

// Days Off Calendar
router.get('/employee/:userId/days-off', authenticateUser, getDaysOff);
router.post('/employee/:userId/days-off', authenticateUser, toggleDayOff);

// Assigned Tasks
router.get('/employee/:userId/assigned-tasks', authenticateUser, getAssignedTasks);

export default router;
