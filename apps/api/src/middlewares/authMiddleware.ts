import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const prisma = new PrismaClient();

// Initialize Firebase Admin
// Helper to initialize Firebase
const initializeFirebase = () => {
    if (admin.apps.length) return true; // Already initialized

    try {
        let credential;

        // Check for direct environment variables (Docker/Coolify friendly)
        if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            console.log('🔑 [AUTH-INIT] Using Firebase Private Key from ENV');
            console.log(`🔑 [AUTH-INIT] Key Length: ${process.env.FIREBASE_PRIVATE_KEY.length}`);

            // Handle various newline formats
            let privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

            if (!privateKey.includes('\n') && privateKey.includes('PRIVATE KEY')) {
                console.log('⚠️ [AUTH-INIT] Private Key has no newlines, attempting to fix format...');
                privateKey = privateKey.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n');
                privateKey = privateKey.replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
            }

            credential = admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            });
        } else {
            console.log('📂 [AUTH-INIT] Using Default Credentials');
            credential = admin.credential.applicationDefault();
        }

        admin.initializeApp({
            credential
        });
        console.log('🔥 [AUTH-INIT] Firebase Admin initialized successfully');
        return true;
    } catch (error: any) {
        console.error('⚠️ [AUTH-INIT] Initialization Failed:', error.message);
        return false;
    }
};

// Attempt init immediately
initializeFirebase();

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
        // Init check (Lazy Load)
        if (!admin.apps.length) {
            console.error('[AUTH-DEBUG] Firebase App not found. Attempting Re-Init...');
            const success = initializeFirebase();
            if (!success) {
                throw new Error('Firebase Admin could not be initialized. Check Server Logs.');
            }
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
