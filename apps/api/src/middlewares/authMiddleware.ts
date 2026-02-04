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
        let credential;

        // Check for direct environment variables (Docker/Coolify friendly)
        if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            console.log('🔑 Using Firebase credentials from Environment Variables');
            credential = admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Handle newlines in private key which are often escaped in env vars
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            });
        } else {
            // Fallback to file-based or Google Cloud auto-discovery
            console.log('📂 Using Default Google Application Credentials (File/Metadata)');
            credential = admin.credential.applicationDefault();
        }

        admin.initializeApp({
            credential
        });
        console.log('🔥 Firebase Admin initialized successfully');
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
