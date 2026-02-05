import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import admin from '../config/firebase';

dotenv.config();

const prisma = new PrismaClient();

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

    // DEBUG LOGS
    console.log(`[AUTH-DEBUG] Request to: ${req.path}`);
    console.log(`[AUTH-DEBUG] Auth Header Present: ${!!authHeader}`);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('[AUTH-DEBUG] Missing or invalid Auth header format');
        res.status(401).json({ error: 'Unauthorized: No token provided' });
        return;
    }

    const token = authHeader.split('Bearer ')[1];
    console.log(`[AUTH-DEBUG] Token Length: ${token.length}, Preview: ${token.substring(0, 10)}...`);

    try {
        // Init check
        if (!admin.apps.length) {
            console.error('[AUTH-DEBUG] CRITICAL: Firebase Admin NOT initialized!');
            throw new Error('Firebase Admin not initialized set up in server.ts');
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        console.log(`[AUTH-DEBUG] Token Verified for UID: ${decodedToken.uid}`);

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
        console.error('[AUTH-DEBUG] Auth Verification Failed:', error);
        console.error('[AUTH-DEBUG] Error Code:', error.code);
        console.error('[AUTH-DEBUG] Error Message:', error.message);

        res.status(401).json({
            error: 'Unauthorized: Invalid token',
            details: error.message || error,
            debugCode: error.code
        });
    }
};
