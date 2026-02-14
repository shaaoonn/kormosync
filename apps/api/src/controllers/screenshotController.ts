import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { uploadToMinio, getSignedViewUrl, deleteFromMinio } from '../utils/minioClient';
import { v4 as uuidv4 } from 'uuid';
import { calculateActivityScore } from '../services/activityScoreService';
import { invalidateEarningsCache } from '../services/earningsService';

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


/**
 * Upload screenshot from desktop app
 */
export const uploadScreenshot = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.uid;
        const { taskId, subTaskId, keystrokes, mouseClicks, activeSeconds, capturedAt, deviceId, activeSubTaskIds, activeSubTaskNames } = req.body;

        console.log(`📸 Screenshot: user=${userId?.slice(0,8)}, task=${taskId?.slice(0,8)}, file=${req.file ? `${(req.file.size/1024).toFixed(0)}KB` : 'MISSING'}`);

        if (!userId || !taskId) {
            console.error('❌ Missing required fields - userId:', userId, 'taskId:', taskId);
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // FETCH INTERNAL DB USER
        const dbUser = await prisma.user.findUnique({
            where: { firebaseUid: userId }
        });

        if (!dbUser) {
            console.error('❌ User not found in DB with Firebase UID:', userId);
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!req.file) {
            console.error('❌ No screenshot file in request');
            return res.status(400).json({ success: false, message: 'No screenshot file provided' });
        }

        // Check company storage quota before uploading
        if (dbUser.companyId) {
            const company = await prisma.company.findUnique({
                where: { id: dbUser.companyId },
                select: { storageUsed: true, storageLimit: true }
            });
            const fileSizeMB = req.file.size / (1024 * 1024);
            if (company && (company.storageUsed + fileSizeMB) > company.storageLimit) {
                console.warn(`⚠️ Storage quota exceeded for company ${dbUser.companyId}: ${company.storageUsed.toFixed(1)}/${company.storageLimit}MB`);
                return res.status(403).json({
                    success: false,
                    quotaExceeded: true,
                    message: `স্টোরেজ সীমা ছাড়িয়ে গেছে (${company.storageLimit}MB)। স্ক্রিনশট বন্ধ।`,
                    storageUsed: company.storageUsed,
                    storageLimit: company.storageLimit,
                });
            }

            // Increment storage used
            await prisma.company.update({
                where: { id: dbUser.companyId },
                data: { storageUsed: { increment: fileSizeMB } }
            });
        }

        // Generate unique filename — detect format from mimetype
        const ext = req.file.mimetype === 'image/jpeg' ? 'jpg' : 'png';
        const fileName = `${dbUser.id}_${Date.now()}_${uuidv4().slice(0, 8)}.${ext}`;
        console.log('   Generated filename:', fileName);

        // Upload to MinIO
        const fileKey = await uploadToMinio(req.file.buffer, fileName, req.file.mimetype, 'screenshots');

        // Calculate activity score using unified formula
        const parsedKeystrokes = parseInt(keystrokes || '0') || 0;
        const parsedClicks = parseInt(mouseClicks || '0') || 0;
        const parsedActiveSeconds = parseInt(activeSeconds || '300') || 300;
        const intervalMinutes = Math.max(1, Math.ceil(parsedActiveSeconds / 60)) || 5;
        const { score: activityScore } = calculateActivityScore(
            parsedActiveSeconds, parsedKeystrokes, parsedClicks, 0, intervalMinutes
        );

        // Save to database
        const screenshot = await prisma.screenshot.create({
            data: {
                screenshotPath: fileKey,
                recordedAt: capturedAt ? new Date(capturedAt) : new Date(),
                keyboardCount: parseInt(keystrokes || '0'),
                mouseCount: parseInt(mouseClicks || '0'),
                activeSeconds: parseInt(activeSeconds || '300'),
                activityScore,
                userId: dbUser.id,   // USE INTERNAL UUID
                taskId,
                subTaskId: subTaskId || null,
                deviceId: deviceId || null,
            },
        });

        // Invalidate earnings cache — triggers fresh calculation with active TimeLog duration
        invalidateEarningsCache(dbUser.id);

        // RESPOND FIRST — don't block client waiting for socket emit
        res.json({
            success: true,
            message: 'Screenshot uploaded successfully',
            screenshot: {
                id: screenshot.id,
                imageUrl: fileKey,
                activityScore
            }
        });

        // THEN emit socket event asynchronously (non-blocking)
        // getSignedViewUrl calls MinIO which can be slow on remote servers
        const io = (req.app as any).get('io');
        if (io && dbUser?.companyId) {
            getSignedViewUrl(fileKey).then(signedUrl => {
                io.to(`company:${dbUser.companyId}`).emit('screenshot:new', {
                    id: screenshot.id,
                    imageUrl: signedUrl,
                    recordedAt: screenshot.recordedAt,
                    keyboardCount: screenshot.keyboardCount,
                    mouseCount: screenshot.mouseCount,
                    activityScore: screenshot.activityScore,
                    activeSubTaskNames: activeSubTaskNames || null,
                });
            }).catch(() => {}); // Non-critical — admin can refresh to see

            // Notify the user's own session that earnings should refresh
            io.to(`user:${dbUser.id}`).emit('earnings:updated');
        }
        return;

    } catch (error) {
        console.error('Screenshot upload error:', error);
        return res.status(500).json({ success: false, message: 'Failed to upload screenshot' });
    }
};

