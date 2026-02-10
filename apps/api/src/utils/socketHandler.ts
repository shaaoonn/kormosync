import { Server, Socket } from 'socket.io';
import prisma from './prisma';


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
    currentApp?: string;
    currentWindow?: string;
    socketId?: string;  // Track which socket owns this session for cleanup
}

// In-memory store for active sessions (key: odId)
const activeSessions = new Map<string, TrackingSession>();

// Pending remote capture requests (key: userId)
// Desktop apps poll this via heartbeat response
const pendingCaptures = new Map<string, { taskId: string; requestedBy: string; requestedAt: Date }>();

export function requestRemoteCapture(userId: string, taskId: string, requestedBy: string) {
    pendingCaptures.set(userId, { taskId, requestedBy, requestedAt: new Date() });
    // Auto-expire after 60 seconds
    setTimeout(() => pendingCaptures.delete(userId), 60000);
}

export function consumePendingCapture(userId: string): { taskId: string; requestedBy: string } | null {
    const pending = pendingCaptures.get(userId);
    if (pending) {
        pendingCaptures.delete(userId);
        return pending;
    }
    return null;
}

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
                    lastUpdate: new Date(),
                    socketId: socket.id,
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
        socket.on('tracking:tick', (data: {
            odId: string;
            elapsedSeconds: number;
            currentApp?: string;
            currentWindow?: string;
        }) => {
            try {
                const session = activeSessions.get(data.odId);
                if (session) {
                    session.lastUpdate = new Date();
                    if (data.currentApp) session.currentApp = data.currentApp;
                    if (data.currentWindow) session.currentWindow = data.currentWindow;
                    io.to(`company:${session.companyId}`).emit('tracking:tick', {
                        odId: data.odId,
                        elapsedSeconds: data.elapsedSeconds,
                        userId: session.userId,
                        currentApp: session.currentApp,
                        currentWindow: session.currentWindow,
                    });
                }
            } catch (err) {
                console.error('[SOCKET] tracking:tick error:', err);
            }
        });

        // Employee stops tracking
        socket.on('tracking:stop', (data: { odId: string }) => {
            try {
                const session = activeSessions.get(data.odId);
                if (session) {
                    io.to(`company:${session.companyId}`).emit('tracking:stopped', {
                        odId: data.odId,
                        userId: session.userId
                    });
                    activeSessions.delete(data.odId);
                    console.log(`🔴 Tracking stopped: ${session.userName}`);
                }
            } catch (err) {
                console.error('[SOCKET] tracking:stop error:', err);
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
            try {
                io.to(`company:${data.companyId}`).emit('screenshot:new', data);
            } catch (err) {
                console.error('[SOCKET] screenshot:uploaded error:', err);
            }
        });

        // Task updated (live edit broadcast)
        socket.on('task:update', (data: {
            companyId: string;
            taskId: string;
            changes: string[];
            updatedBy: string;
        }) => {
            try {
                socket.to(`company:${data.companyId}`).emit('task:updated', data);
            } catch (err) {
                console.error('[SOCKET] task:update error:', err);
            }
        });

        // Penalty acknowledged by employee
        socket.on('penalty:acknowledged', (data: { taskId: string; userId: string }) => {
            try {
                console.log(`✅ Penalty acknowledged by ${data.userId} on task ${data.taskId}`);
            } catch (err) {
                console.error('[SOCKET] penalty:acknowledged error:', err);
            }
        });

        // ============================================================
        // Remote Screenshot Capture (Admin → Employee)
        // ============================================================

        // Admin requests remote screenshot from employee
        socket.on('screenshot:request-capture', (data: {
            targetUserId: string;
            taskId: string;
            companyId: string;
            requestedBy: string;
        }) => {
            try {
                console.log(`📸 Remote capture requested for user ${data.targetUserId} by ${data.requestedBy}`);
                io.to(`user:${data.targetUserId}`).emit('screenshot:capture-now', {
                    taskId: data.taskId,
                    requestedBy: data.requestedBy,
                });
                requestRemoteCapture(data.targetUserId, data.taskId, data.requestedBy);
            } catch (err) {
                console.error('[SOCKET] screenshot:request-capture error:', err);
            }
        });

        // Employee sends back captured screenshot result
        socket.on('screenshot:capture-response', (data: {
            companyId: string;
            requestedBy: string;
            userId: string;
            userName: string;
            imageUrl: string;
            activityStats: { keystrokes: number; mouseClicks: number };
            currentApp?: string;
            currentWindow?: string;
            capturedAt: string;
        }) => {
            try {
                console.log(`📸 Remote capture response from ${data.userName}`);
                io.to(`company:${data.companyId}`).emit('screenshot:remote-result', data);
            } catch (err) {
                console.error('[SOCKET] screenshot:capture-response error:', err);
            }
        });

        // ============================================================
        // Leave Management Events
        // ============================================================

        // Leave request submitted — notify company admins
        socket.on('leave:requested', (data: {
            companyId: string;
            userId: string;
            userName: string;
            type: string;
            startDate: string;
            endDate: string;
            totalDays: number;
        }) => {
            try {
                io.to(`company:${data.companyId}`).emit('leave:new-request', data);
                console.log(`🏖️ Leave requested by ${data.userName}: ${data.type}`);
            } catch (err) {
                console.error('[SOCKET] leave:requested error:', err);
            }
        });

        // Leave approved — notify employee
        socket.on('leave:approved', (data: {
            userId: string;
            companyId: string;
            type: string;
            startDate: string;
            endDate: string;
            approvedBy: string;
        }) => {
            try {
                io.to(`user:${data.userId}`).emit('leave:status-update', {
                    ...data,
                    status: 'APPROVED',
                });
                io.to(`company:${data.companyId}`).emit('leave:updated', data);
                console.log(`✅ Leave approved for user ${data.userId}`);
            } catch (err) {
                console.error('[SOCKET] leave:approved error:', err);
            }
        });

        // Leave rejected — notify employee
        socket.on('leave:rejected', (data: {
            userId: string;
            companyId: string;
            type: string;
            reason?: string;
            rejectedBy: string;
        }) => {
            try {
                io.to(`user:${data.userId}`).emit('leave:status-update', {
                    ...data,
                    status: 'REJECTED',
                });
                io.to(`company:${data.companyId}`).emit('leave:updated', data);
                console.log(`❌ Leave rejected for user ${data.userId}`);
            } catch (err) {
                console.error('[SOCKET] leave:rejected error:', err);
            }
        });

        // Disconnect — clean up orphaned sessions to prevent memory leak
        socket.on('disconnect', () => {
            console.log(`📴 Client disconnected: ${socket.id}`);
            // Remove any active sessions belonging to this socket
            for (const [key, session] of activeSessions.entries()) {
                if ((session as any).socketId === socket.id) {
                    activeSessions.delete(key);
                    console.log(`🧹 Cleaned up orphaned session: ${key}`);
                }
            }
        });
    });
}

