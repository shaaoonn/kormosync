import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import prisma, { isPoolResetting, resetPool, isConnectionError, markHealthSuccess, markHealthFailure } from './utils/prisma';
import { isMinioHealthy } from './utils/minioClient';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initSocketHandler } from './utils/socketHandler';

import authRoutes from './routes/authRoutes';
import paymentRoutes from './routes/paymentRoutes';
import uploadRoutes from './routes/uploadRoutes';
import taskRoutes from './routes/taskRoutes';
import aiRoutes from './routes/aiRoutes';
import companyRoutes from './routes/companyRoutes';
import profileRoutes from './routes/profileRoutes';
import freelancerRoutes from './routes/freelancerRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import adminRoutes from './routes/adminRoutes';
import taskBundleRoutes from './routes/taskBundleRoutes';
import activityRoutes from './routes/activityRoutes';
import screenshotRoutes from './routes/screenshotRoutes';
import subtaskRoutes from './routes/subtaskRoutes';
import timeLogRoutes from './routes/timeLogRoutes';
import settingsRoutes from './routes/settingsRoutes';
import payrollRoutes from './routes/payrollRoutes';
import appUsageRoutes from './routes/appUsageRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
import syncRoutes from './routes/syncRoutes';
import assignmentRoutes from './routes/assignmentRoutes';
import proofRoutes from './routes/proofRoutes';
import monitoringRoutes from './routes/monitoringRoutes';
import leaveRoutes from './routes/leaveRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import checklistRoutes from './routes/checklistRoutes';
import customFieldRoutes from './routes/customFieldRoutes';
import reviewRoutes from './routes/reviewRoutes';
import noteRoutes from './routes/noteRoutes';
import notificationRoutes from './routes/notificationRoutes';
import submissionRoutes from './routes/submissionRoutes';
import { startPayrollCron, startAttendanceCron } from './services/payrollCronService';
import { startRecurringTaskCron } from './cron/recurringTaskCron';

// Load env vars
dotenv.config();

// Initialize App
const app: Express = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 8001;

// Initialize Firebase Admin (Professional Pattern)
import { initializeFirebase } from './config/firebase';
initializeFirebase();

// Create HTTP Server
const httpServer = createServer(app);

// Dynamic CORS origin checker — allows all localhost ports + production domains
const allowedOrigins = [
    "https://appkormosync.ejobsit.com",
    "https://adminkormosync.ejobsit.com",
    "tauri://localhost",
    "electron://localhost",
    "file://"
];

function checkOrigin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow all localhost origins (any port)
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
    }
    // Allow whitelisted production origins
    if (allowedOrigins.includes(origin)) {
        return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
}

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: checkOrigin as any,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Initialize Socket Handler
initSocketHandler(io);

// Make io available to controllers
app.set('io', io);

// Middleware — CORS must be first to ensure headers are set even on errors
app.use(cors({
    origin: checkOrigin as any,
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,  // Required for Firebase Google Auth popups + Electron
    crossOriginEmbedderPolicy: false, // Allow cross-origin resources (screenshots, etc.)
}));
// Morgan — skip noisy high-frequency endpoints (heartbeat fires every 30s per user)
app.use(morgan('dev', {
    skip: (req) => {
        const url = req.url || '';
        return url.includes('/heartbeat') || url.includes('/today-stats');
    },
}));

// Global Request Timeout — kill requests that hang > 30 seconds
// Prevents a single slow MinIO call from blocking the event loop indefinitely
app.use((req: Request, res: Response, next: NextFunction) => {
    req.setTimeout(30000, () => {
        if (!res.headersSent) {
            console.warn(`⏰ Request timeout: ${req.method} ${req.url}`);
            res.status(408).json({ success: false, error: 'Request timeout (30s)' });
        }
    });
    next();
});

// Heavy Endpoint Concurrency Limiter — prevents DB pool exhaustion
// Some endpoints (company-earnings, activity/company, admin/analytics) trigger 100+ DB queries
// If 3 users hit these simultaneously = 300+ concurrent queries → pool dead
const heavyEndpointCounters = new Map<string, number>();
const HEAVY_ENDPOINTS: Record<string, number> = {
    '/api/payroll/company-earnings': 1,   // N×10 DB queries — max 1 concurrent
    '/api/admin/analytics': 1,            // 12+ DB queries — max 1 concurrent
    '/api/activity/company': 2,           // Heavy aggregation — max 2 concurrent
    '/api/monitoring/task': 2,            // 7 DB queries + MinIO — max 2 concurrent
};
app.use((req: Request, res: Response, next: NextFunction) => {
    // Check if this is a heavy endpoint (match by prefix)
    const matchedEndpoint = Object.keys(HEAVY_ENDPOINTS).find(ep => req.path.startsWith(ep));
    if (!matchedEndpoint) return next();

    const maxConcurrent = HEAVY_ENDPOINTS[matchedEndpoint];
    const current = heavyEndpointCounters.get(matchedEndpoint) || 0;

    if (current >= maxConcurrent) {
        console.warn(`🚫 Concurrency limit hit: ${matchedEndpoint} (${current}/${maxConcurrent})`);
        res.status(429).json({ success: false, error: 'Server busy, please retry in a few seconds' });
        return;
    }

    heavyEndpointCounters.set(matchedEndpoint, current + 1);
    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return; // Prevent double-decrement from finish+close
        cleaned = true;
        const count = heavyEndpointCounters.get(matchedEndpoint) || 1;
        const newCount = Math.max(0, count - 1);
        if (newCount <= 0) {
            heavyEndpointCounters.delete(matchedEndpoint); // Fix memory leak: remove key when count reaches 0
        } else {
            heavyEndpointCounters.set(matchedEndpoint, newCount);
        }
    };
    res.on('finish', cleanup);
    res.on('close', cleanup);
    next();
});

