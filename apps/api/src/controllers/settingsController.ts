import { Request, Response } from 'express';
import prisma from '../utils/prisma';


// Get company settings
export const getCompanySettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;

        if (!user?.companyId) {
            res.status(400).json({ error: 'No company associated with this user' });
            return;
        }

        // Only OWNER and ADMIN can view company settings
        if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
            res.status(403).json({ error: 'Only admins can access company settings' });
            return;
        }

        const company = await prisma.company.findUnique({
            where: { id: user.companyId },
            select: {
                id: true,
                name: true,
                companySize: true,
                subscriptionStatus: true,
                maxEmployees: true,
                storageUsed: true,
                storageLimit: true,
                subscriptionEndDate: true,
                aiCredits: true,
                hasClaimedTrial: true,
                trialEmployeeEndDate: true,
                enabledFeatures: true,
                workingDaysPerMonth: true,
                overtimeRate: true,
                defaultExpectedHours: true,
                createdAt: true,
                _count: {
                    select: { users: true, tasks: true }
                }
            }
        });

        if (!company) {
            res.status(404).json({ error: 'Company not found' });
            return;
        }

        res.json({ success: true, company });
    } catch (error) {
        console.error('Get Company Settings Error:', error);
        res.status(500).json({ error: 'Failed to fetch company settings' });
    }
};

// Update company settings
export const updateCompanySettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;

        if (!user?.companyId) {
            res.status(400).json({ error: 'No company associated with this user' });
            return;
        }

        // Only OWNER can update company settings
        if (user.role !== 'OWNER') {
            res.status(403).json({ error: 'Only the owner can update company settings' });
            return;
        }

        const { name, companySize } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (companySize !== undefined) updateData.companySize = companySize;

        const company = await prisma.company.update({
            where: { id: user.companyId },
            data: updateData,
            select: {
                id: true,
                name: true,
                companySize: true,
                subscriptionStatus: true,
                maxEmployees: true,
                storageUsed: true,
                storageLimit: true,
            }
        });

        res.json({ success: true, company });
    } catch (error) {
        console.error('Update Company Settings Error:', error);
        res.status(500).json({ error: 'Failed to update company settings' });
    }
};

// Get payroll settings
export const getPayrollSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;

        if (!user?.companyId) {
            res.status(400).json({ error: 'No company associated with this user' });
            return;
        }

        const company = await prisma.company.findUnique({
            where: { id: user.companyId },
            select: {
                id: true,
                workingDaysPerMonth: true,
                overtimeRate: true,
                defaultExpectedHours: true,
            }
        });

        if (!company) {
            res.status(404).json({ error: 'Company not found' });
            return;
        }

        res.json({ success: true, payrollSettings: company });
    } catch (error) {
        console.error('Get Payroll Settings Error:', error);
        res.status(500).json({ error: 'Failed to fetch payroll settings' });
    }
};

// Update payroll settings
export const updatePayrollSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;

        if (!user?.companyId || user.role !== 'OWNER') {
            res.status(403).json({ error: 'Only company owner can update payroll settings' });
            return;
        }

        const { workingDaysPerMonth, overtimeRate, defaultExpectedHours } = req.body;

        // Validation
        const updates: any = {};

        if (workingDaysPerMonth !== undefined) {
            const val = Number(workingDaysPerMonth);
            if (isNaN(val) || val < 1 || val > 31) {
                res.status(400).json({ error: 'Working days must be between 1 and 31' });
                return;
            }
            updates.workingDaysPerMonth = val;
        }

        if (overtimeRate !== undefined) {
            const val = Number(overtimeRate);
            if (isNaN(val) || val < 1.0) {
                res.status(400).json({ error: 'Overtime rate must be at least 1.0' });
                return;
            }
            updates.overtimeRate = val;
        }

        if (defaultExpectedHours !== undefined) {
            const val = Number(defaultExpectedHours);
            if (isNaN(val) || val < 1 || val > 24) {
                res.status(400).json({ error: 'Expected hours must be between 1 and 24' });
                return;
            }
            updates.defaultExpectedHours = val;
        }

        if (Object.keys(updates).length === 0) {
            res.status(400).json({ error: 'No valid fields to update' });
            return;
        }

        const company = await prisma.company.update({
            where: { id: user.companyId },
            data: updates,
            select: {
                id: true,
                workingDaysPerMonth: true,
                overtimeRate: true,
                defaultExpectedHours: true,
            }
        });

        res.json({ success: true, company });
    } catch (error: any) {
        console.error('Update Payroll Settings Error:', error);
        res.status(500).json({ error: 'Failed to update payroll settings' });
    }
};
