// ============================================================
// KormoSync API - Monitoring Controller
// Aggregated monitoring data for admin smart monitoring page
// ============================================================

import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getSignedViewUrl } from '../utils/minioClient';
import { getActiveSessions } from '../utils/socketHandler';

// ============================================================
// Helper: Batch-process async operations to prevent MinIO overload
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

async function safeSignUrl(path: string | null): Promise<string | null> {
    if (!path) return null;
    try {
        return await getSignedViewUrl(path);
    } catch {
        return null;
    }
}

const getUser = (req: Request) => req.user as any;

// ============================================================
// Response Cache — prevents DB pool exhaustion from repeated monitoring polls
// Key: taskId, TTL: 30 seconds (matches Web polling interval)
// ============================================================
interface MonitoringCacheEntry {
    data: any;
    expiresAt: number;
}
const monitoringCache = new Map<string, MonitoringCacheEntry>();
const MONITORING_CACHE_TTL = 30 * 1000; // 30 seconds
const MAX_MONITORING_CACHE = 30;

// Cleanup expired entries every 60 seconds
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of monitoringCache.entries()) {
        if (now >= entry.expiresAt) monitoringCache.delete(key);
    }
}, 60 * 1000);

// Get aggregated monitoring data for a task
export const getTaskMonitoring = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        // Only admins can access monitoring
        if (!['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Only administrators can access monitoring' });
        }

        const { taskId } = req.params;

        // Check cache first — prevents 7 DB queries + MinIO on every 30s poll
        const cached = monitoringCache.get(taskId);
        if (cached && Date.now() < cached.expiresAt) {
            return res.json(cached.data);
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: {
                id: true,
                title: true,
                companyId: true,
                allowRemoteCapture: true,
                screenshotEnabled: true,
                activityEnabled: true,
                assignees: {
                    select: { id: true, name: true, email: true, profileImage: true }
                }
            }
        });

        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (task.companyId !== user.companyId) {
            return res.status(403).json({ error: 'Not authorized for this task' });
        }

        // Get all data in parallel
        const now = new Date();
        const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [screenshots, activityLast5min, activityLastHour, activityToday, workProofs, appUsage, assignees] = await Promise.all([
            // Recent screenshots (last 20)
            prisma.screenshot.findMany({
                where: { taskId },
                orderBy: { recordedAt: 'desc' },
                take: 20,
                select: {
                    id: true,
                    screenshotPath: true,
                    activityScore: true,
                    keyboardCount: true,
                    mouseCount: true,
                    activeSeconds: true,
                    recordedAt: true,
                    userId: true,
                    subTaskId: true,
                    user: { select: { name: true } }
                }
            }),
            // Last 5 min activity
            prisma.activityLog.findMany({
                where: { taskId, intervalStart: { gte: fiveMinAgo } },
                select: { keystrokes: true, mouseClicks: true, activeSeconds: true, userId: true }
            }),
            // Last hour activity
            prisma.activityLog.findMany({
                where: { taskId, intervalStart: { gte: oneHourAgo } },
                select: { keystrokes: true, mouseClicks: true, activeSeconds: true, intervalStart: true, userId: true }
            }),
            // Today activity
            prisma.activityLog.findMany({
                where: { taskId, intervalStart: { gte: todayStart } },
                select: { keystrokes: true, mouseClicks: true, activeSeconds: true, intervalStart: true, userId: true }
            }),
            // Work proofs
            prisma.workProof.findMany({
                where: { taskId },
                include: {
                    user: { select: { id: true, name: true, profileImage: true } },
                    subTask: { select: { id: true, title: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: 20
            }),
            // App usage (top 10 by duration)
            prisma.appUsageLog.groupBy({
                by: ['appName'],
                where: { taskId, recordedAt: { gte: todayStart } },
                _sum: { durationSec: true },
                orderBy: { _sum: { durationSec: 'desc' } },
                take: 10
            }),
            // Assignee profile images
            prisma.task.findUnique({
                where: { id: taskId },
                select: {
                    assignees: {
                        select: { id: true, name: true, email: true, profileImage: true }
                    }
                }
            })
        ]);

        // Sign screenshot URLs — BATCHED (5 at a time, was 20+ concurrent)
        const screenshotsWithUrls = await batchProcess(screenshots, 5, async (ss) => ({
            ...ss,
            imageUrl: await safeSignUrl(ss.screenshotPath),
        }));

        // Sign proof attachment URLs — BATCHED (3 at a time, each has nested attachments)
        const proofsWithUrls = await batchProcess(workProofs, 3, async (proof) => {
            const signedAttachments = await batchProcess(
                (proof.attachments || []) as string[], 3, (path: string) => safeSignUrl(path)
            );
            return {
                ...proof,
                attachments: signedAttachments,
                user: {
                    ...proof.user,
                    profileImage: await safeSignUrl(proof.user.profileImage)
                }
            };
        });

        // Sign assignee profile images — BATCHED (5 at a time)
        const assigneesWithImages = await batchProcess(
            assignees?.assignees || [], 5, async (a) => ({
                ...a,
                profileImage: await safeSignUrl(a.profileImage)
            })
        );

        // Aggregate activity stats
        const aggregateActivity = (logs: any[]) => ({
            totalKeystrokes: logs.reduce((s, l) => s + l.keystrokes, 0),
            totalMouseClicks: logs.reduce((s, l) => s + l.mouseClicks, 0),
            totalActiveSeconds: logs.reduce((s, l) => s + l.activeSeconds, 0),
            intervalCount: logs.length,
            averageActivity: logs.length > 0
                ? Math.round(logs.reduce((s, l) => s + (l.activeSeconds / 300 * 100), 0) / logs.length)
                : 0,
        });

        // Get live sessions from socket handler
        const liveSessions = getActiveSessions(task.companyId!);
        const taskLiveSessions = liveSessions.filter(s => s.taskId === taskId);

        const responseData = {
            success: true,
            monitoring: {
                task: {
                    id: task.id,
                    title: task.title,
                    allowRemoteCapture: task.allowRemoteCapture,
                    screenshotEnabled: task.screenshotEnabled,
                    activityEnabled: task.activityEnabled,
                },
                assignees: assigneesWithImages,
                liveSessions: taskLiveSessions.map(s => ({
                    userId: s.userId,
                    userName: s.userName,
                    currentApp: s.currentApp || null,
                    currentWindow: s.currentWindow || null,
                    startTime: s.startTime,
                    lastUpdate: s.lastUpdate,
                })),
                screenshots: screenshotsWithUrls,
                activityStats: {
                    last5min: aggregateActivity(activityLast5min),
                    lastHour: aggregateActivity(activityLastHour),
                    today: aggregateActivity(activityToday),
                    hourlyBreakdown: activityToday,
                },
                workProofs: proofsWithUrls,
                appUsage: appUsage.map(a => ({
                    appName: a.appName,
                    totalDurationSec: a._sum.durationSec || 0,
                })),
            }
        };

        // Cache the response — evict oldest if full
        if (monitoringCache.size >= MAX_MONITORING_CACHE) {
            const firstKey = monitoringCache.keys().next().value;
            if (firstKey) monitoringCache.delete(firstKey);
        }
        monitoringCache.set(taskId, { data: responseData, expiresAt: Date.now() + MONITORING_CACHE_TTL });

        return res.json(responseData);
    } catch (error) {
        console.error('Get Task Monitoring Error:', error);
        return res.status(500).json({ error: 'Failed to fetch monitoring data' });
    }
};
