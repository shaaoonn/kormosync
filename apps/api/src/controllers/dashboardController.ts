import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get Dashboard Stats (Real-time data)
export const getStats = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;

        if (!user?.companyId) {
            // Freelancer stats (no company)
            const userId = user?.id;
            const tasks = await prisma.task.findMany({
                where: { creatorId: userId },
            });

            return res.json({
                totalTasks: tasks.length,
                activeTasks: tasks.filter(t => t.status === 'IN_PROGRESS').length,
                completedTasks: tasks.filter(t => t.status === 'DONE').length,
                pendingTasks: tasks.filter(t => t.status === 'TODO' || t.status === 'REVIEW').length,
                totalEmployees: 0,
                maxEmployees: 0,
                storageUsed: 0,
                storageLimit: 0,
                recentTasks: tasks.slice(0, 5).map(t => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    priority: t.priority,
                    createdAt: t.createdAt,
                })),
            });
        }

        // Company stats
        const companyId = user.companyId;

        // Get company data
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: {
                users: true,
                tasks: true,
            }
        });

        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // Calculate stats
        const tasks = company.tasks;
        const employees = company.users.filter(u => u.role !== 'OWNER');

        const stats = {
            // Task stats
            totalTasks: tasks.length,
            activeTasks: tasks.filter(t => t.status === 'IN_PROGRESS').length,
            completedTasks: tasks.filter(t => t.status === 'DONE').length,
            pendingTasks: tasks.filter(t => t.status === 'TODO' || t.status === 'REVIEW').length,

            // Employee stats
            totalEmployees: employees.length,
            maxEmployees: company.maxEmployees,

            // Storage stats
            storageUsed: company.storageUsed,
            storageLimit: company.storageLimit,

            // Subscription
            subscriptionStatus: company.subscriptionStatus,
            subscriptionEndDate: company.subscriptionEndDate,

            // Recent activity (last 5 tasks)
            recentTasks: tasks
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5)
                .map(t => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    priority: t.priority,
                    createdAt: t.createdAt,
                })),
        };

        return res.json(stats);
    } catch (error) {
        console.error('Get Dashboard Stats Error:', error);
        return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};
