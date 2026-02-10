import prisma from '../utils/prisma';


/**
 * Log an audit entry for a task change.
 * Reusable across all controllers that modify tasks.
 */
export async function logAudit(params: {
    taskId: string;
    userId: string;
    action: 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'DELETED';
    field?: string;
    oldValue?: string | null;
    newValue?: string | null;
}): Promise<void> {
    try {
        await prisma.taskAuditLog.create({
            data: {
                taskId: params.taskId,
                userId: params.userId,
                action: params.action,
                field: params.field || null,
                oldValue: params.oldValue || null,
                newValue: params.newValue || null,
            },
        });
    } catch (error) {
        // Audit logging should never break the main operation
        console.error('[AUDIT] Failed to create audit log:', error);
    }
}

/**
 * Log multiple field changes at once (for task updates).
 * Compares old and new values and creates audit entries only for changed fields.
 */
export async function logFieldChanges(params: {
    taskId: string;
    userId: string;
    oldData: Record<string, any>;
    newData: Record<string, any>;
    fields: string[]; // Which fields to compare
}): Promise<void> {
    const { taskId, userId, oldData, newData, fields } = params;

    for (const field of fields) {
        const oldVal = oldData[field];
        const newVal = newData[field];

        // Skip if unchanged
        if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;
        // Skip if new value not provided
        if (newVal === undefined) continue;

        await logAudit({
            taskId,
            userId,
            action: field === 'status' ? 'STATUS_CHANGED' : 'UPDATED',
            field,
            oldValue: oldVal !== undefined && oldVal !== null ? String(oldVal) : null,
            newValue: newVal !== undefined && newVal !== null ? String(newVal) : null,
        });
    }
}

/**
 * Get audit logs for a task with user details.
 */
export async function getTaskAuditLogs(taskId: string, limit = 50) {
    return prisma.taskAuditLog.findMany({
        where: { taskId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            user: {
                select: { id: true, name: true, email: true, profileImage: true },
            },
        },
    });
}
