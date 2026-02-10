import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getSignedViewUrl } from '../utils/minioClient';


// Get Current User Profile
export const getProfile = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;

        if (!user?.uid) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const profile = await prisma.user.findUnique({
            where: { firebaseUid: user.uid },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                designation: true,
                profileImage: true,
                bio: true,
                dateOfBirth: true,
                address: true,
                city: true,
                country: true,
                skills: true,
                education: true,
                experience: true,
                references: true,
                linkedIn: true,
                portfolio: true,
                facebook: true,
                youtube: true,
                twitter: true,
                github: true,
                hourlyRate: true,
                currency: true,
                role: true,
                createdAt: true
            }
        });

        if (!profile) {
            res.status(404).json({ error: 'Profile not found' });
            return;
        }

        // Sign Profile Image
        if (profile.profileImage) {
            profile.profileImage = await getSignedViewUrl(profile.profileImage);
        }

        res.json({ success: true, profile });

    } catch (error) {
        console.error("Get Profile Error:", error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

// Get Employee Profile by ID (Admin only)
export const getEmployeeProfile = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;
        const { userId } = req.params;

        if (!user?.uid) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check if requester is admin
        const requester = await prisma.user.findUnique({ where: { firebaseUid: user.uid } });
        if (!requester || (requester.role !== 'OWNER' && requester.role !== 'ADMIN')) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }

        // Get employee profile
        const profile = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                designation: true,
                profileImage: true,
                bio: true,
                dateOfBirth: true,
                address: true,
                city: true,
                country: true,
                skills: true,
                education: true,
                experience: true,
                references: true,
                linkedIn: true,
                portfolio: true,
                facebook: true,
                youtube: true,
                twitter: true,
                github: true,
                hourlyRate: true,
                currency: true,
                role: true,
                companyId: true,
                createdAt: true
            }
        });

        if (!profile) {
            res.status(404).json({ error: 'Employee not found' });
            return;
        }

        // Fix 6B: Verify same company using profile.companyId
        if (requester.companyId !== profile.companyId) {
            res.status(403).json({ error: 'Employee not in your company' });
            return;
        }

        // Sign Profile Image
        if (profile.profileImage) {
            profile.profileImage = await getSignedViewUrl(profile.profileImage);
        }

        res.json({ success: true, profile });

    } catch (error) {
        console.error("Get Employee Profile Error:", error);
        res.status(500).json({ error: 'Failed to fetch employee profile' });
    }
};

// ============================================================
// Salary & Duty Configuration (Admin only)
// ============================================================

// GET /profile/employee/:userId/salary-config
export const getSalaryConfig = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;
        const { userId } = req.params;

        if (!user?.uid) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check admin access
        const requester = await prisma.user.findUnique({ where: { firebaseUid: user.uid } });
        if (!requester || (requester.role !== 'OWNER' && requester.role !== 'ADMIN')) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }

        // Verify same company
        const employee = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                companyId: true,
                salaryType: true,
                monthlySalary: true,
                hourlyRate: true,
                expectedHoursPerDay: true,
                minDailyHours: true,
                currency: true,
                // Per-employee overrides
                overrideWorkingDaysPerMonth: true,
                overrideOvertimeRate: true,
                overrideExpectedHours: true,
                // Work schedule
                workStartTime: true,
                workEndTime: true,
                breakStartTime: true,
                breakEndTime: true,
                weeklyOffDays: true,
            }
        });

        if (!employee) {
            res.status(404).json({ error: 'Employee not found' });
            return;
        }
        if (employee.companyId !== requester.companyId) {
            res.status(403).json({ error: 'Employee not in your company' });
            return;
        }

        // Fetch company defaults for display
        let companyWorkingDays = 22;
        let companyOvertimeRate = 1.5;
        let companyExpectedHours = 8.0;
        if (employee.companyId) {
            const company = await prisma.company.findUnique({
                where: { id: employee.companyId },
                select: { workingDaysPerMonth: true, overtimeRate: true, defaultExpectedHours: true }
            });
            if (company) {
                companyWorkingDays = company.workingDaysPerMonth;
                companyOvertimeRate = company.overtimeRate;
                companyExpectedHours = company.defaultExpectedHours;
            }
        }

        res.json({
            success: true,
            salaryConfig: employee,
            companyWorkingDays,
            companyOvertimeRate,
            companyExpectedHours,
        });
    } catch (error) {
        console.error("Get Salary Config Error:", error);
        res.status(500).json({ error: 'Failed to fetch salary config' });
    }
};

