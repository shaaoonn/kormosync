import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { BillingType, ScheduleType } from '@prisma/client';


// ============================================================
// HELPER: Time Overlap Validation
// ============================================================

interface ScheduleInfo {
    scheduleType?: ScheduleType | null;
    scheduleDays: number[];
    startTime?: string | null;
    endTime?: string | null;
}

function parseTime(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function validateNoOverlap(existingSubTasks: ScheduleInfo[], newSubTask: ScheduleInfo): { valid: boolean; message?: string } {
    if (!newSubTask.scheduleType || !newSubTask.startTime || !newSubTask.endTime) {
        return { valid: true };
    }

    for (const existing of existingSubTasks) {
        if (!existing.scheduleType || !existing.startTime || !existing.endTime) continue;

        // Check if schedule types are compatible for comparison
        if (existing.scheduleType !== newSubTask.scheduleType) continue;

        // Check day overlap
        const daysOverlap = existing.scheduleDays.some(d => newSubTask.scheduleDays.includes(d));
        if (!daysOverlap) continue;

        // Check time overlap
        const newStart = parseTime(newSubTask.startTime);
        const newEnd = parseTime(newSubTask.endTime);
        const existStart = parseTime(existing.startTime);
        const existEnd = parseTime(existing.endTime);

        if (newStart < existEnd && newEnd > existStart) {
            return {
                valid: false,
                message: `Time conflict detected: ${newSubTask.startTime}-${newSubTask.endTime} overlaps with an existing schedule ${existing.startTime}-${existing.endTime}`
            };
        }
    }

    return { valid: true };
}

// ============================================================
// CREATE Task Bundle (Task with SubTasks)
// ============================================================

export const createTaskBundle = async (req: Request, res: Response): Promise<void> => {
    try {
        const { title, description, priority, deadline, subTasks } = req.body;
        const user = (req as any).user;

        if (!user?.companyId) {
            res.status(400).json({ success: false, error: 'Company context required' });
            return;
        }

        if (!title) {
            res.status(400).json({ success: false, error: 'Task title is required' });
            return;
        }

        if (subTasks && subTasks.length > 10) {
            res.status(400).json({ success: false, error: 'Maximum 10 sub-tasks per bundle allowed' });
            return;
        }

        // Validate time overlaps for SCHEDULED sub-tasks
        if (subTasks && subTasks.length > 1) {
            const scheduledSubTasks: ScheduleInfo[] = [];
            for (let i = 0; i < subTasks.length; i++) {
                const st = subTasks[i];
                if (st.billingType === 'SCHEDULED') {
                    const validation = validateNoOverlap(scheduledSubTasks, st);
                    if (!validation.valid) {
                        res.status(400).json({
                            success: false,
                            error: validation.message,
                            subTaskIndex: i
                        });
                        return;
                    }
                    scheduledSubTasks.push(st);
                }
            }
        }

        // Create task with nested sub-tasks
        const task = await prisma.task.create({
            data: {
                companyId: user.companyId,
                creatorId: user.id,
                title,
                description,
                priority: priority || 'MEDIUM',
                deadline: deadline ? new Date(deadline) : null,
                publishStatus: 'DRAFT',
                subTasks: subTasks ? {
                    create: subTasks.map((st: any, index: number) => ({
                        title: st.title,
                        description: st.description,
                        billingType: st.billingType || 'HOURLY',
                        fixedPrice: st.fixedPrice,
                        hourlyRate: st.hourlyRate,
                        estimatedHours: st.estimatedHours,
                        scheduleType: st.scheduleType,
                        scheduleDays: st.scheduleDays || [],
                        startTime: st.startTime,
                        endTime: st.endTime,
                        orderIndex: index
                    }))
                } : undefined
            },
            include: {
                subTasks: true
            }
        });

        res.status(201).json({ success: true, task });
    } catch (error: any) {
        console.error('Create Task Bundle Error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to create task bundle' });
    }
};

// ============================================================
// ADD SubTask to existing Task
// ============================================================

export const addSubTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const { title, description, billingType, fixedPrice, hourlyRate, estimatedHours, scheduleType, scheduleDays, startTime, endTime } = req.body;

        // Check sub-task limit
        const existingCount = await prisma.subTask.count({ where: { taskId } });
        if (existingCount >= 10) {
            res.status(400).json({ success: false, error: 'Maximum 10 sub-tasks per bundle reached' });
            return;
        }

        // Get existing sub-tasks for overlap check
        if (billingType === 'SCHEDULED') {
            const existingSubTasks = await prisma.subTask.findMany({
                where: { taskId, billingType: 'SCHEDULED' },
                select: { scheduleType: true, scheduleDays: true, startTime: true, endTime: true }
            });

            const validation = validateNoOverlap(existingSubTasks, {
                scheduleType,
                scheduleDays: scheduleDays || [],
                startTime,
                endTime
            });

            if (!validation.valid) {
                res.status(400).json({ success: false, error: validation.message });
                return;
            }
        }

        const subTask = await prisma.subTask.create({
            data: {
                taskId,
                title,
                description,
                billingType: billingType || 'HOURLY',
                fixedPrice,
                hourlyRate,
                estimatedHours,
                scheduleType,
                scheduleDays: scheduleDays || [],
                startTime,
                endTime,
                orderIndex: existingCount
            }
        });

        res.status(201).json({ success: true, subTask });
    } catch (error: any) {
        console.error('Add SubTask Error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to add sub-task' });
    }
};

