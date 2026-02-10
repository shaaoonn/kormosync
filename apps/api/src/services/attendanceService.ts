import prisma from '../utils/prisma';

// ============================================================
// KormoSync — On-Demand Attendance Service
// Replaces the old cron-based attendance generation.
// Attendance is now based on minDailyHours per employee.
// ============================================================

/**
 * Generate/update daily attendance for a single user on a specific date.
 * Called on-demand (admin view, timelog creation, etc.)
 *
 * Logic:
 * - If user.minDailyHours === 0, attendance tracking is disabled → skip
 * - Sum all timelog durations for the date
 * - If totalWorkedSeconds >= minDailyHours * 3600 → PRESENT
 * - Else → ABSENT
 * - Overtime = max(0, totalWorkedSeconds - expectedHoursPerDay * 3600)
 */
export async function generateDailyAttendance(userId: string, date: Date): Promise<void> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                companyId: true,
                minDailyHours: true,
                expectedHoursPerDay: true,
            }
        });

        if (!user || !user.companyId) return;
        if (!user.minDailyHours || user.minDailyHours <= 0) return; // attendance disabled

        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        // Sum timelog durations for the day
        const timelogs = await prisma.timeLog.aggregate({
            where: {
                userId,
                startTime: { gte: dayStart, lt: dayEnd }
            },
            _sum: { durationSeconds: true }
        });

        const totalWorkedSeconds = timelogs._sum?.durationSeconds || 0;
        const minRequiredSeconds = user.minDailyHours * 3600;
        const expectedSeconds = user.expectedHoursPerDay * 3600;
        const overtimeSeconds = Math.max(0, totalWorkedSeconds - expectedSeconds);

        const status = totalWorkedSeconds >= minRequiredSeconds ? 'PRESENT' : 'ABSENT';

        await prisma.dailyAttendance.upsert({
            where: {
                userId_date: { userId, date: dayStart }
            },
            update: {
                totalWorkedSeconds,
                status,
                overtimeSeconds,
                expectedSeconds: Math.round(expectedSeconds),
            },
            create: {
                userId,
                companyId: user.companyId,
                date: dayStart,
                totalWorkedSeconds,
                status,
                expectedSeconds: Math.round(expectedSeconds),
                overtimeSeconds,
            }
        });

        console.log(`📋 Attendance updated: ${userId} on ${dayStart.toISOString().split('T')[0]} → ${status} (${Math.round(totalWorkedSeconds / 60)}min worked)`);
    } catch (error) {
        console.error('Failed to generate daily attendance:', error);
    }
}

/**
 * Generate attendance for ALL employees of a company for a specific date.
 * Useful for admin bulk refresh.
 */
export async function generateCompanyAttendance(companyId: string, date: Date): Promise<void> {
    const employees = await prisma.user.findMany({
        where: {
            companyId,
            minDailyHours: { gt: 0 },
            deletedAt: null,
        },
        select: { id: true }
    });

    for (const emp of employees) {
        await generateDailyAttendance(emp.id, date);
    }
}

/**
 * Get attendance summary for a user within a date range.
 */
export async function getAttendanceSummary(userId: string, startDate: Date, endDate: Date) {
    const records = await prisma.dailyAttendance.findMany({
        where: {
            userId,
            date: { gte: startDate, lte: endDate }
        },
        orderBy: { date: 'desc' }
    });

    const totalPresent = records.filter(r => r.status === 'PRESENT').length;
    const totalAbsent = records.filter(r => r.status === 'ABSENT').length;
    const totalWorkedSeconds = records.reduce((sum, r) => sum + r.totalWorkedSeconds, 0);
    const totalOvertimeSeconds = records.reduce((sum, r) => sum + r.overtimeSeconds, 0);

    return {
        records,
        summary: {
            totalDays: records.length,
            totalPresent,
            totalAbsent,
            totalWorkedSeconds,
            totalOvertimeSeconds,
        }
    };
}
