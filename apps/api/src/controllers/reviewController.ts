import { Request, Response } from 'express';
import prisma from '../utils/prisma';

const getUser = (req: Request) => req.user as any;

// Submit task for review (Employee marks DONE → REVIEW)
export const submitForReview = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { taskId } = req.params;

        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) return res.status(404).json({ error: 'Task not found' });

        // Only allow submitting if task has a reviewer assigned
        if (!task.reviewerId) {
            // No reviewer → just mark DONE directly
            const updated = await prisma.task.update({
                where: { id: taskId },
                data: { status: 'DONE' }
            });
            return res.json({ success: true, task: updated, message: 'No reviewer — marked as DONE' });
        }

        // Move to REVIEW status
        const updated = await prisma.task.update({
            where: { id: taskId },
            data: { status: 'REVIEW' }
        });

        // Create review comment entry
        await prisma.reviewComment.create({
            data: {
                taskId,
                userId: user.id,
                action: 'REQUEST_CHANGES', // Using as "SUBMITTED" indicator
                comment: 'Task submitted for review',
            }
        });

        // Notify reviewer via socket
        const io = req.app.get('io');
        if (io && task.reviewerId) {
            io.to(`user:${task.reviewerId}`).emit('review:submitted', {
                taskId,
                title: task.title,
                submittedBy: user.name || user.email,
            });

            await prisma.notification.create({
                data: {
                    userId: task.reviewerId,
                    title: 'রিভিউ অনুরোধ',
                    message: `"${task.title}" টাস্কটি রিভিউর জন্য জমা দেওয়া হয়েছে।`,
                    type: 'INFO',
                }
            });
        }

        return res.json({ success: true, task: updated });
    } catch (error) {
        console.error('Submit for Review Error:', error);
        return res.status(500).json({ error: 'Failed to submit for review' });
    }
};

// Review a task (Approve or Request Changes)
export const reviewTask = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { taskId } = req.params;
        const { action, comment } = req.body; // action: 'APPROVED' | 'REQUEST_CHANGES'

        if (!['APPROVED', 'REQUEST_CHANGES'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Use APPROVED or REQUEST_CHANGES' });
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, title: true, reviewerId: true, status: true, companyId: true, assignees: { select: { id: true } } }
        });
        if (!task) return res.status(404).json({ error: 'Task not found' });

        // Only reviewer or admin can review
        const isReviewer = task.reviewerId === user.id;
        const isAdmin = ['OWNER', 'ADMIN'].includes(user.role);
        if (!isReviewer && !isAdmin) {
            return res.status(403).json({ error: 'Only the assigned reviewer or admin can review' });
        }

        // Create review comment
        await prisma.reviewComment.create({
            data: {
                taskId,
                userId: user.id,
                action: action as any,
                comment: comment || null,
            }
        });

        // Update task status based on action
        const newStatus = action === 'APPROVED' ? 'DONE' : 'IN_PROGRESS';
        const updated = await prisma.task.update({
            where: { id: taskId },
            data: { status: newStatus }
        });

        // Notify assignees
        const io = req.app.get('io');
        if (io) {
            for (const assignee of task.assignees) {
                io.to(`user:${assignee.id}`).emit('review:result', {
                    taskId,
                    title: task.title,
                    action,
                    comment,
                    reviewedBy: user.name || user.email,
                });

                await prisma.notification.create({
                    data: {
                        userId: assignee.id,
                        title: action === 'APPROVED' ? 'টাস্ক অনুমোদিত ✅' : 'পরিবর্তন প্রয়োজন ↩️',
                        message: action === 'APPROVED'
                            ? `"${task.title}" টাস্কটি অনুমোদিত হয়েছে।`
                            : `"${task.title}" টাস্কে পরিবর্তন প্রয়োজন: ${comment || 'কোনো মন্তব্য নেই'}`,
                        type: action === 'APPROVED' ? 'INFO' : 'WARNING',
                    }
                });
            }
        }

        return res.json({ success: true, task: updated, action });
    } catch (error) {
        console.error('Review Task Error:', error);
        return res.status(500).json({ error: 'Failed to review task' });
    }
};

// Get review history for a task
export const getReviewHistory = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;

        const reviews = await prisma.reviewComment.findMany({
            where: { taskId },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' }
        });

        return res.json({ success: true, reviews });
    } catch (error) {
        console.error('Get Review History Error:', error);
        return res.status(500).json({ error: 'Failed to fetch review history' });
    }
};
