import { Request, Response } from 'express';
import prisma from '../utils/prisma';


// Get Company Members
export const getMembers = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;

        if (!user?.companyId) {
            res.status(400).json({ error: 'User not linked to company' });
            return;
        }

        const members = await prisma.user.findMany({
            where: { companyId: user.companyId, deletedAt: null },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                designation: true,
                profileImage: true,
                createdAt: true
            },
            orderBy: { createdAt: 'asc' }
        });

        res.json({ success: true, members });

    } catch (error) {
        console.error("Get Members Error:", error);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
};

// Create Invite (Email-specific or Open Link)
export const createInvite = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;
        const { email } = req.body; // Optional - if provided, locked to this email

        if (!user?.companyId || !user?.id) {
            res.status(400).json({ error: 'User not linked to company' });
            return;
        }

        // Get company details for plan checks
        const company = await prisma.company.findUnique({
            where: { id: user.companyId },
            include: { users: true }
        });

        if (!company) {
            res.status(400).json({ error: 'Company not found' });
            return;
        }

        // FREE Plan Checks (INACTIVE subscription)
        if (company.subscriptionStatus === 'INACTIVE') {
            // Check member limit (1 employee for free plan, excluding owner)
            const employeeCount = company.users.filter(u => u.role !== 'OWNER').length;
            if (employeeCount >= 1) {
                res.status(403).json({
                    error: 'Free plan limit reached. You can only have 1 employee on the free plan.',
                    upgradeRequired: true
                });
                return;
            }

            // Check trial expiry
            if (company.trialEmployeeEndDate && new Date() > company.trialEmployeeEndDate) {
                res.status(403).json({
                    error: 'Employee trial expired. Please upgrade to continue inviting team members.',
                    upgradeRequired: true
                });
                return;
            }
        }

        // If email provided, check if already a member

        // Create invite token
        const invite = await prisma.invite.create({
            data: {
                companyId: user.companyId,
                email: email || null, // Null = open link
                createdById: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            }
        });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const inviteLink = `${frontendUrl}/join?token=${invite.token}`;

        // Mock email sending if email provided
        if (email) {
            console.log(`📧 [MOCK EMAIL] Sending invite to ${email}: ${inviteLink}`);
        }

        res.json({
            success: true,
            invite: {
                token: invite.token,
                email: invite.email,
                link: inviteLink,
                expiresAt: invite.expiresAt
            }
        });

    } catch (error) {
        console.error("Create Invite Error:", error);
        res.status(500).json({ error: 'Failed to create invite' });
    }
};

// Get Open Invite Link (creates one if none exists)
export const getInviteLink = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;

        if (!user?.companyId || !user?.id) {
            res.status(400).json({ error: 'User not linked to company' });
            return;
        }

        // Find existing open invite or create new one
        let invite = await prisma.invite.findFirst({
            where: {
                companyId: user.companyId,
                email: null, // Open invite
                usedAt: null,
                expiresAt: { gt: new Date() }
            }
        });

        if (!invite) {
            invite = await prisma.invite.create({
                data: {
                    companyId: user.companyId,
                    email: null,
                    createdById: user.id,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
                }
            });
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const inviteLink = `${frontendUrl}/join?token=${invite.token}`;

        res.json({ success: true, inviteLink, expiresAt: invite.expiresAt });

    } catch (error) {
        console.error("Get Invite Link Error:", error);
        res.status(500).json({ error: 'Failed to generate invite link' });
    }
};

