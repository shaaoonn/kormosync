// ============================================================
// KormoSync Desktop App - Zustand Store
// Multiple Concurrent Timer Support
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
    User,
    Task,
    SubTask,
    Toast,
    TodayStats,
    AppSettings,
    NavItem,
    ActivityStats,
} from '../types';
import { generateId, getScheduleInfo } from '../utils/formatters';
import { DEFAULT_SETTINGS } from '../utils/constants';
import { cacheTasks, getCachedTasks, clearTaskCache } from '../utils/taskCache';
import { addLocalHistoryEntry, clearHistoryCache } from '../utils/historyCache';

// Screenshot concurrency guard — prevent overlapping uploads
let screenshotInProgress = false;

// ============================================================
// API Health Tracker — prevents death spiral when API is down
// When API fails repeatedly, skip non-critical calls (heartbeat,
// activity logging, screenshot upload) to avoid request storm
// ============================================================
let lastApiSuccess = Date.now();
let consecutiveApiFailures = 0;
let screenshotConsecutiveFails = 0;
const MAX_SCREENSHOT_FAILS = 3;        // After 3 fails, pause screenshots for cooldown
const SCREENSHOT_COOLDOWN_MS = 600000; // 10 minute cooldown after max failures
let screenshotCooldownUntil = 0;

function markApiSuccess() {
    lastApiSuccess = Date.now();
    consecutiveApiFailures = 0;
    screenshotConsecutiveFails = 0; // Reset screenshot failures on any API success
}

function markApiFailure() {
    consecutiveApiFailures++;
    // Start recovery probe when API transitions to unhealthy
    if (!isApiHealthy()) {
        startRecoveryProbe();
    }
}

/** Returns true if API has been responding recently (< 5 failures, < 2 min since last success) */
function isApiHealthy(): boolean {
    return consecutiveApiFailures < 5 && (Date.now() - lastApiSuccess) < 120000;
}

// ============================================================
// Recovery Probe — breaks the deadlock when API is marked unhealthy
// Problem: heartbeat is skipped when unhealthy → markApiSuccess() never called → stuck
// Solution: lightweight GET / probe every 30s when unhealthy to detect API recovery
// ============================================================
let recoveryProbeRunning = false;
let recoveryProbeInterval: ReturnType<typeof setInterval> | null = null;

function startRecoveryProbe() {
    if (recoveryProbeInterval) return; // Already running
    console.log('🔍 Starting API recovery probe (every 30s)...');
    recoveryProbeInterval = setInterval(async () => {
        if (isApiHealthy()) {
            // API recovered — stop probing
            stopRecoveryProbe();
            return;
        }
        if (recoveryProbeRunning) return; // Skip if previous probe still in-flight
        recoveryProbeRunning = true;
        try {
            // Lightweight check — API root "/" has no DB queries, no auth
            const response = await fetch('http://localhost:8001/', {
                method: 'GET',
                signal: AbortSignal.timeout(5000), // 5s timeout
            });
            if (response.ok) {
                console.log('✅ API recovery probe succeeded — marking API healthy');
                markApiSuccess();
                stopRecoveryProbe();
                // Flush any queued screenshots now that API is back
                import('../utils/offlineQueue').then(m => m.flushQueue().then(count => {
                    if (count > 0) console.log(`📤 Flushed ${count} queued screenshots after API recovery`);
                })).catch(() => {});
            }
        } catch {
            // API still down — continue probing
            console.log('⏳ API recovery probe failed — still unhealthy');
        } finally {
            recoveryProbeRunning = false;
        }
    }, 30000); // Every 30 seconds
}

function stopRecoveryProbe() {
    if (recoveryProbeInterval) {
        clearInterval(recoveryProbeInterval);
        recoveryProbeInterval = null;
        console.log('🔍 Recovery probe stopped — API is healthy');
    }
}

// Pre-import API module once instead of dynamic import every 30 seconds
let _apiModule: typeof import('../services/api') | null = null;
async function getApiModule() {
    if (!_apiModule) _apiModule = await import('../services/api');
    return _apiModule;
}

// ============================================================
// Active Timer Interface (per sub-task)
// ============================================================
interface ActiveTimer {
    subTaskId: string;
    taskId: string;
    taskTitle: string;
    subTaskTitle: string;
    startedAt: number;          // Unix timestamp when started
    accumulatedSeconds: number; // Time already accumulated before this session
    elapsedSeconds: number;     // Current total elapsed (for UI display)
    isPaused: boolean;
    hourlyRate?: number;
    screenshotInterval?: number;
    monitoringMode: 'TRANSPARENT' | 'STEALTH';
    lastScreenshotElapsed: number;
    screenshotEnabled: boolean;
    activityEnabled: boolean;
}

