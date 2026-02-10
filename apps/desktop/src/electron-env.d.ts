export { };

declare global {
    interface Window {
        electron: {
            // Screenshot
            captureScreenshot: () => Promise<string>;

            // Activity Tracker
            getActivityStats: () => Promise<{ keystrokes: number; mouseClicks: number }>;
            resetActivityStats?: () => void;

            // Open External
            openExternal: (url: string) => Promise<void>;

            // Auto Update
            onUpdate: (callback: (val: any) => void) => void;
            checkForUpdates?: () => void;
            downloadUpdate?: () => void;
            quitAndInstall?: () => void;
            onUpdateAvailable?: (callback: (info: any) => void) => void;
            onUpdateDownloaded?: (callback: (info: any) => void) => void;
            onDownloadProgress?: (callback: (progress: any) => void) => void;
            onUpdateError?: (callback: (error: any) => void) => void;

            // Tracking IPC methods
            trackingStarted: (data: {
                taskName: string;
                taskId: string;
                endTime?: string;
                subTaskId?: string;
                subTaskName?: string;
            }) => void;
            trackingStopped: () => void;
            trackingTick: (seconds: number) => void;
            onStopTracking: (callback: () => void) => void;

            // Schedule-based auto-stop event listener
            onScheduleAutoStop: (callback: (data: { subTaskId: string }) => void) => void;

            // Activity / Idle
            onActivity?: (callback: () => void) => void;
            getIdleTime?: () => Promise<number>;

            // Window Controls
            minimizeWindow?: () => void;
            maximizeWindow?: () => void;
            closeWindow?: () => void;
            switchToMiniMode?: () => void;
            switchToMainMode?: () => void;

            // System
            getPlatform?: () => string;
            getVersion?: () => string;
        };
    }
}