/**
 * Get screenshots for activity log (with signed URLs)
 */
export const getScreenshots = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.uid;
        const { startDate, endDate, taskId, employeeId } = req.query;

        // Get user's company
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { companyId: true, role: true }
        });

        if (!user?.companyId) {
            return res.status(403).json({ success: false, message: 'No company associated' });
        }

        // Build query
        const where: any = {
            user: { companyId: user.companyId }
        };

        if (startDate && endDate) {
            where.recordedAt = {
                gte: new Date(startDate as string),
                lte: new Date(`${endDate}T23:59:59`)
            };
        }

        if (taskId) where.taskId = taskId as string;
        if (employeeId) where.userId = employeeId as string;

        // Filter by subTaskId if provided
        const { subTaskId } = req.query;
        if (subTaskId) where.subTaskId = subTaskId as string;

        const screenshots = await prisma.screenshot.findMany({
            where,
            orderBy: { recordedAt: 'desc' },
            take: 30 // Was 100 → reduced to prevent MinIO overload
        });

        // Generate signed URLs — BATCHED (5 at a time, was 100 concurrent)
        const screenshotsWithUrls = await batchProcess(screenshots, 5, async (ss) => ({
            ...ss,
            imageUrl: await safeSignUrl(ss.screenshotPath)
        }));

        return res.json({
            success: true,
            screenshots: screenshotsWithUrls
        });

    } catch (error) {
        console.error('Get screenshots error:', error);
        return res.status(500).json({ success: false, message: 'Failed to get screenshots' });
    }
};

/**
 * Get single screenshot by ID with full details
 */
export const getScreenshotById = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.uid;
        const { screenshotId } = req.params;

        // Get user to verify access
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { companyId: true, role: true }
        });

        if (!user?.companyId) {
            return res.status(403).json({ success: false, message: 'No company associated' });
        }

        const screenshot = await prisma.screenshot.findUnique({
            where: { id: screenshotId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        profileImage: true,
                        companyId: true
                    }
                },
                task: {
                    select: {
                        id: true,
                        title: true,
                        priority: true,
                        description: true
                    }
                }
            }
        });

        if (!screenshot) {
            return res.status(404).json({ success: false, message: 'Screenshot not found' });
        }

        // Verify user has access to this screenshot
        if (screenshot.user?.companyId !== user.companyId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Generate signed URL for the image
        const signedUrl = await getSignedViewUrl(screenshot.screenshotPath);

        return res.json({
            success: true,
            screenshot: {
                ...screenshot,
                imageUrl: signedUrl // Map back to imageUrl if frontend expects it, or use screenshotPath
            }
        });

    } catch (error) {
        console.error('Get screenshot by ID error:', error);
        return res.status(500).json({ success: false, message: 'Failed to get screenshot' });
    }
};

/**
 * Delete screenshot (Admin only) — frees storage
 */
