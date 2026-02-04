import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
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

// Load env vars
dotenv.config();

// Initialize App
const app: Express = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 8001;

// Create HTTP Server
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:5173",
            "https://appkormosync.ejobsit.com",
            "https://adminkormosync.ejobsit.com",
            "tauri://localhost",
            "electron://localhost",
            "file://"
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Initialize Socket Handler
initSocketHandler(io);

// Make io available to controllers
app.set('io', io);

// Middleware
app.use(express.json());
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:5173",
        "https://appkormosync.ejobsit.com",
        "https://adminkormosync.ejobsit.com",
        "tauri://localhost",
        "electron://localhost",
        "file://"
    ],
    credentials: true,
}));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan('dev'));

// Database
const prisma = new PrismaClient();

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
        console.error('❌ Database connection failed (Server still running for logs):', error);
        // Do NOT process.exit(1) here. Let the server run so we can see logs.
    }
};

// Keep process alive
setInterval(() => { }, 1000);

// Debugging Exit
process.on('exit', (code) => {
    console.log(`[DEBUG] About to exit with code: ${code}`);
});
process.on('uncaughtException', (err) => {
    console.error('[DEBUG] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[DEBUG] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export io for use in other modules
export { io };

startServer();
