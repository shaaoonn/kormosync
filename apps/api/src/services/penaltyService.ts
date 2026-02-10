import prisma from '../utils/prisma';
import { Server } from 'socket.io';


/**
 * Penalty Types:
 * - DEDUCT_TIME: Mark low-activity intervals as idle (don't count towards paid time)
 * - NOTIFY_ADMIN: Send socket notification + create Notification record
 * - PAUSE_TIMER: Emit a pause event to the desktop app
 */

interface PenaltyCheckResult {
    triggered: boolean;
    penaltyType: string | null;
    consecutiveLowMins: number;
    threshold: number;
    taskId: string;
    userId: string;
}

/**
 * Check if a user has consecutive low-activity intervals on a task
 * and trigger the appropriate penalty action.
 *
 * Called after each activity log submission.
 */
export async function checkAndApplyPenalty(
    userId: string,
    taskId: string,
    io?: Server
): Promise<PenaltyCheckResult> {
    const result: PenaltyCheckResult = {
        triggered: false,
        penaltyType: null,
        consecutiveLowMins: 0,
        threshold: 0,
        taskId,
        userId,
    };

    try {
        // 1. Get task penalty config
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: {
                activityThreshold: true,
                penaltyEnabled: true,
                penaltyType: true,
                penaltyThresholdMins: true,
                companyId: true,
                title: true,
            },
        });

        if (!task || !task.penaltyEnabled || !task.penaltyType) {
            return result;
        }

        result.threshold = task.penaltyThresholdMins;

        // 2. Get recent activity logs for this user+task, ordered newest first
        const recentLogs = await prisma.activityLog.findMany({
            where: { userId, taskId },
            orderBy: { intervalStart: 'desc' },
            take: Math.ceil(task.penaltyThresholdMins / 5) + 1, // Need enough intervals
        });

        if (recentLogs.length === 0) return result;

        // 3. Count consecutive low-activity intervals (from most recent)
        let consecutiveLow = 0;
        for (const log of recentLogs) {
            // Calculate activity score for this interval (0-100)
            const activityPercent = Math.round((log.activeSeconds / 300) * 100);
            if (activityPercent < task.activityThreshold) {
                consecutiveLow++;
            } else {
                break; // Chain broken
            }
        }

        const consecutiveMinutes = consecutiveLow * 5; // Each interval = 5 minutes
        result.consecutiveLowMins = consecutiveMinutes;

        // 4. Check if threshold exceeded
        if (consecutiveMinutes < task.penaltyThresholdMins) {
            return result;
        }

        // Penalty triggered!
        result.triggered = true;
        result.penaltyType = task.penaltyType;

        // 5. Apply penalty action
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true },
        });

        switch (task.penaltyType) {
            case 'DEDUCT_TIME':
                // Mark the low-activity time as idle (won't count in payroll)
                // We do this by noting it — the payroll cron will check activity scores
                console.log(
                    `[PENALTY] DEDUCT_TIME: ${user?.name} had ${consecutiveMinutes}min low activity on "${task.title}"`
                );
                break;

            case 'NOTIFY_ADMIN':
                // Create notification for company admins
                if (task.companyId) {
                    const admins = await prisma.user.findMany({
                        where: {
                            companyId: task.companyId,
                            role: { in: ['OWNER', 'ADMIN'] },
                        },
                        select: { id: true },
                    });

                    // Create notifications in bulk
                    await prisma.notification.createMany({
                        data: admins.map((admin) => ({
                            userId: admin.id,
                            title: 'Low Activity Alert',
                            message: `${user?.name || 'Employee'} has had low activity for ${consecutiveMinutes} minutes on "${task.title}"`,
                            type: 'WARNING',
                        })),
                    });

                    // Socket emit
                    if (io) {
                        io.to(`company:${task.companyId}`).emit('penalty:triggered', {
                            type: 'NOTIFY_ADMIN',
                            userId,
                            userName: user?.name,
                            taskId,
                            taskTitle: task.title,
                            consecutiveMinutes,
                            threshold: task.activityThreshold,
                        });
                    }
                }
                break;

            case 'PAUSE_TIMER':
                // Emit event to desktop app to pause tracking
                if (io) {
                    io.to(`user:${userId}`).emit('penalty:pause-timer', {
                        taskId,
                        reason: `Activity below ${task.activityThreshold}% for ${consecutiveMinutes} minutes`,
                    });

                    // Also notify admins
                    if (task.companyId) {
                        io.to(`company:${task.companyId}`).emit('penalty:triggered', {
                            type: 'PAUSE_TIMER',
                            userId,
                            userName: user?.name,
                            taskId,
                            taskTitle: task.title,
                            consecutiveMinutes,
                        });
                    }
                }
                break;
        }

        console.log(
            `[PENALTY] ${task.penaltyType} triggered for user ${userId} on task ${taskId}: ${consecutiveMinutes}min >= ${task.penaltyThresholdMins}min threshold`
        );
    } catch (error) {
        console.error('[PENALTY] Error checking penalty:', error);
    }

    return result;
}