// PUT /profile/employee/:userId/salary-config
export const updateSalaryConfig = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;
        const { userId } = req.params;
        const {
            salaryType, monthlySalary, hourlyRate, expectedHoursPerDay, minDailyHours,
            overrideWorkingDaysPerMonth, overrideOvertimeRate, overrideExpectedHours,
            workStartTime, workEndTime, breakStartTime, breakEndTime, weeklyOffDays,
        } = req.body;

        if (!user?.uid) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check admin access
        const requester = await prisma.user.findUnique({ where: { firebaseUid: user.uid } });
        if (!requester || (requester.role !== 'OWNER' && requester.role !== 'ADMIN')) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }

        // Verify same company
        const employee = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
        if (!employee || employee.companyId !== requester.companyId) {
            res.status(403).json({ error: 'Employee not in your company' });
            return;
        }

        // Validation
        if (salaryType && !['HOURLY', 'MONTHLY'].includes(salaryType)) {
            res.status(400).json({ error: 'Invalid salaryType. Must be HOURLY or MONTHLY' });
            return;
        }
        if (minDailyHours !== undefined && (minDailyHours < 0 || minDailyHours > 24)) {
            res.status(400).json({ error: 'minDailyHours must be between 0 and 24' });
            return;
        }
        if (expectedHoursPerDay !== undefined && (expectedHoursPerDay < 0 || expectedHoursPerDay > 24)) {
            res.status(400).json({ error: 'expectedHoursPerDay must be between 0 and 24' });
            return;
        }
        // Override validations (null = use company default)
        if (overrideWorkingDaysPerMonth !== undefined && overrideWorkingDaysPerMonth !== null) {
            if (overrideWorkingDaysPerMonth < 1 || overrideWorkingDaysPerMonth > 31) {
                res.status(400).json({ error: 'overrideWorkingDaysPerMonth must be 1-31 or null' });
                return;
            }
        }
        if (overrideOvertimeRate !== undefined && overrideOvertimeRate !== null) {
            if (overrideOvertimeRate < 1.0) {
                res.status(400).json({ error: 'overrideOvertimeRate must be >= 1.0 or null' });
                return;
            }
        }
        if (overrideExpectedHours !== undefined && overrideExpectedHours !== null) {
            if (overrideExpectedHours < 1 || overrideExpectedHours > 24) {
                res.status(400).json({ error: 'overrideExpectedHours must be 1-24 or null' });
                return;
            }
        }
        // HH:mm format validation
        const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
        for (const [field, val] of Object.entries({ workStartTime, workEndTime, breakStartTime, breakEndTime })) {
            if (val !== undefined && val !== null && !timeRegex.test(val)) {
                res.status(400).json({ error: `${field} must be in HH:mm format or null` });
                return;
            }
        }
        if (weeklyOffDays !== undefined && Array.isArray(weeklyOffDays)) {
            if (!weeklyOffDays.every((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)) {
                res.status(400).json({ error: 'weeklyOffDays must be array of integers 0-6' });
                return;
            }
        }

        const updateData: any = {};
        if (salaryType !== undefined) updateData.salaryType = salaryType;
        if (monthlySalary !== undefined) updateData.monthlySalary = monthlySalary;
        if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate;
        if (expectedHoursPerDay !== undefined) updateData.expectedHoursPerDay = expectedHoursPerDay;
        if (minDailyHours !== undefined) updateData.minDailyHours = minDailyHours;
        // Override fields (explicitly allow null to clear)
        if (overrideWorkingDaysPerMonth !== undefined) updateData.overrideWorkingDaysPerMonth = overrideWorkingDaysPerMonth;
        if (overrideOvertimeRate !== undefined) updateData.overrideOvertimeRate = overrideOvertimeRate;
        if (overrideExpectedHours !== undefined) updateData.overrideExpectedHours = overrideExpectedHours;
        // Schedule fields
        if (workStartTime !== undefined) updateData.workStartTime = workStartTime;
        if (workEndTime !== undefined) updateData.workEndTime = workEndTime;
        if (breakStartTime !== undefined) updateData.breakStartTime = breakStartTime;
        if (breakEndTime !== undefined) updateData.breakEndTime = breakEndTime;
        if (weeklyOffDays !== undefined) updateData.weeklyOffDays = weeklyOffDays;

        const updated = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                name: true,
                salaryType: true,
                monthlySalary: true,
                hourlyRate: true,
                expectedHoursPerDay: true,
                minDailyHours: true,
                currency: true,
                overrideWorkingDaysPerMonth: true,
                overrideOvertimeRate: true,
                overrideExpectedHours: true,
                workStartTime: true,
                workEndTime: true,
                breakStartTime: true,
                breakEndTime: true,
                weeklyOffDays: true,
            }
        });

        res.json({ success: true, salaryConfig: updated });
    } catch (error) {
        console.error("Update Salary Config Error:", error);
        res.status(500).json({ error: 'Failed to update salary config' });
    }
};