// DB + MinIO Circuit Breaker — instant 503 when pool is resetting or MinIO is down for uploads
// Prevents requests from queuing/timing out during recovery
app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/' || req.path === '/health') return next(); // Health checks bypass
    if (isPoolResetting()) {
        res.status(503).json({
            success: false,
            error: 'Database reconnecting, please retry in a few seconds',
            retryAfterMs: 3000,
        });
        return;
    }
    // MinIO circuit breaker — block screenshot/upload when MinIO is down
    if (!isMinioHealthy() && (req.path.startsWith('/api/screenshots') || req.path.startsWith('/api/upload'))) {
        if (req.method === 'POST') {
            res.status(503).json({
                success: false,
                error: 'Storage service temporarily unavailable',
                retryAfterMs: 5000,
            });
            return;
        }
    }
    next();
});

// Static Uploads
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/freelancer', freelancerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/task-bundle', taskBundleRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/screenshots', screenshotRoutes);
app.use('/api/subtasks', subtaskRoutes);
app.use('/api/timelogs', timeLogRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/app-usage', appUsageRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/proofs', proofRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/custom-fields', customFieldRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/submissions', submissionRoutes);

// Global Error Handler — ensures CORS headers even on multer/validation errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // Multer file upload errors
    if (err?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: 'File too large (max 5MB)' });
    }
    if (err?.message === 'Only images are allowed') {
        return res.status(400).json({ success: false, message: 'Only image files are allowed' });
    }
    if (err?.message?.includes('Not allowed by CORS')) {
        return res.status(403).json({ success: false, message: 'CORS origin not allowed' });
    }
    // DB Connection Error — trigger pool reset
    if (isConnectionError(err)) {
        console.error('🔴 Connection error in request handler, triggering pool reset');
        resetPool().catch(() => {});
        if (!res.headersSent) {
            return res.status(503).json({ success: false, error: 'Database connection error — recovering...' });
        }
        return;
    }

    // General error
    console.error('Unhandled Error:', err?.message || err);
    return res.status(500).json({ success: false, message: err?.message || 'Internal server error' });
});

app.get('/', (req: Request, res: Response) => {
    res.json({
        status: 'API is Live',
        db: 'Connected',
        socket: 'Active',
        timestamp: new Date().toISOString(),
    });
});

// Start Server
const startServer = async () => {
    // 1. Start HTTP Server immediately
    httpServer.listen(port, "0.0.0.0", () => {
        console.log(`🚀 Server is running on port ${port}`);
        console.log(`🔌 Socket.IO ready for connections`);
    });

    // 2. Attempt Database Connection (Async)
    try {
        await prisma.$connect();
        console.log('✅ Database connected successfully');
    } catch (error) {
        console.error('❌ Database connection failed (Server still running — will auto-recover):', error);
        // Do NOT process.exit(1) here. Health monitor will auto-reconnect.
    }

    // 3. DB Pool Health Monitor — ALWAYS starts (even if initial $connect fails)
    // Every 20s: SELECT 1 with 5s timeout. 3 consecutive failures → auto pool reset
    setInterval(async () => {
        if (isPoolResetting()) return; // Don't health-check during reset
        try {
            const start = Date.now();
            await Promise.race([
                prisma.$queryRaw`SELECT 1`,
                new Promise((_, reject) => setTimeout(() => reject(new Error('DB_POOL_TIMEOUT')), 5000))
            ]);
            const ms = Date.now() - start;
            markHealthSuccess();
            if (ms > 1000) console.warn(`⚠️ DB pool slow: ${ms}ms`);
        } catch (err: any) {
            console.error(`🔴 DB health check failed: ${err.message}`);
            markHealthFailure(); // 3 consecutive → auto resetPool()
        }
    }, 20000); // 20s (was 30s — faster detection)

    // 4. Start Cron Jobs — DELAYED by 30s to let API warm up first
    console.log('⏳ Cron jobs will start in 30 seconds (API warming up first)...');
    setTimeout(() => {
        // startPayrollCron();    // DISABLED — replaced by new on-demand attendance model
        // startAttendanceCron(); // DISABLED — replaced by new on-demand attendance model
        startRecurringTaskCron();
        console.log('⏰ Recurring task cron started (payroll/attendance crons disabled)');
    }, 30000);
};

// Keep process alive
setInterval(() => { }, 1000);

// Process Lifecycle Handlers — auto-recover from crashes where possible
process.on('exit', (code) => {
    console.log(`[PROCESS] Exiting with code: ${code}`);
});
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
    // Attempt DB pool recovery if it's a connection issue
    if (isConnectionError(err)) {
        console.log('[RECOVERY] Triggering pool reset from uncaughtException...');
        resetPool().catch(() => {});
    }
});
process.on('unhandledRejection', (reason: any) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
    // Attempt DB pool recovery if it's a connection issue
    if (reason && isConnectionError(reason)) {
        console.log('[RECOVERY] Triggering pool reset from unhandledRejection...');
        resetPool().catch(() => {});
    }
});

// Export io for use in other modules
export { io };

startServer();
