import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getSignedViewUrl } from '../utils/minioClient';

const prisma = new PrismaClient();

// ============================================================
// LOG Activity (5-minute interval)
// ============================================================

export const logActivity = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId, intervalStart, intervalEnd, keystrokes, mouseClicks, mouseMovement, activeSeconds } = req.body;
        const user = (req as any).user;

        if (!user?.id) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        if (!taskId) {
            res.status(400).json({ success: false, error: 'Task ID required' });
            return;
        }

        const activityLog = await prisma.activityLog.create({
            data: {
                userId: user.id,
                taskId,
                intervalStart: new Date(intervalStart),
                intervalEnd: new Date(intervalEnd),
                keystrokes: keystrokes || 0,
                mouseClicks: mouseClicks || 0,
                mouseMovement: mouseMovement || 0,
                activeSeconds: activeSeconds || 0
            }
        });

        res.status(201).json({ success: true, activityLog });
    } catch (error: any) {
        console.error('Log Activity Error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to log activity' });
    }
};

// ============================================================
// GET Activity for Task
// ============================================================

export const getTaskActivity = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const { startDate, endDate, limit } = req.query;

        const where: any = { taskId };

        if (startDate || endDate) {
            where.intervalStart = {};
            // Set start to 00:00:00 of the requested start day
            if (startDate) {
                const s = new Date(startDate as string);
                s.setHours(0, 0, 0, 0);
                where.intervalStart.gte = s;
            }
            // Set end to 23:59:59 of the requested end day
            if (endDate) {
                const e = new Date(endDate as string);
                e.setHours(23, 59, 59, 999);
                where.intervalStart.lte = e;
            }
        }

        const activityLogs = await prisma.activityLog.findMany({
            where,
            orderBy: { intervalStart: 'desc' },
            take: limit ? parseInt(limit as string) : 100,
            include: {
                user: {
                    select: { id: true, name: true, email: true, profileImage: true }
                }
            }
        });

        // Also fetch screenshots for this task's time range
        const screenshots = await prisma.screenshot.findMany({
            where: {
                userId: { in: activityLogs.map(a => a.userId) },
                recordedAt: {
                    gte: startDate ? new Date(startDate as string) : undefined,
                    lte: endDate ? new Date(endDate as string) : undefined
                }
            },
            orderBy: { recordedAt: 'desc' },
            take: 50
        });

        // Aggregate stats
        const stats = {
            totalKeystrokes: activityLogs.reduce((sum, a) => sum + a.keystrokes, 0),
            totalMouseClicks: activityLogs.reduce((sum, a) => sum + a.mouseClicks, 0),
            totalMouseMovement: activityLogs.reduce((sum, a) => sum + a.mouseMovement, 0),
            totalActiveSeconds: activityLogs.reduce((sum, a) => sum + a.activeSeconds, 0),
            intervalCount: activityLogs.length,
            averageActivity: activityLogs.length > 0
                ? Math.round((activityLogs.reduce((sum, a) => sum + (a.activeSeconds / 300 * 100), 0)) / activityLogs.length)
                : 0
        };

        res.json({ success: true, activityLogs, screenshots, stats });
    } catch (error: any) {
        console.error('Get Task Activity Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// GET User's Activity History
// ============================================================

export const getUserActivity = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const { startDate, endDate, taskId, limit } = req.query;

        const where: any = { userId };

        if (taskId) where.taskId = taskId as string;
        if (startDate || endDate) {
            where.intervalStart = {};
            if (startDate) where.intervalStart.gte = new Date(startDate as string);
            if (endDate) where.intervalStart.lte = new Date(endDate as string);
        }

        const activityLogs = await prisma.activityLog.findMany({
            where,
            orderBy: { intervalStart: 'desc' },
            take: limit ? parseInt(limit as string) : 100,
            include: {
                task: {
                    select: { id: true, title: true }
                }
            }
        });

        // Daily summary
        const dailySummary: Record<string, any> = {};
        for (const log of activityLogs) {
            const day = log.intervalStart.toISOString().split('T')[0];
            if (!dailySummary[day]) {
                dailySummary[day] = {
                    date: day,
                    totalSeconds: 0,
                    keystrokes: 0,
                    mouseClicks: 0,
                    intervals: 0
                };
            }
            dailySummary[day].totalSeconds += log.activeSeconds;
            dailySummary[day].keystrokes += log.keystrokes;
            dailySummary[day].mouseClicks += log.mouseClicks;
            dailySummary[day].intervals += 1;
        }

        res.json({
            success: true,
            activityLogs,
            dailySummary: Object.values(dailySummary).sort((a: any, b: any) => b.date.localeCompare(a.date))
        });
    } catch (error: any) {
        console.error('Get User Activity Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// GET Today's Stats for Current User (Desktop App)
// ============================================================

export const getTodayStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;

        if (!user?.id) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activityLogs = await prisma.activityLog.findMany({
            where: {
                userId: user.id,
                intervalStart: { gte: today }
            }
        });

        const timeLogs = await prisma.timeLog.findMany({
            where: {
                userId: user.id,
                startTime: { gte: today }
            }
        });

        // Calculate total hours worked today
        let totalSeconds = 0;
        for (const tl of timeLogs) {
            if (tl.endTime) {
                totalSeconds += Math.floor((tl.endTime.getTime() - tl.startTime.getTime()) / 1000);
            } else {
                // Still tracking
                totalSeconds += Math.floor((Date.now() - tl.startTime.getTime()) / 1000);
            }
        }

        const stats = {
            todayHours: Math.floor(totalSeconds / 3600),
            todayMinutes: Math.floor((totalSeconds % 3600) / 60),
            totalKeystrokes: activityLogs.reduce((sum, a) => sum + a.keystrokes, 0),
            totalMouseClicks: activityLogs.reduce((sum, a) => sum + a.mouseClicks, 0),
            averageActivity: activityLogs.length > 0
                ? Math.round((activityLogs.reduce((sum, a) => sum + (a.activeSeconds / 300 * 100), 0)) / activityLogs.length)
                : 0,
            intervals: activityLogs.length
        };

        res.json({ success: true, stats });
    } catch (error: any) {
        console.error('Get Today Stats Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// ADMIN: Get All Activity (Company-wide)
// ============================================================

export const getCompanyActivity = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { startDate, endDate, userId, taskId, limit } = req.query;

        // ALLOW everyone to access, but restrict data based on role
        if (!user?.companyId) {
            res.status(403).json({ success: false, error: 'Company association required' });
            return;
        }

        const isManagement = ['OWNER', 'ADMIN', 'MANAGER'].includes(user.role);

        // Get all users in company (Management only needs this for dropdowns/filtering all)
        // Regular employees will be scoped to themselves
        const companyUsers = await prisma.user.findMany({
            where: { companyId: user.companyId },
            select: { id: true }
        });

        const userIds = companyUsers.map(u => u.id);

        const where: any = {};

        // ROLE BASED SCOPING
        if (isManagement) {
            // Management: Can see everyone, or filter by specific userId
            where.userId = { in: userIds };
            if (userId) where.userId = userId as string;
        } else {
            // Employee/Freelancer: STRICTLY see only their own data
            where.userId = user.id;
        }

        if (taskId) where.taskId = taskId as string;
        if (startDate || endDate) {
            where.intervalStart = {};
            // Set start to 00:00:00 of the requested start day
            if (startDate) {
                const s = new Date(startDate as string);
                s.setHours(0, 0, 0, 0);
                where.intervalStart.gte = s;
            }
            // Set end to 23:59:59 of the requested end day
            if (endDate) {
                const e = new Date(endDate as string);
                e.setHours(23, 59, 59, 999);
                where.intervalStart.lte = e;
            }
        }

        const activityLogs = await prisma.activityLog.findMany({
            where,
            orderBy: { intervalStart: 'desc' },
            take: limit ? parseInt(limit as string) : 200,
            include: {
                user: {
                    select: { id: true, name: true, email: true, profileImage: true }
                },
                task: {
                    select: { id: true, title: true }
                }
            }
        });

        // Helper to get screenshot scope - FIX DATE RANGE
        let startDateTime, endDateTime;
        if (startDate) {
            startDateTime = new Date(startDate as string);
            startDateTime.setHours(0, 0, 0, 0);
        }
        if (endDate) {
            endDateTime = new Date(endDate as string);
            endDateTime.setHours(23, 59, 59, 999);
        }

        const screenshotWhere: any = {
            recordedAt: {
                gte: startDateTime,
                lte: endDateTime
            }
        };

        if (isManagement) {
            screenshotWhere.userId = { in: userIds };
            // If admin selected a specific user, narrow it down
            if (userId) screenshotWhere.userId = userId as string;
        } else {
            screenshotWhere.userId = user.id;
        }

        // Get screenshots
        const screenshotsRaw = await prisma.screenshot.findMany({
            where: screenshotWhere,
            orderBy: { recordedAt: 'desc' },
            take: 100,
            include: {
                user: {
                    select: { id: true, name: true, email: true, profileImage: true }
                },
                task: {
                    select: { id: true, title: true }
                }
            }
        });

        // Sign URLs
        const screenshots = await Promise.all(screenshotsRaw.map(async (ss) => ({
            ...ss,
            imageUrl: await getSignedViewUrl(ss.screenshotPath),
            user: {
                ...ss.user,
                profileImage: ss.user.profileImage ? await getSignedViewUrl(ss.user.profileImage) : null
            }
        })));

        // Sign Activity Log Profile Images
        const signedActivityLogs = await Promise.all(activityLogs.map(async (log) => ({
            ...log,
            user: {
                ...log.user,
                profileImage: log.user.profileImage ? await getSignedViewUrl(log.user.profileImage) : null
            }
        })));

        // NEW: Fetch unique tasks involved to show hierarchy
        const distinctTaskIds = Array.from(new Set([
            ...activityLogs.map(a => a.taskId),
            ...screenshotsRaw.map(s => s.taskId).filter(Boolean) as string[]
        ]));

        const tasks = await prisma.task.findMany({
            where: { id: { in: distinctTaskIds } },
            include: {
                subTasks: true,
                assignees: {
                    select: { id: true, name: true, profileImage: true }
                }
            }
        });

        // Sign Assignee Images in Tasks
        const signedTasks = await Promise.all(tasks.map(async (t) => ({
            ...t,
            assignees: await Promise.all(t.assignees.map(async (a) => ({
                ...a,
                profileImage: a.profileImage ? await getSignedViewUrl(a.profileImage) : null
            })))
        })));

        res.json({ success: true, activityLogs: signedActivityLogs, screenshots, tasks: signedTasks });
    } catch (error: any) {
        console.error('Get Company Activity Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
