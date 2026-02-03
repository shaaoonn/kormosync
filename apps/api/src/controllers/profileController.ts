import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getSignedViewUrl } from '../utils/minioClient';

const prisma = new PrismaClient();

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
