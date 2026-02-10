// ============================================================
// Attendance Controller
// Daily attendance generation, calendar view, and summary
// ============================================================

import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// ============================================================
// Generate daily attendance for a company
// Exported for use by cron service
// ============================================================
export async function generateDailyAttendance(companyId: string, date: Date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    // Get company settings
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { defaultExpectedHours: true },
    });
    const defaultExpectedHours = company?.defaultExpectedHours || 8.0;

    // Get all employees
    const employees = await prisma.user.findMany({
        where: {
            companyId,
            role: { in: ['EMPLOYEE', 'ADMIN'] },
            deletedAt: null,
        },
        select: {
            id: true,
            hourlyRate: true,
            currency: true,
            salaryType: true,
            monthlySalary: true,
            expectedHoursPerDay: true,
        },
    });

    const results = [];

    for (const emp of employees) {
        const expectedHours = emp.expectedHoursPerDay || defaultExpectedHours;
        const expectedSeconds = Math.round(expectedHours * 3600);

        // 1. Get time logs for the day
        const timeLogs = await prisma.timeLog.findMany({
            where: {
                userId: emp.id,
                startTime: { gte: dayStart, lte: dayEnd },
                durationSeconds: { not: null },
            },
            include: {
                task: { select: { id: true, title: true } },
            },
        });

        const totalWorkedSeconds = timeLogs.reduce((sum, tl) => sum + (tl.durationSeconds || 0), 0);

        // 2. Build tasks summary
        const taskMap: Record<string, { taskId: string; taskTitle: string; seconds: number }> = {};
        for (const tl of timeLogs) {
            const taskId = tl.taskId || 'unknown';
            if (!taskMap[taskId]) {
                taskMap[taskId] = {
                    taskId,
                    taskTitle: tl.task?.title || 'Unknown',
                    seconds: 0,
                };
            }
            taskMap[taskId].seconds += tl.durationSeconds || 0;
        }
        const tasksSummary = Object.values(taskMap);

        // 3. Check if on leave
        const leaveForDay = await prisma.leaveRequest.findFirst({
            where: {
                userId: emp.id,
                status: 'APPROVED',
                startDate: { lte: dayEnd },
                endDate: { gte: dayStart },
            },
        });

        // 4. Determine status
        let status: string;
        if (leaveForDay) {
            status = 'ON_LEAVE';
        } else if (totalWorkedSeconds >= expectedSeconds * 0.5) {
            status = 'PRESENT';
        } else if (totalWorkedSeconds > 0) {
            status = 'PARTIAL';
        } else {
            // Check if it's a weekend
            const dayOfWeek = dayStart.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                status = 'HOLIDAY';
            } else {
                status = 'ABSENT';
            }
        }

        // 5. Calculate overtime
        const overtimeSeconds = Math.max(0, totalWorkedSeconds - expectedSeconds);

        // 6. Calculate earnings for the day
        let earningsToday = 0;
        const hourlyRate = emp.hourlyRate || 0;

        if (emp.salaryType === 'MONTHLY' && emp.monthlySalary) {
            // For monthly: daily rate based on ~22 working days
            const dailyRate = emp.monthlySalary / 22;
            if (status === 'PRESENT' || status === 'PARTIAL') {
                earningsToday = dailyRate;
            } else if (status === 'ON_LEAVE' && leaveForDay?.type !== 'UNPAID') {
                earningsToday = dailyRate; // Paid leave
            }
        } else {
            // Hourly
            earningsToday = parseFloat(((totalWorkedSeconds / 3600) * hourlyRate).toFixed(2));
        }

        // 7. Upsert attendance record
        const record = await prisma.dailyAttendance.upsert({
            where: {
                userId_date: { userId: emp.id, date: dayStart },
            },
            update: {
                status: status as any,
                totalWorkedSeconds,
                expectedSeconds,
                overtimeSeconds,
                tasksSummary: tasksSummary as any,
                earningsToday,
            },
            create: {
                userId: emp.id,
                companyId,
                date: dayStart,
                status: status as any,
                totalWorkedSeconds,
                expectedSeconds,
                overtimeSeconds,
                tasksSummary: tasksSummary as any,
                earningsToday,
            },
        });

        results.push(record);
    }

    return results;
}

