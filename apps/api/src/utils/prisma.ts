import { PrismaClient } from '@prisma/client';

// ============================================================
// KormoSync API — Prisma Singleton with Auto Pool Recovery
// ============================================================
// Single PrismaClient instance prevents connection pool exhaustion.
// Pool size configured via DATABASE_URL: connection_limit=15&pool_timeout=5
//
// When VPS PostgreSQL drops connections (ConnectionReset), the pool
// fills with dead connections. This module detects that and auto-resets
// the pool via $disconnect() + $connect().
// ============================================================

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
    log: process.env.NODE_ENV === 'development'
        ? [
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
          ]
        : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// ============================================================
// Pool Reset State
// ============================================================
let isResetting = false;
let lastResetTime = 0;
let consecutiveHealthFailures = 0;
const RESET_COOLDOWN_MS = 10_000;  // Min 10s between resets (prevent flapping)
const MAX_HEALTH_FAILURES = 3;     // Trigger auto-reset after 3 consecutive failures

// ============================================================
// Connection Error Detection
// ============================================================
export function isConnectionError(error: any): boolean {
    const msg = (error?.message || '').toLowerCase();
    const code = error?.code || '';
    return (
        msg.includes('connection reset') ||
        msg.includes('connection refused') ||
        msg.includes('connection closed') ||
        msg.includes('econnreset') ||
        msg.includes('timed out fetching a new connection') ||
        msg.includes("can't reach database") ||
        msg.includes('server closed the connection') ||
        msg.includes('server has closed the connection') ||
        msg.includes('socket hang up') ||
        msg.includes('db_pool_timeout') ||
        msg.includes('forcibly closed') ||
        code === 'P1001' || // Can't reach database server
        code === 'P1002' || // Database server timed out
        code === 'P1008' || // Operations timed out
        code === 'P1017' || // Server has closed the connection
        code === 'P2024'    // Timed out fetching new connection from pool
    );
}

// ============================================================
// Pool Reset — clears dead connections, establishes fresh ones
// Same PrismaClient instance: $disconnect() + $connect()
// ============================================================
export async function resetPool(): Promise<boolean> {
    if (isResetting || (Date.now() - lastResetTime) < RESET_COOLDOWN_MS) {
        return false; // Already resetting or cooldown active
    }

    isResetting = true;
    console.log('🔄 [PRISMA] Resetting connection pool...');

    try {
        // 1. Disconnect — closes all pooled connections (5s timeout to prevent hanging)
        await Promise.race([
            prisma.$disconnect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('$disconnect timeout (5s)')), 5000))
        ]).catch(() => {}); // If disconnect times out, continue to $connect anyway

        // 2. Brief pause — let TCP connections fully close
        await new Promise(r => setTimeout(r, 2000));

        // 3. Reconnect — establishes fresh connections
        await prisma.$connect();

        consecutiveHealthFailures = 0;
        lastResetTime = Date.now();
        console.log('✅ [PRISMA] Pool reset successful — fresh connections established');
        return true;
    } catch (e: any) {
        console.error('❌ [PRISMA] Pool reset failed:', e?.message || e);
        lastResetTime = Date.now();
        return false;
    } finally {
        isResetting = false;
    }
}

// ============================================================
// Health Tracking — used by server.ts health monitor
// ============================================================
export function isPoolResetting(): boolean {
    return isResetting;
}

export function markHealthSuccess(): void {
    consecutiveHealthFailures = 0;
}

export function markHealthFailure(): void {
    consecutiveHealthFailures++;
    if (consecutiveHealthFailures >= MAX_HEALTH_FAILURES) {
        console.error(`🔴 [PRISMA] ${MAX_HEALTH_FAILURES} consecutive health failures — triggering auto-reset`);
        resetPool().catch(() => {});
    }
}

export function getHealthFailures(): number {
    return consecutiveHealthFailures;
}

export default prisma;
