import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';


export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('Fetching Dashboard Stats...');

        // 1. Total Revenue (Sum of SUCCESS payments)
        const revenueAgg = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { status: PaymentStatus.SUCCESS }
        });
        const totalRevenue = revenueAgg._sum.amount || 0;

        // 2. Active Companies
        const activeCompanies = await prisma.company.count({
            where: { subscriptionStatus: SubscriptionStatus.ACTIVE }
        });

        // 3. Total Users
        const totalUsers = await prisma.user.count();

        res.json({
            totalRevenue,
            activeCompanies,
            totalUsers
        });

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};

export const getAllCompanies = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string || '';
        const skip = (page - 1) * limit;

        const where: any = { deletedAt: null };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { users: { some: { email: { contains: search, mode: 'insensitive' } } } }
            ];
        }

        const [companies, total] = await Promise.all([
            prisma.company.findMany({
                where,
                include: {
                    users: {
                        where: { role: 'OWNER' },
                        select: { email: true, name: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.company.count({ where })
        ]);

        const formattedCompanies = companies.map(company => ({
            id: company.id,
            name: company.name,
            plan: company.subscriptionStatus,
            status: company.subscriptionStatus,
            isStarred: company.isStarred,
            ownerEmail: company.users[0]?.email || 'N/A',
            ownerName: company.users[0]?.name || 'N/A',
            createdAt: company.createdAt
        }));

        res.json({
            companies: formattedCompanies,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
};

export const getCompanyDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const company = await prisma.company.findUnique({
            where: { id },
            include: {
                users: {
                    include: {
                        assignedTasks: {
                            select: { status: true }
                        }
                    }
                },
                _count: {
                    select: { tasks: true } // Total company tasks
                }
            }
        });

        if (!company) {
            res.status(404).json({ error: 'Company not found' });
            return;
        }

        // Process Users to get Task Stats
        const employees = company.users.map(user => {
            const totalTasks = user.assignedTasks.length;
            const completedTasks = user.assignedTasks.filter(t => t.status === 'DONE').length;
            const activeTasks = user.assignedTasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length;
            const pendingTasks = user.assignedTasks.filter(t => t.status === 'TODO').length;

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                profileImage: user.profileImage,
                stats: {
                    total: totalTasks,
                    completed: completedTasks,
                    active: activeTasks,
                    pending: pendingTasks
                }
            };
        });

        const response = {
            id: company.id,
            name: company.name,
            totalTasks: company._count.tasks,
            subscriptionStatus: company.subscriptionStatus,
            enabledFeatures: company.enabledFeatures,
            createdAt: company.createdAt,
            employees
        };

        res.json(response);

    } catch (error) {
        console.error('Error fetching company details:', error);
        res.status(500).json({ error: 'Failed to fetch company details' });
    }
};

// Toggle Star
export const toggleCompanyStar = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const company = await prisma.company.findUnique({ where: { id } });
        if (!company) {
            res.status(404).json({ error: 'Company not found' });
            return;
        }

        const updated = await prisma.company.update({
            where: { id },
            data: { isStarred: !company.isStarred }
        });

        res.json({ success: true, isStarred: updated.isStarred });
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle star' });
    }
};

// Update Status (Block/Freeze/Activate)
export const updateCompanyStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // Expect SubscriptionStatus enum value

        if (!status) {
            res.status(400).json({ error: 'Status is required' });
            return;
        }

        const updated = await prisma.company.update({
            where: { id },
            data: { subscriptionStatus: status }
        });

        res.json({ success: true, status: updated.subscriptionStatus });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update status' });
    }
};

