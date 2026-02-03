import { contextBridge, ipcRenderer, shell } from 'electron';

// --------- Expose API to the Renderer process ---------
contextBridge.exposeInMainWorld('electron', {
    // Screenshot
    captureScreenshot: () => ipcRenderer.invoke('CAPTURE_SCREENSHOT'),

    // Activity Stats (Get and Reset)
    getActivityStats: () => ipcRenderer.invoke('GET_ACTIVITY_STATS'),

    // Open external URL
    openExternal: (url: string) => ipcRenderer.invoke('OPEN_EXTERNAL', url),

    // Tracking notifications to main process
    trackingStarted: (data: { taskName: string; taskId: string; subTaskId?: string; subTaskName?: string; endTime?: string }) =>
        ipcRenderer.send('TRACKING_STARTED', data),
    trackingStopped: () => ipcRenderer.send('TRACKING_STOPPED'),
    trackingTick: (seconds: number) => ipcRenderer.send('TRACKING_TICK', seconds),

    // Listen for stop command from main process (tray/widget)
    onStopTracking: (callback: () => void) =>
        ipcRenderer.on('STOP_TRACKING', () => callback()),

    // Listen for schedule-based auto-stop from main process
    onScheduleAutoStop: (callback: (data: { taskName: string; reason: string }) => void) =>
        ipcRenderer.on('SCHEDULE_AUTO_STOP', (_event, data) => callback(data)),

    // General updates
    onUpdate: (callback: any) =>
        ipcRenderer.on('main-process-message', (_event, value) => callback(value)),
});

// Type declarations for TypeScript
declare global {
    interface Window {
        electron: {
            captureScreenshot: () => Promise<string>;
            getActivityStats: () => Promise<{ keystrokes: number; mouseClicks: number }>;
            openExternal: (url: string) => Promise<void>;
            trackingStarted: (data: { taskName: string; taskId: string; subTaskId?: string; subTaskName?: string; endTime?: string }) => void;
            trackingStopped: () => void;
            trackingTick: (seconds: number) => void;
            onStopTracking: (callback: () => void) => void;
            onScheduleAutoStop: (callback: (data: { taskName: string; reason: string }) => void) => void;
            onUpdate: (callback: any) => void;
        };
    }
}

