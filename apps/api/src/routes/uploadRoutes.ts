import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../utils/prisma';
import { authenticateUser } from '../middlewares/authMiddleware';
import { uploadToMinio, getSignedViewUrl } from '../utils/minioClient';
import { calculateActivityScore } from '../services/activityScoreService';

const router = express.Router();

// Fix 6C: Allowed file extensions for upload security
const ALLOWED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',  // Images
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.pptx', '.txt', '.csv',  // Documents
    '.mp4', '.webm', '.mov', '.avi',  // Videos
    '.mp3', '.wav', '.ogg',  // Audio
    '.zip', '.rar', '.7z',  // Archives
];

// Configure disk storage for general uploads
// Configure memory storage for all uploads (to pass buffer to MinIO)
const memoryStorage = multer.memoryStorage();

// Set hard ceiling to 1GB — actual limit enforced per subscription after upload
const upload = multer({
    storage: memoryStorage,
    limits: { fileSize: 1024 * 1024 * 1024 } // 1GB hard ceiling
});

const screenshotUpload = multer({
    storage: memoryStorage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB for screenshots
});

// Endpoint: POST /api/upload
router.post('/', authenticateUser, upload.single('file'), async (req: Request, res: Response) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }

    // Fix 6C: Validate file type
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        res.status(400).json({ error: `ফাইল টাইপ অনুমোদিত নয়: ${ext}। অনুমোদিত: ${ALLOWED_EXTENSIONS.join(', ')}` });
        return;
    }

    try {
        // @ts-ignore
        const user = req.user;
        const fileSizeMB = req.file.size / (1024 * 1024);

        // Dynamic per-file limit based on subscription
        if (user?.companyId) {
            const company = await prisma.company.findUnique({
                where: { id: user.companyId },
                select: { storageUsed: true, storageLimit: true, subscriptionStatus: true }
            });

            if (company) {
                // Free users: 10MB per file, Paid users: 1GB per file
                const maxFileSizeMB = company.subscriptionStatus === 'INACTIVE' ? 10 : 1024;
                if (fileSizeMB > maxFileSizeMB) {
                    res.status(413).json({
                        error: `ফাইল সাইজ সীমা ছাড়িয়ে গেছে। সর্বোচ্চ ${maxFileSizeMB}MB আপলোড করা যাবে।`,
                        maxSizeMB: maxFileSizeMB,
                        isPaidFeature: company.subscriptionStatus === 'INACTIVE',
                    });
                    return;
                }

                // Check total storage quota
                if ((company.storageUsed + fileSizeMB) > company.storageLimit) {
                    res.status(403).json({
                        error: `স্টোরেজ সীমা ছাড়িয়ে গেছে (${company.storageLimit}MB)। ব্যবহৃত: ${company.storageUsed.toFixed(1)}MB`,
                        quotaExceeded: true,
                    });
                    return;
                }

                // Update storage used
                await prisma.company.update({
                    where: { id: user.companyId },
                    data: { storageUsed: { increment: fileSizeMB } }
                });
            }
        }

        // Upload to MinIO (using 'uploads' folder)
        const fileKey = await uploadToMinio(req.file.buffer, req.file.originalname, req.file.mimetype, 'uploads');

        // Generate signed URL for immediate display
        // We import getSignedViewUrl from minioClient (need to add import)
        // If not imported at top, I will add it.
        // Assuming I'll add the import in a separate tool call or assume it's there? 
        // No, I must add the import first or in the same step if I can edit multiple chunks.
        // I'll edit this chunk to user imports too?
        // replace_file_content supports single contiguous block.
        // I will do two edits or use multi_replace.
        // Let's use multi_replace or just update imports first.
        // Wait, replace_file_content allows only one block.

        // Let's use multi_replace_file_content to add import AND update logic.

        const signedUrl = await getSignedViewUrl(fileKey);

        res.json({
            success: true,
            url: signedUrl, // Return signed URL for display
            key: fileKey,   // Return raw key/url for potential use
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Endpoint: POST /api/upload/screenshot
router.post('/screenshot', authenticateUser, screenshotUpload.single('image'), async (req: Request, res: Response) => {
    if (!req.file) {
        res.status(400).json({ error: 'No image uploaded' });
        return;
    }

    try {
        // @ts-ignore
        const user = req.user;
        const { taskId, keystrokes, mouseClicks, activeSeconds, capturedAt } = req.body;

        console.log('📸 Screenshot Upload via /api/upload/screenshot');
        console.log('   User ID:', user?.id, '| Task ID:', taskId);
        console.log('   File:', req.file.size, 'bytes');

        if (!user || !user.id) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check company storage quota
        if (user.companyId) {
            const company = await prisma.company.findUnique({
                where: { id: user.companyId },
                select: { storageUsed: true, storageLimit: true }
            });
            const fileSizeMB = req.file.size / (1024 * 1024);
            if (company && (company.storageUsed + fileSizeMB) > company.storageLimit) {
                res.status(403).json({
                    success: false,
                    quotaExceeded: true,
                    message: `স্টোরেজ সীমা ছাড়িয়ে গেছে (${company.storageLimit}MB)।`,
                });
                return;
            }
            await prisma.company.update({
                where: { id: user.companyId },
                data: { storageUsed: { increment: fileSizeMB } }
            });
        }

        // Generate unique filename & upload to MinIO
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `${uniqueSuffix}${path.extname(req.file.originalname || '.png')}`;
        const fileKey = await uploadToMinio(req.file.buffer, fileName, req.file.mimetype, 'screenshots');

        // Calculate activity score
        const parsedKeystrokes = parseInt(keystrokes || '0') || 0;
        const parsedClicks = parseInt(mouseClicks || '0') || 0;
        const parsedActiveSeconds = parseInt(activeSeconds || '300') || 300;
        const intervalMinutes = Math.max(1, Math.ceil(parsedActiveSeconds / 60)) || 5;
        const { score: activityScore } = calculateActivityScore(
            parsedActiveSeconds, parsedKeystrokes, parsedClicks, 0, intervalMinutes
        );

        // Create Screenshot Record with ALL data
        const screenshot = await prisma.screenshot.create({
            data: {
                userId: user.id,
                taskId: taskId || null,
                screenshotPath: fileKey,
                activityScore,
                keyboardCount: parsedKeystrokes,
                mouseCount: parsedClicks,
                activeSeconds: parsedActiveSeconds,
                recordedAt: capturedAt ? new Date(capturedAt) : new Date(),
            }
        });

        // Emit socket event for real-time update
        const io = (req.app as any).get('io');
        if (io && user.companyId) {
            io.to(`company:${user.companyId}`).emit('screenshot:new', {
                id: screenshot.id,
                imageUrl: await getSignedViewUrl(fileKey),
                recordedAt: screenshot.recordedAt,
                keyboardCount: screenshot.keyboardCount,
                mouseCount: screenshot.mouseCount,
                activityScore: screenshot.activityScore,
            });
        }

        console.log('✅ Screenshot saved:', screenshot.id, '| Score:', activityScore);

        res.json({
            success: true,
            screenshot: {
                id: screenshot.id,
                imageUrl: fileKey,
                activityScore,
            }
        });

    } catch (error) {
        console.error("Screenshot Upload Error:", error);
        res.status(500).json({ error: 'Screenshot upload failed' });
    }
});

export default router;

