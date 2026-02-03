import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from '../middlewares/authMiddleware';
import { uploadToMinio, getSignedViewUrl } from '../utils/minioClient';

const prisma = new PrismaClient();
const router = express.Router();

// Configure disk storage for general uploads
// Configure memory storage for all uploads (to pass buffer to MinIO)
const memoryStorage = multer.memoryStorage();

const upload = multer({
    storage: memoryStorage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB per file
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

    try {
        // @ts-ignore
        const user = req.user;
        const fileSizeMB = req.file.size / (1024 * 1024);

        // Check storage limit (2GB = 2048MB)
        if (user?.companyId) {
            const company = await prisma.company.findUnique({
                where: { id: user.companyId },
                select: { storageUsed: true, storageLimit: true }
            });

            if (company && (company.storageUsed + fileSizeMB) > company.storageLimit) {
                res.status(403).json({ error: `Storage Limit Reached (${company.storageLimit}MB). Used: ${company.storageUsed.toFixed(1)}MB` });
                return;
            }

            // Update storage used
            await prisma.company.update({
                where: { id: user.companyId },
                data: { storageUsed: { increment: fileSizeMB } }
            });
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
        const { taskId, activityScore } = req.body; // metadata from FormData

        // Generate a unique filename for MinIO (handled inside uploadToMinio for screenshots logic somewhat, but we pass raw name)
        // But our new logic expects fileName. Let's pass original name.
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `${uniqueSuffix}${path.extname(req.file.originalname)}`;

        // Pass 'screenshots' as folder
        const imageUrl = await uploadToMinio(req.file.buffer, fileName, req.file.mimetype, 'screenshots');


        if (!user || !user.id) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Create Screenshot Record
        const screenshot = await prisma.screenshot.create({
            data: {
                userId: user.id,
                screenshotPath: imageUrl, // Variable name from S3 upload is still 'imageUrl' (fileKey), mapping to DB field 'screenshotPath'
                activityScore: activityScore ? parseInt(activityScore) : 0,
                // taskId: taskId // Schema doesn't have taskId in Screenshot model yet? 
                // Let's check schema. If not, we just skip it or link it via relation if possible.
                // The current schema has `userId`, `imageUrl`, `activityScore`, `capturedAt`.
                // It does NOT have `taskId`. I'll skip taskId for now or we need to migrate DB.
                // User asked to "Log: Call `/api/timelogs`". Screenshot usually links to a task.
                // For now, I will just save the screenshot record.
            }
        });

        res.json(screenshot);

    } catch (error) {
        console.error("Screenshot Upload Error:", error);
        res.status(500).json({ error: 'Screenshot upload failed' });
    }
});

export default router;

