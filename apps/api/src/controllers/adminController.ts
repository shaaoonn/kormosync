import { Request, Response } from 'express';
import { PrismaClient, PaymentStatus, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

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
        const companies = await prisma.company.findMany({
            include: {
                users: {
                    where: { role: 'OWNER' },
                    select: { email: true, name: true } // Fetch Owner Details
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Format response to flatten owner info
        const formattedCompanies = companies.map(company => ({
            id: company.id,
            name: company.name,
            plan: company.subscriptionStatus, // Assuming plan maps to status for now or add logic
            status: company.subscriptionStatus,
            isStarred: company.isStarred,
            ownerEmail: company.users[0]?.email || 'N/A',
            ownerName: company.users[0]?.name || 'N/A',
            createdAt: company.createdAt
        }));

        res.json(formattedCompanies);
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
