// ============================================================
// KormoSync API - Work Proof Controller
// Employee proof submission during work
// ============================================================

import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getSignedViewUrl } from '../utils/minioClient';

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

// Submit work proof
export const submitProof = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { taskId, subTaskId, summary, notes, attachments } = req.body;

        if (!taskId) return res.status(400).json({ error: 'taskId is required' });
        if (!summary || !summary.trim()) return res.status(400).json({ error: 'summary is required' });

        // Verify task exists and user is assigned
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, title: true, companyId: true, creatorId: true }
        });

        if (!task) return res.status(404).json({ error: 'Task not found' });

        const proof = await prisma.workProof.create({
            data: {
                taskId,
                subTaskId: subTaskId || null,
                userId: user.id,
                summary: summary.trim(),
                notes: notes?.trim() || null,
                attachments: Array.isArray(attachments) ? attachments : [],
            }
        });

        // Notify task creator/admin
        await prisma.notification.create({
            data: {
                userId: task.creatorId,
                title: 'নতুন কাজের প্রমাণ',
                message: `${user.dbUser?.name || user.email} "${task.title}" টাস্কে প্রুফ পাঠিয়েছে: ${summary.substring(0, 80)}`,
                type: 'INFO',
            }
        });

        // Socket notification
        const io = req.app.get('io');
        if (io && task.companyId) {
            io.to(`company:${task.companyId}`).emit('proof:submitted', {
                proofId: proof.id,
                taskId,
                taskTitle: task.title,
                userId: user.id,
                userName: user.dbUser?.name || user.email,
                summary: proof.summary,
                createdAt: proof.createdAt,
            });
        }

        return res.json({ success: true, proof });
    } catch (error) {
        console.error('Submit Proof Error:', error);
        return res.status(500).json({ error: 'Failed to submit proof' });
    }
};

// Get proofs for a task (Admin view)
export const getTaskProofs = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { taskId } = req.params;

        const proofs = await prisma.workProof.findMany({
            where: { taskId },
            include: {
                user: {
                    select: { id: true, name: true, email: true, profileImage: true }
                },
                subTask: {
                    select: { id: true, title: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 30 // Limit to prevent MinIO overload (was unlimited!)
        });

        // Sign attachment URLs — BATCHED (3 proofs at a time, each with nested attachments)
        const proofsWithSignedUrls = await batchProcess(proofs, 3, async (proof) => {
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

        return res.json({ success: true, proofs: proofsWithSignedUrls });
    } catch (error) {
        console.error('Get Task Proofs Error:', error);
        return res.status(500).json({ error: 'Failed to fetch proofs' });
    }
};

// Get my proofs (Employee view)
export const getMyProofs = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const proofs = await prisma.workProof.findMany({
            where: { userId: user.id },
            include: {
                task: {
                    select: { id: true, title: true }
                },
                subTask: {
                    select: { id: true, title: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // Sign attachment URLs — BATCHED (3 proofs at a time)
        const proofsWithSignedUrls = await batchProcess(proofs, 3, async (proof) => {
            const signedAttachments = await batchProcess(
                (proof.attachments || []) as string[], 3, (path: string) => safeSignUrl(path)
            );
            return {
                ...proof,
                attachments: signedAttachments,
            };
        });

        return res.json({ success: true, proofs: proofsWithSignedUrls });
    } catch (error) {
        console.error('Get My Proofs Error:', error);
        return res.status(500).json({ error: 'Failed to fetch proofs' });
    }
};