export const deleteScreenshot = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { screenshotId } = req.params;

        if (!user?.companyId) {
            return res.status(403).json({ success: false, message: 'No company associated' });
        }

        // Only OWNER/ADMIN can delete
        const dbUser = await prisma.user.findUnique({
            where: { firebaseUid: user.uid },
            select: { id: true, role: true, companyId: true }
        });
        if (!dbUser || !['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(dbUser.role)) {
            return res.status(403).json({ success: false, message: 'Only administrators can delete screenshots' });
        }

        const screenshot = await prisma.screenshot.findUnique({
            where: { id: screenshotId },
            include: { user: { select: { companyId: true } } }
        });

        if (!screenshot) {
            return res.status(404).json({ success: false, message: 'Screenshot not found' });
        }

        // Verify same company
        if (screenshot.user?.companyId !== dbUser.companyId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Delete from MinIO
        await deleteFromMinio(screenshot.screenshotPath);

        // Delete from database
        await prisma.screenshot.delete({ where: { id: screenshotId } });

        // Estimate file size (screenshots are typically ~100KB-500KB, use a rough estimate)
        // Since we don't store file size in Screenshot model, approximate as 0.3MB
        const estimatedSizeMB = 0.3;
        if (dbUser.companyId) {
            await prisma.company.update({
                where: { id: dbUser.companyId },
                data: { storageUsed: { decrement: estimatedSizeMB } }
            });

            // Ensure storageUsed doesn't go below 0
            const company = await prisma.company.findUnique({
                where: { id: dbUser.companyId },
                select: { storageUsed: true }
            });
            if (company && company.storageUsed < 0) {
                await prisma.company.update({
                    where: { id: dbUser.companyId },
                    data: { storageUsed: 0 }
                });
            }
        }

        return res.json({ success: true, message: 'Screenshot deleted successfully' });
    } catch (error) {
        console.error('Delete screenshot error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete screenshot' });
    }
};

/**
 * Bulk delete screenshots (Admin only)
 */
export const bulkDeleteScreenshots = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { screenshotIds } = req.body;

        if (!user?.companyId) {
            return res.status(403).json({ success: false, message: 'No company associated' });
        }

        const dbUser = await prisma.user.findUnique({
            where: { firebaseUid: user.uid },
            select: { id: true, role: true, companyId: true }
        });
        if (!dbUser || !['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(dbUser.role)) {
            return res.status(403).json({ success: false, message: 'Only administrators can delete screenshots' });
        }

        if (!screenshotIds || !Array.isArray(screenshotIds) || screenshotIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No screenshot IDs provided' });
        }

        // Fetch all screenshots to get file paths
        const screenshots = await prisma.screenshot.findMany({
            where: {
                id: { in: screenshotIds },
                user: { companyId: dbUser.companyId }
            }
        });

        // Delete from MinIO
        for (const ss of screenshots) {
            await deleteFromMinio(ss.screenshotPath).catch(() => {});
        }

        // Delete from database
        await prisma.screenshot.deleteMany({
            where: { id: { in: screenshots.map(s => s.id) } }
        });

        // Decrement storage (approx 0.3MB per screenshot)
        const totalFreedMB = screenshots.length * 0.3;
        if (dbUser.companyId) {
            const company = await prisma.company.findUnique({
                where: { id: dbUser.companyId },
                select: { storageUsed: true }
            });
            const newUsed = Math.max(0, (company?.storageUsed || 0) - totalFreedMB);
            await prisma.company.update({
                where: { id: dbUser.companyId },
                data: { storageUsed: newUsed }
            });
        }

        return res.json({
            success: true,
            deletedCount: screenshots.length,
            message: `${screenshots.length}টি স্ক্রিনশট ডিলিট হয়েছে`
        });
    } catch (error) {
        console.error('Bulk delete screenshots error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete screenshots' });
    }
};

/**
 * Self-delete screenshot (Employee — own screenshots only, within 24h)
 * Sprint 11: Screenshot Self-Correction / Privacy Feature
 * Impact: Deletes screenshot + deducts corresponding time from earnings
 */
