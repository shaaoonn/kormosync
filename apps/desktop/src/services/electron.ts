// ============================================================
// KormoSync Desktop App - Electron Service
// Wrapper for IPC communication with main process
// ============================================================

import type { ActivityStats } from '../types';

// Type definition for window.electron (exposed via preload)
// Types are defined in electron-env.d.ts

// ============================================================
// Electron Service Class
// ============================================================
class ElectronService {
    private isElectron: boolean;

    constructor() {
        this.isElectron = !!window.electron;
    }

    // Check if running in Electron
    get available(): boolean {
        return this.isElectron;
    }

    // ============================================================
    // Screenshot Methods
    // ============================================================

    /**
     * Capture screenshot and return as base64
     */
    async captureScreenshot(): Promise<string | null> {
        if (!this.isElectron) {
            console.warn('Screenshot capture not available outside Electron');
            return null;
        }

        try {
            return await window.electron!.captureScreenshot();
        } catch (error) {
            console.error('Screenshot capture failed:', error);
            return null;
        }
    }

    /**
     * Capture screenshot as Blob (for upload)
     */
    async captureScreenshotBlob(): Promise<Blob | null> {
        const base64 = await this.captureScreenshot();
        if (!base64) return null;

        try {
            const byteChars = atob(base64);
            const byteArray = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
                byteArray[i] = byteChars.charCodeAt(i);
            }
            return new Blob([byteArray], { type: 'image/png' });
        } catch (error) {
            console.error('Failed to convert screenshot to blob:', error);
            return null;
        }
    }

    // ============================================================
    // Activity Tracking Methods
    // ============================================================

    /**
     * Get current activity stats (keystrokes, mouse clicks)
     */
    async getActivityStats(): Promise<ActivityStats> {
        if (!this.isElectron) {
            return { keystrokes: 0, mouseClicks: 0 };
        }

        try {
            return await window.electron!.getActivityStats();
        } catch (error) {
            console.error('Failed to get activity stats:', error);
            return { keystrokes: 0, mouseClicks: 0 };
        }
    }

    /**
     * Reset activity counters
     */
    resetActivityStats(): void {
        if (this.isElectron) {
            window.electron!.resetActivityStats?.();
        }
    }

    // ============================================================
    // Tracking Lifecycle Methods
    // ============================================================

    /**
     * Notify main process that tracking has started
     */
    trackingStarted(data: {
        taskId: string;
        subTaskId?: string;
        taskName: string;
        endTime?: string;
    }): void {
        if (this.isElectron) {
            window.electron!.trackingStarted(data);
        }
    }

    /**
     * Notify main process that tracking has stopped
     */
    trackingStopped(): void {
        if (this.isElectron) {
            window.electron!.trackingStopped();
        }
    }

    /**
     * Send tick update (elapsed time)
     */
    trackingTick(elapsedSeconds: number): void {
        if (this.isElectron) {
            window.electron!.trackingTick(elapsedSeconds);
        }
    }

    // ============================================================
    // Event Listeners
    // ============================================================

    /**
     * Listen for stop tracking command from main/widget
     */
    onStopTracking(callback: () => void): void {
        if (this.isElectron) {
            window.electron!.onStopTracking(callback);
        }
    }

    /**
     * Listen for schedule auto-stop
     */
    onScheduleAutoStop(callback: (data: { subTaskId: string }) => void): void {
        if (this.isElectron) {
            window.electron!.onScheduleAutoStop(callback);
        }
    }

    /**
     * Listen for any activity (keyboard/mouse) - for idle detection reset
     */
    onActivity(callback: () => void): void {
        if (this.isElectron) {
            window.electron!.onActivity?.(callback);
        }
    }

    // ============================================================
    // Window Control Methods
    // ============================================================

    /**
     * Minimize the window
     */
    minimizeWindow(): void {
        if (this.isElectron) {
            window.electron!.minimizeWindow?.();
        }
    }

    /**
     * Maximize/restore the window
     */
    maximizeWindow(): void {
        if (this.isElectron) {
            window.electron!.maximizeWindow?.();
        }
    }

    /**
     * Close the window
     */
    closeWindow(): void {
        if (this.isElectron) {
            window.electron!.closeWindow?.();
        }
    }

    /**
     * Open URL in external browser
     */
    async openExternal(url: string): Promise<void> {
        if (this.isElectron) {
            await window.electron!.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    }

    // ============================================================
    // Widget Methods
    // ============================================================

    /**
     * Switch to mini widget mode
     */
    switchToMiniMode(): void {
        if (this.isElectron) {
            window.electron!.switchToMiniMode?.();
        }
    }

    /**
     * Switch back to main window
     */
    switchToMainMode(): void {
        if (this.isElectron) {
            window.electron!.switchToMainMode?.();
        }
    }

    // ============================================================
    // System Info Methods
    // ============================================================

    /**
     * Get OS platform
     */
    getPlatform(): string {
        if (this.isElectron) {
            return window.electron!.getPlatform?.() || 'unknown';
        }
        return navigator.platform;
    }

    /**
     * Get app version
     */
    getVersion(): string {
        if (this.isElectron) {
            return window.electron!.getVersion?.() || '1.0.0';
        }
        return '1.0.0';
    }
    // ============================================================
    // Auto Update Methods
    // ============================================================

    checkForUpdates(): void {
        if (this.isElectron) {
            window.electron!.checkForUpdates?.();
        }
    }

    downloadUpdate(): void {
        if (this.isElectron) {
            window.electron!.downloadUpdate?.();
        }
    }

    quitAndInstall(): void {
        if (this.isElectron) {
            window.electron!.quitAndInstall?.();
        }
    }

    onUpdateAvailable(callback: (info: any) => void): void {
        if (this.isElectron) {
            window.electron!.onUpdateAvailable?.(callback);
        }
    }

    onUpdateDownloaded(callback: (info: any) => void): void {
        if (this.isElectron) {
            window.electron!.onUpdateDownloaded?.(callback);
        }
    }

    onDownloadProgress(callback: (progress: any) => void): void {
        if (this.isElectron) {
            window.electron!.onDownloadProgress?.(callback);
        }
    }

    onUpdateError(callback: (error: any) => void): void {
        if (this.isElectron) {
            window.electron!.onUpdateError?.(callback);
        }
    }
}

// Export singleton instance
export const electronService = new ElectronService();
export default electronService;
