import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Store active tracking sessions
interface TrackingSession {
    odId: string;
    userId: string;
    userName: string;
    userEmail: string;
    userImage: string | null;
    taskId: string;
    taskTitle: string;
    companyId: string;
    startTime: Date;
    lastUpdate: Date;
}

// In-memory store for active sessions (key: odId)
const activeSessions = new Map<string, TrackingSession>();

export function initSocketHandler(io: Server) {
    console.log('🔌 Socket.IO initialized');

    io.on('connection', (socket: Socket) => {
        console.log(`📡 Client connected: ${socket.id}`);

        // Join company room for targeted updates
        socket.on('join:company', (companyId: string) => {
            socket.join(`company:${companyId}`);
            console.log(`👥 Socket ${socket.id} joined company:${companyId}`);

            // Send current active sessions for this company
            const companySessions = Array.from(activeSessions.values())
                .filter(s => s.companyId === companyId);
            socket.emit('tracking:active-sessions', companySessions);
        });

        // Join user specific room
        socket.on('join:user', (userId: string) => {
            socket.join(`user:${userId}`);
            console.log(`👤 Socket ${socket.id} joined user:${userId}`);
        });

        // Employee starts tracking
        socket.on('tracking:start', async (data: {
            odId: string;
            userId: string;
            taskId: string;
            companyId: string;
        }) => {
            try {
                // Fetch user and task details
                const [user, task] = await Promise.all([
                    prisma.user.findUnique({ where: { id: data.userId }, select: { name: true, email: true, profileImage: true } }),
                    prisma.task.findUnique({ where: { id: data.taskId }, select: { title: true } })
                ]);

                if (!user || !task) {
                    console.error('User or task not found');
                    return;
                }

                const session: TrackingSession = {
                    odId: data.odId,
                    userId: data.userId,
                    userName: user.name || 'Unknown',
                    userEmail: user.email || 'unknown@email.com',
                    userImage: user.profileImage || null,
                    taskId: data.taskId,
                    taskTitle: task.title,
                    companyId: data.companyId,
                    startTime: new Date(),
                    lastUpdate: new Date()
                };

                activeSessions.set(data.odId, session);

                // Broadcast to company admins
                io.to(`company:${data.companyId}`).emit('tracking:started', session);
                console.log(`🟢 Tracking started: ${user.name} on "${task.title}"`);
            } catch (error) {
                console.error('Error starting tracking:', error);
            }
        });

        // Tracking tick (every 30 seconds)
        socket.on('tracking:tick', (data: { odId: string; elapsedSeconds: number }) => {
            const session = activeSessions.get(data.odId);
            if (session) {
                session.lastUpdate = new Date();
                io.to(`company:${session.companyId}`).emit('tracking:tick', {
                    odId: data.odId,
                    elapsedSeconds: data.elapsedSeconds,
                    userId: session.userId
                });
            }
        });

        // Employee stops tracking
        socket.on('tracking:stop', (data: { odId: string }) => {
            const session = activeSessions.get(data.odId);
            if (session) {
                io.to(`company:${session.companyId}`).emit('tracking:stopped', {
                    odId: data.odId,
                    userId: session.userId
                });
                activeSessions.delete(data.odId);
                console.log(`🔴 Tracking stopped: ${session.userName}`);
            }
        });

        // Screenshot uploaded
        socket.on('screenshot:uploaded', (data: {
            companyId: string;
            userId: string;
            userName: string;
            imageUrl: string;
            capturedAt: string;
        }) => {
            io.to(`company:${data.companyId}`).emit('screenshot:new', data);
            console.log(`📸 Screenshot from ${data.userName}`);
        });

        // Disconnect
        socket.on('disconnect', () => {
            console.log(`📴 Client disconnected: ${socket.id}`);
        });
    });
}

// Helper to get active sessions for a company
export function getActiveSessions(companyId: string): TrackingSession[] {
    return Array.from(activeSessions.values())
        .filter(s => s.companyId === companyId);
}
