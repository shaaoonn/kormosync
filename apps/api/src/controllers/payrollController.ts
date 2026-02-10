import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { calculateEarnings, getCurrentPeriodStart } from '../services/earningsService';


// Get payroll summary for a company (monthly)
export const getPayrollSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;

        if (!user?.companyId) {
            res.status(400).json({ error: 'No company associated' });
            return;
        }

        if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
            res.status(403).json({ error: 'Only admins can view payroll' });
            return;
        }

        const { month } = req.query; // Format: "2026-02"
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (month && typeof month === 'string') {
            const [year, mon] = month.split('-').map(Number);
            startDate = new Date(year, mon - 1, 1);
            endDate = new Date(year, mon, 0, 23, 59, 59);
        } else {
            // Default: current month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }

        // Get all employees in company
        const employees = await prisma.user.findMany({
            where: {
                companyId: user.companyId,
                role: { in: ['EMPLOYEE', 'ADMIN'] }
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                hourlyRate: true,
                currency: true,
                profileImage: true,
            }
        });

        // Get time logs for each employee in this period
        const employeeSummaries = await Promise.all(
            employees.map(async (emp) => {
                const timeLogs = await prisma.timeLog.findMany({
                    where: {
                        userId: emp.id,
                        startTime: { gte: startDate, lte: endDate },
                        durationSeconds: { not: null }
                    }
                });

                const totalSeconds = timeLogs.reduce((sum, tl) => sum + (tl.durationSeconds || 0), 0);
                const totalHours = parseFloat((totalSeconds / 3600).toFixed(2));
                const hourlyRate = emp.hourlyRate || 0;
                const grossPay = parseFloat((totalHours * hourlyRate).toFixed(2));

                // Get average activity score for the period
                const activityLogs = await prisma.activityLog.findMany({
                    where: {
                        userId: emp.id,
                        intervalStart: { gte: startDate, lte: endDate }
                    },
                    select: { activeSeconds: true }
                });

                const avgActivity = activityLogs.length > 0
                    ? Math.round(activityLogs.reduce((sum, a) => sum + (a.activeSeconds / 300) * 100, 0) / activityLogs.length)
                    : 0;

                return {
                    userId: emp.id,
                    name: emp.name || 'Unknown',
                    email: emp.email,
                    role: emp.role,
                    profileImage: emp.profileImage,
                    hourlyRate,
                    currency: emp.currency,
                    totalHours,
                    totalSeconds,
                    grossPay,
                    avgActivity,
                    logCount: timeLogs.length,
                };
            })
        );

        const totalGrossPay = employeeSummaries.reduce((sum, e) => sum + e.grossPay, 0);
        const totalHoursAll = employeeSummaries.reduce((sum, e) => sum + e.totalHours, 0);

        res.json({
            success: true,
            period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                label: month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
            },
            summary: {
                totalEmployees: employeeSummaries.length,
                totalHours: parseFloat(totalHoursAll.toFixed(2)),
                totalGrossPay: parseFloat(totalGrossPay.toFixed(2)),
            },
            employees: employeeSummaries,
        });
    } catch (error) {
        console.error('Get Payroll Summary Error:', error);
        res.status(500).json({ error: 'Failed to fetch payroll summary' });
    }
};