// Get all payments (for financials page)
export const getPayments = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const status = req.query.status as string;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: {
                    company: { select: { id: true, name: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.payment.count({ where })
        ]);

        res.json({
            payments: payments.map(p => ({
                id: p.id,
                trxID: p.trxID,
                amount: p.amount,
                status: p.status,
                companyName: p.company.name,
                companyId: p.company.id,
                metadata: p.metadata,
                paymentDate: p.paymentExecuteTime || p.createdAt,
                createdAt: p.createdAt,
            })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
};

// Get revenue chart data
export const getRevenueChart = async (req: Request, res: Response): Promise<void> => {
    try {
        const year = parseInt(req.query.year as string) || new Date().getFullYear();

        const payments = await prisma.payment.findMany({
            where: {
                status: PaymentStatus.SUCCESS,
                createdAt: {
                    gte: new Date(year, 0, 1),
                    lte: new Date(year, 11, 31, 23, 59, 59)
                }
            },
            select: { amount: true, createdAt: true }
        });

        // Group by month
        const monthlyRevenue = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            label: new Date(year, i).toLocaleString('en', { month: 'short' }),
            revenue: 0,
            count: 0,
        }));

        for (const p of payments) {
            const month = p.createdAt.getMonth();
            monthlyRevenue[month].revenue += p.amount;
            monthlyRevenue[month].count++;
        }

        res.json({
            year,
            totalRevenue: payments.reduce((s, p) => s + p.amount, 0),
            totalTransactions: payments.length,
            monthly: monthlyRevenue,
        });
    } catch (error) {
        console.error('Error fetching revenue chart:', error);
        res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
};

// ============================================================
// Phase 5: Enhanced Super Admin Endpoints
// ============================================================

// Global Analytics - platform-wide metrics
export const getGlobalAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [
            totalCompanies,
            activeCompanies,
            inactiveCompanies,
            totalUsers,
            totalTasks,
            completedTasks,
            totalScreenshots,
            recentSignups,
            weeklyActiveUsers,
            totalRevenue,
            monthlyRevenue,
            totalHoursResult,
        ] = await Promise.all([
            prisma.company.count({ where: { deletedAt: null } }),
            prisma.company.count({ where: { subscriptionStatus: 'ACTIVE', deletedAt: null } }),
            prisma.company.count({ where: { subscriptionStatus: 'INACTIVE', deletedAt: null } }),
            prisma.user.count({ where: { deletedAt: null } }),
            prisma.task.count(),
            prisma.task.count({ where: { status: 'DONE' } }),
            prisma.screenshot.count(),
            prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
            prisma.activityLog.groupBy({
                by: ['userId'],
                where: { createdAt: { gte: sevenDaysAgo } },
            }),
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { status: 'SUCCESS' },
            }),
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: {
                    status: 'SUCCESS',
                    createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
                },
            }),
            prisma.timeLog.aggregate({
                _sum: { durationSeconds: true },
                where: { durationSeconds: { not: null } },
            }),
        ]);

        // Signups by day (last 30 days)
        const signupsByDay: Record<string, number> = {};
        const recentUsers = await prisma.user.findMany({
            where: { createdAt: { gte: thirtyDaysAgo } },
            select: { createdAt: true },
        });
        for (const u of recentUsers) {
            const key = u.createdAt.toISOString().split('T')[0];
            signupsByDay[key] = (signupsByDay[key] || 0) + 1;
        }

        // Top companies by employee count
        const topCompanies = await prisma.company.findMany({
            where: { deletedAt: null, subscriptionStatus: 'ACTIVE' },
            select: {
                id: true,
                name: true,
                _count: { select: { users: true, tasks: true } },
            },
            orderBy: { users: { _count: 'desc' } },
            take: 10,
        });

        const totalHoursTracked = parseFloat(
            ((totalHoursResult._sum.durationSeconds || 0) / 3600).toFixed(1)
        );

        res.json({
            success: true,
            overview: {
                totalCompanies,
                activeCompanies,
                inactiveCompanies,
                totalUsers,
                totalTasks,
                completedTasks,
                totalScreenshots,
                totalHoursTracked,
                recentSignups,
                weeklyActiveUsers: weeklyActiveUsers.length,
                totalRevenue: totalRevenue._sum.amount || 0,
                monthlyRevenue: monthlyRevenue._sum.amount || 0,
            },
            signupsByDay,
            topCompanies: topCompanies.map((c) => ({
                id: c.id,
                name: c.name,
                employeeCount: c._count.users,
                taskCount: c._count.tasks,
            })),
        });
    } catch (error) {
        console.error('Global Analytics Error:', error);
        res.status(500).json({ error: 'Failed to fetch global analytics' });
    }
};

