import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getAuth } from "firebase-admin/auth";
import multer from 'multer';
import path from 'path';
import { invalidateEarningsCache } from '../services/earningsService';

import { getSignedViewUrl } from '../utils/minioClient';
import { logAudit, logFieldChanges } from '../services/auditService';

// ============================================================
// Helper: Batch-process async operations to prevent MinIO overload
// Instead of 100+ concurrent getSignedViewUrl calls, processes N at a time
// ============================================================
async function batchProcess<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);
    }
    return results;
}

// Safe URL signing — returns null on failure instead of throwing
async function safeSignUrl(path: string | null): Promise<string | null> {
    if (!path) return null;
    try {
        return await getSignedViewUrl(path);
    } catch {
        return null;
    }
}


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
            videoUrl,
            // Phase 2: Activity threshold & penalty fields
            activityThreshold,
            penaltyEnabled,
            penaltyType,
            penaltyThresholdMins,
            // Phase 6: Monitoring & resource fields
            monitoringMode,
            resourceLinks,
            // Data collection toggles
            screenshotEnabled,
            activityEnabled,
            // Overtime
            allowOvertime,
            // Phase 9: Recurring, Budget, Review
            isRecurring,
            recurringType,
            recurringEndDate,
            recurringCount,
            maxBudget,
            reviewerId,
            // Phase 10: Employee completion & break settings
            employeeCanComplete,
            breakReminderEnabled,
            breakAfterHours,
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
            resourceLinks: Array.isArray(resourceLinks) ? resourceLinks.filter((l: string) => l.trim()) : [],
            attachments: [],
            videoUrl: extractKey(videoUrl),
            monitoringMode: monitoringMode === 'STEALTH' ? 'STEALTH' : 'TRANSPARENT',
            // Data collection toggles
            screenshotEnabled: screenshotEnabled !== undefined ? !!screenshotEnabled : true,
            activityEnabled: activityEnabled !== undefined ? !!activityEnabled : true,
            allowRemoteCapture: req.body.allowRemoteCapture !== undefined ? !!req.body.allowRemoteCapture : true,
            // Phase 2: Activity & penalty settings
            activityThreshold: activityThreshold !== undefined ? Math.min(100, Math.max(0, activityThreshold)) : 40,
            penaltyEnabled: !!penaltyEnabled,
            penaltyType: penaltyType || null,
            penaltyThresholdMins: penaltyThresholdMins || 15,
            // Overtime
            allowOvertime: !!allowOvertime,
            // Recurring
            isRecurring: !!isRecurring,
            recurringType: isRecurring ? (recurringType || null) : null,
            recurringEndDate: isRecurring && recurringEndDate ? new Date(recurringEndDate) : null,
            recurringCount: isRecurring && recurringCount ? parseInt(recurringCount) : null,
            // Budget
            maxBudget: maxBudget ? parseFloat(maxBudget) : null,
            // Reviewer
            reviewerId: reviewerId || null,
            // Phase 10: Employee completion & break
            employeeCanComplete: employeeCanComplete !== undefined ? !!employeeCanComplete : true,
            breakReminderEnabled: !!breakReminderEnabled,
            breakAfterHours: breakAfterHours ? parseFloat(breakAfterHours) : 2.0,
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

        // Validate recurring task fields
        if (isRecurring) {
            if (!recurringType) {
                return res.status(400).json({ error: 'recurringType is required for recurring tasks' });
            }
            if (recurringCount !== undefined && recurringCount !== null && recurringCount <= 0) {
                return res.status(400).json({ error: 'recurringCount must be greater than 0' });
            }
            if (recurringEndDate && new Date(recurringEndDate) < new Date()) {
                return res.status(400).json({ error: 'recurringEndDate must be in the future' });
            }
        }

        // Create Task (assignees NOT connected directly — they go through approval)
        const task = await prisma.task.create({
            data: {
                ...data,
            }
        });

        // Audit log: task created
        await logAudit({ taskId: task.id, userId: user.id, action: 'CREATED' });

        // Create TaskAssignment records for approval workflow
        const io = req.app.get('io');
        if (user.role !== 'FREELANCER' && assigneeIds?.length) {
            await prisma.taskAssignment.createMany({
                data: assigneeIds.map((assigneeId: string) => ({
                    taskId: task.id,
                    userId: assigneeId,
                    status: 'PENDING' as const,
                })),
                skipDuplicates: true,
            });

            // Notify each assignee via notification + socket
            for (const assigneeId of assigneeIds) {
                await prisma.notification.create({
                    data: {
                        userId: assigneeId,
                        title: 'নতুন টাস্ক অ্যাসাইনমেন্ট',
                        message: `আপনাকে "${task.title}" টাস্কে অ্যাসাইন করা হয়েছে। অনুগ্রহ করে গ্রহণ বা প্রত্যাখ্যান করুন।`,
                        type: 'INFO',
                    }
                });

                if (io) {
                    io.to(`user:${assigneeId}`).emit('assignment:pending', {
                        taskId: task.id,
                        title: task.title,
                        createdBy: user.dbUser?.name || user.email,
                    });
                }
            }
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


// Start Task (Time Tracking) — with dependency check
export const startTask = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.body;
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        // Check if task is blocked by incomplete dependencies
        const blockers = await prisma.taskDependency.findMany({
            where: { taskId },
            include: { dependsOnTask: { select: { id: true, title: true, status: true } } }
        });

        const incompleteBlockers = blockers.filter(b => b.dependsOnTask.status !== 'DONE');
        if (incompleteBlockers.length > 0) {
            const blockerNames = incompleteBlockers.map(b => b.dependsOnTask.title).join(', ');
            return res.status(403).json({
                error: `এই টাস্ক ব্লক করা আছে। আগে শেষ করুন: ${blockerNames}`,
                blockedBy: incompleteBlockers.map(b => b.dependsOnTask)
            });
        }

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
                where.publishStatus = 'PUBLISHED';
            }
        }

        if (status) {
            where.status = status;
        }

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
                        allowOvertime: true,
                        orderIndex: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Sign URLs for tasks in batches of 3 to avoid overwhelming MinIO
        const TASK_BATCH_SIZE = 3;
        const tasksWithSignedUrls: any[] = [];
        for (let i = 0; i < tasks.length; i += TASK_BATCH_SIZE) {
            const taskBatch = tasks.slice(i, i + TASK_BATCH_SIZE);
            const signedBatch = await Promise.all(taskBatch.map(async (task) => {
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
            tasksWithSignedUrls.push(...signedBatch);
        }

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
                reviewer: { select: { id: true, name: true, email: true } },
                timeLogs: {
                    orderBy: { startTime: 'desc' as const },
                    take: 50, // Limit to prevent fetching thousands of timelogs into memory
                },
                screenshots: {
                    orderBy: { recordedAt: 'desc' },
                    take: 20, // Reduced from 50 — each needs MinIO URL signing
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
                        allowOvertime: true,
                        orderIndex: true
                    }
                },
                dependencies: {
                    include: { dependsOnTask: { select: { id: true, title: true, status: true } } }
                },
                dependedOnBy: {
                    include: { task: { select: { id: true, title: true, status: true } } }
                },
                checklist: { orderBy: { orderIndex: 'asc' } },
                customFieldValues: {
                    include: { field: true }
                },
                reviewComments: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                    orderBy: { createdAt: 'desc' }
                },
                parentTask: { select: { id: true, title: true } },
                childTasks: { select: { id: true, title: true, status: true, recurringIndex: true }, orderBy: { recurringIndex: 'asc' } }
            }
        });

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        // Cross-tenant access verification
        const user = getUser(req);
        if (user) {
            if (user.role === 'FREELANCER') {
                if (task.creatorId !== user.id && task.clientId !== user.companyId) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            } else if (task.companyId && task.companyId !== user.companyId) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        // BATCHED URL signing — 5 concurrent max instead of 100+ concurrent
        // Previously: Promise.all() with 50 screenshots × 2 calls each = 100 concurrent MinIO requests
        // Now: 5 at a time, single call per screenshot (no duplicate)
        const screenshotsWithSignedUrls = await batchProcess(task.screenshots, 5, async (ss: any) => {
            const signedUrl = await safeSignUrl(ss.screenshotPath);
            return { ...ss, screenshotPath: signedUrl, imageUrl: signedUrl };
        });

        // Sign Task Attachments & Video — batched (5 at a time)
        const signedAttachments = await batchProcess(
            (task.attachments || []) as string[], 5, (p: string) => safeSignUrl(p)
        );

        // Sign Assignee Profile Images — batched (5 at a time)
        const signedAssignees = await batchProcess(task.assignees, 5, async (a) => ({
            ...a,
            profileImage: await safeSignUrl(a.profileImage)
        }));

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

// Update Task (Manager or Freelancer) — with Audit Log + Socket Events
export const updateTask = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;
        const user = getUser(req);
        const { assigneeIds, subTasks, customFields, ...data } = req.body;

        // Sanitize Video URL if present
        if (data.videoUrl) {
            data.videoUrl = extractKey(data.videoUrl);
        }

        // Sanitize Attachments if present
        if (data.attachments && Array.isArray(data.attachments)) {
            data.attachments = data.attachments.map((url: string) => extractKey(url)).filter(Boolean);
        }

        // Fetch old task data for audit comparison
        const oldTask = await prisma.task.findUnique({
            where: { id: taskId },
            select: {
                title: true, description: true, status: true, priority: true,
                deadline: true, activityThreshold: true, penaltyEnabled: true,
                penaltyType: true, penaltyThresholdMins: true, companyId: true,
            },
        });

        // Fix 4F: employeeCanComplete enforcement
        if (data.status === 'DONE' && user.role === 'EMPLOYEE') {
            const taskForCheck = await prisma.task.findUnique({ where: { id: taskId }, select: { employeeCanComplete: true } });
            if (taskForCheck && !taskForCheck.employeeCanComplete) {
                return res.status(403).json({ error: 'শুধুমাত্র অ্যাডমিন এই টাস্ক সম্পন্ন করতে পারবে' });
            }
        }

        // Validate status transitions
        if (data.status && oldTask && data.status !== oldTask.status) {
            const VALID_TRANSITIONS: Record<string, string[]> = {
                'TODO': ['IN_PROGRESS'],
                'IN_PROGRESS': ['REVIEW', 'DONE', 'TODO'],
                'REVIEW': ['DONE', 'IN_PROGRESS'],
                'DONE': [], // Final state
            };
            const allowed = VALID_TRANSITIONS[oldTask.status] || [];
            if (!allowed.includes(data.status)) {
                return res.status(400).json({ error: `Invalid status transition: ${oldTask.status} → ${data.status}` });
            }
        }

        // 1. Update Main Task
        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: {
                ...data,
                assignees: assigneeIds ? { set: assigneeIds.map((uid: string) => ({ id: uid })) } : undefined
            }
        });

        // Audit log: track field changes
        if (user?.id && oldTask) {
            await logFieldChanges({
                taskId,
                userId: user.id,
                oldData: oldTask,
                newData: data,
                fields: ['title', 'description', 'status', 'priority', 'deadline',
                    'activityThreshold', 'penaltyEnabled', 'penaltyType', 'penaltyThresholdMins',
                    'monitoringMode', 'screenshotInterval', 'maxBudget', 'employeeCanComplete',
                    'breakReminderEnabled', 'screenshotEnabled', 'activityEnabled', 'allowRemoteCapture'],
            });

            if (assigneeIds) {
                await logAudit({ taskId, userId: user.id, action: 'ASSIGNED', field: 'assignees', newValue: JSON.stringify(assigneeIds) });
            }
        }

        // Socket: broadcast task update to company room
        const io = req.app.get('io');
        const companyId = oldTask?.companyId || updatedTask.companyId;
        if (io && companyId) {
            io.to(`company:${companyId}`).emit('task:updated', {
                taskId,
                changes: Object.keys(data),
                updatedBy: user?.name || 'Unknown',
            });
        }

        // Emit task update event for real-time sync
        try {
            const io2 = req.app.get('io');
            if (io2 && updatedTask.companyId) {
                io2.to(`company:${updatedTask.companyId}`).emit('task:updated', {
                    taskId: updatedTask.id,
                    status: updatedTask.status,
                    updatedBy: user.name || user.email,
                });
            }
        } catch (e) { /* socket emit failed */ }

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

        // Invalidate earnings cache — task edit (interval, rate, etc.) may affect calculations
        invalidateEarningsCache(); // Clear all — task edit is rare, safe to clear all

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

        if (task.status !== 'IN_PROGRESS' && task.status !== 'REVIEW') {
            return res.status(400).json({ error: 'Only IN_PROGRESS or REVIEW tasks can be approved' });
        }

        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: { status: 'DONE' }
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
        const user = getUser(req);

        // Audit log before deletion (cascade will remove audit logs too, but we log the intent)
        if (user?.id) {
            await logAudit({ taskId, userId: user.id, action: 'DELETED' });
        }

        await prisma.task.delete({ where: { id: taskId } });
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: "Failed to delete task" });
    }
};

