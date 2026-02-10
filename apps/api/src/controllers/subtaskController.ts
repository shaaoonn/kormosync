import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { isWithinSchedule, getScheduleDisplayStatus } from '../services/scheduleService';


// Helper to get user from request
const getUser = (req: Request) => (req as any).user;

/**
 * Start tracking a sub-task (auto-pauses any active sub-task)
 */
export const startSubTask = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { subTaskId } = req.params;

        // Find the sub-task
        const subTask = await prisma.subTask.findUnique({
            where: { id: subTaskId },
            include: { task: true }
        });

        if (!subTask) {
            return res.status(404).json({ error: 'Sub-task not found' });
        }

        // Check schedule constraints
        const scheduleStatus = isWithinSchedule({
            startTime: subTask.startTime,
            endTime: subTask.endTime,
            scheduleDays: subTask.scheduleDays,
            billingType: subTask.billingType
        });

        if (!scheduleStatus.canStart) {
            return res.status(403).json({
                error: 'Sub-task is outside scheduled time window',
                scheduleLocked: true,
                reason: scheduleStatus.reason,
                startsInSeconds: scheduleStatus.startsInSeconds,
                scheduleDisplay: getScheduleDisplayStatus({
                    startTime: subTask.startTime,
                    endTime: subTask.endTime,
                    scheduleDays: subTask.scheduleDays,
                    billingType: subTask.billingType
                })
            });
        }

        // Check if sub-task is already completed
        if (subTask.status === 'COMPLETED') {
            return res.status(400).json({ error: 'Cannot start a completed sub-task' });
        }

        // CRITICAL: Auto-pause any active sub-task for this user
        const activeTimeLog = await prisma.subTaskTimeLog.findFirst({
            where: {
                userId: user.id,
                endTime: null
            },
            include: { subTask: true }
        });

        if (activeTimeLog) {
            // Stop the active time log
            const endTime = new Date();
            const duration = Math.floor((endTime.getTime() - activeTimeLog.startTime.getTime()) / 1000);

            await prisma.$transaction([
                // Close the time log
                prisma.subTaskTimeLog.update({
                    where: { id: activeTimeLog.id },
                    data: { endTime, durationSeconds: duration }
                }),
                // Update the sub-task's total time and set to PENDING
                prisma.subTask.update({
                    where: { id: activeTimeLog.subTaskId },
                    data: {
                        totalSeconds: { increment: duration },
                        status: 'PENDING'
                    }
                })
            ]);
        }

        // Start new time log for the requested sub-task
        const timeLog = await prisma.subTaskTimeLog.create({
            data: {
                subTaskId,
                userId: user.id,
                startTime: new Date()
            }
        });

        // Update sub-task status to IN_PROGRESS
        await prisma.subTask.update({
            where: { id: subTaskId },
            data: { status: 'IN_PROGRESS' }
        });

        // Emit socket event
        const io = (req.app as any).get('io');
        if (io && subTask.task?.companyId) {
            io.to(`company:${subTask.task.companyId}`).emit('subtask:started', {
                subTaskId,
                taskId: subTask.taskId,
                userId: user.id,
                timeLogId: timeLog.id
            });
        }

        return res.json({
            success: true,
            timeLog,
            stoppedSubTask: activeTimeLog?.subTask || null
        });

    } catch (error) {
        console.error('Start sub-task error:', error);
        return res.status(500).json({ error: 'Failed to start sub-task' });
    }
};

/**
 * Stop tracking a sub-task (pause without completing)
 */