// Get individual employee payroll details
export const getEmployeePayroll = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        const { userId } = req.params;
        const { month } = req.query;

        // Employees can only see their own payroll
        if (user?.role === 'EMPLOYEE' && user?.id !== userId) {
            res.status(403).json({ error: 'You can only view your own payroll' });
            return;
        }

        // Admin/Owner need to be in same company
        if (user?.role === 'OWNER' || user?.role === 'ADMIN') {
            const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
            if (targetUser?.companyId !== user.companyId) {
                res.status(403).json({ error: 'User not in your company' });
                return;
            }
        }

        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (month && typeof month === 'string') {
            const [year, mon] = month.split('-').map(Number);
            startDate = new Date(year, mon - 1, 1);
            endDate = new Date(year, mon, 0, 23, 59, 59);
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }

        const employee = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                hourlyRate: true,
                currency: true,
            }
        });

        if (!employee) {
            res.status(404).json({ error: 'Employee not found' });
            return;
        }

        // Get daily time logs
        const timeLogs = await prisma.timeLog.findMany({
            where: {
                userId,
                startTime: { gte: startDate, lte: endDate },
            },
            include: {
                task: { select: { id: true, title: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        // Group by date
        const dailyBreakdown: Record<string, { totalSeconds: number; tasks: Set<string>; logs: number }> = {};

        for (const log of timeLogs) {
            const dateKey = log.startTime.toISOString().split('T')[0];
            if (!dailyBreakdown[dateKey]) {
                dailyBreakdown[dateKey] = { totalSeconds: 0, tasks: new Set(), logs: 0 };
            }
            dailyBreakdown[dateKey].totalSeconds += log.durationSeconds || 0;
            if (log.task) dailyBreakdown[dateKey].tasks.add(log.task.title);
            dailyBreakdown[dateKey].logs++;
        }

        const hourlyRate = employee.hourlyRate || 0;

        const dailyData = Object.entries(dailyBreakdown).map(([date, data]) => ({
            date,
            totalHours: parseFloat((data.totalSeconds / 3600).toFixed(2)),
            grossPay: parseFloat(((data.totalSeconds / 3600) * hourlyRate).toFixed(2)),
            taskCount: data.tasks.size,
            tasks: Array.from(data.tasks),
            logCount: data.logs,
        }));

        const totalSeconds = timeLogs.reduce((sum, tl) => sum + (tl.durationSeconds || 0), 0);
        const totalHours = parseFloat((totalSeconds / 3600).toFixed(2));

        res.json({
            success: true,
            employee: {
                id: employee.id,
                name: employee.name,
                email: employee.email,
                hourlyRate,
                currency: employee.currency,
            },
            period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
            summary: {
                totalHours,
                grossPay: parseFloat((totalHours * hourlyRate).toFixed(2)),
                workingDays: dailyData.length,
            },
            dailyBreakdown: dailyData,
        });
    } catch (error) {
        console.error('Get Employee Payroll Error:', error);
        res.status(500).json({ error: 'Failed to fetch employee payroll' });
    }
};

// ============================================================
// Current Earnings — "শেষ বেতনের পর থেকে এ পর্যন্ত"
// ============================================================

// GET /api/payroll/current-earnings — Employee's own current earnings
export const getCurrentEarnings = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.id) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const periodStart = await getCurrentPeriodStart(user.id);
        const periodEnd = new Date();

        const earnings = await calculateEarnings(user.id, periodStart, periodEnd);

        res.json({ success: true, earnings });
    } catch (error: any) {
        console.error('Get Current Earnings Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/payroll/current-earnings/:userId — Admin view of specific employee
export const getUserCurrentEarnings = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.companyId || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const { userId } = req.params;

        // Verify user is in same company
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { companyId: true },
        });
        if (targetUser?.companyId !== user.companyId) {
            res.status(403).json({ success: false, error: 'User not in your company' });
            return;
        }

        const periodStart = await getCurrentPeriodStart(userId);
        const periodEnd = new Date();

        const earnings = await calculateEarnings(userId, periodStart, periodEnd);

        res.json({ success: true, earnings });
    } catch (error: any) {
        console.error('Get User Current Earnings Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/payroll/company-earnings — Admin: all employees' current period earnings
export const getCompanyEarnings = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.companyId || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const employees = await prisma.user.findMany({
            where: {
                companyId: user.companyId,
                role: { in: ['EMPLOYEE', 'ADMIN'] },
                deletedAt: null,
            },
            select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
                hourlyRate: true,
                currency: true,
                salaryType: true,
                monthlySalary: true,
            },
        });

        const now = new Date();
        // Process employees in batches of 3 to prevent DB pool exhaustion
        // (was: Promise.all(employees.map(...)) = N×10 concurrent DB queries!)
        const earningsList: any[] = [];
        for (let i = 0; i < employees.length; i += 3) {
            const batch = employees.slice(i, i + 3);
            const batchResults = await Promise.all(
                batch.map(async (emp) => {
                    try {
                        const periodStart = await getCurrentPeriodStart(emp.id);
                        const earnings = await calculateEarnings(emp.id, periodStart, now);
                        return {
                            userId: emp.id,
                            name: emp.name || 'Unknown',
                            email: emp.email,
                            profileImage: emp.profileImage,
                            ...earnings,
                        };
                    } catch (e) {
                        return {
                            userId: emp.id,
                            name: emp.name || 'Unknown',
                            email: emp.email,
                            profileImage: emp.profileImage,
                            netAmount: 0,
                            workedHours: 0,
                            currency: emp.currency || 'BDT',
                        };
                    }
                })
            );
            earningsList.push(...batchResults);
        }

        res.json({ success: true, employees: earningsList });
    } catch (error: any) {
        console.error('Get Company Earnings Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
