import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getAuth } from "firebase-admin/auth";
import multer from 'multer';
import path from 'path';

import { getSignedViewUrl } from '../utils/minioClient'; // Add this import

const prisma = new PrismaClient();

// Multer Setup
// Multer Setup (unchanged)
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

export const upload = multer({ storage });

// Helper for user type
const getUser = (req: Request) => req.user as any;

// Helper to strip signed URL params
const extractKey = (url: string | undefined) => {
    if (!url) return undefined;

    // Only sanitize if it's a KormoSync MinIO URL
    if (url.includes('/kormosync/')) {
        let clean = url.split('?')[0];
        clean = clean.split('/kormosync/')[1];
        return decodeURIComponent(clean);
    }

    // Otherwise return as is (e.g. YouTube, External Images)
    return url;
};

// Create Task (Manager or Freelancer)
export const createTask = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const {
            title,
            descriptionRaw,
            priority,
            deadline,
            isDraft,
            screenshotInterval,
            assigneeIds,
            clientEmail,
            videoUrl // Capture videoUrl
        } = req.body;

        // Common Data
        const data: any = {
            creatorId: user.id,
            title: title || 'Untitled Task',
            descriptionRaw,
            description: descriptionRaw,
            priority: priority || 'MEDIUM',
            deadline: deadline ? new Date(deadline) : null,
            isDraft: !!isDraft,
            screenshotInterval: Math.min(60, Math.max(1, screenshotInterval || 5)),
            manualAllowedApps: req.body.manualAllowedApps || [],
            resourceLinks: [],
            attachments: [],
            videoUrl: extractKey(videoUrl) // Sanitize videoUrl
        };

        // Handle File Uploads (Attachments)
        if (req.body.attachments && Array.isArray(req.body.attachments)) {
            data.attachments = req.body.attachments.map((url: string) => extractKey(url)).filter(Boolean);
        }

        // ROLE SPECIFIC LOGIC
        if (user.role === 'FREELANCER') {
            // Freelancer Flow
            data.status = 'PENDING';
            data.clientId = null;

            if (clientEmail) {
                const clientUser = await prisma.user.findUnique({
                    where: { email: clientEmail },
                    include: { company: true }
                });

                if (clientUser?.company) {
                    data.clientId = clientUser.company.id;
                }
            }

        } else {
            // Manager/Owner Flow
            if (!user.companyId) {
                return res.status(400).json({ error: 'User must belong to a company' });
            }
            data.companyId = user.companyId;
            data.status = 'IN_PROGRESS';
        }

        // Create Task
        const task = await prisma.task.create({
            data: {
                ...data,
                assignees: (user.role !== 'FREELANCER' && assigneeIds?.length) ? {
                    connect: assigneeIds.map((id: string) => ({ id }))
                } : undefined
            }
        });

        // Notify Assignees via Socket.IO
        const io = req.app.get('io');
        if (io && assigneeIds && assigneeIds.length > 0) {
            assigneeIds.forEach((assigneeId: string) => {
                io.to(`user:${assigneeId}`).emit('task:assigned', {
                    taskId: task.id,
                    title: task.title,
                    createdBy: user.name
                });
                console.log(`📢 Emitted task:assigned to user:${assigneeId}`);
            });
        }

        return res.json({ success: true, task });

    } catch (error) {
        console.error("Create Task Error:", error);
        return res.status(500).json({ error: 'Failed to create task' });
    }
};



// Get Tasks (skipping context-irrelevant function body as it was unmodified in this context, assuming tool behaves correctly with ReplaceContent spanning large block?)
// Actually ReplaceContent requires EXACT match. I should be careful. 
// I will only replace `createTask` and `updateTask` separately or use `multi_replace`.
// Using `replace_file_content` for `createTask` block and then another call for `updateTask`.

// ... (skipping getTasks and getTaskById for this edit, focusing on createTask first?)
// Wait, the instruction says "Sanitize attachments/videoUrl in create/update task".
// If I provide a huge block, I risk mismatch.
// I'll try to do `createTask` first.


