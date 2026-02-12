// ============================================================
// Notification Controller — CRUD endpoints for user notifications
// ============================================================

import { Request, Response } from 'express';
import prisma from '../utils/prisma';

/**
 * GET /notifications — paginated list of user's notifications
 * Query: ?page=1&limit=20&unreadOnly=true
 */
export const getNotifications = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
        const unreadOnly = req.query.unreadOnly === 'true';

        const where: any = { userId: user.id };
        if (unreadOnly) where.isRead = false;

        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.notification.count({ where }),
            prisma.notification.count({ where: { userId: user.id, isRead: false } }),
        ]);

        return res.json({
            success: true,
            notifications,
            unreadCount,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('getNotifications error:', error);
        return res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

/**
 * GET /notifications/unread-count — just the unread badge count
 */
export const getUnreadCount = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

        const unreadCount = await prisma.notification.count({
            where: { userId: user.id, isRead: false },
        });

        return res.json({ success: true, unreadCount });
    } catch (error) {
        console.error('getUnreadCount error:', error);
        return res.status(500).json({ error: 'Failed to fetch unread count' });
    }
};

/**
 * PATCH /notifications/:id/read — mark single notification as read
 */
export const markAsRead = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

        const { id } = req.params;

        // Verify ownership
        const notification = await prisma.notification.findUnique({ where: { id } });
        if (!notification) return res.status(404).json({ error: 'Notification not found' });
        if (notification.userId !== user.id) return res.status(403).json({ error: 'Access denied' });

        await prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });

        return res.json({ success: true });
    } catch (error) {
        console.error('markAsRead error:', error);
        return res.status(500).json({ error: 'Failed to mark notification as read' });
    }
};

/**
 * PATCH /notifications/read-all — mark all user's notifications as read
 */
export const markAllAsRead = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

        const result = await prisma.notification.updateMany({
            where: { userId: user.id, isRead: false },
            data: { isRead: true },
        });

        return res.json({ success: true, updatedCount: result.count });
    } catch (error) {
        console.error('markAllAsRead error:', error);
        return res.status(500).json({ error: 'Failed to mark all as read' });
    }
};

/**
 * DELETE /notifications/:id — delete single notification
 */
export const deleteNotification = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

        const { id } = req.params;

        // Verify ownership
        const notification = await prisma.notification.findUnique({ where: { id } });
        if (!notification) return res.status(404).json({ error: 'Notification not found' });
        if (notification.userId !== user.id) return res.status(403).json({ error: 'Access denied' });

        await prisma.notification.delete({ where: { id } });

        return res.json({ success: true });
    } catch (error) {
        console.error('deleteNotification error:', error);
        return res.status(500).json({ error: 'Failed to delete notification' });
    }
};

/**
 * DELETE /notifications/clear-all — delete all read notifications older than 30 days
 */
export const clearOldNotifications = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await prisma.notification.deleteMany({
            where: {
                userId: user.id,
                isRead: true,
                createdAt: { lt: thirtyDaysAgo },
            },
        });

        return res.json({ success: true, deletedCount: result.count });
    } catch (error) {
        console.error('clearOldNotifications error:', error);
        return res.status(500).json({ error: 'Failed to clear old notifications' });
    }
};
