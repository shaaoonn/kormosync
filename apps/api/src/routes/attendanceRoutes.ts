import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import {
    getDailyAttendance,
    getMyAttendanceSummary,
    getAttendanceCalendar,
    generateAttendance,
} from '../controllers/attendanceController';

const router = Router();

// Admin endpoints
router.get('/daily', authenticateUser, getDailyAttendance);
router.get('/calendar', authenticateUser, getAttendanceCalendar);
router.post('/generate', authenticateUser, generateAttendance);

// Employee endpoints
router.get('/my-summary', authenticateUser, getMyAttendanceSummary);

export default router;
