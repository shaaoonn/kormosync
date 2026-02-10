import cron from 'node-cron';
import prisma from '../utils/prisma';

/**
 * Recurring Task Cron Job
 * Runs every hour — checks for recurring template tasks and creates child tasks
 * based on their recurringType (DAILY, WEEKLY, MONTHLY).
 */
export function startRecurringTaskCron() {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
        console.log('🔄 Recurring Task Cron running...');
        try {
            await generateRecurringTasks();
        } catch (error) {
            console.error('❌ Recurring Task Cron Error:', error);
        }
    });

    console.log('⏰ Recurring Task Cron registered (every hour)');
}

async function generateRecurringTasks() {
    const now = new Date();

    // Find all active recurring template tasks (parent tasks, not children)
    const templates = await prisma.task.findMany({
        where: {
            isRecurring: true,
            parentTaskId: null, // Only top-level templates
            status: { not: 'DONE' },
        },
        include: {
            assignees: { select: { id: true } },
            childTasks: {
                select: { id: true, recurringIndex: true, createdAt: true },
                orderBy: { recurringIndex: 'desc' },
                take: 1, // Only get the latest child
            }
        }
    });

    for (const template of templates) {
        try {
            // Check end date
            if (template.recurringEndDate && now > template.recurringEndDate) {
                continue; // Past end date, skip
            }

            // Get the latest child's index and creation time
            const latestChild = template.childTasks[0];
            const currentIndex = (latestChild?.recurringIndex ?? 0) + 1;

            // Check max count
            if (template.recurringCount && currentIndex > template.recurringCount) {
                continue; // Exceeded max count
            }

            // Determine if it's time to create a new instance
            const shouldCreate = shouldCreateNewInstance(
                template.recurringType!,
                latestChild?.createdAt || template.createdAt,
                now
            );

            if (!shouldCreate) continue;

            // Clone the template task as a child task
            const childTask = await prisma.task.create({
                data: {
                    companyId: template.companyId,
                    creatorId: template.creatorId,
                    clientId: template.clientId,
                    title: `${template.title} #${currentIndex}`,
                    description: template.description,
                    descriptionRaw: template.descriptionRaw,
                    priority: template.priority,
                    billingType: template.billingType,
                    fixedPrice: template.fixedPrice,
                    hourlyRate: template.hourlyRate,
                    estimatedHours: template.estimatedHours,
                    scheduleType: template.scheduleType,
                    scheduleDays: template.scheduleDays,
                    startTime: template.startTime,
                    endTime: template.endTime,
                    allowOvertime: template.allowOvertime,
                    screenshotInterval: template.screenshotInterval,
                    activityThreshold: template.activityThreshold,
                    penaltyEnabled: template.penaltyEnabled,
                    penaltyType: template.penaltyType,
                    penaltyThresholdMins: template.penaltyThresholdMins,
                    monitoringMode: template.monitoringMode,
                    screenshotEnabled: template.screenshotEnabled,
                    activityEnabled: template.activityEnabled,
                    allowRemoteCapture: template.allowRemoteCapture,
                    maxBudget: template.maxBudget,
                    reviewerId: template.reviewerId,
                    // Child-specific
                    parentTaskId: template.id,
                    recurringIndex: currentIndex,
                    isRecurring: false, // Child is NOT recurring itself
                    status: 'IN_PROGRESS',
                    publishStatus: 'PUBLISHED',
                    // Connect same assignees
                    assignees: {
                        connect: template.assignees.map(a => ({ id: a.id }))
                    },
                }
            });

            console.log(`✅ Created recurring child: "${childTask.title}" (index ${currentIndex})`);
        } catch (err) {
            console.error(`❌ Failed to create child for template ${template.id}:`, err);
        }
    }
}

function shouldCreateNewInstance(
    type: string,
    lastCreated: Date,
    now: Date
): boolean {
    const diffMs = now.getTime() - lastCreated.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    switch (type) {
        case 'DAILY':
            // Create if last was more than 20 hours ago (allows for cron timing variance)
            return diffHours >= 20;
        case 'WEEKLY':
            return diffHours >= 6 * 24; // ~6 days
        case 'MONTHLY':
            return diffHours >= 27 * 24; // ~27 days
        default:
            return false;
    }
}
