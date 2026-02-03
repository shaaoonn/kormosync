import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { uploadToMinio, getSignedViewUrl } from '../utils/minioClient';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

/**
 * Upload screenshot from desktop app
 */
export const uploadScreenshot = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.uid;
        const { taskId, keystrokes, mouseClicks, activeSeconds, capturedAt } = req.body;

        console.log('📸 Screenshot Upload Request Received');
        console.log('   User ID:', userId);
        console.log('   Task ID:', taskId);
        console.log('   File:', req.file ? `${req.file.size} bytes` : 'MISSING');

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

        // Generate unique filename
        const fileName = `${dbUser.id}_${Date.now()}_${uuidv4().slice(0, 8)}.png`;
        console.log('   Generated filename:', fileName);

        // Upload to MinIO
        const fileKey = await uploadToMinio(req.file.buffer, fileName, 'image/png', 'screenshots');

        // Calculate activity score (based on keystrokes and mouse activity)
        const activityScore = Math.min(100, Math.round(
            ((parseInt(keystrokes || '0') || 0) / 100 + (parseInt(mouseClicks || '0') || 0) / 50) * 10 +
            ((parseInt(activeSeconds || '300') || 300) / 300) * 50
        ));

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
            },
            include: {
                user: { select: { id: true, name: true, email: true, profileImage: true } },
                task: { select: { id: true, title: true } }
            }
        });

        // Emit socket event for real-time update
        const io = (req.app as any).get('io');
        if (io && dbUser?.companyId) {
            io.to(`company:${dbUser.companyId}`).emit('screenshot:new', {
                id: screenshot.id,
                imageUrl: await getSignedViewUrl(fileKey), // Send Signed URL immediately
                recordedAt: screenshot.recordedAt,
                keyboardCount: screenshot.keyboardCount,
                mouseCount: screenshot.mouseCount,
                activityScore: screenshot.activityScore,
                user: screenshot.user,
                task: screenshot.task
            });
        }

        return res.json({
            success: true,
            message: 'Screenshot uploaded successfully',
            screenshot: {
                id: screenshot.id,
                imageUrl: fileKey,
                activityScore
            }
        });

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

        const screenshots = await prisma.screenshot.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true, profileImage: true } },
                task: { select: { id: true, title: true } }
            },
            orderBy: { recordedAt: 'desc' },
            take: 100
        });

        // Generate signed URLs for each screenshot
        const screenshotsWithUrls = await Promise.all(
            screenshots.map(async (ss) => ({
                ...ss,
                imageUrl: await getSignedViewUrl(ss.screenshotPath) // Map screenshotPath -> imageUrl for frontend compat or use new name
            }))
        );

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
