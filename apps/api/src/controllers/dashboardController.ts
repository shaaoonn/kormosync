import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { calculateEarnings, getCurrentPeriodStart } from '../services/earningsService';


// Get Employee-specific stats
export const getEmployeeStats = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        const userId = user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'User not found' });
        }

        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

        // Pending tasks
        const pendingTasks = await prisma.task.count({
            where: {
                assignees: { some: { id: userId } },
                status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] }
            }
        });

        // This month's hours
        const monthLogs = await prisma.timeLog.findMany({
            where: {
                userId,
                startTime: { gte: startOfMonth, lte: endOfMonth },
                durationSeconds: { not: null }
            }
        });
        const monthSeconds = monthLogs.reduce((sum, tl) => sum + (tl.durationSeconds || 0), 0);
        const hoursThisMonth = parseFloat((monthSeconds / 3600).toFixed(2));

        // Earnings
        const userInfo = await prisma.user.findUnique({
            where: { id: userId },
            select: { hourlyRate: true, currency: true }
        });
        const hourlyRate = userInfo?.hourlyRate || 0;
        const earningsThisMonth = parseFloat((hoursThisMonth * hourlyRate).toFixed(2));

        // Get "since last pay" earnings using earningsService
        let currentEarnings = null;
        try {
            const periodStart = await getCurrentPeriodStart(userId!);
            currentEarnings = await calculateEarnings(userId!, periodStart, new Date());
        } catch (e) {
            // earningsService may fail if user has no company, that's ok
        }

        // Get leave balance
        const year = today.getFullYear();
        const leaveBalance = await prisma.leaveBalance.findUnique({
            where: { userId_year: { userId: userId!, year } },
        });

        // Get pending leave requests count
        const pendingLeaves = await prisma.leaveRequest.count({
            where: { userId: userId!, status: 'PENDING' },
        });

        return res.json({
            success: true,
            stats: {
                pendingTasks,
                hoursThisMonth,
                earningsThisMonth,
                currency: userInfo?.currency || 'BDT',
                currentEarnings: currentEarnings ? {
                    netAmount: currentEarnings.netAmount,
                    workedHours: currentEarnings.workedHours,
                    paidLeaveDays: currentEarnings.paidLeaveDays,
                    leaveHours: currentEarnings.leaveHours,
                    leavePay: currentEarnings.leavePay,
                    overtimeHours: currentEarnings.overtimeHours,
                    overtimePay: currentEarnings.overtimePay,
                    grossAmount: currentEarnings.grossAmount,
                    penaltyAmount: currentEarnings.penaltyAmount,
                    salaryType: currentEarnings.salaryType,
                    currency: currentEarnings.currency,
                } : null,
                leaveBalance: leaveBalance ? {
                    paidRemaining: leaveBalance.paidLeave - leaveBalance.paidUsed,
                    sickRemaining: leaveBalance.sickLeave - leaveBalance.sickUsed,
                    paidLeave: leaveBalance.paidLeave,
                    sickLeave: leaveBalance.sickLeave,
                    paidUsed: leaveBalance.paidUsed,
                    sickUsed: leaveBalance.sickUsed,
                } : null,
                pendingLeaves,
            }
        });
    } catch (error) {
        console.error('Get Employee Stats Error:', error);
        return res.status(500).json({ error: 'Failed to fetch employee stats' });
    }
};

// Phase 9D: Badge counts for sidebar
export const getBadgeCounts = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user?.companyId) {
            return res.json({ pendingLeaves: 0, pendingAssignments: 0 });
        }

        const isAdmin = user.role === 'OWNER' || user.role === 'ADMIN';

        if (isAdmin) {
            const [pendingLeaves, pendingAssignments] = await Promise.all([
                prisma.leaveRequest.count({
                    where: { user: { companyId: user.companyId }, status: 'PENDING' }
                }),
                prisma.taskAssignment.count({
                    where: { task: { companyId: user.companyId }, status: 'PENDING' }
                }),
            ]);
            return res.json({ pendingLeaves, pendingAssignments });
        } else {
            const [activeTasks, pendingAssignments] = await Promise.all([
                prisma.task.count({
                    where: { assignees: { some: { id: user.id } }, status: 'IN_PROGRESS' }
                }),
                prisma.taskAssignment.count({
                    where: { userId: user.id!, status: 'PENDING' }
                }),
            ]);
            return res.json({ activeTasks, pendingAssignments });
        }
    } catch (error) {
        console.error('Get Badge Counts Error:', error);
        return res.status(500).json({ error: 'Failed to fetch badge counts' });
    }
};