// ============================================================
// VALIDATE Schedule (Check for overlaps before save)
// ============================================================

export const validateSchedule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const { scheduleType, scheduleDays, startTime, endTime } = req.body;

        const existingSubTasks = await prisma.subTask.findMany({
            where: { taskId, billingType: 'SCHEDULED' },
            select: { scheduleType: true, scheduleDays: true, startTime: true, endTime: true }
        });

        const validation = validateNoOverlap(existingSubTasks, {
            scheduleType,
            scheduleDays: scheduleDays || [],
            startTime,
            endTime
        });

        res.json({ success: true, valid: validation.valid, message: validation.message });
    } catch (error: any) {
        console.error('Validate Schedule Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// PUBLISH Task (Assign employees)
// ============================================================

export const publishTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const { assigneeIds } = req.body;

        if (!assigneeIds || assigneeIds.length === 0) {
            res.status(400).json({ success: false, error: 'At least one assignee required to publish' });
            return;
        }

        const task = await prisma.task.update({
            where: { id: taskId },
            data: {
                publishStatus: 'PUBLISHED',
                assignees: {
                    connect: assigneeIds.map((id: string) => ({ id }))
                }
            },
            include: {
                subTasks: true,
                assignees: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        res.json({ success: true, task });
    } catch (error: any) {
        console.error('Publish Task Error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to publish task' });
    }
};

// ============================================================
// GET Task Bundle Details
// ============================================================

export const getTaskBundle = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                subTasks: {
                    orderBy: { orderIndex: 'asc' }
                },
                assignees: {
                    select: { id: true, name: true, email: true, profileImage: true }
                },
                creator: {
                    select: { id: true, name: true, email: true }
                },
                activityLogs: {
                    orderBy: { intervalStart: 'desc' },
                    take: 50
                }
            }
        });

        if (!task) {
            res.status(404).json({ success: false, error: 'Task not found' });
            return;
        }

        res.json({ success: true, task });
    } catch (error: any) {
        console.error('Get Task Bundle Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// UPDATE SubTask
// ============================================================

export const updateSubTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const { subTaskId } = req.params;
        const updates = req.body;

        // If updating schedule, validate overlap
        if (updates.billingType === 'SCHEDULED' && updates.startTime && updates.endTime) {
            const subTask = await prisma.subTask.findUnique({ where: { id: subTaskId } });
            if (subTask) {
                const siblings = await prisma.subTask.findMany({
                    where: { taskId: subTask.taskId, billingType: 'SCHEDULED', id: { not: subTaskId } },
                    select: { scheduleType: true, scheduleDays: true, startTime: true, endTime: true }
                });

                const validation = validateNoOverlap(siblings, {
                    scheduleType: updates.scheduleType,
                    scheduleDays: updates.scheduleDays || [],
                    startTime: updates.startTime,
                    endTime: updates.endTime
                });

                if (!validation.valid) {
                    res.status(400).json({ success: false, error: validation.message });
                    return;
                }
            }
        }

        const subTask = await prisma.subTask.update({
            where: { id: subTaskId },
            data: updates
        });

        // Fix 4E: Subtask Status Aggregation — when a subtask is marked COMPLETED,
        // check if ALL sibling subtasks are also COMPLETED → move parent task to REVIEW
        if (updates.status === 'COMPLETED' && subTask.taskId) {
            const allSiblings = await prisma.subTask.findMany({
                where: { taskId: subTask.taskId },
                select: { status: true }
            });

            const allCompleted = allSiblings.length > 0 && allSiblings.every(s => s.status === 'COMPLETED');

            if (allCompleted) {
                const parentTask = await prisma.task.findUnique({
                    where: { id: subTask.taskId },
                    select: { status: true }
                });

                // Only auto-promote if parent is still IN_PROGRESS (don't override DONE or other states)
                if (parentTask && parentTask.status === 'IN_PROGRESS') {
                    await prisma.task.update({
                        where: { id: subTask.taskId },
                        data: { status: 'REVIEW' }
                    });

                    // Emit socket event for real-time update
                    const io = (req.app as any).get('io');
                    const user = (req as any).user;
                    if (io && user?.companyId) {
                        io.to(`company:${user.companyId}`).emit('task:updated', {
                            taskId: subTask.taskId,
                            status: 'REVIEW',
                            reason: 'All subtasks completed'
                        });
                    }
                }
            }
        }

        res.json({ success: true, subTask });
    } catch (error: any) {
        console.error('Update SubTask Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// DELETE SubTask
// ============================================================

export const deleteSubTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const { subTaskId } = req.params;

        await prisma.subTask.delete({ where: { id: subTaskId } });

        res.json({ success: true, message: 'Sub-task deleted' });
    } catch (error: any) {
        console.error('Delete SubTask Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
