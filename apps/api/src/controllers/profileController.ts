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
                createdAt: true
            }
        });

        if (!profile) {
            res.status(404).json({ error: 'Employee not found' });
            return;
        }

        // Verify same company
        if (requester.companyId !== profile.id) {
            // Allow if employee belongs to same company (need to check via separate query)
            const employee = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
            if (employee?.companyId !== requester.companyId) {
                res.status(403).json({ error: 'Employee not in your company' });
                return;
            }
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

        res.json({ success: true, salaryConfig: employee });
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
        const { salaryType, monthlySalary, hourlyRate, expectedHoursPerDay, minDailyHours } = req.body;

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

        const updateData: any = {};
        if (salaryType !== undefined) updateData.salaryType = salaryType;
        if (monthlySalary !== undefined) updateData.monthlySalary = monthlySalary;
        if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate;
        if (expectedHoursPerDay !== undefined) updateData.expectedHoursPerDay = expectedHoursPerDay;
        if (minDailyHours !== undefined) updateData.minDailyHours = minDailyHours;

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