// Export for use in components
export type { ActiveTimer };

// ============================================================
// Store State Interface
// ============================================================
interface AppState {
    // User
    user: User | null;
    isAuthenticated: boolean;

    // Navigation
    currentNav: NavItem;
    currentView: 'dashboard' | 'playlist' | 'settings';
    selectedTaskId: string | null;
    selectedTask: Task | null;

    // Tasks
    tasks: Task[];
    tasksLoading: boolean;
    isLoading: boolean;

    // Active Timers (multiple concurrent support)
    activeTimers: Record<string, ActiveTimer>; // subTaskId -> timer
    tickCounter: number; // Forces re-render on tick

    // Today Stats
    todayStats: TodayStats;

    // Activity (from Electron)
    activityStats: ActivityStats;

    // UI State
    toasts: Toast[];
    isWidgetMode: boolean;
    isMiniWidgetVisible: boolean;
    showProofOfWork: boolean;
    proofOfWorkSubTaskId: string | null;
    showIdleWarning: boolean;
    idleCountdown: number;

    // Offline Support
    isOffline: boolean;
    pendingSyncCount: number;
    setIsOffline: (offline: boolean) => void;
    setPendingSyncCount: (count: number) => void;

    // Settings
    settings: AppSettings;

    // Actions - User
    setUser: (user: User | null) => void;
    logout: () => void;

    // Actions - Navigation
    setCurrentNav: (nav: NavItem) => void;
    setCurrentView: (view: 'dashboard' | 'playlist' | 'settings') => void;
    selectTask: (taskId: string | null) => void;
    setSelectedTask: (task: Task | null) => void;

    // Actions - Tasks
    setTasks: (tasks: Task[]) => void;
    setTasksLoading: (loading: boolean) => void;
    fetchTasks: () => Promise<void>;
    updateSubTaskStatus: (subTaskId: string, status: SubTask['status']) => void;
    updateSubTaskTime: (subTaskId: string, seconds: number) => void;

    // Actions - Timers (MULTI-CONCURRENT)
    startTimer: (subTask: SubTask, task: Task) => void;
    pauseTimer: (subTaskId: string) => void;
    resumeTimer: (subTaskId: string) => void;
    stopTimer: (subTaskId: string) => void;
    stopAllTimers: () => void;
    tick: () => void; // Called every second

    // Actions - Stats
    setTodayStats: (stats: TodayStats) => void;
    setActivityStats: (stats: ActivityStats) => void;

    // Actions - Toasts
    addToast: (type: Toast['type'], message: string, duration?: number) => void;
    removeToast: (id: string) => void;

    // Actions - Widget
    setWidgetMode: (isWidget: boolean) => void;
    setMiniWidgetVisible: (visible: boolean) => void;

    // Actions - Proof of Work
    showProofOfWorkModal: (subTaskId: string) => void;
    hideProofOfWorkModal: () => void;

    // Actions - Idle
    showIdleWarningModal: () => void;
    hideIdleWarningModal: () => void;
    setIdleCountdown: (seconds: number) => void;

    // Actions - Settings
    updateSettings: (settings: Partial<AppSettings>) => void;

    // Computed/Helpers
    getActiveTimer: (subTaskId: string) => ActiveTimer | undefined;
    getActiveTimersForTask: (taskId: string) => ActiveTimer[];
    getAllActiveTimers: () => ActiveTimer[];
    getTotalActiveSeconds: () => number;
    isSubTaskActive: (subTaskId: string) => boolean;
    getElapsedSeconds: (subTaskId: string) => number;
}