// Periodic cleanup of stale sessions — prevents memory leak from orphaned sessions
setInterval(() => {
    const now = Date.now();
    const desktopStaleThreshold = 2 * 60 * 1000;   // 2 minutes for desktop
    const generalStaleThreshold = 10 * 60 * 1000;   // 10 minutes for all others
    let cleaned = 0;

    for (const [odId, session] of activeSessions.entries()) {
        const age = now - session.lastUpdate.getTime();
        const threshold = odId.startsWith('desktop_') ? desktopStaleThreshold : generalStaleThreshold;
        if (age > threshold) {
            activeSessions.delete(odId);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} stale sessions (remaining: ${activeSessions.size})`);
    }
}, 60 * 1000); // Check every minute

// Helper to get active sessions for a company
export function getActiveSessions(companyId: string): TrackingSession[] {
    return Array.from(activeSessions.values())
        .filter(s => s.companyId === companyId);
}

// Update active session from REST heartbeat (bridge for desktop apps without Socket.IO)
// Auto-creates session if none exists — Desktop apps register here instead of socket tracking:start
export function updateSessionFromHeartbeat(
    userId: string,
    data: {
        taskId: string;
        currentApp?: string;
        currentWindow?: string;
        elapsedSeconds?: number;
        // Additional fields for auto-creating new sessions
        companyId?: string;
        userName?: string;
        userEmail?: string;
        userImage?: string | null;
        taskTitle?: string;
    },
    io?: any // Socket.IO server for broadcasting
): TrackingSession | null {
    // Find existing session by userId
    for (const [odId, session] of activeSessions.entries()) {
        if (session.userId === userId) {
            session.lastUpdate = new Date();
            if (data.currentApp) session.currentApp = data.currentApp;
            if (data.currentWindow) session.currentWindow = data.currentWindow;
            // If task changed, update it
            if (data.taskId && data.taskId !== session.taskId) {
                session.taskId = data.taskId;
                if (data.taskTitle) session.taskTitle = data.taskTitle;
            }
            return session;
        }
    }

    // AUTO-CREATE session for Desktop apps (no Socket.IO, register via heartbeat)
    if (data.taskId && data.companyId) {
        const odId = `desktop_${userId}`;
        const newSession: TrackingSession = {
            odId,
            userId,
            userName: data.userName || 'Unknown',
            userEmail: data.userEmail || '',
            userImage: data.userImage || null,
            taskId: data.taskId,
            taskTitle: data.taskTitle || 'Unknown Task',
            companyId: data.companyId,
            startTime: new Date(),
            lastUpdate: new Date(),
            currentApp: data.currentApp,
            currentWindow: data.currentWindow,
        };
        activeSessions.set(odId, newSession);
        console.log(`🟢 Auto-registered Desktop session: ${data.userName || userId} on "${data.taskTitle}"`);

        // Broadcast to company admins
        if (io) {
            io.to(`company:${data.companyId}`).emit('tracking:started', newSession);
        }

        return newSession;
    }

    return null;
}
