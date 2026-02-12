// ============================================================
// Notification Service — centralized notification creation
// ============================================================

import prisma from '../utils/prisma';

type NotificationType = 'INFO' | 'WARNING' | 'ERROR';

/**
 * Create a notification for a single user
 */
export async function createNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType = 'INFO'
) {
    return prisma.notification.create({
        data: { userId, title, message, type },
    });
}

/**
 * Create notifications for multiple users (bulk)
 */
export async function createBulkNotifications(
    userIds: string[],
    title: string,
    message: string,
    type: NotificationType = 'INFO'
) {
    if (userIds.length === 0) return;
    return prisma.notification.createMany({
        data: userIds.map((userId) => ({ userId, title, message, type })),
    });
}

/**
 * Notify all admins/owners of a company
 */
export async function notifyCompanyAdmins(
    companyId: string,
    title: string,
    message: string,
    type: NotificationType = 'INFO'
) {
    const admins = await prisma.user.findMany({
        where: {
            companyId,
            role: { in: ['OWNER', 'ADMIN'] },
        },
        select: { id: true },
    });
    const adminIds = admins.map((a) => a.id);
    if (adminIds.length > 0) {
        await createBulkNotifications(adminIds, title, message, type);
    }
    return adminIds;
}

/**
 * Notify all assignees of a task
 */
export async function notifyTaskAssignees(
    taskId: string,
    title: string,
    message: string,
    type: NotificationType = 'INFO',
    excludeUserId?: string
) {
    const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { assignees: { select: { id: true } } },
    });
    if (!task) return [];
    const assigneeIds = task.assignees
        .map((a) => a.id)
        .filter((id) => id !== excludeUserId);
    if (assigneeIds.length > 0) {
        await createBulkNotifications(assigneeIds, title, message, type);
    }
    return assigneeIds;
}

// ============================================================
// Event-specific notification helpers
// ============================================================

/** 1. নতুন টাস্ক এসাইন হলে */
export async function onTaskAssigned(userId: string, taskTitle: string) {
    return createNotification(userId, 'নতুন টাস্ক অ্যাসাইনমেন্ট', `আপনাকে "${taskTitle}" টাস্কে অ্যাসাইন করা হয়েছে`, 'INFO');
}

/** 2. টাস্ক স্ট্যাটাস পরিবর্তন */
export async function onTaskStatusChanged(taskId: string, taskTitle: string, newStatus: string, changedByUserId: string) {
    return notifyTaskAssignees(taskId, 'টাস্ক স্ট্যাটাস পরিবর্তন', `"${taskTitle}" টাস্কের স্ট্যাটাস পরিবর্তিত হয়েছে: ${newStatus}`, 'INFO', changedByUserId);
}

/** 3. টাস্ক ডেডলাইন আসন্ন (24h) */
export async function onDeadlineApproaching(taskId: string, taskTitle: string) {
    return notifyTaskAssignees(taskId, '⏰ ডেডলাইন আসন্ন', `"${taskTitle}" টাস্কের ডেডলাইন আগামী ২৪ ঘন্টার মধ্যে`, 'WARNING');
}

/** 4. টাস্ক ডেডলাইন পেরিয়ে গেলে */
export async function onDeadlinePassed(taskId: string, taskTitle: string, companyId: string) {
    await notifyTaskAssignees(taskId, '🔴 ডেডলাইন পেরিয়ে গেছে', `"${taskTitle}" টাস্কের ডেডলাইন পেরিয়ে গেছে!`, 'ERROR');
    await notifyCompanyAdmins(companyId, '🔴 ডেডলাইন পেরিয়ে গেছে', `"${taskTitle}" টাস্কের ডেডলাইন পার হয়ে গেছে`, 'ERROR');
}

/** 5. টাস্ক pause/resume হলে */
export async function onTaskPauseResume(taskId: string, taskTitle: string, isPaused: boolean, changedByUserId: string) {
    const action = isPaused ? '⏸ বিরতি' : '▶️ পুনরায় শুরু';
    return notifyTaskAssignees(taskId, `টাস্ক ${action}`, `"${taskTitle}" টাস্ক ${isPaused ? 'বিরতিতে' : 'পুনরায় শুরু হয়েছে'}`, 'WARNING', changedByUserId);
}

/** 6. প্রুফ সাবমিট হলে */
export async function onProofSubmitted(reviewerUserId: string, taskTitle: string, submitterName: string) {
    return createNotification(reviewerUserId, 'নতুন কাজের প্রমাণ', `${submitterName} "${taskTitle}" টাস্কের কাজের প্রমাণ জমা দিয়েছেন`, 'INFO');
}

/** 7. প্রুফ approve/reject হলে */
export async function onProofReviewed(userId: string, taskTitle: string, approved: boolean) {
    return createNotification(
        userId,
        approved ? 'টাস্ক অনুমোদিত ✅' : 'পরিবর্তন প্রয়োজন ↩️',
        approved
            ? `"${taskTitle}" টাস্কের কাজ অনুমোদিত হয়েছে`
            : `"${taskTitle}" টাস্কে পরিবর্তন প্রয়োজন`,
        approved ? 'INFO' : 'WARNING'
    );
}

/** 8. লিভ request হলে */
export async function onLeaveRequested(companyId: string, employeeName: string, leaveType: string) {
    return notifyCompanyAdmins(companyId, 'নতুন ছুটির আবেদন', `${employeeName} ${leaveType} ছুটির আবেদন করেছেন`, 'INFO');
}

/** 9. লিভ approve/reject হলে */
export async function onLeaveReviewed(userId: string, approved: boolean, leaveType: string) {
    return createNotification(
        userId,
        approved ? 'ছুটি অনুমোদিত ✅' : 'ছুটি প্রত্যাখ্যাত ❌',
        approved
            ? `আপনার ${leaveType} ছুটি অনুমোদিত হয়েছে`
            : `আপনার ${leaveType} ছুটি প্রত্যাখ্যাত হয়েছে`,
        approved ? 'INFO' : 'WARNING'
    );
}

/** 10. পেনাল্টি হলে */
export async function onPenaltyApplied(userId: string, reason: string, amount: number) {
    return createNotification(userId, '⚠️ জরিমানা', `${reason} — ৳${amount}`, 'ERROR');
}

/** 11. বেতন processed হলে */
export async function onPayrollProcessed(userId: string, amount: number, periodLabel: string) {
    return createNotification(userId, '💰 বেতন প্রদান', `${periodLabel} — ৳${amount.toLocaleString()} প্রদান হয়েছে`, 'INFO');
}

/** 12. নতুন কর্মী যোগ হলে */
export async function onNewEmployeeJoined(companyId: string, employeeName: string) {
    return notifyCompanyAdmins(companyId, '👤 নতুন কর্মী', `${employeeName} টিমে যোগ দিয়েছেন`, 'INFO');
}