// GET /profile/duty-progress (Self — for desktop app)
export const getDutyProgress = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;

        if (!user?.uid) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const dbUser = await prisma.user.findUnique({
            where: { firebaseUid: user.uid },
            select: {
                id: true,
                salaryType: true,
                monthlySalary: true,
                hourlyRate: true,
                expectedHoursPerDay: true,
                minDailyHours: true,
                currency: true,
            }
        });

        if (!dbUser) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Get today's total worked seconds from timelogs
        const now = new Date();
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const timelogs = await prisma.timeLog.aggregate({
            where: {
                userId: dbUser.id,
                startTime: { gte: dayStart, lt: dayEnd }
            },
            _sum: { durationSeconds: true }
        });

        const todayWorkedSeconds = timelogs._sum?.durationSeconds || 0;
        const minDailySeconds = (dbUser.minDailyHours || 0) * 3600;
        const expectedDailySeconds = dbUser.expectedHoursPerDay * 3600;

        // Calculate VirtualHourlyRate for MONTHLY users
        let virtualHourlyRate: number | undefined;
        if (dbUser.salaryType === 'MONTHLY' && dbUser.monthlySalary && dbUser.expectedHoursPerDay > 0) {
            // Approximate 22 working days per month
            const workingDaysPerMonth = 22;
            virtualHourlyRate = dbUser.monthlySalary / (workingDaysPerMonth * dbUser.expectedHoursPerDay);
        }

        const progressPercent = expectedDailySeconds > 0
            ? Math.min(100, Math.round((todayWorkedSeconds / expectedDailySeconds) * 100))
            : 0;

        res.json({
            success: true,
            dutyProgress: {
                todayWorkedSeconds,
                minDailySeconds,
                expectedDailySeconds,
                progressPercent,
                attendanceAchieved: todayWorkedSeconds >= minDailySeconds,
                salaryType: dbUser.salaryType,
                virtualHourlyRate,
                currency: dbUser.currency,
            }
        });
    } catch (error) {
        console.error("Get Duty Progress Error:", error);
        res.status(500).json({ error: 'Failed to fetch duty progress' });
    }
};

// Update Current User Profile
export const updateProfile = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;
        const {
            name,
            phoneNumber,
            designation,
            profileImage,
            bio,
            dateOfBirth,
            address,
            city,
            country,
            skills,
            education,
            experience,
            references,
            linkedIn,
            portfolio,
            facebook,
            youtube,
            twitter,
            github
        } = req.body;

        if (!user?.uid) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Helper to strip signed URL params and extraction key
        const extractKey = (url: string | undefined) => {
            if (!url) return undefined;
            // Only sanitize if it's a KormoSync MinIO URL
            if (url.includes('/kormosync/')) {
                let clean = url.split('?')[0];
                clean = clean.split('/kormosync/')[1];
                return decodeURIComponent(clean);
            }
            return url;
        };

        const cleanProfileImage = extractKey(profileImage);

        const updatedProfile = await prisma.user.update({
            where: { firebaseUid: user.uid },
            data: {
                name,
                phoneNumber,
                designation,
                profileImage: cleanProfileImage,
                bio,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                address,
                city,
                country,
                skills: skills || undefined,
                education: education || undefined,
                experience: experience || undefined,
                references: references || undefined,
                linkedIn,
                portfolio,
                facebook,
                youtube,
                twitter,
                github
            },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                designation: true,
                profileImage: true,
                bio: true,
                dateOfBirth: true,
                address: true,
                city: true,
                country: true,
                skills: true,
                education: true,
                experience: true,
                references: true,
                linkedIn: true,
                portfolio: true,
                facebook: true,
                youtube: true,
                twitter: true,
                github: true
            }
        });

        // Sign Profile Image
        if (updatedProfile.profileImage) {
            updatedProfile.profileImage = await getSignedViewUrl(updatedProfile.profileImage);
        }

        res.json({ success: true, profile: updatedProfile });

    } catch (error) {
        console.error("Update Profile Error:", error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

// ============================================================
// Days Off Calendar (Admin only)
// ============================================================

// GET /profile/employee/:userId/days-off?month=YYYY-MM
export const getDaysOff = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;
        const { userId } = req.params;
        const { month } = req.query; // "YYYY-MM"

        if (!user?.uid) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const requester = await prisma.user.findUnique({ where: { firebaseUid: user.uid } });
        if (!requester || (requester.role !== 'OWNER' && requester.role !== 'ADMIN')) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }

        const employee = await prisma.user.findUnique({
            where: { id: userId },
            select: { companyId: true, weeklyOffDays: true }
        });
        if (!employee || employee.companyId !== requester.companyId) {
            res.status(403).json({ error: 'Employee not in your company' });
            return;
        }

        // Parse month range
        const now = new Date();
        let year = now.getFullYear();
        let mon = now.getMonth(); // 0-indexed
        if (month && typeof month === 'string') {
            const parts = month.split('-');
            year = parseInt(parts[0]);
            mon = parseInt(parts[1]) - 1;
        }
        const startDate = new Date(year, mon, 1);
        const endDate = new Date(year, mon + 1, 0, 23, 59, 59); // Last day of month

        const holidays = await prisma.dailyAttendance.findMany({
            where: {
                userId,
                companyId: requester.companyId!,
                status: 'HOLIDAY',
                date: { gte: startDate, lte: endDate },
            },
            select: { date: true },
            orderBy: { date: 'asc' },
        });

        const holidayDates = holidays.map(h => {
            const d = new Date(h.date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        });

        res.json({
            success: true,
            holidays: holidayDates,
            weeklyOffDays: employee.weeklyOffDays,
        });
    } catch (error) {
        console.error("Get Days Off Error:", error);
        res.status(500).json({ error: 'Failed to fetch days off' });
    }
};

