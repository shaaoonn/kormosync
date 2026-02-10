import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import {
    createLeaveRequest,
    getMyLeaveRequests,
    getMyLeaveBalance,
    getPendingLeaveRequests,
    getAllLeaveRequests,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest,
    getLeaveCalendar,
} from '../controllers/leaveController';

const router = Router();

// Employee endpoints
router.post('/request', authenticateUser, createLeaveRequest);
router.get('/my-requests', authenticateUser, getMyLeaveRequests);
router.get('/my-balance', authenticateUser, getMyLeaveBalance);

// Admin endpoints
router.get('/pending', authenticateUser, getPendingLeaveRequests);
router.get('/all', authenticateUser, getAllLeaveRequests);
router.get('/calendar', authenticateUser, getLeaveCalendar);
router.put('/:id/approve', authenticateUser, approveLeaveRequest);
router.put('/:id/reject', authenticateUser, rejectLeaveRequest);

// Employee cancel
router.delete('/:id/cancel', authenticateUser, cancelLeaveRequest);

export default router;