export const stopSubTask = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { subTaskId } = req.params;

        // Find active time log for this sub-task and user
        const activeTimeLog = await prisma.subTaskTimeLog.findFirst({
            where: {
                subTaskId,
                userId: user.id,
                endTime: null
            }
        });

        if (!activeTimeLog) {
            return res.status(400).json({ error: 'No active tracking for this sub-task' });
        }

        const endTime = new Date();
        const duration = Math.floor((endTime.getTime() - activeTimeLog.startTime.getTime()) / 1000);

        // Close time log and update sub-task
        await prisma.$transaction([
            prisma.subTaskTimeLog.update({
                where: { id: activeTimeLog.id },
                data: { endTime, durationSeconds: duration }
            }),
            prisma.subTask.update({
                where: { id: subTaskId },
                data: {
                    totalSeconds: { increment: duration },
                    status: 'PENDING'
                }
            })
        ]);

        return res.json({
            success: true,
            durationSeconds: duration
        });

    } catch (error) {
        console.error('Stop sub-task error:', error);
        return res.status(500).json({ error: 'Failed to stop sub-task' });
    }
};

/**
 * Complete a sub-task (stop and mark as done)
 */
export const completeSubTask = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { subTaskId } = req.params;
        const { comment, attachments } = req.body;

        // Find sub-task
        const subTask = await prisma.subTask.findUnique({
            where: { id: subTaskId },
            include: { task: true }
        });

        if (!subTask) {
            return res.status(404).json({ error: 'Sub-task not found' });
        }

        // If there's an active time log, close it first
        const activeTimeLog = await prisma.subTaskTimeLog.findFirst({
            where: {
                subTaskId,
                userId: user.id,
                endTime: null
            }
        });

        let additionalDuration = 0;
        if (activeTimeLog) {
            const endTime = new Date();
            additionalDuration = Math.floor((endTime.getTime() - activeTimeLog.startTime.getTime()) / 1000);

            await prisma.subTaskTimeLog.update({
                where: { id: activeTimeLog.id },
                data: { endTime, durationSeconds: additionalDuration }
            });
        }

        // Mark sub-task as completed
        const updatedSubTask = await prisma.subTask.update({
            where: { id: subTaskId },
            data: {
                status: 'COMPLETED',
                totalSeconds: { increment: additionalDuration }
            }
        });

        // Emit socket event
        const io = (req.app as any).get('io');
        if (io && subTask.task?.companyId) {
            io.to(`company:${subTask.task.companyId}`).emit('subtask:completed', {
                subTaskId,
                taskId: subTask.taskId,
                userId: user.id,
                totalSeconds: updatedSubTask.totalSeconds
            });
        }

        return res.json({
            success: true,
            subTask: updatedSubTask
        });

    } catch (error) {
        console.error('Complete sub-task error:', error);
        return res.status(500).json({ error: 'Failed to complete sub-task' });
    }
};

/**
 * Get currently active sub-task for user
 */
export const getActiveSubTask = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const activeTimeLog = await prisma.subTaskTimeLog.findFirst({
            where: {
                userId: user.id,
                endTime: null
            },
            include: {
                subTask: {
                    include: {
                        task: {
                            select: { id: true, title: true, screenshotInterval: true }
                        }
                    }
                }
            },
            orderBy: { startTime: 'desc' }
        });

        if (!activeTimeLog) {
            return res.json({ success: true, activeSubTask: null });
        }

        // Calculate current elapsed time
        const elapsedSeconds = Math.floor((Date.now() - activeTimeLog.startTime.getTime()) / 1000);

        return res.json({
            success: true,
            activeSubTask: {
                ...activeTimeLog.subTask,
                currentSessionSeconds: elapsedSeconds,
                timeLogId: activeTimeLog.id,
                sessionStartTime: activeTimeLog.startTime
            }
        });

    } catch (error) {
        console.error('Get active sub-task error:', error);
        return res.status(500).json({ error: 'Failed to get active sub-task' });
    }
};

/**
 * Get all sub-tasks for a task with time info
 */