// Get Dashboard Stats (Real-time data)
export const getStats = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;

        if (!user?.companyId) {
            // Freelancer stats (no company)
            const userId = user?.id;
            const tasks = await prisma.task.findMany({
                where: { creatorId: userId },
            });

            return res.json({
                totalTasks: tasks.length,
                activeTasks: tasks.filter(t => t.status === 'IN_PROGRESS').length,
                completedTasks: tasks.filter(t => t.status === 'DONE').length,
                pendingTasks: tasks.filter(t => t.status === 'TODO' || t.status === 'REVIEW').length,
                totalEmployees: 0,
                maxEmployees: 0,
                storageUsed: 0,
                storageLimit: 0,
                recentTasks: tasks.slice(0, 5).map(t => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    priority: t.priority,
                    createdAt: t.createdAt,
                })),
            });
        }

        // Company stats — use aggregate queries instead of loading all users + tasks
        const companyId = user.companyId;

        // Parallel queries — much faster than include: { users: true, tasks: true }
        const [company, taskCounts, employeeCount, recentTasks] = await Promise.all([
            prisma.company.findUnique({
                where: { id: companyId },
                select: {
                    maxEmployees: true,
                    storageUsed: true,
                    storageLimit: true,
                    subscriptionStatus: true,
                    subscriptionEndDate: true,
                },
            }),
            prisma.task.groupBy({
                by: ['status'],
                where: { companyId },
                _count: true,
            }),
            prisma.user.count({
                where: { companyId, role: { not: 'OWNER' } },
            }),
            prisma.task.findMany({
                where: { companyId },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, title: true, status: true, priority: true, createdAt: true },
            }),
        ]);

        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // Build count map from groupBy result
        const countMap: Record<string, number> = {};
        for (const tc of taskCounts) {
            countMap[tc.status] = tc._count;
        }
        const totalTasks = Object.values(countMap).reduce((a, b) => a + b, 0);

        const stats = {
            totalTasks,
            activeTasks: countMap['IN_PROGRESS'] || 0,
            completedTasks: countMap['DONE'] || 0,
            pendingTasks: (countMap['TODO'] || 0) + (countMap['REVIEW'] || 0),
            totalEmployees: employeeCount,
            maxEmployees: company.maxEmployees,
            storageUsed: company.storageUsed,
            storageLimit: company.storageLimit,
            subscriptionStatus: company.subscriptionStatus,
            subscriptionEndDate: company.subscriptionEndDate,
            recentTasks,
        };

        return res.json(stats);
    } catch (error) {
        console.error('Get Dashboard Stats Error:', error);
        return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};

// Phase 9D: Badge counts for sidebar
export const getBadgeCounts = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user?.companyId) {
            return res.json({ pendingLeaves: 0, pendingAssignments: 0 });
        }

        const isAdmin = user.role === 'OWNER' || user.role === 'ADMIN';

        if (isAdmin) {
            const [pendingLeaves, pendingAssignments] = await Promise.all([
                prisma.leaveRequest.count({
                    where: { user: { companyId: user.companyId }, status: 'PENDING' }
                }),
                prisma.taskAssignment.count({
                    where: { task: { companyId: user.companyId }, status: 'PENDING' }
                }),
            ]);
            return res.json({ pendingLeaves, pendingAssignments });
        } else {
            const [activeTasks, pendingAssignments] = await Promise.all([
                prisma.task.count({
                    where: { assignees: { some: { id: user.id } }, status: 'IN_PROGRESS' }
                }),
                prisma.taskAssignment.count({
                    where: { userId: user.id!, status: 'PENDING' }
                }),
            ]);
            return res.json({ activeTasks, pendingAssignments });
        }
    } catch (error) {
        console.error('Get Badge Counts Error:', error);
        return res.status(500).json({ error: 'Failed to fetch badge counts' });
    }
};