// ============================================================
// Store Implementation
// ============================================================
export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            // Initial State
            user: null,
            isAuthenticated: false,
            currentNav: 'home',
            currentView: 'dashboard',
            selectedTaskId: null,
            selectedTask: null,
            tasks: [],
            tasksLoading: false,
            isLoading: false,
            activeTimers: {},
            tickCounter: 0,
            todayStats: {
                totalSeconds: 0,
                totalKeystrokes: 0,
                totalMouseClicks: 0,
                averageActivity: 0,
                sessionsCount: 0,
            },
            activityStats: { keystrokes: 0, mouseClicks: 0 },
            toasts: [],
            isWidgetMode: false,
            isMiniWidgetVisible: false,
            showProofOfWork: false,
            proofOfWorkSubTaskId: null,
            showIdleWarning: false,
            idleCountdown: 30,
            isOffline: false,
            pendingSyncCount: 0,
            settings: DEFAULT_SETTINGS as AppSettings,

            // ============================================================
            // User Actions
            // ============================================================
            setUser: (user) => set({ user, isAuthenticated: !!user }),

            logout: () => {
                get().stopAllTimers();
                clearTaskCache().catch(() => {}); // Clear offline cache on logout
                clearHistoryCache().catch(() => {}); // Clear history cache on logout
                set({
                    user: null,
                    isAuthenticated: false,
                    tasks: [],
                    activeTimers: {},
                    selectedTaskId: null,
                    isOffline: false,
                    pendingSyncCount: 0,
                });
            },

            // ============================================================
            // Navigation Actions
            // ============================================================
            setCurrentNav: (nav) => set({ currentNav: nav }),

            setCurrentView: (view) => set({ currentView: view }),

            selectTask: (taskId) => set({ selectedTaskId: taskId }),

            setSelectedTask: (task) => set({ selectedTask: task, selectedTaskId: task?.id || null }),

            // ============================================================
            // Task Actions
            // ============================================================
            setTasks: (tasks) => set({ tasks }),

            setTasksLoading: (loading) => set({ tasksLoading: loading, isLoading: loading }),

            fetchTasks: async () => {
                set({ isLoading: true, tasksLoading: true });

                // STEP 1: Instantly load from IndexedDB cache → show UI immediately
                try {
                    const cached = await getCachedTasks();
                    if (cached && cached.tasks.length > 0) {
                        set({ tasks: cached.tasks, isLoading: false, tasksLoading: false });
                        console.log(`📦 Showing ${cached.tasks.length} cached tasks instantly (from ${cached.cachedAt})`);
                    }
                } catch (e) {
                    console.warn('Cache read failed:', e);
                }

                // STEP 2: If offline, skip API completely
                if (!navigator.onLine) {
                    set({ isOffline: true, isLoading: false, tasksLoading: false });
                    if (get().tasks.length === 0) {
                        get().addToast('error', 'অফলাইন — কোনো ক্যাশড টাস্ক নেই');
                    }
                    return;
                }

                // STEP 3: Try API in background (2 attempts, 2s gap)
                const maxRetries = 2;
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        const { api } = await import('../services/api');
                        const response = await api.get('/tasks/list');
                        if (response.data.success) {
                            const tasks = response.data.tasks || [];
                            set({ tasks, isLoading: false, tasksLoading: false });
                            // Update IndexedDB cache with fresh data
                            cacheTasks(tasks).catch(() => {});
                            console.log(`✅ Tasks refreshed from API: ${tasks.length} tasks`);
                        }
                        return; // Success
                    } catch (error: any) {
                        console.error(`Failed to fetch tasks (attempt ${attempt + 1}/${maxRetries}):`, error?.message);
                        if (attempt < maxRetries - 1) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    }
                }

                // STEP 4: API failed — cache already shown above. Don't set isOffline here!
                // isOffline is ONLY controlled by navigator.onLine via App.tsx event listeners.
                // API being slow/down ≠ offline — it's a server-side issue.
                set({ isLoading: false, tasksLoading: false });
                if (get().tasks.length === 0) {
                    get().addToast('error', 'টাস্ক লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
                }
            },

            updateSubTaskStatus: (subTaskId, status) => {
                set((state) => ({
                    tasks: state.tasks.map((task) => ({
                        ...task,
                        subTasks: task.subTasks?.map((st) =>
                            st.id === subTaskId ? { ...st, status } : st
                        ),
                    })),
                }));
            },

            updateSubTaskTime: (subTaskId, seconds) => {
                set((state) => ({
                    tasks: state.tasks.map((task) => ({
                        ...task,
                        subTasks: task.subTasks?.map((st) =>
                            st.id === subTaskId ? { ...st, totalSeconds: seconds } : st
                        ),
                    })),
                }));
            },

            // ============================================================
            // Timer Actions - MULTIPLE CONCURRENT SUPPORT
            // ============================================================
            startTimer: (subTask, task) => {
                const { activeTimers } = get();

                // Check if task is deactivated by admin
                if (task.isActive === false) {
                    get().addToast('error', 'এই টাস্ক এডমিন দ্বারা বন্ধ করা হয়েছে');
                    return;
                }

                // Pre-start schedule validation
                const scheduleInfo = getScheduleInfo(subTask, new Date());
                if (!scheduleInfo.canStart) {
                    if (scheduleInfo.status === 'ended') {
                        get().addToast('error', `"${subTask.title}" এর সময়সূচী শেষ। ওভারটাইম অনুমোদিত নয়।`, 5000);
                    } else if (scheduleInfo.status === 'locked') {
                        get().addToast('error', `"${subTask.title}" এর সময়সূচী এখনও শুরু হয়নি। ${scheduleInfo.message}`, 5000);
                    } else if (scheduleInfo.status === 'starting_soon') {
                        get().addToast('warning', `"${subTask.title}" শীঘ্রই শুরু হবে। ${scheduleInfo.message}`, 5000);
                    }
                    return;
                }

                // Check if already running
                if (activeTimers[subTask.id] && !activeTimers[subTask.id].isPaused) {
                    console.log(`Timer already running for ${subTask.id}`);
                    return;
                }

                const initialSeconds = subTask.totalSeconds || subTask.trackedTime || 0;
                // Use task-specific interval, fallback to global settings, default 10
                const screenshotInterval = task.screenshotInterval || get().settings.screenshotInterval || 10;

                const newTimer: ActiveTimer = {
                    subTaskId: subTask.id,
                    taskId: task.id,
                    taskTitle: task.title,
                    subTaskTitle: subTask.title,
                    startedAt: Date.now(),
                    accumulatedSeconds: initialSeconds,
                    elapsedSeconds: initialSeconds,
                    isPaused: false,
                    hourlyRate: subTask.hourlyRate || task.hourlyRate,
                    screenshotInterval,
                    monitoringMode: task.monitoringMode || 'TRANSPARENT',
                    lastScreenshotElapsed: initialSeconds,
                    screenshotEnabled: task.screenshotEnabled !== false,  // default true
                    activityEnabled: task.activityEnabled !== false,       // default true
                };

                set((state) => ({
                    activeTimers: {
                        ...state.activeTimers,
                        [subTask.id]: newTimer,
                    },
                }));

                // Notify Electron
                window.electron?.trackingStarted?.({
                    taskId: task.id,
                    subTaskId: subTask.id,
                    taskName: `${task.title} - ${subTask.title}`,
                    endTime: subTask.endTime,
                    monitoringMode: task.monitoringMode || 'TRANSPARENT',
                });

                get().addToast('success', `${subTask.title} শুরু হয়েছে`);
            },

            pauseTimer: (subTaskId) => {
                const timer = get().activeTimers[subTaskId];
                if (!timer || timer.isPaused) return;

                // Calculate elapsed and add to accumulated
                const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
                const totalSeconds = timer.accumulatedSeconds + elapsed;

                set((state) => ({
                    activeTimers: {
                        ...state.activeTimers,
                        [subTaskId]: {
                            ...timer,
                            isPaused: true,
                            accumulatedSeconds: totalSeconds,
                            elapsedSeconds: totalSeconds,
                            startedAt: Date.now(), // Reset for resume
                        },
                    },
                }));

                get().updateSubTaskTime(subTaskId, totalSeconds);
            },

            resumeTimer: (subTaskId) => {
                const timer = get().activeTimers[subTaskId];
                if (!timer || !timer.isPaused) return;

                set((state) => ({
                    activeTimers: {
                        ...state.activeTimers,
                        [subTaskId]: {
                            ...timer,
                            isPaused: false,
                            startedAt: Date.now(),
                        },
                    },
                }));
            },

            stopTimer: (subTaskId) => {
                const timer = get().activeTimers[subTaskId];
                if (!timer) return;

                // Calculate final time
                let totalSeconds = timer.accumulatedSeconds;
                if (!timer.isPaused) {
                    const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
                    totalSeconds += elapsed;
                }

                // Update subtask time
                get().updateSubTaskTime(subTaskId, totalSeconds);

                // Remove from active timers
                set((state) => {
                    const newTimers = { ...state.activeTimers };
                    delete newTimers[subTaskId];
                    return { activeTimers: newTimers };
                });

                // Notify Electron if no more active timers
                if (Object.keys(get().activeTimers).length === 0) {
                    window.electron?.trackingStopped?.();
                }
            },

            stopAllTimers: () => {
                const { activeTimers } = get();
                Object.keys(activeTimers).forEach((subTaskId) => {
                    get().stopTimer(subTaskId);
                });
                window.electron?.trackingStopped?.();
            },

            tick: () => {
                // Called every second — MUST be lightweight to avoid memory bloat
                const { activeTimers, settings } = get();
                const timerKeys = Object.keys(activeTimers);

                // Fast path: no active timers — skip everything
                if (timerKeys.length === 0) {
                    set((state) => ({ tickCounter: state.tickCounter + 1 }));
                    return;
                }

                const now = Date.now();
                let hasChanges = false;
                const timersToScreenshot: ActiveTimer[] = [];

                // MUTATE in-place instead of creating new objects every second
                // This is safe because Zustand only triggers re-renders on set()
                for (const id of timerKeys) {
                    const timer = activeTimers[id];

                    // Migration guard
                    if (typeof timer.lastScreenshotElapsed === 'undefined') {
                        timer.lastScreenshotElapsed = timer.elapsedSeconds;
                    }

                    if (!timer.isPaused) {
                        const newElapsed = timer.accumulatedSeconds + Math.floor((now - timer.startedAt) / 1000);
                        if (newElapsed !== timer.elapsedSeconds) {
                            timer.elapsedSeconds = newElapsed;
                            hasChanges = true;
                        }

                        // Screenshot check
                        if (timer.screenshotEnabled !== false) {
                            const intervalSeconds = (timer.screenshotInterval || settings.screenshotInterval || 10) * 60;
                            if (newElapsed - timer.lastScreenshotElapsed >= intervalSeconds) {
                                timer.lastScreenshotElapsed = newElapsed;
                                timersToScreenshot.push(timer);
                            }
                        }
                    }
                }

                // Only trigger re-render if elapsed times actually changed
                // Use modular tickCounter to prevent unbounded growth
                set((state) => ({
                    tickCounter: (state.tickCounter + 1) % 1_000_000,
                    // Spread ONLY when there are changes — avoids new object allocation on idle ticks
                    ...(hasChanges ? { activeTimers: { ...activeTimers } } : {}),
                }));

                // Notify Electron with total time
                const totalSeconds = get().getTotalActiveSeconds();
                window.electron?.trackingTick?.(totalSeconds);

                const currentTickCount = get().tickCounter;

                // ============================================================
                // Heartbeat — send current app info every 30 seconds
                // SKIP when API is unhealthy to prevent request storm
                // ============================================================
                if (currentTickCount % 30 === 0 && navigator.onLine && isApiHealthy()) {
                    (async () => {
                        try {
                            const firstTimer = Object.values(activeTimers)[0];
                            if (!firstTimer) return;
                            const currentApp = await window.electron?.getCurrentApp?.();
                            const { api, screenshotApi } = await getApiModule();
                            const res = await api.post('/activity/heartbeat', {
                                taskId: firstTimer.taskId,
                                subTaskId: firstTimer.subTaskId,
                                taskTitle: `${firstTimer.taskTitle} - ${firstTimer.subTaskTitle}`,
                                currentApp: currentApp?.appName || '',
                                currentWindow: currentApp?.windowTitle || '',
                                elapsedSeconds: totalSeconds,
                            }, { timeout: 10000 }); // 10s timeout (was 15s) — heartbeat is non-critical

                            markApiSuccess(); // Track API health

                            // Remote capture request from admin
                            if (res.data?.captureNow) {
                                try {
                                    const rawBase64 = await window.electron?.captureScreenshot?.();
                                    if (rawBase64) {
                                        const binaryStr = atob(rawBase64);
                                        const bytes = new Uint8Array(binaryStr.length);
                                        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
                                        const blob = new Blob([bytes], { type: 'image/jpeg' });
                                        const formData = new FormData();
                                        formData.append('screenshot', blob, `remote_${Date.now()}.jpg`);
                                        formData.append('taskId', res.data.captureTaskId || firstTimer.taskId);
                                        formData.append('subTaskId', firstTimer.subTaskId || '');
                                        formData.append('activityScore', '0');
                                        formData.append('keyboardCount', '0');
                                        formData.append('mouseCount', '0');
                                        await screenshotApi.upload(formData);
                                    }
                                } catch (captureErr) {
                                    console.error('Remote capture failed:', captureErr);
                                }
                            }
                        } catch {
                            markApiFailure(); // Track API health — skip heartbeats when unhealthy
                        }
                    })();
                }

                // ============================================================
                // Independent Activity Logging — every 5 minutes (300 ticks)
                // SKIP when API is unhealthy
                // ============================================================
                if (currentTickCount > 0 && currentTickCount % 300 === 0 && isApiHealthy()) {
                    const anyActivityEnabled = Object.values(activeTimers).some(t => t.activityEnabled !== false);
                    if (anyActivityEnabled) {
                        (async () => {
                            try {
                                const activityStats = await window.electron?.getActivityStats?.();
                                if (activityStats && (activityStats.keystrokes > 0 || activityStats.mouseClicks > 0)) {
                                    const { activityApi } = await getApiModule();
                                    for (const timer of Object.values(activeTimers)) {
                                        if (!timer.isPaused && timer.activityEnabled !== false) {
                                            await activityApi.logActivity({
                                                taskId: timer.taskId,
                                                subTaskId: timer.subTaskId,
                                                intervalStart: new Date(Date.now() - 300000),
                                                intervalEnd: new Date(),
                                                keystrokes: activityStats.keystrokes,
                                                mouseClicks: activityStats.mouseClicks,
                                                mouseMovement: 0,
                                                activeSeconds: 300,
                                            }).catch(() => {});
                                        }
                                    }
                                }
                            } catch {
                                // Non-critical
                            }
                        })();
                    }
                }

                // ============================================================
                // Execute Screenshots — sequential, with concurrency guard
                // + Circuit breaker: skip uploads after repeated failures
                // + API health check: skip when API is unresponsive
                // ============================================================
                if (timersToScreenshot.length > 0 && screenshotInProgress) {
                    console.warn('Screenshot still in progress, skipping this interval');
                    return; // Early return — don't pile up
                }
                if (timersToScreenshot.length === 0) return;

                // Determine if we should queue screenshots locally instead of uploading
                // (API unhealthy or circuit breaker cooldown — but STILL capture screenshots!)
                let shouldQueueOffline = false;

                if (screenshotCooldownUntil > Date.now()) {
                    console.warn(`⏸️ API cooldown active — screenshots will be saved locally`);
                    shouldQueueOffline = true;
                }

                if (!shouldQueueOffline && !isApiHealthy() && navigator.onLine) {
                    console.warn('⏸️ API unhealthy — screenshots will be saved locally');
                    shouldQueueOffline = true;
                }

                screenshotInProgress = true;

                // Process ONE screenshot at a time (sequential, not parallel)
                (async () => {
                    try {
                        for (const timer of timersToScreenshot) {
                            if (!window.electron) break;

                            let rawBase64: string | null = null;
                            try {
                                rawBase64 = await window.electron.captureScreenshot();
                            } catch (captureErr) {
                                console.error('Screenshot capture failed:', captureErr);
                                continue;
                            }
                            if (!rawBase64) continue;

                            // Direct Base64 → Blob (no intermediate data URI fetch)
                            const binaryStr = atob(rawBase64);
                            rawBase64 = null; // Free base64 string for GC immediately
                            const bytes = new Uint8Array(binaryStr.length);
                            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
                            const blob = new Blob([bytes], { type: 'image/jpeg' });
                            const capturedAt = new Date().toISOString();

                            // Get activity stats
                            const activityStats = await window.electron.getActivityStats?.() || { keystrokes: 0, mouseClicks: 0 };

                            // Inactivity warning
                            if (activityStats.keystrokes === 0 && activityStats.mouseClicks === 0 && timer.monitoringMode === 'TRANSPARENT') {
                                const intervalMins = timer.screenshotInterval || settings.screenshotInterval || 10;
                                get().addToast('warning', `সতর্কতা: গত ${intervalMins} মিনিটে কোনো কার্যকলাপ পাওয়া যায়নি।`, 8000);
                            }

                            // Offline queue (also used when API unhealthy/cooldown — always capture!)
                            if (!navigator.onLine || shouldQueueOffline) {
                                const { enqueueScreenshot } = await import('../utils/offlineQueue');
                                const offlineDeviceId = await window.electron.getDeviceId?.().catch(() => undefined);
                                await enqueueScreenshot({
                                    taskId: timer.taskId,
                                    subTaskId: timer.subTaskId,
                                    deviceId: offlineDeviceId,
                                    keystrokes: activityStats.keystrokes || 0,
                                    mouseClicks: activityStats.mouseClicks || 0,
                                    activeSeconds: 300,
                                    capturedAt,
                                    imageBlob: blob,
                                });
                                // Add to local history cache (offline — pending sync)
                                const intervalSecsOffline = (timer.screenshotInterval || settings.screenshotInterval || 10) * 60;
                                addLocalHistoryEntry(capturedAt.split('T')[0], {
                                    id: `local-${Date.now()}`,
                                    recordedAt: capturedAt,
                                    activityScore: Math.min(100, Math.round(((activityStats.keystrokes || 0) + (activityStats.mouseClicks || 0)) / 3)),
                                    keyboardCount: activityStats.keystrokes || 0,
                                    mouseCount: activityStats.mouseClicks || 0,
                                    duration: intervalSecsOffline,
                                    taskId: timer.taskId,
                                    synced: false,
                                }).catch(() => {});
                                await window.electron.resetActivityStats?.();
                                if (timer.monitoringMode === 'TRANSPARENT') {
                                    get().addToast('info', shouldQueueOffline ? 'স্ক্রিনশট লোকালি সেভ হয়েছে — API পুনরুদ্ধার হলে আপলোড হবে' : 'Offline - screenshot saved locally');
                                }
                                continue;
                            }

                            // Online upload
                            try {
                                const formData = new FormData();
                                formData.append('screenshot', new File([blob], `ss-${Date.now()}.jpg`, { type: 'image/jpeg' }));
                                formData.append('taskId', timer.taskId);
                                formData.append('subTaskId', timer.subTaskId);
                                formData.append('keystrokes', String(activityStats.keystrokes || 0));
                                formData.append('mouseClicks', String(activityStats.mouseClicks || 0));
                                formData.append('capturedAt', capturedAt);
                                // Hardware fingerprint — detect multi-device usage
                                const deviceId = await window.electron.getDeviceId?.().catch(() => null);
                                if (deviceId) formData.append('deviceId', deviceId);

                                const { screenshotApi, api } = await getApiModule();
                                await screenshotApi.upload(formData);
                                await window.electron.resetActivityStats?.();

                                // Screenshot upload success — reset failure counters
                                markApiSuccess();
                                screenshotConsecutiveFails = 0;

                                // Trigger earnings refresh on Dashboard (cache invalidated server-side)
                                window.dispatchEvent(new CustomEvent('earnings-update'));

                                // Add to local history cache (online — synced)
                                const intervalSecsOnline = (timer.screenshotInterval || settings.screenshotInterval || 10) * 60;
                                addLocalHistoryEntry(capturedAt.split('T')[0], {
                                    id: `local-${Date.now()}`,
                                    recordedAt: capturedAt,
                                    activityScore: Math.min(100, Math.round(((activityStats.keystrokes || 0) + (activityStats.mouseClicks || 0)) / 3)),
                                    keyboardCount: activityStats.keystrokes || 0,
                                    mouseCount: activityStats.mouseClicks || 0,
                                    duration: intervalSecsOnline,
                                    taskId: timer.taskId,
                                    synced: true,
                                }).catch(() => {});

                                // App usage flush
                                try {
                                    const appUsageEntries = await window.electron.getAppUsage?.();
                                    if (appUsageEntries && appUsageEntries.length > 0) {
                                        await api.post('/app-usage/log', {
                                            entries: appUsageEntries.map((e: any) => ({
                                                taskId: timer.taskId,
                                                appName: e.appName,
                                                windowTitle: e.windowTitle,
                                                durationSec: e.durationSec,
                                                recordedAt: new Date().toISOString(),
                                            })),
                                        });
                                    }
                                } catch { /* non-critical */ }

                                if (timer.monitoringMode === 'TRANSPARENT') {
                                    get().addToast('success', 'স্ক্রিনশট আপলোড হয়েছে');
                                }
                            } catch (err: any) {
                                if (err?.response?.data?.quotaExceeded) {
                                    get().addToast('warning', 'স্টোরেজ সীমা ছাড়িয়ে গেছে।');
                                    break; // Stop all screenshots
                                }

                                // Circuit breaker: track consecutive failures
                                screenshotConsecutiveFails++;
                                markApiFailure();

                                console.error('Screenshot upload failed:', err?.message || err);

                                // Save failed upload to offline queue for retry later
                                // Screenshot is NEVER lost — always saved locally
                                try {
                                    const { enqueueScreenshot } = await import('../utils/offlineQueue');
                                    const failedDeviceId = await window.electron.getDeviceId?.().catch(() => undefined);
                                    await enqueueScreenshot({
                                        taskId: timer.taskId,
                                        subTaskId: timer.subTaskId,
                                        deviceId: failedDeviceId,
                                        keystrokes: activityStats.keystrokes || 0,
                                        mouseClicks: activityStats.mouseClicks || 0,
                                        activeSeconds: 300,
                                        capturedAt,
                                        imageBlob: blob,
                                    });
                                    const intervalSecsFailed = (timer.screenshotInterval || settings.screenshotInterval || 10) * 60;
                                    addLocalHistoryEntry(capturedAt.split('T')[0], {
                                        id: `local-${Date.now()}`,
                                        recordedAt: capturedAt,
                                        activityScore: Math.min(100, Math.round(((activityStats.keystrokes || 0) + (activityStats.mouseClicks || 0)) / 3)),
                                        keyboardCount: activityStats.keystrokes || 0,
                                        mouseCount: activityStats.mouseClicks || 0,
                                        duration: intervalSecsFailed,
                                        taskId: timer.taskId,
                                        synced: false,
                                    }).catch(() => {});
                                    console.log('📋 Failed upload saved to offline queue — will retry when API recovers');
                                } catch { /* queue save failed — non-critical */ }

                                if (screenshotConsecutiveFails >= MAX_SCREENSHOT_FAILS) {
                                    screenshotCooldownUntil = Date.now() + SCREENSHOT_COOLDOWN_MS;
                                    console.warn(`⛔ Screenshot upload paused for 10 min — screenshots will continue saving locally`);
                                    get().addToast('warning', 'আপলোড ব্যর্থ — স্ক্রিনশট লোকালি সেভ হচ্ছে, API পুনরুদ্ধার হলে আপলোড হবে');
                                    break; // Stop trying remaining screenshots this cycle
                                }

                                await window.electron.resetActivityStats?.().catch(() => {});
                            }
                        }
                    } finally {
                        screenshotInProgress = false;
                    }
                })();
            },

            // ============================================================
            // Stats Actions
            // ============================================================
            setTodayStats: (stats) => set({ todayStats: stats }),

            setActivityStats: (stats) => set({ activityStats: stats }),

            // ============================================================
            // Toast Actions
            // ============================================================
            addToast: (type, message, duration = 3000) => {
                const id = generateId();
                set((state) => ({
                    toasts: [...state.toasts, { id, type, message, duration }],
                }));

                // Auto remove
                setTimeout(() => {
                    get().removeToast(id);
                }, duration);
            },

            removeToast: (id) => {
                set((state) => ({
                    toasts: state.toasts.filter((t) => t.id !== id),
                }));
            },

            // ============================================================
            // Widget Actions
            // ============================================================
            setWidgetMode: (isWidget) => set({ isWidgetMode: isWidget }),

            setMiniWidgetVisible: (visible) => set({ isMiniWidgetVisible: visible }),

            // ============================================================
            // Proof of Work Actions
            // ============================================================
            showProofOfWorkModal: (subTaskId) =>
                set({ showProofOfWork: true, proofOfWorkSubTaskId: subTaskId }),

            hideProofOfWorkModal: () =>
                set({ showProofOfWork: false, proofOfWorkSubTaskId: null }),

            // ============================================================
            // Idle Actions
            // ============================================================
            showIdleWarningModal: () => set({ showIdleWarning: true, idleCountdown: 30 }),

            hideIdleWarningModal: () => set({ showIdleWarning: false }),

            setIdleCountdown: (seconds) => set({ idleCountdown: seconds }),

            // Offline Support
            setIsOffline: (offline) => set({ isOffline: offline }),
            setPendingSyncCount: (count) => set({ pendingSyncCount: count }),

            // ============================================================
            // Settings Actions
            // ============================================================
            updateSettings: (newSettings) =>
                set((state) => ({
                    settings: { ...state.settings, ...newSettings },
                })),

            // ============================================================
            // Computed Helpers
            // ============================================================
            getActiveTimer: (subTaskId) => get().activeTimers[subTaskId],

            getActiveTimersForTask: (taskId) =>
                Object.values(get().activeTimers).filter((t) => t.taskId === taskId),

            getAllActiveTimers: () => Object.values(get().activeTimers),

            getTotalActiveSeconds: () => {
                const { activeTimers } = get();
                let total = 0;

                Object.values(activeTimers).forEach((timer) => {
                    total += timer.accumulatedSeconds;
                    if (!timer.isPaused) {
                        total += Math.floor((Date.now() - timer.startedAt) / 1000);
                    }
                });

                return total;
            },

            isSubTaskActive: (subTaskId) => {
                const timer = get().activeTimers[subTaskId];
                return !!timer && !timer.isPaused;
            },

            getElapsedSeconds: (subTaskId) => {
                const timer = get().activeTimers[subTaskId];
                if (!timer) return 0;

                let total = timer.accumulatedSeconds;
                if (!timer.isPaused) {
                    total += Math.floor((Date.now() - timer.startedAt) / 1000);
                }
                return total;
            },
        }),
        {
            name: 'kormosync-desktop-store',
            partialize: (state) => ({
                // Only persist these fields
                settings: state.settings,
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
            // Debounced storage — prevents localStorage write on every tick (1/sec)
            // Writes are batched: max 1 write per 2 seconds
            storage: {
                getItem: (name) => {
                    const str = localStorage.getItem(name);
                    return str ? JSON.parse(str) : null;
                },
                setItem: (() => {
                    let timer: ReturnType<typeof setTimeout> | null = null;
                    return (name: string, value: any) => {
                        if (timer) clearTimeout(timer);
                        timer = setTimeout(() => {
                            localStorage.setItem(name, JSON.stringify(value));
                            timer = null;
                        }, 2000);
                    };
                })(),
                removeItem: (name) => localStorage.removeItem(name),
            },
        }
    )
);

// ============================================================
// Selectors (for optimized re-renders)
// ============================================================
export const selectUser = (state: AppState) => state.user;
export const selectTasks = (state: AppState) => state.tasks;
export const selectActiveTimers = (state: AppState) => state.activeTimers;
export const selectToasts = (state: AppState) => state.toasts;
export const selectSettings = (state: AppState) => state.settings;
export const selectSelectedTaskId = (state: AppState) => state.selectedTaskId;

export default useAppStore;
