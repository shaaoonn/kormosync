import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Toggle Public Profile Visibility
export const togglePublicProfile = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = req.user;
        const { isPublic } = req.body; // Boolean

        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        if (user.role !== 'FREELANCER') {
            return res.status(403).json({ error: 'Only freelancers can have a public profile' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { isPublic: !!isPublic },
            select: { id: true, isPublic: true }
        });

        return res.json({ success: true, isPublic: updatedUser.isPublic });

    } catch (error) {
        console.error("Toggle Public Profile Error:", error);
        return res.status(500).json({ error: 'Failed to update public status' });
    }
};

// Search Freelancers (Public Only)
export const searchFreelancers = async (req: Request, res: Response) => {
    try {
        const { query, skill } = req.query;

        const whereClause: any = {
            role: 'FREELANCER' as any,
            isPublic: true,
            deletedAt: null
        };

        if (query) {
            whereClause.OR = [
                { name: { contains: String(query), mode: 'insensitive' } },
                { designation: { contains: String(query), mode: 'insensitive' } },
                { bio: { contains: String(query), mode: 'insensitive' } }
            ];
        }

        if (skill) {
            whereClause.skills = { has: String(skill) };
        }

        const freelancers = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                designation: true,
                profileImage: true,
                skills: true,
                bio: true,
                hourlyRate: true,
                currency: true,
                city: true,
                country: true,
                linkedIn: true,
                portfolio: true
            },
            take: 20,
            orderBy: { createdAt: 'desc' }
        });

        return res.json({ success: true, freelancers });

    } catch (error) {
        console.error("Search Freelancers Error:", error);
        return res.status(500).json({ error: 'Failed to search freelancers' });
    }
};

// Get Public Freelancer Profile
export const getPublicFreelancerProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const freelancer = await prisma.user.findFirst({
            where: {
                id,
                role: 'FREELANCER' as any,
                isPublic: true,
                deletedAt: null
            },
            select: {
                id: true,
                name: true,
                designation: true,
                profileImage: true,
                skills: true,
                bio: true,
                hourlyRate: true,
                currency: true,
                city: true,
                country: true,
                education: true,
                experience: true,
                references: true,
                linkedIn: true,
                portfolio: true,
                facebook: true,
                youtube: true,
                twitter: true,
                github: true,
                createdAt: true
            }
        });

        if (!freelancer) {
            return res.status(404).json({ error: 'Freelancer not found or private' });
        }

        return res.json({ success: true, profile: freelancer });

    } catch (error) {
        console.error("Get Public Profile Error:", error);
        return res.status(500).json({ error: 'Failed to fetch freelancer profile' });
    }
};