// Start Task (Time Tracking)
export const startTask = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.body;
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const timeLog = await prisma.timeLog.create({
            data: {
                userId: user.id,
                taskId,
                startTime: new Date()
            }
        });

        return res.json({ success: true, timeLog });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to start timer' });
    }
};

// Stop Task
export const stopTask = async (req: Request, res: Response) => {
    try {
        const { timeLogId } = req.body;
        const endTime = new Date();

        const timeLog = await prisma.timeLog.findUnique({ where: { id: timeLogId } });
        if (!timeLog) {
            return res.status(404).json({ error: 'Time log not found' });
            // Added explicit return to satisfy "Not all code paths return a value" if interpreted strictly
        }

        const durationSeconds = Math.floor((endTime.getTime() - timeLog.startTime.getTime()) / 1000);

        const updatedLog = await prisma.timeLog.update({
            where: { id: timeLogId },
            data: { endTime, durationSeconds }
        });

        return res.json({ success: true, timeLog: updatedLog });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to stop timer' });
    }
};

// Get Tasks
export const getTasks = async (req: Request, res: Response) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { status } = req.query;

        let where: any = {};

        if (user.role === 'FREELANCER') {
            // Freelancer sees tasks they created
            where = { creatorId: user.id };
        } else {
            // Managers see all company tasks, Employees see assigned tasks
            where = { companyId: user.companyId };
            if (user.role === 'EMPLOYEE') {
                where.assignees = { some: { id: user.id } };
            }
        }

        if (status) {
            where.status = status;
        }

        console.log('🔍 FETCHING TASKS FOR USER:', user.email, user.role);
        console.log('🔍 WHERE CLAUSE:', JSON.stringify(where, null, 2));

        const tasks = await prisma.task.findMany({
            where,
            include: {
                assignees: {
                    select: { id: true, name: true, profileImage: true, email: true }
                },
                creator: {
                    select: { name: true, email: true }
                },
                client: {
                    select: { name: true }
                },
                subTasks: {
                    orderBy: { orderIndex: 'asc' },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        billingType: true,
                        fixedPrice: true,
                        hourlyRate: true,
                        estimatedHours: true,
                        scheduleDays: true,
                        startTime: true,
                        endTime: true,
                        orderIndex: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`✅ FOUND ${tasks.length} TASKS`);

        // Sign URLs for all tasks
        const tasksWithSignedUrls = await Promise.all(tasks.map(async (task) => {
            const signedAttachments = await Promise.all(
                (task.attachments || []).map((path: string) => getSignedViewUrl(path))
            );

            const signedAssignees = await Promise.all(
                task.assignees.map(async (a) => ({
                    ...a,
                    profileImage: a.profileImage ? await getSignedViewUrl(a.profileImage) : null
                }))
            );

            return {
                ...task,
                attachments: signedAttachments,
                videoUrl: task.videoUrl ? await getSignedViewUrl(task.videoUrl) : null,
                assignees: signedAssignees
            };
        }));

        const isAdmin = user.role === 'OWNER' || user.role === 'ADMIN';
        return res.json({ success: true, tasks: tasksWithSignedUrls, isAdmin, role: user.role });

    } catch (error) {
        console.error("Get Tasks Error:", error);
        return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

// Get Task Details
export const getTaskById = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                assignees: { select: { id: true, name: true, email: true, profileImage: true } },
                creator: { select: { id: true, name: true, email: true } },
                timeLogs: true,
                screenshots: {
                    orderBy: { recordedAt: 'desc' },
                    take: 50 // Limit to recent screenshots
                },
                subTasks: {
                    orderBy: { orderIndex: 'asc' },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        billingType: true,
                        fixedPrice: true,
                        hourlyRate: true,
                        estimatedHours: true,
                        scheduleType: true,
                        scheduleDays: true,
                        startTime: true,
                        endTime: true,
                        orderIndex: true
                    }
                }
            }
        });

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        // Sign Screenshot URLs
        const screenshotsWithSignedUrls = await Promise.all(
            task.screenshots.map(async (ss: any) => ({
                ...ss,
                screenshotPath: await getSignedViewUrl(ss.screenshotPath), // Use stored path to generate signed URL
                // If frontend expects 'imageUrl', mapping it here:
                imageUrl: await getSignedViewUrl(ss.screenshotPath)
            }))
        );

        // Sign Task Attachments & Video
        const signedAttachments = await Promise.all(
            (task.attachments || []).map((path: string) => getSignedViewUrl(path))
        );

        // Sign Assignee Profile Images
        const signedAssignees = await Promise.all(
            task.assignees.map(async (a) => ({
                ...a,
                profileImage: a.profileImage ? await getSignedViewUrl(a.profileImage) : null
            }))
        );

        return res.json({
            success: true,
            task: {
                ...task,
                screenshots: screenshotsWithSignedUrls,
                attachments: signedAttachments,
                videoUrl: task.videoUrl ? await getSignedViewUrl(task.videoUrl) : null,
                assignees: signedAssignees
            }
        });
    } catch (error) {
        console.error("Get Task Error:", error);
        return res.status(500).json({ error: "Failed to fetch task" });
    }
};

