// ============================================================
// KormoSync API - Task Assignment Controller
// Handles assignment approval workflow (accept/reject/pending)
// ============================================================

import { Request, Response } from 'express';
import prisma from '../utils/prisma';

const getUser = (req: Request) => req.user as any;

// Get pending assignments for current employee
export const getPendingAssignments = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const assignments = await prisma.taskAssignment.findMany({
            where: {
                userId: user.id,
                status: 'PENDING',
            },
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        priority: true,
                        deadline: true,
                        billingType: true,
                        hourlyRate: true,
                        fixedPrice: true,
                        estimatedHours: true,
                        screenshotInterval: true,
                        monitoringMode: true,
                        screenshotEnabled: true,
                        activityEnabled: true,
                        creator: {
                            select: { id: true, name: true, email: true }
                        },
                        subTasks: {
                            orderBy: { orderIndex: 'asc' },
                            select: {
                                id: true,
                                title: true,
                                description: true,
                                billingType: true,
                                fixedPrice: true,
                                hourlyRate: true,
                                estimatedHours: true,
                            }
                        }
                    }
                }
            },
            orderBy: { assignedAt: 'desc' }
        });

        return res.json({ success: true, assignments });
    } catch (error) {
        console.error('Get Pending Assignments Error:', error);
        return res.status(500).json({ error: 'Failed to fetch pending assignments' });
    }
};

// Accept assignment
export const acceptAssignment = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { assignmentId } = req.params;

        // Verify assignment belongs to this user
        const assignment = await prisma.taskAssignment.findUnique({
            where: { id: assignmentId },
            include: { task: { select: { id: true, title: true, companyId: true, creatorId: true } } }
        });

        if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
        if (assignment.userId !== user.id) return res.status(403).json({ error: 'Not your assignment' });
        if (assignment.status !== 'PENDING') {
            return res.status(400).json({ error: `Assignment already ${assignment.status.toLowerCase()}` });
        }

        // Update assignment status + connect user to task assignees
        const [updatedAssignment] = await prisma.$transaction([
            prisma.taskAssignment.update({
                where: { id: assignmentId },
                data: { status: 'ACCEPTED', respondedAt: new Date() }
            }),
            prisma.task.update({
                where: { id: assignment.taskId },
                data: {
                    assignees: { connect: { id: user.id } }
                }
            })
        ]);

        // Create notification for admin/creator
        await prisma.notification.create({
            data: {
                userId: assignment.task.creatorId,
                title: 'টাস্ক গৃহীত',
                message: `${user.dbUser?.name || user.email} "${assignment.task.title}" টাস্ক গ্রহণ করেছে`,
                type: 'INFO',
            }
        });

        // Socket notification
        const io = req.app.get('io');
        if (io && assignment.task.companyId) {
            io.to(`company:${assignment.task.companyId}`).emit('assignment:accepted', {
                assignmentId,
                taskId: assignment.taskId,
                taskTitle: assignment.task.title,
                userId: user.id,
                userName: user.dbUser?.name || user.email,
            });
        }

        return res.json({ success: true, assignment: updatedAssignment });
    } catch (error) {
        console.error('Accept Assignment Error:', error);
        return res.status(500).json({ error: 'Failed to accept assignment' });
    }
};

// Reject assignment
export const rejectAssignment = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { assignmentId } = req.params;

        const assignment = await prisma.taskAssignment.findUnique({
            where: { id: assignmentId },
            include: { task: { select: { id: true, title: true, companyId: true, creatorId: true } } }
        });

        if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
        if (assignment.userId !== user.id) return res.status(403).json({ error: 'Not your assignment' });
        if (assignment.status !== 'PENDING') {
            return res.status(400).json({ error: `Assignment already ${assignment.status.toLowerCase()}` });
        }

        const updatedAssignment = await prisma.taskAssignment.update({
            where: { id: assignmentId },
            data: { status: 'REJECTED', respondedAt: new Date() }
        });

        // Notify admin/creator
        await prisma.notification.create({
            data: {
                userId: assignment.task.creatorId,
                title: 'টাস্ক প্রত্যাখ্যাত',
                message: `${user.dbUser?.name || user.email} "${assignment.task.title}" টাস্ক প্রত্যাখ্যান করেছে`,
                type: 'WARNING',
            }
        });

        // Socket notification
        const io = req.app.get('io');
        if (io && assignment.task.companyId) {
            io.to(`company:${assignment.task.companyId}`).emit('assignment:rejected', {
                assignmentId,
                taskId: assignment.taskId,
                taskTitle: assignment.task.title,
                userId: user.id,
                userName: user.dbUser?.name || user.email,
            });
        }

        return res.json({ success: true, assignment: updatedAssignment });
    } catch (error) {
        console.error('Reject Assignment Error:', error);
        return res.status(500).json({ error: 'Failed to reject assignment' });
    }
};

// Get all assignments for a task (Admin view)
export const getTaskAssignments = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { taskId } = req.params;

        const assignments = await prisma.taskAssignment.findMany({
            where: { taskId },
            include: {
                user: {
                    select: { id: true, name: true, email: true, profileImage: true }
                }
            },
            orderBy: { assignedAt: 'desc' }
        });

        return res.json({ success: true, assignments });
    } catch (error) {
        console.error('Get Task Assignments Error:', error);
        return res.status(500).json({ error: 'Failed to fetch task assignments' });
    }
};
