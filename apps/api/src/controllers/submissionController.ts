// ============================================================
// KormoSync API - Task Submission Controller (Sprint 11)
// Dynamic proof form answers — like Google Forms per task
// ============================================================

import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getSignedViewUrl } from '../utils/minioClient';

// ============================================================
// Helpers
// ============================================================
const getUser = (req: Request) => req.user as any;

async function safeSignUrl(path: string | null): Promise<string | null> {
    if (!path) return null;
    try { return await getSignedViewUrl(path); } catch { return null; }
}

interface ProofField {
    id: string;
    label: string;
    type: 'TEXT' | 'NUMBER' | 'FILE' | 'DROPDOWN' | 'CHECKBOX';
    options?: string[];
    required: boolean;
}

// ============================================================
// Submit proof form answers
// POST /submissions/submit
// ============================================================
export const submitProofForm = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { taskId, subTaskId, answers } = req.body;

        if (!taskId) return res.status(400).json({ success: false, error: 'taskId is required' });
        if (!answers || typeof answers !== 'object') {
            return res.status(400).json({ success: false, error: 'answers object is required' });
        }

        // Fetch task with proofSchema
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, title: true, companyId: true, creatorId: true, proofSchema: true, proofFrequency: true }
        });

        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

        // Validate answers against proofSchema
        const schema = task.proofSchema as ProofField[] | null;
        if (schema && Array.isArray(schema)) {
            for (const field of schema) {
                if (field.required) {
                    const value = answers[field.id];
                    if (value === undefined || value === null || value === '') {
                        return res.status(400).json({
                            success: false,
                            error: `"${field.label}" ফিল্ডটি পূরণ করা আবশ্যক`,
                            fieldId: field.id,
                        });
                    }
                }
                // Type validation
                if (answers[field.id] !== undefined && answers[field.id] !== null) {
                    if (field.type === 'NUMBER' && typeof answers[field.id] !== 'number') {
                        const parsed = Number(answers[field.id]);
                        if (isNaN(parsed)) {
                            return res.status(400).json({
                                success: false,
                                error: `"${field.label}" একটি সংখ্যা হতে হবে`,
                                fieldId: field.id,
                            });
                        }
                        answers[field.id] = parsed;
                    }
                    if (field.type === 'DROPDOWN' && field.options && !field.options.includes(String(answers[field.id]))) {
                        return res.status(400).json({
                            success: false,
                            error: `"${field.label}" এর মান অবৈধ`,
                            fieldId: field.id,
                        });
                    }
                }
            }
        }

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        let submission;
        if (task.proofFrequency === 'ONCE_DAILY') {
            // Upsert: one entry per user per day per task
            submission = await prisma.taskSubmission.upsert({
                where: {
                    taskId_userId_date: { taskId, userId: user.id, date: today }
                },
                update: {
                    answers,
                    subTaskId: subTaskId || null,
                },
                create: {
                    taskId,
                    subTaskId: subTaskId || null,
                    userId: user.id,
                    answers,
                    date: today,
                },
            });
        } else {
            // UNLIMITED: always create new
            submission = await prisma.taskSubmission.create({
                data: {
                    taskId,
                    subTaskId: subTaskId || null,
                    userId: user.id,
                    answers,
                    date: today,
                },
            });
        }

        // Notify task creator
        await prisma.notification.create({
            data: {
                userId: task.creatorId,
                title: 'নতুন প্রুফ সাবমিশন',
                message: `${user.dbUser?.name || user.email} "${task.title}" টাস্কে প্রুফ ফর্ম জমা দিয়েছে`,
                type: 'INFO',
            }
        });

        // Socket notification
        const io = req.app.get('io');
        if (io && task.companyId) {
            io.to(`company:${task.companyId}`).emit('submission:new', {
                submissionId: submission.id,
                taskId,
                taskTitle: task.title,
                userId: user.id,
                userName: user.dbUser?.name || user.email,
                date: today,
                createdAt: submission.createdAt,
            });
        }

        return res.json({ success: true, submission });
    } catch (error) {
        console.error('Submit Proof Form Error:', error);
        return res.status(500).json({ success: false, error: 'Failed to submit proof form' });
    }
};

// ============================================================
// Get submissions for a task (Admin/Manager view — for worksheet)
// GET /submissions/task/:taskId
// ============================================================
export const getTaskSubmissions = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { taskId } = req.params;
        const { date } = req.query; // Optional: filter by date

        const where: any = { taskId };
        if (date) where.date = date;

        const submissions = await prisma.taskSubmission.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true, profileImage: true } },
                subTask: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        // Sign FILE-type answer URLs if needed
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { proofSchema: true }
        });

        const schema = task?.proofSchema as ProofField[] | null;
        const fileFieldIds = schema?.filter(f => f.type === 'FILE').map(f => f.id) || [];

        // Sign URLs for file fields
        if (fileFieldIds.length > 0) {
            for (const sub of submissions) {
                const answers = sub.answers as Record<string, any>;
                for (const fieldId of fileFieldIds) {
                    if (answers[fieldId] && typeof answers[fieldId] === 'string') {
                        answers[fieldId] = await safeSignUrl(answers[fieldId]) || answers[fieldId];
                    }
                }
            }
        }

        return res.json({ success: true, submissions });
    } catch (error) {
        console.error('Get Task Submissions Error:', error);
        return res.status(500).json({ success: false, error: 'Failed to get submissions' });
    }
};

// ============================================================
// Get my submissions (Employee view)
// GET /submissions/my
// ============================================================
export const getMySubmissions = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const submissions = await prisma.taskSubmission.findMany({
            where: { userId: user.id },
            include: {
                task: { select: { id: true, title: true } },
                subTask: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        return res.json({ success: true, submissions });
    } catch (error) {
        console.error('Get My Submissions Error:', error);
        return res.status(500).json({ success: false, error: 'Failed to get submissions' });
    }
};
