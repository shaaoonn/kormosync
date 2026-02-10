// ============================================================
// KormoSync Desktop App - Schedule Checker Hook
// Monitors task schedules and enforces time restrictions
// ============================================================

import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getScheduleInfo } from '../utils/formatters';

// ============================================================
// Hook
// ============================================================
export const useScheduleChecker = () => {
    const {
        activeTimers,
        tasks,
        pauseTimer,
        addToast,
    } = useAppStore();
    const notifiedTimers = useRef<Set<string>>(new Set());

    // Check all active timers against their schedules
    const checkSchedules = useCallback(() => {
        const now = new Date();

        Object.values(activeTimers).forEach((timer) => {
            if (timer.isPaused) return;

            const task = tasks.find((t) => t.id === timer.taskId);
            const subTask = task?.subTasks?.find((st) => st.id === timer.subTaskId);

            if (!subTask) return;

            const scheduleInfo = getScheduleInfo(subTask, now);

            // If schedule ended (no overtime), pause the timer
            if (scheduleInfo.status === 'ended' || scheduleInfo.status === 'locked') {
                // Only notify once per timer
                if (!notifiedTimers.current.has(timer.subTaskId)) {
                    notifiedTimers.current.add(timer.subTaskId);

                    // Pause the timer
                    pauseTimer(timer.subTaskId);

                    // Show notification
                    addToast(
                        'warning',
                        `"${subTask.title}" এর সময়সূচী শেষ। টাইমার বিরতি দেওয়া হয়েছে।`,
                        5000
                    );

                    // Show system notification
                    if (Notification.permission === 'granted') {
                        new Notification('KormoSync - সময়সূচী শেষ', {
                            body: `"${subTask.title}" এর নির্ধারিত সময় শেষ হয়ে গেছে।`,
                            icon: '/icon.png',
                        });
                    }
                }
            } else if (scheduleInfo.status === 'overtime') {
                // Overtime allowed — warn but DON'T pause
                if (!notifiedTimers.current.has(timer.subTaskId)) {
                    notifiedTimers.current.add(timer.subTaskId);

                    addToast(
                        'info',
                        `"${subTask.title}" ওভারটাইমে চলছে। নির্ধারিত সময় শেষ হয়েছে।`,
                        5000
                    );

                    if (Notification.permission === 'granted') {
                        new Notification('KormoSync - ওভারটাইম', {
                            body: `"${subTask.title}" ওভারটাইম মোডে কাজ চলছে।`,
                            icon: '/icon.png',
                        });
                    }
                }
            } else if (scheduleInfo.status === 'active') {
                // Timer is within schedule, remove from notified set
                notifiedTimers.current.delete(timer.subTaskId);
            }
        });
    }, [activeTimers, tasks, pauseTimer, addToast]);

    // Check schedules every minute
    useEffect(() => {
        const interval = setInterval(checkSchedules, 60 * 1000);
        checkSchedules(); // Check immediately

        return () => clearInterval(interval);
    }, [checkSchedules]);

    // Also check when schedules are about to start
    useEffect(() => {
        const now = new Date();

        tasks.forEach((task) => {
            task.subTasks?.forEach((subTask) => {
                const scheduleInfo = getScheduleInfo(subTask, now);

                if (scheduleInfo.status === 'starting_soon' && scheduleInfo.timeUntilStart) {
                    // Set a timeout to notify when schedule starts
                    const timeout = setTimeout(() => {
                        addToast(
                            'info',
                            `"${subTask.title}" এর সময়সূচী শুরু হয়েছে!`,
                            5000
                        );

                        if (Notification.permission === 'granted') {
                            new Notification('KormoSync - সময়সূচী শুরু', {
                                body: `"${subTask.title}" এখন শুরু করতে পারেন।`,
                                icon: '/icon.png',
                            });
                        }
                    }, scheduleInfo.timeUntilStart * 1000);

                    return () => clearTimeout(timeout);
                }
            });
        });
    }, [tasks, addToast]);

    return null;
};

export default useScheduleChecker;