// POST /profile/employee/:userId/days-off
export const toggleDayOff = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;
        const { userId } = req.params;
        const { date, isOff } = req.body; // date: "YYYY-MM-DD", isOff: boolean

        if (!user?.uid) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!date) {
            res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
            return;
        }

        const requester = await prisma.user.findUnique({ where: { firebaseUid: user.uid } });
        if (!requester || (requester.role !== 'OWNER' && requester.role !== 'ADMIN')) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }

        const employee = await prisma.user.findUnique({
            where: { id: userId },
            select: { companyId: true }
        });
        if (!employee || employee.companyId !== requester.companyId) {
            res.status(403).json({ error: 'Employee not in your company' });
            return;
        }

        const dateObj = new Date(date + 'T00:00:00.000Z');

        if (isOff) {
            // Upsert as HOLIDAY
            await prisma.dailyAttendance.upsert({
                where: {
                    userId_date: { userId, date: dateObj }
                },
                create: {
                    userId,
                    companyId: requester.companyId!,
                    date: dateObj,
                    status: 'HOLIDAY',
                    totalWorkedSeconds: 0,
                    expectedSeconds: 0,
                },
                update: {
                    status: 'HOLIDAY',
                    totalWorkedSeconds: 0,
                    expectedSeconds: 0,
                },
            });
        } else {
            // Remove holiday — delete the record or set to ABSENT
            const existing = await prisma.dailyAttendance.findUnique({
                where: { userId_date: { userId, date: dateObj } }
            });
            if (existing && existing.status === 'HOLIDAY') {
                await prisma.dailyAttendance.delete({
                    where: { userId_date: { userId, date: dateObj } }
                });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Toggle Day Off Error:", error);
        res.status(500).json({ error: 'Failed to toggle day off' });
    }
};

// ============================================================
// Assigned Tasks (Admin view for employee)
// ============================================================

// GET /profile/employee/:userId/assigned-tasks
export const getAssignedTasks = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;
        const { userId } = req.params;

        if (!user?.uid) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const requester = await prisma.user.findUnique({ where: { firebaseUid: user.uid } });
        if (!requester || (requester.role !== 'OWNER' && requester.role !== 'ADMIN')) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }

        const employee = await prisma.user.findUnique({
            where: { id: userId },
            select: { companyId: true }
        });
        if (!employee || employee.companyId !== requester.companyId) {
            res.status(403).json({ error: 'Employee not in your company' });
            return;
        }

        const tasks = await prisma.task.findMany({
            where: {
                assignees: { some: { id: userId } },
                status: { not: 'DONE' },
            },
            select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                deadline: true,
                scheduleType: true,
                scheduleDays: true,
                startTime: true,
                endTime: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        res.json({ success: true, tasks });
    } catch (error) {
        console.error("Get Assigned Tasks Error:", error);
        res.status(500).json({ error: 'Failed to fetch assigned tasks' });
    }
};