// ============================================================
// Admin: Get daily attendance for all employees
// GET /api/attendance/daily?date=2026-02-07
// ============================================================
export const getDailyAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.companyId || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const { date } = req.query;
        const targetDate = date ? new Date(date as string) : new Date();
        targetDate.setHours(0, 0, 0, 0);

        const records = await prisma.dailyAttendance.findMany({
            where: {
                companyId: user.companyId,
                date: targetDate,
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, profileImage: true, designation: true },
                },
            },
            orderBy: { user: { name: 'asc' } },
        });

        res.json({ success: true, date: targetDate, records });
    } catch (error: any) {
        console.error('Get Daily Attendance Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Employee: Get my attendance summary
// GET /api/attendance/my-summary?startDate=2026-02-01&endDate=2026-02-28
// ============================================================
export const getMyAttendanceSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.id) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        const { startDate, endDate } = req.query;
        const now = new Date();
        const start = startDate ? new Date(startDate as string) : new Date(now.getFullYear(), now.getMonth(), 1);
        const end = endDate ? new Date(endDate as string) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        const records = await prisma.dailyAttendance.findMany({
            where: {
                userId: user.id,
                date: { gte: start, lte: end },
            },
            orderBy: { date: 'asc' },
        });

        // Calculate summary
        const presentDays = records.filter(r => r.status === 'PRESENT').length;
        const partialDays = records.filter(r => r.status === 'PARTIAL').length;
        const absentDays = records.filter(r => r.status === 'ABSENT').length;
        const leaveDays = records.filter(r => r.status === 'ON_LEAVE').length;
        const totalWorkedHours = parseFloat(
            (records.reduce((sum, r) => sum + r.totalWorkedSeconds, 0) / 3600).toFixed(2)
        );
        const totalOvertimeHours = parseFloat(
            (records.reduce((sum, r) => sum + r.overtimeSeconds, 0) / 3600).toFixed(2)
        );
        const totalEarnings = parseFloat(
            records.reduce((sum, r) => sum + r.earningsToday, 0).toFixed(2)
        );

        res.json({
            success: true,
            summary: {
                presentDays,
                partialDays,
                absentDays,
                leaveDays,
                totalWorkedHours,
                totalOvertimeHours,
                totalEarnings,
            },
            records,
        });
    } catch (error: any) {
        console.error('Get My Attendance Summary Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Admin: Monthly attendance calendar
// GET /api/attendance/calendar?month=2026-02
// ============================================================
export const getAttendanceCalendar = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.companyId || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const { month } = req.query;
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

        // Get all employees
        const employees = await prisma.user.findMany({
            where: {
                companyId: user.companyId,
                role: { in: ['EMPLOYEE', 'ADMIN'] },
                deletedAt: null,
            },
            select: { id: true, name: true, email: true, profileImage: true },
            orderBy: { name: 'asc' },
        });

        // Get all attendance records for the month
        const records = await prisma.dailyAttendance.findMany({
            where: {
                companyId: user.companyId,
                date: { gte: startDate, lte: endDate },
            },
        });

        // Build calendar: { userId: { 'YYYY-MM-DD': { status, hours, earnings } } }
        const calendar: Record<string, Record<string, {
            status: string;
            workedHours: number;
            overtimeHours: number;
            earnings: number;
        }>> = {};

        for (const record of records) {
            const dateKey = record.date.toISOString().split('T')[0];
            if (!calendar[record.userId]) {
                calendar[record.userId] = {};
            }
            calendar[record.userId][dateKey] = {
                status: record.status,
                workedHours: parseFloat((record.totalWorkedSeconds / 3600).toFixed(2)),
                overtimeHours: parseFloat((record.overtimeSeconds / 3600).toFixed(2)),
                earnings: record.earningsToday,
            };
        }

        res.json({
            success: true,
            employees,
            calendar,
            period: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Get Attendance Calendar Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// Admin/Cron: Generate attendance for a date
// POST /api/attendance/generate?date=2026-02-07
// ============================================================
export const generateAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.companyId || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }

        const { date } = req.query;
        const targetDate = date ? new Date(date as string) : new Date();

        const records = await generateDailyAttendance(user.companyId, targetDate);

        res.json({
            success: true,
            message: `${records.length} attendance records generated`,
            count: records.length,
        });
    } catch (error: any) {
        console.error('Generate Attendance Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
