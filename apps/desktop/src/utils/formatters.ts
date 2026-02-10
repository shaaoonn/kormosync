// ============================================================
// KormoSync Desktop App - Formatter Utilities
// ============================================================

import { DAYS_BENGALI, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from './constants';
import type { ScheduleInfo, ScheduleStatus, SubTask, Task } from '../types';

/**
 * Format seconds to HH:MM:SS
 */
export const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / SECONDS_PER_HOUR);
    const m = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    const s = seconds % SECONDS_PER_MINUTE;

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * Format seconds to compact format (2ঘ 30মি)
 */
export const formatTimeCompact = (seconds: number): string => {
    const h = Math.floor(seconds / SECONDS_PER_HOUR);
    const m = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

    if (h > 0) {
        return `${h}ঘ ${m}মি`;
    }
    return `${m}মি`;
};

/**
 * Format time string (HH:MM) to readable format
 */
export const formatTimeString = (time: string): string => {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
};

/**
 * Parse time string to minutes from midnight
 */
export const parseTimeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

/**
 * Get current time in minutes from midnight
 */
export const getCurrentMinutes = (): number => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
};

/**
 * Format currency (BDT)
 */
export const formatCurrency = (amount: number): string => {
    return `৳${amount.toLocaleString('bn-BD')}`;
};

/**
 * Format date to Bengali locale
 */
export const formatDateBengali = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('bn-BD', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

/**
 * Format time to Bengali locale
 */
export const formatTimeBengali = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('bn-BD', {
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * Get day name in Bengali
 */
export const getDayName = (day: number): string => {
    return DAYS_BENGALI[day] || '';
};

/**
 * Calculate schedule status for a task/subtask
 */
export const getScheduleInfo = (
    item: Task | SubTask,
    now: Date = new Date()
): ScheduleInfo => {
    // No schedule restrictions
    if (!item.startTime || !item.endTime || !item.scheduleDays?.length) {
        return {
            status: 'no_schedule',
            message: 'যেকোনো সময় কাজ করা যাবে',
            canStart: true,
        };
    }

    const today = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = parseTimeToMinutes(item.startTime);
    const endMinutes = parseTimeToMinutes(item.endTime);

    // Check if today is a scheduled day
    if (!item.scheduleDays.includes(today)) {
        // Find next scheduled day
        const nextDay = findNextScheduledDay(item.scheduleDays, today);
        const daysUntil = (nextDay - today + 7) % 7 || 7;

        return {
            status: 'locked',
            message: `${DAYS_BENGALI[nextDay]} শুরু হবে`,
            canStart: false,
        };
    }

    // Today is scheduled - check time
    if (currentMinutes < startMinutes) {
        // Before start time
        const minutesUntil = startMinutes - currentMinutes;
        const timeUntilStart = minutesUntil * 60;

        if (minutesUntil <= 30) {
            return {
                status: 'starting_soon',
                message: `${minutesUntil} মিনিটে শুরু`,
                timeUntilStart,
                canStart: false,
            };
        }

        return {
            status: 'locked',
            message: `${formatTimeString(item.startTime)} এ শুরু`,
            timeUntilStart,
            canStart: false,
        };
    }

    if (currentMinutes > endMinutes) {
        // After end time — check overtime
        if (item.allowOvertime) {
            return {
                status: 'overtime',
                message: 'ওভারটাইম চলছে',
                canStart: true,
            };
        }
        return {
            status: 'ended',
            message: 'আজকের সময় শেষ',
            canStart: false,
        };
    }

    // Within scheduled time
    const minutesRemaining = endMinutes - currentMinutes;
    return {
        status: 'active',
        message: `${minutesRemaining} মিনিট বাকি`,
        timeUntilEnd: minutesRemaining * 60,
        canStart: true,
    };
};

/**
 * Find next scheduled day
 */
const findNextScheduledDay = (scheduleDays: number[], currentDay: number): number => {
    const sorted = [...scheduleDays].sort((a, b) => a - b);
    const next = sorted.find(d => d > currentDay);
    return next !== undefined ? next : sorted[0];
};

/**
 * Check if two time ranges overlap
 */
export const doTimesOverlap = (
    start1: string,
    end1: string,
    start2: string,
    end2: string
): boolean => {
    const s1 = parseTimeToMinutes(start1);
    const e1 = parseTimeToMinutes(end1);
    const s2 = parseTimeToMinutes(start2);
    const e2 = parseTimeToMinutes(end2);

    return s1 < e2 && e1 > s2;
};

/**
 * Check if two subtasks can run concurrently (same schedule day + overlapping times)
 */
export const canRunConcurrently = (subTask1: SubTask, subTask2: SubTask): boolean => {
    // Both must be SCHEDULED type
    if (subTask1.billingType !== 'SCHEDULED' || subTask2.billingType !== 'SCHEDULED') {
        return false;
    }

    // Must have time ranges
    if (!subTask1.startTime || !subTask1.endTime || !subTask2.startTime || !subTask2.endTime) {
        return false;
    }

    // Must have overlapping days
    const daysOverlap = subTask1.scheduleDays?.some(d => subTask2.scheduleDays?.includes(d));
    if (!daysOverlap) {
        return false;
    }

    // Must have overlapping times
    return doTimesOverlap(subTask1.startTime, subTask1.endTime, subTask2.startTime, subTask2.endTime);
};

/**
 * Calculate earnings from time worked
 */
export const calculateEarnings = (
    seconds: number,
    hourlyRate?: number,
    fixedPrice?: number
): number => {
    if (fixedPrice) {
        return fixedPrice;
    }
    if (hourlyRate) {
        const hours = seconds / SECONDS_PER_HOUR;
        return hours * hourlyRate;
    }
    return 0;
};

/**
 * Calculate progress percentage
 */
export const calculateProgress = (
    workedSeconds: number,
    estimatedHours?: number
): number => {
    if (!estimatedHours) return 0;
    const estimatedSeconds = estimatedHours * SECONDS_PER_HOUR;
    return Math.min(100, (workedSeconds / estimatedSeconds) * 100);
};

/**
 * Format relative time (e.g., "5 মিনিট আগে")
 */
export const formatRelativeTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSeconds < 60) return 'এইমাত্র';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} মিনিট আগে`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} ঘন্টা আগে`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)} দিন আগে`;

    return formatDateBengali(d);
};

/**
 * Generate unique ID
 */
export const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Alias for formatTime - Format seconds to HH:MM:SS
 */
export const formatDuration = formatTime;

/**
 * Format money with currency
 */
export const formatMoney = (amount: number, currency: string = 'BDT'): string => {
    if (currency === 'BDT') {
        return `৳${amount.toLocaleString('bn-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    if (currency === 'USD') {
        return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${amount.toLocaleString()} ${currency}`;
};