// System Health - server stats, recent audit log
export const getSystemHealth = async (req: Request, res: Response): Promise<void> => {
    try {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const [
            recentActivityLogs,
            recentScreenshots,
            recentTimeLogs,
            dailyActivityLogs,
            dailyScreenshots,
            totalPayPeriods,
            openPayPeriods,
            pendingInvoices,
            recentAuditCount,
        ] = await Promise.all([
            prisma.activityLog.count({ where: { createdAt: { gte: oneHourAgo } } }),
            prisma.screenshot.count({ where: { recordedAt: { gte: oneHourAgo } } }),
            prisma.timeLog.count({ where: { startTime: { gte: oneHourAgo } } }),
            prisma.activityLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
            prisma.screenshot.count({ where: { recordedAt: { gte: oneDayAgo } } }),
            prisma.payPeriod.count(),
            prisma.payPeriod.count({ where: { status: 'OPEN' } }),
            prisma.invoice.count({ where: { status: 'DRAFT' } }),
            prisma.taskAuditLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
        ]);

        const latestAuditEntries = await prisma.taskAuditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 25,
            include: {
                user: { select: { name: true, email: true } },
                task: { select: { title: true } },
            },
        });

        res.json({
            success: true,
            health: {
                status: 'operational',
                serverTime: now.toISOString(),
                uptimeSeconds: Math.floor(process.uptime()),
                memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            },
            lastHour: {
                activityLogs: recentActivityLogs,
                screenshots: recentScreenshots,
                timeLogs: recentTimeLogs,
            },
            last24Hours: {
                activityLogs: dailyActivityLogs,
                screenshots: dailyScreenshots,
                auditLogs: recentAuditCount,
            },
            payroll: {
                totalPayPeriods,
                openPayPeriods,
                pendingInvoices,
            },
            recentAuditEntries: latestAuditEntries.map((entry) => ({
                id: entry.id,
                action: entry.action,
                field: entry.field,
                oldValue: entry.oldValue,
                newValue: entry.newValue,
                userName: entry.user?.name || 'Unknown',
                taskTitle: entry.task?.title || 'Deleted Task',
                createdAt: entry.createdAt,
            })),
        });
    } catch (error) {
        console.error('System Health Error:', error);
        res.status(500).json({ error: 'Failed to fetch system health' });
    }
};

// Enhanced Company Details with payroll & activity
export const getCompanyActivity = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const users = await prisma.user.findMany({
            where: { companyId: id },
            select: { id: true },
        });
        const userIds = users.map((u) => u.id);

        const [
            totalHoursResult,
            monthlyHoursResult,
            screenshotCount,
            activityAvg,
            payPeriods,
        ] = await Promise.all([
            prisma.timeLog.aggregate({
                _sum: { durationSeconds: true },
                where: { userId: { in: userIds }, durationSeconds: { not: null } },
            }),
            prisma.timeLog.aggregate({
                _sum: { durationSeconds: true },
                where: {
                    userId: { in: userIds },
                    durationSeconds: { not: null },
                    startTime: { gte: thirtyDaysAgo },
                },
            }),
            prisma.screenshot.count({ where: { userId: { in: userIds } } }),
            prisma.activityLog.aggregate({
                _avg: { activeSeconds: true },
                where: { userId: { in: userIds }, createdAt: { gte: thirtyDaysAgo } },
            }),
            prisma.payPeriod.findMany({
                where: { companyId: id },
                orderBy: { startDate: 'desc' },
                take: 6,
                include: {
                    invoices: { select: { netAmount: true, status: true } },
                },
            }),
        ]);

        res.json({
            success: true,
            activity: {
                totalHoursTracked: parseFloat(((totalHoursResult._sum.durationSeconds || 0) / 3600).toFixed(1)),
                monthlyHours: parseFloat(((monthlyHoursResult._sum.durationSeconds || 0) / 3600).toFixed(1)),
                totalScreenshots: screenshotCount,
                avgActivityScore: Math.round(((activityAvg._avg.activeSeconds || 0) / 300) * 100),
            },
            payPeriods: payPeriods.map((p) => ({
                id: p.id,
                startDate: p.startDate,
                endDate: p.endDate,
                status: p.status,
                totalAmount: p.totalAmount,
                invoiceCount: p.invoices.length,
                paidAmount: p.invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.netAmount, 0),
            })),
        });
    } catch (error) {
        console.error('Company Activity Error:', error);
        res.status(500).json({ error: 'Failed to fetch company activity' });
    }
};

// Update Company Feature Gates (Phase 5.2)
export const updateCompanyFeatures = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { enabledFeatures } = req.body;

        if (!Array.isArray(enabledFeatures)) {
            res.status(400).json({ error: 'enabledFeatures must be an array of strings' });
            return;
        }

        const validFeatures = ['tasks', 'screenshots', 'activity', 'payroll', 'reports', 'integrations'];
        const filtered = enabledFeatures.filter((f: string) => validFeatures.includes(f));

        const updated = await prisma.company.update({
            where: { id },
            data: { enabledFeatures: filtered },
            select: { enabledFeatures: true },
        });

        res.json({ success: true, enabledFeatures: updated.enabledFeatures });
    } catch (error) {
        console.error('Update Features Error:', error);
        res.status(500).json({ error: 'Failed to update features' });
    }
};

// Soft Delete Company
export const deleteCompany = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // Soft delete usually implies setting deletedAt.
        // Current schema has `deletedAt` in Company model properly.
        await prisma.company.update({
            where: { id },
            data: { deletedAt: new Date(), subscriptionStatus: 'INACTIVE' } // Also deactivate
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete company' });
    }
};
