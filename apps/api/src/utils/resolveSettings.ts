import prisma from './prisma';

export interface ResolvedEmployeeSettings {
    workingDaysPerMonth: number;
    overtimeRate: number;
    expectedHoursPerDay: number;
    workStartTime: string;
    workEndTime: string;
    breakStartTime: string;
    breakEndTime: string;
    weeklyOffDays: number[];
}

/**
 * Resolves the effective settings for an employee.
 * Priority: per-employee override > company default > hardcoded fallback
 */
export async function resolveEmployeeSettings(userId: string): Promise<ResolvedEmployeeSettings> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            overrideWorkingDaysPerMonth: true,
            overrideOvertimeRate: true,
            overrideExpectedHours: true,
            expectedHoursPerDay: true,
            workStartTime: true,
            workEndTime: true,
            breakStartTime: true,
            breakEndTime: true,
            weeklyOffDays: true,
            companyId: true,
        }
    });

    if (!user) {
        return {
            workingDaysPerMonth: 22,
            overtimeRate: 1.5,
            expectedHoursPerDay: 8.0,
            workStartTime: '09:00',
            workEndTime: '18:00',
            breakStartTime: '13:00',
            breakEndTime: '14:00',
            weeklyOffDays: [5],
        };
    }

    const company = user.companyId
        ? await prisma.company.findUnique({
            where: { id: user.companyId },
            select: {
                workingDaysPerMonth: true,
                overtimeRate: true,
                defaultExpectedHours: true,
            }
        })
        : null;

    return {
        workingDaysPerMonth: user.overrideWorkingDaysPerMonth ?? company?.workingDaysPerMonth ?? 22,
        overtimeRate: user.overrideOvertimeRate ?? company?.overtimeRate ?? 1.5,
        expectedHoursPerDay: user.overrideExpectedHours ?? company?.defaultExpectedHours ?? 8.0,
        workStartTime: user.workStartTime ?? '09:00',
        workEndTime: user.workEndTime ?? '18:00',
        breakStartTime: user.breakStartTime ?? '13:00',
        breakEndTime: user.breakEndTime ?? '14:00',
        weeklyOffDays: user.weeklyOffDays.length > 0 ? user.weeklyOffDays : [5],
    };
}
