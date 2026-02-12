import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import crypto from 'crypto';
import dotenv from 'dotenv';
import admin from '../config/firebase';

dotenv.config();

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

// ============================================================
// Auth Cache — avoids Firebase verifyIdToken + DB lookup on every request
// Key: SHA-256 hash of token (first 32 chars for speed)
// TTL: 5 minutes
// ============================================================
interface CachedAuth {
    user: ExtendedUser;
    expiresAt: number;
}

const authCache = new Map<string, CachedAuth>();
const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500; // Prevent unbounded growth

function getTokenHash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
}

// Periodic cache cleanup (every 2 minutes — was 10min, too slow for memory hygiene)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of authCache.entries()) {
        if (now >= entry.expiresAt) {
            authCache.delete(key);
        }
    }
}, 2 * 60 * 1000);

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided' });
        return;
    }

    const token = authHeader.split('Bearer ')[1];

    // Quick format check — Firebase JWT tokens are always 3 parts separated by dots
    // Reject obviously invalid tokens instantly (prevents 30s+ hang in verifyIdToken)
    if (!token || token.length < 100 || token.split('.').length !== 3) {
        res.status(401).json({ error: 'Unauthorized: Invalid token format' });
        return;
    }

    try {
        // Check cache first
        const tokenHash = getTokenHash(token);
        const cached = authCache.get(tokenHash);
        if (cached && Date.now() < cached.expiresAt) {
            req.user = cached.user;
            return next();
        }

        // Init check
        if (!admin.apps.length) {
            console.error('[AUTH] CRITICAL: Firebase Admin NOT initialized!');
            throw new Error('Firebase Admin not initialized');
        }

        // Cache miss — verify token + DB lookup (5s timeout to prevent hanging)
        const decodedToken = await Promise.race([
            admin.auth().verifyIdToken(token),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Firebase verifyIdToken timeout (5s)')), 5000)
            ),
        ]);

        const dbUser = await Promise.race([
            prisma.user.findUnique({
                where: { firebaseUid: decodedToken.uid },
                select: { id: true, companyId: true, role: true, email: true, name: true, profileImage: true }
            }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('DB lookup timeout (10s)')), 10000)
            ),
        ]);

        const user: ExtendedUser = {
            ...decodedToken,
            id: dbUser?.id,
            companyId: dbUser?.companyId,
            role: dbUser?.role,
            dbUser: dbUser
        };

        // Populate cache (evict oldest if full)
        if (authCache.size >= MAX_CACHE_SIZE) {
            const firstKey = authCache.keys().next().value;
            if (firstKey) authCache.delete(firstKey);
        }
        authCache.set(tokenHash, { user, expiresAt: Date.now() + AUTH_CACHE_TTL });

        req.user = user;
        next();
    } catch (error: any) {
        // Invalidate cache on error
        const tokenHash = getTokenHash(token);
        authCache.delete(tokenHash);

        // Distinguish Database Errors from Auth Errors
        if ((error.code && error.code.startsWith('P')) ||
            (error.message && error.message.includes("Can't reach database server")) ||
            (error.message && error.message.includes("PrismaClientInitializationError"))) {

            console.error('[AUTH] Database Error:', error.message);
            res.status(503).json({
                error: 'Service Unavailable: Database Connection Failed',
                details: 'The server cannot reach the database. Please try again later.',
                debugCode: error.code || 'DB_CONNECTION_ERROR'
            });
            return;
        }

        res.status(401).json({
            error: 'Unauthorized: Invalid token',
            details: error.message || error,
            debugCode: error.code
        });
    }
};

// Fix 6E: Export function to clear auth cache for a specific user (e.g., on member removal)
export function clearAuthCacheForUser(firebaseUid: string): void {
    for (const [key, entry] of authCache.entries()) {
        if (entry.user.uid === firebaseUid) {
            authCache.delete(key);
        }
    }
}