export const getSubTasksForTask = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { taskId } = req.params;

        // Get all sub-tasks for the task
        const subTasks = await prisma.subTask.findMany({
            where: { taskId },
            orderBy: { orderIndex: 'asc' },
            include: {
                timeLogs: {
                    where: { userId: user.id },
                    orderBy: { startTime: 'desc' },
                    take: 1
                }
            }
        });

        // Check for active time log
        const activeTimeLog = await prisma.subTaskTimeLog.findFirst({
            where: {
                userId: user.id,
                endTime: null,
                subTask: { taskId }
            }
        });

        // Add active state, current session, and schedule info to sub-tasks
        const enrichedSubTasks = subTasks.map(st => {
            const scheduleInfo = getScheduleDisplayStatus({
                startTime: st.startTime,
                endTime: st.endTime,
                scheduleDays: st.scheduleDays,
                billingType: st.billingType
            });

            const schedule = isWithinSchedule({
                startTime: st.startTime,
                endTime: st.endTime,
                scheduleDays: st.scheduleDays,
                billingType: st.billingType
            });

            return {
                ...st,
                isActive: activeTimeLog?.subTaskId === st.id,
                currentSessionSeconds: activeTimeLog?.subTaskId === st.id
                    ? Math.floor((Date.now() - activeTimeLog.startTime.getTime()) / 1000)
                    : 0,
                // Schedule info for UI
                scheduleStatus: scheduleInfo.status,
                scheduleLabel: scheduleInfo.label,
                scheduleCountdown: scheduleInfo.countdown,
                canStart: schedule.canStart,
                endsInSeconds: schedule.endsInSeconds,
                // Budget info
                budgetSeconds: st.estimatedHours ? Math.floor(st.estimatedHours * 3600) : null,
                remainingBudgetSeconds: st.estimatedHours
                    ? Math.max(0, Math.floor(st.estimatedHours * 3600) - st.totalSeconds)
                    : null
            };
        });

        return res.json({
            success: true,
            subTasks: enrichedSubTasks,
            activeSubTaskId: activeTimeLog?.subTaskId || null
        });

    } catch (error) {
        console.error('Get sub-tasks error:', error);
        return res.status(500).json({ error: 'Failed to get sub-tasks' });
    }
};

/**
 * Auto-stop sub-task when scheduled time ends (with optional proof of work)
 */
export const autoStopSubTask = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { subTaskId } = req.params;
        const { proofOfWork, attachments } = req.body;

        // Find sub-task
        const subTask = await prisma.subTask.findUnique({
            where: { id: subTaskId },
            include: { task: true }
        });

        if (!subTask) {
            return res.status(404).json({ error: 'Sub-task not found' });
        }

        // Find active time log for this sub-task and user
        const activeTimeLog = await prisma.subTaskTimeLog.findFirst({
            where: {
                subTaskId,
                userId: user.id,
                endTime: null
            }
        });

        if (!activeTimeLog) {
            return res.status(400).json({ error: 'No active tracking for this sub-task' });
        }

        const endTime = new Date();
        const duration = Math.floor((endTime.getTime() - activeTimeLog.startTime.getTime()) / 1000);

        // Close time log and update sub-task
        await prisma.$transaction([
            prisma.subTaskTimeLog.update({
                where: { id: activeTimeLog.id },
                data: {
                    endTime,
                    durationSeconds: duration
                }
            }),
            prisma.subTask.update({
                where: { id: subTaskId },
                data: {
                    totalSeconds: { increment: duration },
                    status: 'PENDING'
                }
            })
        ]);

        // Emit socket event for auto-stop
        const io = (req.app as any).get('io');
        if (io && subTask.task?.companyId) {
            io.to(`company:${subTask.task.companyId}`).emit('subtask:auto-stopped', {
                subTaskId,
                taskId: subTask.taskId,
                userId: user.id,
                reason: 'scheduled_end',
                durationSeconds: duration,
                proofOfWork: proofOfWork || null
            });
        }

        return res.json({
            success: true,
            durationSeconds: duration,
            message: 'Sub-task auto-stopped due to schedule end'
        });

    } catch (error) {
        console.error('Auto-stop sub-task error:', error);
        return res.status(500).json({ error: 'Failed to auto-stop sub-task' });
    }
};