// Toggle Task Active (Pause/Resume)
export const toggleTaskActive = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        // Only OWNER, ADMIN, or task creator can toggle
        if (!['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Only administrators can pause/resume tasks' });
        }

        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) return res.status(404).json({ error: 'Task not found' });

        const newIsActive = !task.isActive;
        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: {
                isActive: newIsActive,
                pausedAt: newIsActive ? null : new Date(),
                pausedReason: newIsActive ? null : (req.body.reason || null),
            }
        });

        // Audit log
        await logAudit({
            taskId,
            userId: user.id,
            action: 'STATUS_CHANGED' as any,
            field: 'isActive',
            newValue: newIsActive ? 'RESUMED' : 'PAUSED',
        });

        // Socket.IO notification
        const io = req.app.get('io');
        const companyId = task.companyId;
        if (io && companyId) {
            io.to(`company:${companyId}`).emit(newIsActive ? 'task:resumed' : 'task:paused', {
                taskId,
                isActive: newIsActive,
                pausedReason: req.body.reason || null,
                updatedBy: user.name || user.email,
            });
        }

        return res.json({ success: true, task: updatedTask });
    } catch (error) {
        console.error("Toggle Task Active Error:", error);
        return res.status(500).json({ error: 'Failed to toggle task status' });
    }
};
