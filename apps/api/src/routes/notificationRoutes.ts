import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearOldNotifications,
} from '../controllers/notificationController';

const router = Router();

// Get notifications (paginated)
router.get('/', authenticateUser, getNotifications);

// Get unread count (for badge)
router.get('/unread-count', authenticateUser, getUnreadCount);

// Mark single as read
router.patch('/:id/read', authenticateUser, markAsRead);

// Mark all as read
router.patch('/read-all', authenticateUser, markAllAsRead);

// Delete single notification
router.delete('/:id', authenticateUser, deleteNotification);

// Clear old read notifications (30+ days)
router.delete('/clear-old', authenticateUser, clearOldNotifications);

export default router;
