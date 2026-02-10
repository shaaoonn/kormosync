import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getSignedViewUrl } from '../utils/minioClient';
import { checkAndApplyPenalty } from '../services/penaltyService';
import { calculateActivityScore, calculateDailyProductivity } from '../services/activityScoreService';
import { updateSessionFromHeartbeat, consumePendingCapture } from '../utils/socketHandler';

// ============================================================
// Helper: Batch-process async operations to prevent MinIO overload
// Instead of 200+ concurrent getSignedViewUrl calls, processes N at a time
// ============================================================
async function batchProcess<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);
    }
    return results;
}

// Safe URL signing — returns null on failure instead of throwing
async function safeSignUrl(path: string | null): Promise<string | null> {
    if (!path) return null;
    try {
        return await getSignedViewUrl(path);
    } catch {
        return null;
    }
}


// ============================================================
// Company Activity Response Cache — prevents DB+MinIO storm
// Web app calls /activity/company 2x per page load (page.tsx + ActivityTimeline)
// Without cache: each call = 4 DB queries + 60 MinIO calls = 8+ seconds
// With cache: second call (and refreshes within 2 min) = 0ms
// ============================================================
const companyActivityCache = new Map<string, { data: any; expiresAt: number }>();
const COMPANY_ACTIVITY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const MAX_COMPANY_ACTIVITY_CACHE = 50;

