import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const prisma = new PrismaClient();

// Initialize Firebase Admin
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
        console.log('🔥 Firebase Admin initialized');
    } catch (error) {
        console.error('⚠️ Firebase Admin initialization failed. Auth will break.', error);
    }
}

// Extended user type for request
interface ExtendedUser extends admin.auth.DecodedIdToken {
    id?: string;
    companyId?: string | null;
    role?: string;
    dbUser?: any;
}

// Extend Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: ExtendedUser;
        }
    }
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided' });
        return;
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Also fetch database user to get companyId
        const dbUser = await prisma.user.findUnique({
            where: { firebaseUid: decodedToken.uid },
            select: { id: true, companyId: true, role: true, email: true, name: true }
        });

        // Attach both Firebase and DB user info
        req.user = {
            ...decodedToken,
            id: dbUser?.id,
            companyId: dbUser?.companyId,
            role: dbUser?.role,
            dbUser: dbUser
        };

        next();
    } catch (error: any) {
        console.error('Auth Error:', error);
        res.status(401).json({
            error: 'Unauthorized: Invalid token',
            details: error.message || error
        });
    }
};
