// ============================================================
// KormoSync Desktop App - Idle Detection Hook
// Detects user inactivity and triggers alerts
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

// ============================================================
// Types
// ============================================================
interface UseIdleDetectionOptions {
    idleThreshold?: number; // Seconds before considered idle (default: 5 minutes)
    checkInterval?: number; // How often to check (default: 30 seconds)
    enabled?: boolean;
}

interface UseIdleDetectionResult {
    isIdle: boolean;
    idleSeconds: number;
    lastActivity: Date;
    resetIdle: () => void;
}

// ============================================================
// Hook
// ============================================================
export const useIdleDetection = (
    options: UseIdleDetectionOptions = {}
): UseIdleDetectionResult => {
    const {
        idleThreshold = 5 * 60, // 5 minutes
        checkInterval = 30, // 30 seconds
        enabled = true,
    } = options;

    const { activeTimers, settings } = useAppStore();
    const [isIdle, setIsIdle] = useState(false);
    const [idleSeconds, setIdleSeconds] = useState(0);
    const [lastActivity, setLastActivity] = useState(new Date());
    const lastActivityRef = useRef(new Date());

    // Check if there are any running timers
    const hasRunningTimers = Object.values(activeTimers).some(
        (timer) => !timer.isPaused
    );

    // Reset idle state
    const resetIdle = useCallback(() => {
        const now = new Date();
        lastActivityRef.current = now;
        setLastActivity(now);
        setIsIdle(false);
        setIdleSeconds(0);
    }, []);

    // Stable ref for resetIdle to avoid re-adding 9 listeners every tick
    const resetIdleRef = useRef(resetIdle);
    resetIdleRef.current = resetIdle;

    // Track user activity
    useEffect(() => {
        if (!enabled) return;

        const handleActivity = () => {
            resetIdleRef.current();
        };

        // Listen to various activity events
        const events = [
            'mousemove',
            'mousedown',
            'mouseup',
            'keydown',
            'keyup',
            'touchstart',
            'touchmove',
            'wheel',
            'scroll',
        ];

        events.forEach((event) => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [enabled]); // resetIdle removed from deps — uses ref instead

    // Check idle status periodically
    useEffect(() => {
        if (!enabled || !hasRunningTimers) {
            setIsIdle(false);
            setIdleSeconds(0);
            return;
        }

        const interval = setInterval(() => {
            const now = new Date();
            const secondsSinceActivity = Math.floor(
                (now.getTime() - lastActivityRef.current.getTime()) / 1000
            );

            setIdleSeconds(secondsSinceActivity);

            if (secondsSinceActivity >= idleThreshold) {
                setIsIdle(true);
            }
        }, checkInterval * 1000);

        return () => clearInterval(interval);
    }, [enabled, hasRunningTimers, idleThreshold, checkInterval]);

    // Also check with Electron's native idle detection
    useEffect(() => {
        if (!enabled || !hasRunningTimers) return;

        const checkSystemIdle = async () => {
            try {
                const systemIdleTime = await window.electron?.getIdleTime?.();
                if (systemIdleTime && systemIdleTime >= idleThreshold) {
                    setIsIdle(true);
                    setIdleSeconds(systemIdleTime);
                }
            } catch (error) {
                // Ignore errors
            }
        };

        const interval = setInterval(checkSystemIdle, checkInterval * 1000);
        checkSystemIdle();

        return () => clearInterval(interval);
    }, [enabled, hasRunningTimers, idleThreshold, checkInterval]);

    return {
        isIdle,
        idleSeconds,
        lastActivity,
        resetIdle,
    };
};

export default useIdleDetection;