// Accept Invite (Join via Token)
export const acceptInvite = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;
        const { token } = req.body;

        if (!user?.uid) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!token) {
            res.status(400).json({ error: 'Invite token is required' });
            return;
        }

        // Find invite
        const invite = await prisma.invite.findUnique({
            where: { token },
            include: { company: true }
        });

        if (!invite) {
            res.status(404).json({ error: 'Invalid invite link' });
            return;
        }

        if (invite.usedAt && invite.email) {
            res.status(400).json({ error: 'This invite has already been used' });
            return;
        }

        if (invite.expiresAt && invite.expiresAt < new Date()) {
            res.status(400).json({ error: 'This invite has expired' });
            return;
        }

        // Get or create user in database
        let dbUser = await prisma.user.findUnique({ where: { firebaseUid: user.uid } });

        if (!dbUser) {
            // Create user in database (first time joining via invite)
            dbUser = await prisma.user.create({
                data: {
                    firebaseUid: user.uid,
                    email: user.email || null,
                    name: user.name || user.email?.split('@')[0] || 'New User',
                    role: 'EMPLOYEE',
                    companyId: invite.companyId
                }
            });

            // Mark email-specific invites as used
            if (invite.email) {
                await prisma.invite.update({
                    where: { id: invite.id },
                    data: { usedAt: new Date() }
                });
            }

            res.json({
                success: true,
                message: 'Joined company successfully',
                company: invite.company.name
            });
            return;
        }

        // Check email restriction
        if (invite.email && dbUser.email !== invite.email) {
            res.status(403).json({
                error: `This invite is for ${invite.email}. Please login with that email.`
            });
            return;
        }

        // Already in this company?
        if (dbUser.companyId === invite.companyId) {
            res.status(400).json({ error: 'You are already a member of this company' });
            return;
        }

        // Join company
        await prisma.user.update({
            where: { id: dbUser.id },
            data: { companyId: invite.companyId, role: 'EMPLOYEE' }
        });

        // Mark email-specific invites as used (open invites can be reused)
        if (invite.email) {
            await prisma.invite.update({
                where: { id: invite.id },
                data: { usedAt: new Date() }
            });
        }

        res.json({
            success: true,
            message: 'Joined company successfully',
            company: invite.company.name
        });

    } catch (error) {
        console.error("Accept Invite Error:", error);
        res.status(500).json({ error: 'Failed to join company' });
    }
};

// Remove Member
export const removeMember = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;
        const { memberId } = req.params;

        if (!user?.companyId) {
            res.status(400).json({ error: 'User not linked to company' });
            return;
        }

        const member = await prisma.user.findUnique({ where: { id: memberId } });
        if (!member || member.companyId !== user.companyId) {
            res.status(404).json({ error: 'Member not found' });
            return;
        }

        if (member.firebaseUid === user.uid) {
            res.status(400).json({ error: 'Cannot remove yourself' });
            return;
        }

        await prisma.user.update({
            where: { id: memberId },
            data: { companyId: null }
        });

        res.json({ success: true, message: 'Member removed' });

    } catch (error) {
        console.error("Remove Member Error:", error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
};

// Legacy: joinCompany (for backward compatibility)
export const joinCompany = async (req: Request, res: Response) => {
    // Redirect to acceptInvite logic
    return acceptInvite(req, res);
};

// Phase 8A: Update Payroll & Attendance Settings
export const updatePayrollSettings = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;

        if (!user?.companyId) {
            res.status(400).json({ error: 'User not linked to company' });
            return;
        }

        // Only OWNER can update payroll settings
        if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
            res.status(403).json({ error: 'Only admins can update payroll settings' });
            return;
        }

        const { workingDaysPerMonth, overtimeRate, defaultExpectedHours } = req.body;

        // Validation
        const updates: any = {};

        if (workingDaysPerMonth !== undefined) {
            const val = parseInt(workingDaysPerMonth);
            if (isNaN(val) || val < 1 || val > 31) {
                res.status(400).json({ error: 'workingDaysPerMonth must be between 1 and 31' });
                return;
            }
            updates.workingDaysPerMonth = val;
        }

        if (overtimeRate !== undefined) {
            const val = parseFloat(overtimeRate);
            if (isNaN(val) || val < 1.0) {
                res.status(400).json({ error: 'overtimeRate must be >= 1.0' });
                return;
            }
            updates.overtimeRate = val;
        }

        if (defaultExpectedHours !== undefined) {
            const val = parseFloat(defaultExpectedHours);
            if (isNaN(val) || val < 1 || val > 24) {
                res.status(400).json({ error: 'defaultExpectedHours must be between 1 and 24' });
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

        res.json({ success: true, settings: company });
    } catch (error) {
        console.error("Update Payroll Settings Error:", error);
        res.status(500).json({ error: 'Failed to update payroll settings' });
    }
};

// Phase 8A: Get Payroll Settings
export const getPayrollSettings = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;

        if (!user?.companyId) {
            res.status(400).json({ error: 'User not linked to company' });
            return;
        }

        const company = await prisma.company.findUnique({
            where: { id: user.companyId },
            select: {
                workingDaysPerMonth: true,
                overtimeRate: true,
                defaultExpectedHours: true,
            }
        });

        if (!company) {
            res.status(404).json({ error: 'Company not found' });
            return;
        }

        res.json({ success: true, settings: company });
    } catch (error) {
        console.error("Get Payroll Settings Error:", error);
        res.status(500).json({ error: 'Failed to fetch payroll settings' });
    }
};
