/**
 * Schedule Service - Utilities for Sub-Task Scheduling
 * 
 * Provides functions to check if a sub-task is within its scheduled time window
 * and calculate countdown times for UI display.
 */

interface SubTaskSchedule {
    startTime?: string | null;  // "HH:mm" format
    endTime?: string | null;    // "HH:mm" format
    scheduleDays?: number[];    // 0=Sun...6=Sat
    billingType?: string;       // "SCHEDULED", "HOURLY", "FIXED_PRICE"
}

interface ScheduleStatus {
    canStart: boolean;
    reason?: string;
    isScheduled: boolean;
    isActiveWindow: boolean;
    startsInSeconds?: number;  // Seconds until start time
    endsInSeconds?: number;    // Seconds until end time
}

/**
 * Parse time string (HH:mm) to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Get current time in minutes since midnight
 */
function getCurrentMinutes(now: Date): number {
    return now.getHours() * 60 + now.getMinutes();
}

/**
 * Check if sub-task is within its scheduled time window
 */
export function isWithinSchedule(subTask: SubTaskSchedule, now: Date = new Date()): ScheduleStatus {
    // If not a scheduled type or no time constraints, always allow
    if (subTask.billingType !== 'SCHEDULED' || !subTask.startTime) {
        return {
            canStart: true,
            isScheduled: false,
            isActiveWindow: false
        };
    }

    const today = now.getDay(); // 0=Sun...6=Sat
    const currentMinutes = getCurrentMinutes(now);
    const currentSeconds = now.getSeconds();

    const startMinutes = parseTimeToMinutes(subTask.startTime);
    const endMinutes = subTask.endTime ? parseTimeToMinutes(subTask.endTime) : 23 * 60 + 59;

    // Check if today is a scheduled day
    const scheduleDays = subTask.scheduleDays || [];
    if (scheduleDays.length > 0 && !scheduleDays.includes(today)) {
        // Find next scheduled day
        let daysUntilNext = 1;
        for (let i = 1; i <= 7; i++) {
            const nextDay = (today + i) % 7;
            if (scheduleDays.includes(nextDay)) {
                daysUntilNext = i;
                break;
            }
        }

        // Calculate seconds until next scheduled day at start time
        const minutesToMidnight = 24 * 60 - currentMinutes;
        const startsInSeconds = (minutesToMidnight * 60) - currentSeconds +
            ((daysUntilNext - 1) * 24 * 60 * 60) +
            (startMinutes * 60);

        return {
            canStart: false,
            reason: `Not scheduled for today`,
            isScheduled: true,
            isActiveWindow: false,
            startsInSeconds
        };
    }

    // Before start time
    if (currentMinutes < startMinutes) {
        const startsInSeconds = ((startMinutes - currentMinutes) * 60) - currentSeconds;
        return {
            canStart: false,
            reason: `Starts at ${subTask.startTime}`,
            isScheduled: true,
            isActiveWindow: false,
            startsInSeconds
        };
    }

    // After end time
    if (currentMinutes > endMinutes) {
        // Calculate when it starts tomorrow
        const minutesToMidnight = 24 * 60 - currentMinutes;
        const startsInSeconds = (minutesToMidnight * 60) - currentSeconds + (startMinutes * 60);

        return {
            canStart: false,
            reason: `Schedule ended at ${subTask.endTime}`,
            isScheduled: true,
            isActiveWindow: false,
            startsInSeconds
        };
    }

    // Within active window
    const endsInSeconds = ((endMinutes - currentMinutes) * 60) - currentSeconds;

    return {
        canStart: true,
        isScheduled: true,
        isActiveWindow: true,
        endsInSeconds
    };
}

/**
 * Format seconds to countdown string (HH:MM:SS)
 */
export function formatCountdown(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
        .map(n => n.toString().padStart(2, '0'))
        .join(':');
}

/**
 * Get human-readable schedule status for UI
 */
export function getScheduleDisplayStatus(subTask: SubTaskSchedule, now: Date = new Date()): {
    status: 'locked' | 'active' | 'starting_soon' | 'ended' | 'no_schedule';
    label: string;
    countdown?: string;
} {
    const schedule = isWithinSchedule(subTask, now);

    if (!schedule.isScheduled) {
        return { status: 'no_schedule', label: 'No Schedule' };
    }

    if (schedule.isActiveWindow) {
        return {
            status: 'active',
            label: 'Active Now',
            countdown: schedule.endsInSeconds ? formatCountdown(schedule.endsInSeconds) : undefined
        };
    }

    if (schedule.startsInSeconds !== undefined) {
        // Starting within 30 minutes
        if (schedule.startsInSeconds <= 30 * 60) {
            return {
                status: 'starting_soon',
                label: `Starts in ${formatCountdown(schedule.startsInSeconds)}`,
                countdown: formatCountdown(schedule.startsInSeconds)
            };
        }

        return {
            status: 'locked',
            label: schedule.reason || 'Locked',
            countdown: formatCountdown(schedule.startsInSeconds)
        };
    }

    return { status: 'ended', label: 'Ended' };
}