// Cleanup every 2 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of companyActivityCache.entries()) {
        if (now >= entry.expiresAt) companyActivityCache.delete(key);
    }
}, 2 * 60 * 1000);

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

        // Check penalty rules (non-blocking)
        const io = req.app.get('io');
        checkAndApplyPenalty(user.id, taskId, io).catch((err) =>
            console.error('[PENALTY] Background check error:', err)
        );

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

        // Also fetch screenshots for this task's time range (limited to prevent MinIO overload)
        const screenshots = await prisma.screenshot.findMany({
            where: {
                userId: { in: activityLogs.map(a => a.userId) },
                recordedAt: {
                    gte: startDate ? new Date(startDate as string) : undefined,
                    lte: endDate ? new Date(endDate as string) : undefined
                }
            },
            orderBy: { recordedAt: 'desc' },
            take: 20
        });

        // Enhanced stats with weighted scoring
        const productivity = calculateDailyProductivity(activityLogs);
        const stats = {
            totalKeystrokes: activityLogs.reduce((sum, a) => sum + a.keystrokes, 0),
            totalMouseClicks: activityLogs.reduce((sum, a) => sum + a.mouseClicks, 0),
            totalMouseMovement: activityLogs.reduce((sum, a) => sum + a.mouseMovement, 0),
            totalActiveSeconds: activityLogs.reduce((sum, a) => sum + a.activeSeconds, 0),
            intervalCount: activityLogs.length,
            averageActivity: productivity.averageScore,
            // Enhanced fields
            ...productivity
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
            },
            take: 200, // Limit to prevent memory exhaustion on heavy-use days
        });

        const timeLogs = await prisma.timeLog.findMany({
            where: {
                userId: user.id,
                startTime: { gte: today }
            },
            take: 50, // Limit to prevent memory exhaustion
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

        // Check response cache first — identical requests within 2 min get cached result
        const cacheKey = `${user.companyId}:${startDate}:${endDate}:${userId || 'all'}:${taskId || 'all'}:${limit || '50'}`;
        const cachedResponse = companyActivityCache.get(cacheKey);
        if (cachedResponse && Date.now() < cachedResponse.expiresAt) {
            res.json(cachedResponse.data);
            return;
        }

        const isManagement = ['OWNER', 'ADMIN', 'MANAGER'].includes(user.role);

        const where: any = {};

        // ROLE BASED SCOPING — use Prisma relation filter instead of separate query
        // Previously: fetched ALL company users, then used userId IN (userIds) — now eliminated extra query
        if (isManagement) {
            // Management: Can see everyone in company, or filter by specific userId
            // Use Prisma relation filter — no separate companyUsers query needed
            if (userId) {
                where.userId = userId as string;
            } else {
                where.user = { companyId: user.companyId };
            }
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

        // OPTIMIZED: Reduced limits + batched URL signing to prevent MinIO overload
        // Previously: 200 logs + 100 screenshots + 300+ concurrent MinIO calls = API crash
        const activityLogs = await prisma.activityLog.findMany({
            where,
            orderBy: { intervalStart: 'desc' },
            take: Math.min(limit ? parseInt(limit as string) : 50, 50), // Hard cap at 50 — Web app sends limit=200 which is too heavy
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
            // Use Prisma relation filter — same as activityLogs above
            if (userId) {
                screenshotWhere.userId = userId as string;
            } else {
                screenshotWhere.user = { companyId: user.companyId };
            }
        } else {
            screenshotWhere.userId = user.id;
        }

        // Get screenshots — REDUCED from 100 to 30
        const screenshotsRaw = await prisma.screenshot.findMany({
            where: screenshotWhere,
            orderBy: { recordedAt: 'desc' },
            take: 30, // Was 100 → now 30 (reduces MinIO URL signing from 200+ to ~65)
            include: {
                user: {
                    select: { id: true, name: true, email: true, profileImage: true }
                },
                task: {
                    select: { id: true, title: true }
                },
                subTask: {
                    select: { id: true, title: true }
                }
            }
        });

        // BATCHED URL signing — 5 concurrent max instead of 100+ concurrent
        // This prevents MinIO connection pool exhaustion and memory spikes
        const screenshots = await batchProcess(screenshotsRaw, 5, async (ss) => ({
            ...ss,
            imageUrl: await safeSignUrl(ss.screenshotPath),
            user: {
                ...ss.user,
                profileImage: await safeSignUrl(ss.user.profileImage)
            },
            subTask: ss.subTask || null,
            deviceId: ss.deviceId || null,
        }));

        // Sign Activity Log Profile Images — batched (5 at a time)
        const signedActivityLogs = await batchProcess(activityLogs, 5, async (log) => ({
            ...log,
            user: {
                ...log.user,
                profileImage: await safeSignUrl(log.user.profileImage)
            }
        }));

        // Fetch unique tasks (WITHOUT assignee profileImage signing — saves 50+ MinIO calls)
        const distinctTaskIds = Array.from(new Set([
            ...activityLogs.map(a => a.taskId),
            ...screenshotsRaw.map(s => s.taskId).filter(Boolean) as string[]
        ]));

        const tasks = await prisma.task.findMany({
            where: { id: { in: distinctTaskIds } },
            select: {
                id: true,
                title: true,
                status: true,
                subTasks: {
                    select: { id: true, title: true, status: true }
                },
            }
        });

        const responseData = { success: true, activityLogs: signedActivityLogs, screenshots, tasks };

        // Cache response for 2 minutes — prevents duplicate calls from overwhelming DB
        if (companyActivityCache.size >= MAX_COMPANY_ACTIVITY_CACHE) {
            const firstKey = companyActivityCache.keys().next().value;
            if (firstKey) companyActivityCache.delete(firstKey);
        }
        companyActivityCache.set(cacheKey, { data: responseData, expiresAt: Date.now() + COMPANY_ACTIVITY_CACHE_TTL });

        res.json(responseData);
    } catch (error: any) {
        console.error('Get Company Activity Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// HEARTBEAT — Real-time current app info (bridge for desktop → socket)
// ============================================================

export const heartbeat = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;

        if (!user?.id) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const { taskId, subTaskId, currentApp, currentWindow, elapsedSeconds, taskTitle } = req.body;

        // Update or auto-create session (Desktop apps register via heartbeat, not Socket.IO)
        const io = req.app.get('io');
        const session = updateSessionFromHeartbeat(user.id, {
            taskId,
            currentApp,
            currentWindow,
            elapsedSeconds,
            // Extra fields for auto-creating session if first heartbeat
            companyId: user.companyId,
            userName: user.dbUser?.name || user.name || user.email,
            userEmail: user.dbUser?.email || user.email,
            userImage: user.dbUser?.profileImage || null,
            taskTitle: taskTitle || undefined,
        }, io);
        if (io && user.companyId) {
            io.to(`company:${user.companyId}`).emit('tracking:tick', {
                odId: session?.odId || `desktop_${user.id}`,
                elapsedSeconds: elapsedSeconds || 0,
                userId: user.id,
                currentApp: currentApp || '',
                currentWindow: currentWindow || '',
            });
        }

        // Check for pending remote capture requests (desktop polling)
        const captureRequest = consumePendingCapture(user.id);

        res.json({
            success: true,
            ...(captureRequest && {
                captureNow: true,
                captureTaskId: captureRequest.taskId,
                captureRequestedBy: captureRequest.requestedBy,
            }),
        });
    } catch (error: any) {
        console.error('Heartbeat Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
