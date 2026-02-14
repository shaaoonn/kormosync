import { contextBridge, ipcRenderer } from 'electron';

// --------- Expose API to the Renderer process ---------
contextBridge.exposeInMainWorld('electron', {
    // Device ID (hardware fingerprint)
    getDeviceId: () => ipcRenderer.invoke('GET_DEVICE_ID'),

    // Screenshot
    captureScreenshot: () => ipcRenderer.invoke('CAPTURE_SCREENSHOT'),

    // Activity Stats (read-only)
    getActivityStats: () => ipcRenderer.invoke('GET_ACTIVITY_STATS'),

    // Reset Activity Stats (call after successful upload)
    resetActivityStats: () => ipcRenderer.invoke('RESET_ACTIVITY_STATS'),

    // Get app usage data (returns buffered entries and resets buffer)
    getAppUsage: () => ipcRenderer.invoke('GET_APP_USAGE'),

    // Get current active window (for heartbeat)
    getCurrentApp: () => ipcRenderer.invoke('GET_CURRENT_APP'),

    // Open external URL
    openExternal: (url: string) => ipcRenderer.invoke('OPEN_EXTERNAL', url),

    // Download file with save dialog
    downloadFile: (data: { url: string; filename: string }) =>
        ipcRenderer.invoke('DOWNLOAD_FILE', data),

    // Tracking notifications to main process
    trackingStarted: (data: { taskName: string; taskId: string; subTaskId?: string; subTaskName?: string; endTime?: string; monitoringMode?: string }) =>
        ipcRenderer.send('TRACKING_STARTED', data),
    trackingStopped: () => ipcRenderer.send('TRACKING_STOPPED'),
    trackingTick: (seconds: number) => ipcRenderer.send('TRACKING_TICK', seconds),
    trackingTickMulti: (data: Array<{ subTaskId: string; taskName: string; subTaskName: string; elapsedSeconds: number; isPaused: boolean }>) =>
        ipcRenderer.send('TRACKING_TICK_MULTI', data),

    // Focus main window (from MiniWidget or floating widget)
    focusMainWindow: () => ipcRenderer.send('FOCUS_MAIN_WINDOW'),

    // Listen for stop command from main process (tray/widget)
    // Returns cleanup function to prevent listener accumulation
    onStopTracking: (callback: () => void) => {
        const handler = () => callback();
        ipcRenderer.on('STOP_TRACKING', handler);
        return () => ipcRenderer.removeListener('STOP_TRACKING', handler);
    },

    // Listen for schedule-based auto-stop from main process
    onScheduleAutoStop: (callback: (data: { taskName: string; reason: string }) => void) => {
        const handler = (_event: any, data: any) => callback(data);
        ipcRenderer.on('SCHEDULE_AUTO_STOP', handler);
        return () => ipcRenderer.removeListener('SCHEDULE_AUTO_STOP', handler);
    },

    // General updates
    onUpdate: (callback: any) => {
        const handler = (_event: any, value: any) => callback(value);
        ipcRenderer.on('main-process-message', handler);
        return () => ipcRenderer.removeListener('main-process-message', handler);
    },

    // Google OAuth for packaged Electron (bypasses signInWithPopup cross-origin issues)
    googleSignIn: () => ipcRenderer.invoke('GOOGLE_SIGN_IN'),

    // Auto-Updater (Phase 6.4)
    checkForUpdates: () => ipcRenderer.invoke('CHECK_FOR_UPDATES'),
    downloadUpdate: () => ipcRenderer.invoke('DOWNLOAD_UPDATE'),
    quitAndInstall: () => ipcRenderer.send('QUIT_AND_INSTALL'),
    onUpdateAvailable: (callback: (info: any) => void) => {
        const handler = (_event: any, info: any) => callback(info);
        ipcRenderer.on('UPDATE_AVAILABLE', handler);
        return () => ipcRenderer.removeListener('UPDATE_AVAILABLE', handler);
    },
    onUpdateDownloaded: (callback: (info: any) => void) => {
        const handler = (_event: any, info: any) => callback(info);
        ipcRenderer.on('UPDATE_DOWNLOADED', handler);
        return () => ipcRenderer.removeListener('UPDATE_DOWNLOADED', handler);
    },
    onDownloadProgress: (callback: (progress: any) => void) => {
        const handler = (_event: any, progress: any) => callback(progress);
        ipcRenderer.on('DOWNLOAD_PROGRESS', handler);
        return () => ipcRenderer.removeListener('DOWNLOAD_PROGRESS', handler);
    },
    onUpdateError: (callback: (error: any) => void) => {
        const handler = (_event: any, error: any) => callback(error);
        ipcRenderer.on('UPDATE_ERROR', handler);
        return () => ipcRenderer.removeListener('UPDATE_ERROR', handler);
    },
});

// Type declarations for TypeScript
declare global {
    interface Window {
        electron: {
            getDeviceId: () => Promise<string>;
            captureScreenshot: () => Promise<string>;
            getActivityStats: () => Promise<{ keystrokes: number; mouseClicks: number }>;
            resetActivityStats: () => Promise<{ success: boolean }>;
            getAppUsage: () => Promise<Array<{ appName: string; windowTitle: string; durationSec: number }>>;
            getCurrentApp: () => Promise<{ appName: string; windowTitle: string }>;
            openExternal: (url: string) => Promise<void>;
            downloadFile: (data: { url: string; filename: string }) => Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>;
            trackingStarted: (data: { taskName: string; taskId: string; subTaskId?: string; subTaskName?: string; endTime?: string; monitoringMode?: string }) => void;
            trackingStopped: () => void;
            trackingTick: (seconds: number) => void;
            trackingTickMulti: (data: Array<{ subTaskId: string; taskName: string; subTaskName: string; elapsedSeconds: number; isPaused: boolean }>) => void;
            focusMainWindow: () => void;
            // All on* listeners now return cleanup functions
            onStopTracking: (callback: () => void) => () => void;
            onScheduleAutoStop: (callback: (data: { taskName: string; reason: string }) => void) => () => void;
            onUpdate: (callback: any) => () => void;
            // Google OAuth
            googleSignIn: () => Promise<{ idToken: string }>;
            // Auto-Updater
            checkForUpdates: () => Promise<{ success: boolean; version?: string; error?: string }>;
            downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
            quitAndInstall: () => void;
            onUpdateAvailable: (callback: (info: any) => void) => () => void;
            onUpdateDownloaded: (callback: (info: any) => void) => () => void;
            onDownloadProgress: (callback: (progress: any) => void) => () => void;
            onUpdateError: (callback: (error: any) => void) => () => void;
            // Optional methods from electron.ts service
            [key: string]: any;
        };
    }
}
