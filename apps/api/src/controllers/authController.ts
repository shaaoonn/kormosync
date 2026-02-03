import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import admin from 'firebase-admin';

const prisma = new PrismaClient();

export const syncUser = async (req: Request, res: Response) => {
    try {
        const { uid, email, picture } = req.user!; // From middleware
        // Default name from Firebase, but prefer body
        const firebaseName = req.user!.name;
        const { companyName, designation, phoneNumber, companySize, name: bodyName } = req.body;

        // Use body name if provided (edit), else firebase name
        const finalName = bodyName || firebaseName;

        // 1. Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { firebaseUid: uid },
            include: { company: true },
        });

        // 2. Existing User -> Return Logic
        if (existingUser) {
            return res.json({
                success: true,
                user: existingUser,
                isNew: false
            });
        }

        // 3a. New User -> Freelancer Signup
        if (req.body.role === 'FREELANCER') {
            const freelancerUser = await prisma.user.create({
                data: {
                    firebaseUid: uid,
                    email: email || null,
                    name: finalName || 'Freelancer',
                    role: 'FREELANCER' as any,
                    isPublic: false, // Default private
                    designation: designation,
                    phoneNumber: phoneNumber,
                },
                include: { company: true }
            });

            return res.json({
                success: true,
                user: freelancerUser,
                isNew: true,
                message: "Freelancer account created"
            });
        }

        // 3b. New User -> Check if it's an Onboarding Request (has companyName)
        if (companyName) {
            // Calculate trial end date (30 days from now)
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 30);

            // Create Company First (FREE plan with trial)
            const company = await prisma.company.create({
                data: {
                    name: companyName,
                    companySize: companySize, // Save size
                    subscriptionStatus: 'INACTIVE', // Start as INACTIVE (FREE plan)
                    maxEmployees: 1, // Free plan: 1 employee
                    trialEmployeeEndDate: trialEndDate,
                    hasClaimedTrial: true,
                }
            });

            // Create User as OWNER
            const ownerUser = await prisma.user.create({
                data: {
                    firebaseUid: uid,
                    email: email || null,
                    name: finalName || 'Owner',
                    role: 'OWNER',
                    companyId: company.id,
                    designation: designation,
                    phoneNumber: phoneNumber
                },
                include: { company: true }
            });

            return res.json({
                success: true,
                user: ownerUser,
                isNew: true,
                message: "Workspace created successfully"
            });
        }

        // 4. New User -> Login Attempt ONLY (No companyName)
        // Return "Not Found" state so frontend redirects to Onboarding
        return res.json({
            success: true,
            user: null, // Signals frontend to redirect
            isNew: true
        });

    } catch (error) {
        console.error('Sync User Error:', error);
        return res.status(500).json({ error: 'Failed to sync user' });
    }
};
