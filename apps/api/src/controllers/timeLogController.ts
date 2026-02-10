import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { uploadToMinio, getSignedViewUrl } from '../utils/minioClient'; // Reuse MinIO client
import { v4 as uuidv4 } from 'uuid';


/**
 * Upload Time Log (Snapshot with Activity Data)
 * POST /api/timelogs
 */
export const uploadTimeLog = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.uid;
        // Accept new field names: keyboardCount, mouseCount
        const { taskId, keyboardCount, mouseCount, activeSeconds, recordedAt } = req.body;

        if (!userId || !taskId) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const dbUser = await prisma.user.findUnique({ where: { firebaseUid: userId } });
        if (!dbUser) return res.status(404).json({ success: false, message: 'User not found' });

        if (!req.file) return res.status(400).json({ success: false, message: 'No screenshot file provided' });

        // Generate filename
        const fileName = `${dbUser.id}_${Date.now()}_${uuidv4().slice(0, 8)}.png`;

        // Upload to MinIO (Private Bucket)
        const fileKey = await uploadToMinio(req.file.buffer, fileName, 'image/png', 'screenshots');

        // Calculate activity score
        const kCount = parseInt(keyboardCount || '0');
        const mCount = parseInt(mouseCount || '0');
        const actSec = parseInt(activeSeconds || '300');

        // Simple logic: (activities / threshold) + (time / total) * weight
        const activityScore = Math.min(100, Math.round(
            ((kCount / 100 + mCount / 50) * 10) + ((actSec / 300) * 50)
        ));

        // Save to DB (Screenshot Model)
        const log = await prisma.screenshot.create({
            data: {
                screenshotPath: fileKey,
                recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
                keyboardCount: kCount,
                mouseCount: mCount,
                activeSeconds: actSec,
                activityScore,
                userId: dbUser.id,
                taskId,
            }
        });

        // Generate a 1-hour signed URL for immediate usage
        const signedUrl = await getSignedViewUrl(fileKey);

        return res.json({
            success: true,
            log: {
                id: log.id,
                url: signedUrl,
                activityScore: log.activityScore,
                time: log.recordedAt
            }
        });

    } catch (error) {
        console.error('TimeLog upload error:', error);
        return res.status(500).json({ success: false, message: 'Failed to upload time log' });
    }
};

/**
 * Get Time Logs with Signed URLs
 * GET /api/timelogs?date=YYYY-MM-DD
 */
export const getTimeLogs = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.uid; // Requestor
        const { date, taskId, employeeId } = req.query;

        // Verify Requestor Company
        const requestor = await prisma.user.findUnique({ where: { firebaseUid: userId } });
        if (!requestor?.companyId) return res.status(403).json({ success: false, message: 'No company access' });

        const where: any = {
            user: { companyId: requestor.companyId } // Scope to company
        };

        if (date) {
            const start = new Date(date as string);
            const end = new Date(date as string);
            end.setHours(23, 59, 59, 999);
            where.recordedAt = { gte: start, lte: end };
        }

        if (taskId) where.taskId = taskId as string;
        if (employeeId) where.userId = employeeId as string;

        // Fetch Logs (limited to 50 — reduces signed URL generation time 4x)
        const logs = await prisma.screenshot.findMany({
            where,
            orderBy: { recordedAt: 'desc' },
            take: 50
        });

        // Sign URLs in batches of 5 to avoid overwhelming MinIO server
        const BATCH_SIZE = 5;
        const logsWithSignedUrls: any[] = [];
        for (let i = 0; i < logs.length; i += BATCH_SIZE) {
            const batch = logs.slice(i, i + BATCH_SIZE);
            const signed = await Promise.all(batch.map(async (log) => ({
                id: log.id,
                url: await getSignedViewUrl(log.screenshotPath),
                activityScore: log.activityScore,
                recordedAt: log.recordedAt,
                keyboardCount: log.keyboardCount,
                mouseCount: log.mouseCount
            })));
            logsWithSignedUrls.push(...signed);
        }

        return res.json({
            success: true,
            data: logsWithSignedUrls
        });

    } catch (error) {
        console.error('Get TimeLogs error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch logs' });
    }
};