// Update Task (Manager or Freelancer)
// Update Task (Manager or Freelancer)
export const updateTask = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;
        const { assigneeIds, subTasks, customFields, ...data } = req.body;

        // Sanitize Video URL if present
        if (data.videoUrl) {
            data.videoUrl = extractKey(data.videoUrl);
        }

        // Sanitize Attachments if present
        if (data.attachments && Array.isArray(data.attachments)) {
            data.attachments = data.attachments.map((url: string) => extractKey(url)).filter(Boolean);
        }

        // 1. Update Main Task
        await prisma.task.update({
            where: { id: taskId },
            data: {
                ...data,
                assignees: assigneeIds ? { set: assigneeIds.map((uid: string) => ({ id: uid })) } : undefined
            }
        });

        // 2. Handle SubTasks if provided
        if (subTasks && Array.isArray(subTasks)) {
            // Get existing IDs to know what to delete
            const existingSubTasks = await prisma.subTask.findMany({ where: { taskId }, select: { id: true } });
            const existingIds = existingSubTasks.map(st => st.id);
            const newIds = subTasks.map(st => st.id).filter(id => id); // Filter valid IDs

            // Delete removed subtasks
            const toDelete = existingIds.filter(id => !newIds.includes(id));
            if (toDelete.length > 0) {
                await prisma.subTask.deleteMany({ where: { id: { in: toDelete } } });
            }

            // Upsert (Update or Create)
            for (const st of subTasks) {
                if (st.id && existingIds.includes(st.id)) {
                    // Update
                    const { id, ...stData } = st;
                    await prisma.subTask.update({
                        where: { id: st.id },
                        data: {
                            ...stData,
                            scheduleDays: stData.scheduleDays || [],
                        }
                    });
                } else {
                    // Create
                    const { id, ...stData } = st;
                    await prisma.subTask.create({
                        data: {
                            ...stData,
                            taskId,
                            scheduleDays: stData.scheduleDays || [],
                        }
                    });
                }
            }
        }

        return res.json({ success: true });
    } catch (error: any) {
        console.error("Update Task Error:", error);
        return res.status(500).json({ error: error.message || "Failed to update task" });
    }
};

// Approve Task (Client Action)
export const approveTask = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        // Identify if user is the client linked to this task?
        // Logic: Task must have clientId == user.companyId
        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (task.clientId !== user.companyId) {
            return res.status(403).json({ error: 'Not authorized to approve this task' });
        }

        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: { status: 'APPROVED' as any }
        });

        return res.json({ success: true, task: updatedTask });

    } catch (error) {
        return res.status(500).json({ error: "Failed to approve task" });
    }
};

// Delete Task
export const deleteTask = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;
        await prisma.task.delete({ where: { id: taskId } });
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: "Failed to delete task" });
    }
};
