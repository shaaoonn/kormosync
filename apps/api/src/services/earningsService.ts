// ============================================================
// Earnings Calculation Service
// Shared by payrollController, dashboardController, and payrollCronService
// Supports both HOURLY and MONTHLY salary types
// ============================================================

import prisma from '../utils/prisma';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ============================================================
// Earnings Cache — prevents repeated 8+ DB queries per user
// Desktop Dashboard calls /api/payroll/current-earnings on every load
// Without cache: 10 DB queries per call → pool exhaustion
// With cache: 0 DB queries for 5 minutes → API stays alive
// ============================================================
const earningsCache = new Map<string, { data: EarningsBreakdown; expiresAt: number }>();
const EARNINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_EARNINGS_CACHE = 200;

function getCachedEarnings(userId: string, periodStartMs: number): EarningsBreakdown | null {
    const key = `${userId}:${periodStartMs}`;
    const entry = earningsCache.get(key);
    if (entry && Date.now() < entry.expiresAt) {
        return entry.data;
    }
    if (entry) earningsCache.delete(key);
    return null;
}

function setCachedEarnings(userId: string, periodStartMs: number, data: EarningsBreakdown, ttl?: number): void {
    const key = `${userId}:${periodStartMs}`;
    // Evict oldest if at capacity
    if (earningsCache.size >= MAX_EARNINGS_CACHE) {
        const firstKey = earningsCache.keys().next().value;
        if (firstKey) earningsCache.delete(firstKey);
    }
    earningsCache.set(key, { data, expiresAt: Date.now() + (ttl || EARNINGS_CACHE_TTL) });
}

/**
 * Invalidate earnings cache for a specific user or all users.
 * Call this when data changes that affects earnings (screenshot upload, task edit, etc.)
 */
export function invalidateEarningsCache(userId?: string): void {
    if (userId) {
        for (const key of earningsCache.keys()) {
            if (key.startsWith(userId + ':')) earningsCache.delete(key);
        }
    } else {
        earningsCache.clear();
    }
}

// Cleanup expired cache entries every 2 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of earningsCache.entries()) {
        if (now >= entry.expiresAt) earningsCache.delete(key);
    }
}, 2 * 60 * 1000);

export interface EarningsBreakdown {
    periodStart: Date;
    periodEnd: Date;

    // Work
    workedHours: number;
    workedAmount: number;

    // Leave
    paidLeaveDays: number;
    leaveHours: number;
    leavePay: number;

    // Overtime
    overtimeHours: number;
    overtimePay: number;
    overtimeRate: number;

    // Penalties
    penaltyHours: number;
    penaltyAmount: number;

    // Monthly salary (if applicable)
    salaryType: string;
    monthlySalary: number;
    workedDays: number;
    totalWorkingDays: number;
    expectedHoursPerDay: number;

    // Fixed Salary Duty Model — VirtualHourlyRate analysis
    virtualHourlyRate?: number;  // monthlySalary / (workingDays * expectedHoursPerDay) — for MONTHLY users
    marketValue?: number;        // What it would cost at task bundle rates
    actualCost?: number;         // What it actually costs at VirtualHourlyRate
    savings?: number;            // marketValue - actualCost (positive = company saves money)

    // Totals
    grossAmount: number;
    netAmount: number;
    currency: string;

    // Diagnostics — only present when earnings are zero, helps debug
    _debug?: {
        reason: string;
        hourlyRate: number;
        monthlySalary: number;
        salaryType: string;
        completedTimeLogCount: number;
        activeTimeLogCount: number;
    };
}

/**
 * Calculate business days (Mon-Fri) between two dates.
 */
function getBusinessDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(0, 0, 0, 0);

    while (current <= endDate) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) { // Not Sunday(0) or Saturday(6)
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

/**
 * Main earnings calculation function.
 * Works for both HOURLY and MONTHLY salary types.
 */
export async function calculateEarnings(
    userId: string,
    periodStart: Date,
    periodEnd: Date
): Promise<EarningsBreakdown> {
    // Guard: if period hasn't started yet, return zeroed earnings
    if (periodStart > periodEnd) {
        const zeroResult: EarningsBreakdown = {
            periodStart, periodEnd,
            workedHours: 0, workedAmount: 0,
            paidLeaveDays: 0, leaveHours: 0, leavePay: 0,
            overtimeHours: 0, overtimePay: 0, overtimeRate: 1.5,
            penaltyHours: 0, penaltyAmount: 0,
            salaryType: 'HOURLY', monthlySalary: 0,
            workedDays: 0, totalWorkingDays: 0, expectedHoursPerDay: 8,
            grossAmount: 0, netAmount: 0, currency: 'BDT',
        };
        return zeroResult;
    }

    // Check cache first — avoids 8+ DB queries if data is fresh
    const cached = getCachedEarnings(userId, periodStart.getTime());
    if (cached) return cached;

    // 1. Get user info
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            hourlyRate: true,
            currency: true,
            salaryType: true,
            monthlySalary: true,
            expectedHoursPerDay: true,
            companyId: true,
        },
    });

    if (!user) {
        throw new Error(`User ${userId} not found`);
    }

    // Get company overtime rate and settings
    let overtimeRate = 1.5;
    let company: { overtimeRate: number; defaultExpectedHours: number; workingDaysPerMonth: number | null } | null = null;
    if (user.companyId) {
        company = await prisma.company.findUnique({
            where: { id: user.companyId },
            select: { overtimeRate: true, defaultExpectedHours: true, workingDaysPerMonth: true },
        });
        if (company) {
            overtimeRate = company.overtimeRate;
        }
    }

    const hourlyRate = user.hourlyRate || 0;
    const expectedHoursPerDay = user.expectedHoursPerDay || 8.0;
    const expectedSecondsPerDay = expectedHoursPerDay * 3600;
    const salaryType = user.salaryType || 'HOURLY';
    const monthlySalary = user.monthlySalary || 0;
    const currency = user.currency || 'BDT';

    // 2. Calculate worked hours from TimeLogs
    // COMPLETED timelogs (have durationSeconds set when task was stopped)
    const completedTimeLogs = await prisma.timeLog.findMany({
        where: {
            userId,
            startTime: { gte: periodStart, lte: periodEnd },
            durationSeconds: { not: null },
        },
        take: 5000, // Safety limit — 1 month max ~3000 entries
    });

    // ACTIVE timelogs (currently running — task is being tracked right now)
    // durationSeconds is NULL because task hasn't been stopped yet
    const activeTimeLogs = await prisma.timeLog.findMany({
        where: {
            userId,
            startTime: { gte: periodStart, lte: periodEnd },
            durationSeconds: null,
            endTime: null, // Still running
        },
        take: 100,
    });

    // Calculate total: completed + dynamic active (elapsed time since start)
    const completedSeconds = completedTimeLogs.reduce((sum, tl) => sum + (tl.durationSeconds || 0), 0);
    const now = new Date();
    const activeRunningSeconds = activeTimeLogs.reduce((sum, tl) => {
        const elapsed = Math.floor((now.getTime() - tl.startTime.getTime()) / 1000);
        return sum + Math.max(0, elapsed);
    }, 0);
    const totalWorkedSeconds = completedSeconds + activeRunningSeconds;
    const workedHours = parseFloat((totalWorkedSeconds / 3600).toFixed(4));

    // 3. Calculate paid leave days in the period
    const approvedLeaves = await prisma.leaveRequest.findMany({
        where: {
            userId,
            status: 'APPROVED',
            type: { in: ['PAID', 'SICK', 'HALF_DAY'] }, // These count toward pay
            OR: [
                { startDate: { gte: periodStart, lte: periodEnd } },
                { endDate: { gte: periodStart, lte: periodEnd } },
                { startDate: { lte: periodStart }, endDate: { gte: periodEnd } },
            ],
        },
        take: 200, // Safety limit
    });

    let paidLeaveDays = 0;
    for (const leave of approvedLeaves) {
        // Calculate overlap with period
        const leaveStart = new Date(Math.max(leave.startDate.getTime(), periodStart.getTime()));
        const leaveEnd = new Date(Math.min(leave.endDate.getTime(), periodEnd.getTime()));
        const daysInPeriod = getBusinessDays(leaveStart, leaveEnd);

        if (leave.type === 'HALF_DAY') {
            paidLeaveDays += 0.5 * daysInPeriod;
        } else {
            paidLeaveDays += daysInPeriod;
        }
    }

    const leaveHours = parseFloat((paidLeaveDays * expectedHoursPerDay).toFixed(4));

    // 4. Calculate overtime from DailyAttendance
    const attendanceRecords = await prisma.dailyAttendance.findMany({
        where: {
            userId,
            date: { gte: periodStart, lte: periodEnd },
        },
        take: 400, // Safety limit — 1 month max ~31 entries
    });

    const totalOvertimeSeconds = attendanceRecords.reduce((sum, a) => sum + a.overtimeSeconds, 0);
    const overtimeHours = parseFloat((totalOvertimeSeconds / 3600).toFixed(4));

    // Count worked days
    const workedDays = attendanceRecords.filter(
        a => a.status === 'PRESENT' || a.status === 'PARTIAL'
    ).length;

    // 5. Calculate penalty deductions
    const penalties = await prisma.taskAuditLog.findMany({
        where: {
            userId,
            action: 'PENALTY_DEDUCT_TIME',
            createdAt: { gte: periodStart, lte: periodEnd },
        },
        take: 500, // Safety limit
    });

    const deductionMinutes = penalties.reduce((sum, p) => {
        const mins = parseFloat(p.newValue || '0');
        return sum + (isNaN(mins) ? 0 : mins);
    }, 0);
    const penaltyHours = parseFloat((deductionMinutes / 60).toFixed(4));

    // 6. Calculate amounts based on salary type
    const totalWorkingDays = getBusinessDays(periodStart, periodEnd);

    let workedAmount: number;
    let leavePay: number;
    let overtimePay: number;
    let penaltyAmount: number;
    let grossAmount: number;

    if (salaryType === 'MONTHLY' && monthlySalary > 0) {
        // Monthly salary: proportional to worked days
        const dailyRate = monthlySalary / (company?.workingDaysPerMonth || totalWorkingDays || 22);
        const effectiveWorkedDays = workedDays + paidLeaveDays;

        workedAmount = parseFloat((workedDays * dailyRate).toFixed(2));
        leavePay = parseFloat((paidLeaveDays * dailyRate).toFixed(2));

        // Overtime for monthly: derive hourly equivalent
        const hourlyEquivalent = totalWorkingDays > 0 && expectedHoursPerDay > 0
            ? monthlySalary / (totalWorkingDays * expectedHoursPerDay)
            : 0;
        overtimePay = parseFloat((overtimeHours * hourlyEquivalent * overtimeRate).toFixed(2));
        penaltyAmount = parseFloat((penaltyHours * hourlyEquivalent).toFixed(2));

        grossAmount = parseFloat((workedAmount + leavePay + overtimePay).toFixed(2));
    } else {
        // Hourly: straightforward
        workedAmount = parseFloat((workedHours * hourlyRate).toFixed(2));
        leavePay = parseFloat((leaveHours * hourlyRate).toFixed(2));
        overtimePay = parseFloat((overtimeHours * hourlyRate * overtimeRate).toFixed(2));
        penaltyAmount = parseFloat(((deductionMinutes / 60) * hourlyRate).toFixed(2));

        grossAmount = parseFloat((workedAmount + leavePay + overtimePay).toFixed(2));
    }

    const netAmount = parseFloat(Math.max(0, grossAmount - penaltyAmount).toFixed(2));

    // 7. Calculate VirtualHourlyRate & Market Value analysis for MONTHLY users
    let virtualHourlyRate: number | undefined;
    let marketValue: number | undefined;
    let actualCost: number | undefined;
    let savings: number | undefined;

    if (salaryType === 'MONTHLY' && monthlySalary > 0 && totalWorkingDays > 0 && expectedHoursPerDay > 0) {
        virtualHourlyRate = parseFloat((monthlySalary / (totalWorkingDays * expectedHoursPerDay)).toFixed(2));
        actualCost = parseFloat((workedHours * virtualHourlyRate).toFixed(2));

        // Calculate market value: what it would cost at task/subtask bundle rates
        // REUSE completedTimeLogs + activeTimeLogs from step 2
        // Group worked seconds by taskId
        const taskHoursMap = new Map<string, number>();
        for (const tl of completedTimeLogs) {
            if (tl.taskId) {
                const current = taskHoursMap.get(tl.taskId) || 0;
                taskHoursMap.set(tl.taskId, current + (tl.durationSeconds || 0));
            }
        }
        // Include active timelog elapsed time in market value too
        for (const tl of activeTimeLogs) {
            if (tl.taskId) {
                const elapsed = Math.floor((now.getTime() - tl.startTime.getTime()) / 1000);
                const current = taskHoursMap.get(tl.taskId) || 0;
                taskHoursMap.set(tl.taskId, current + Math.max(0, elapsed));
            }
        }

        let totalMarketValue = 0;
        if (taskHoursMap.size > 0) {
            const taskIds = Array.from(taskHoursMap.keys());
            // Get tasks with their subtasks to find bundle rates
            const tasksWithSubtasks = await prisma.task.findMany({
                where: { id: { in: taskIds } },
                select: {
                    id: true,
                    hourlyRate: true,
                    subTasks: {
                        select: { hourlyRate: true, billingType: true, fixedPrice: true }
                    }
                }
            });

            for (const task of tasksWithSubtasks) {
                const workedSecs = taskHoursMap.get(task.id) || 0;
                const workedHrs = workedSecs / 3600;

                // Use the highest hourly rate from subtasks, or task hourlyRate
                const subtaskMaxRate = task.subTasks.reduce((max, st) => {
                    if (st.billingType === 'HOURLY' && st.hourlyRate) {
                        return Math.max(max, st.hourlyRate);
                    }
                    return max;
                }, 0);

                const effectiveRate = subtaskMaxRate || task.hourlyRate || 0;
                totalMarketValue += workedHrs * effectiveRate;

                // Add fixed price subtasks as market value
                for (const st of task.subTasks) {
                    if (st.billingType === 'FIXED_PRICE' && st.fixedPrice) {
                        totalMarketValue += st.fixedPrice;
                    }
                }
            }
        }

        marketValue = parseFloat(totalMarketValue.toFixed(2));
        savings = parseFloat((marketValue - actualCost).toFixed(2));
    }

    const result: EarningsBreakdown = {
        periodStart,
        periodEnd,
        workedHours,
        workedAmount,
        paidLeaveDays,
        leaveHours,
        leavePay,
        overtimeHours,
        overtimePay,
        overtimeRate,
        penaltyHours,
        penaltyAmount,
        salaryType,
        monthlySalary,
        workedDays,
        totalWorkingDays,
        expectedHoursPerDay,
        virtualHourlyRate,
        marketValue,
        actualCost,
        savings,
        grossAmount,
        netAmount,
        currency,
        // Diagnostics for zero-earnings debugging
        _debug: grossAmount === 0 ? {
            reason: !hourlyRate && !monthlySalary ? 'NO_PAY_RATE' :
                    completedTimeLogs.length === 0 && activeTimeLogs.length === 0 ? 'NO_TIME_LOGS' : 'ZERO_HOURS',
            hourlyRate,
            monthlySalary,
            salaryType,
            completedTimeLogCount: completedTimeLogs.length,
            activeTimeLogCount: activeTimeLogs.length,
        } : undefined,
    };

    // Cache result — shorter TTL when actively tracking (earnings change in real-time)
    const cacheTTL = activeTimeLogs.length > 0 ? 30 * 1000 : EARNINGS_CACHE_TTL; // 30s if active, 5min if idle
    setCachedEarnings(userId, periodStart.getTime(), result, cacheTTL);

    return result;
}

/**
 * Get the current earnings period start (after last PAID pay period, or current month start).
 */
export async function getCurrentPeriodStart(userId: string): Promise<Date> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true },
    });

    if (user?.companyId) {
        // Find the last PAID pay period
        const lastPaidPeriod = await prisma.payPeriod.findFirst({
            where: {
                companyId: user.companyId,
                status: 'PAID',
            },
            orderBy: { endDate: 'desc' },
        });

        if (lastPaidPeriod) {
            // Start from the day after the last paid period ended
            const nextDay = new Date(lastPaidPeriod.endDate);
            nextDay.setDate(nextDay.getDate() + 1);
            nextDay.setHours(0, 0, 0, 0);
            return nextDay;
        }
    }

    // Default: start of current month
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}
