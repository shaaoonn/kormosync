export { };

declare global {
    interface Window {
        electron: {
            captureScreenshot: () => Promise<string>;
            getActivityStats: () => Promise<{ keystrokes: number; mouseClicks: number }>;
            openExternal: (url: string) => Promise<void>;
            onUpdate: (callback: (val: any) => void) => void;

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
            onScheduleAutoStop: (callback: (data: { taskName: string; reason: string }) => void) => void;
        };
    }
}