export const selfDeleteScreenshot = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { screenshotId } = req.params;

        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const dbUser = await prisma.user.findUnique({
            where: { firebaseUid: user.uid },
            select: { id: true, name: true, email: true, companyId: true }
        });
        if (!dbUser) return res.status(403).json({ success: false, message: 'User not found' });

        // Fetch screenshot with task info
        const screenshot = await prisma.screenshot.findUnique({
            where: { id: screenshotId },
            include: {
                task: { select: { id: true, title: true, creatorId: true, screenshotInterval: true, companyId: true } },
            }
        });

        if (!screenshot) {
            return res.status(404).json({ success: false, message: 'Screenshot not found' });
        }

        // Ownership check: must be own screenshot
        if (screenshot.userId !== dbUser.id) {
            return res.status(403).json({ success: false, message: 'You can only delete your own screenshots' });
        }

        // Time window: must be within 24 hours
        const hoursSince = (Date.now() - screenshot.recordedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSince > 24) {
            return res.status(403).json({
                success: false,
                message: '২৪ ঘন্টার বেশি পুরনো স্ক্রিনশট ডিলিট করা যাবে না'
            });
        }

        const intervalMinutes = screenshot.task?.screenshotInterval || 5;
        const deductedSeconds = intervalMinutes * 60;

        // Delete from MinIO
        await deleteFromMinio(screenshot.screenshotPath).catch((err) => {
            console.warn('MinIO delete failed (continuing):', err.message);
        });

        // Delete from database
        await prisma.screenshot.delete({ where: { id: screenshotId } });

        // Time deduction: find the SubTaskTimeLog covering this screenshot's recordedAt
        if (screenshot.subTaskId) {
            const timeLog = await prisma.subTaskTimeLog.findFirst({
                where: {
                    subTaskId: screenshot.subTaskId,
                    userId: dbUser.id,
                    startTime: { lte: screenshot.recordedAt },
                    OR: [
                        { endTime: { gte: screenshot.recordedAt } },
                        { endTime: null }, // Still running
                    ],
                },
                orderBy: { startTime: 'desc' },
            });

            if (timeLog && timeLog.durationSeconds) {
                const newDuration = Math.max(0, timeLog.durationSeconds - deductedSeconds);
                await prisma.subTaskTimeLog.update({
                    where: { id: timeLog.id },
                    data: { durationSeconds: newDuration },
                });
            }

            // Also reduce SubTask totalSeconds
            const subTask = await prisma.subTask.findUnique({
                where: { id: screenshot.subTaskId },
                select: { totalSeconds: true },
            });
            if (subTask) {
                await prisma.subTask.update({
                    where: { id: screenshot.subTaskId },
                    data: { totalSeconds: Math.max(0, subTask.totalSeconds - deductedSeconds) },
                });
            }
        }

        // Also deduct from main TimeLog if exists
        if (screenshot.taskId) {
            const mainTimeLog = await prisma.timeLog.findFirst({
                where: {
                    taskId: screenshot.taskId,
                    userId: dbUser.id,
                    startTime: { lte: screenshot.recordedAt },
                    OR: [
                        { endTime: { gte: screenshot.recordedAt } },
                        { endTime: null },
                    ],
                },
                orderBy: { startTime: 'desc' },
            });

            if (mainTimeLog && mainTimeLog.durationSeconds) {
                const newDuration = Math.max(0, mainTimeLog.durationSeconds - deductedSeconds);
                await prisma.timeLog.update({
                    where: { id: mainTimeLog.id },
                    data: { durationSeconds: newDuration },
                });
            }
        }

        // Decrement company storage
        if (dbUser.companyId) {
            const company = await prisma.company.findUnique({
                where: { id: dbUser.companyId },
                select: { storageUsed: true },
            });
            const newUsed = Math.max(0, (company?.storageUsed || 0) - 0.3);
            await prisma.company.update({
                where: { id: dbUser.companyId },
                data: { storageUsed: newUsed },
            });
        }

        // Notify task creator
        if (screenshot.task?.creatorId) {
            const recordedTime = screenshot.recordedAt.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
            await prisma.notification.create({
                data: {
                    userId: screenshot.task.creatorId,
                    title: 'স্ক্রিনশট ডিলিট করা হয়েছে',
                    message: `${dbUser.name || dbUser.email} "${screenshot.task.title}" টাস্কের ${recordedTime}-এর ${intervalMinutes} মিনিটের স্লট ডিলিট করেছে`,
                    type: 'WARNING',
                },
            });
        }

        // Socket emit
        const io = req.app.get('io');
        if (io && screenshot.task?.companyId) {
            io.to(`company:${screenshot.task.companyId}`).emit('screenshot:self-deleted', {
                screenshotId,
                taskId: screenshot.taskId,
                userId: dbUser.id,
                userName: dbUser.name || dbUser.email,
                deductedSeconds,
                recordedAt: screenshot.recordedAt,
            });
        }

        return res.json({
            success: true,
            message: `স্ক্রিনশট ডিলিট হয়েছে এবং ${intervalMinutes} মিনিট সময় কেটে গেছে`,
            deductedSeconds,
        });
    } catch (error) {
        console.error('Self-delete screenshot error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete screenshot' });
    }
};
