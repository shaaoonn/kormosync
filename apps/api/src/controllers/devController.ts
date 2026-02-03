import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// ⚠️ DEV ONLY - These endpoints are for development testing only
// Remove or disable in production!

// Get list of users for dev testing
export const getDevUsers = async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
        res.status(403).json({ error: 'Disabled in production' });
        return;
    }

    try {
        const users = await prisma.user.findMany({
            take: 20,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                company: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ users });
    } catch (error) {
        console.error('Dev users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

// Create mock token for dev testing
export const createMockToken = async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
        res.status(403).json({ error: 'Disabled in production' });
        return;
    }

    try {
        const { userId } = req.body;

        if (!userId) {
            res.status(400).json({ error: 'userId required' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { company: true }
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Create a mock JWT token
        const token = jwt.sign(
            {
                uid: user.firebaseUid || `dev-${user.id}`,
                email: user.email,
                devMode: true
            },
            process.env.JWT_SECRET || 'dev-secret-key',
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                companyId: user.companyId,
                company: user.company
            }
        });
    } catch (error) {
        console.error('Mock token error:', error);
        res.status(500).json({ error: 'Failed to create token' });
    }
};
