import { app, BrowserWindow, ipcMain, Tray, Menu, screen, shell, nativeImage, desktopCapturer, dialog } from 'electron';
import fs from 'fs';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { uIOhook, UiohookKey, UiohookWheelEvent, UiohookMouseEvent } from 'uiohook-napi';
import { execSync, execFile } from 'child_process';
import crypto from 'crypto';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==========================================
// Memory Optimization — safe flags only
// ==========================================
// Disable unnecessary Chromium features to save memory
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-translate');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-features', 'TranslateUI');
// Note: V8 heap limit and hardware acceleration left at defaults
// to prevent hangs during screenshot capture (base64 + blob needs heap space)

// ==========================================
// Global Error Handlers — prevent EPIPE / uncaught crashes
// ==========================================
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception (Main Process):', error.message);
    // Don't crash the app — log and continue
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection (Main Process):', reason);
});

const DIST = path.join(__dirname, '../dist');
const VITE_PUBLIC = app.isPackaged ? DIST : path.join(DIST, '../public');

let mainWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let isTracking = false;
let currentTaskName = '';
let trackingTime = 0;
let remainingTime = 0;
let monitoringMode: 'TRANSPARENT' | 'STEALTH' = 'TRANSPARENT';

// Multi-task state (kept for tray tooltip and internal tracking)
interface ActiveTaskData {
    subTaskId: string;
    taskName: string;
    subTaskName: string;
    elapsedSeconds: number;
    isPaused: boolean;
}
let activeTasksData: ActiveTaskData[] = [];

// Activity Counters
let keystrokes = 0;
let mouseClicks = 0;

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

// ==========================================
// Main Window
// ==========================================
function createMainWindow() {
    mainWin = new BrowserWindow({
        icon: path.join(VITE_PUBLIC, 'electron-vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false, // Critical: Prevent timer from pausing in background
            spellcheck: false, // Save memory — no dictionary loaded
            enableWebSQL: false, // Deprecated, save memory
            v8CacheOptions: 'bypassHeatCheck', // Cache V8 bytecode aggressively — less re-compilation
        },
        width: 1100,
        height: 750,
        minWidth: 800,
        minHeight: 600,
        title: 'KormoSync',
        backgroundColor: '#111827',
        show: false, // Don't show until ready — prevents blank white flash and reduces initial memory spike
    });

    // Show window when ready — avoids extra repaints during load
    mainWin.once('ready-to-show', () => {
        mainWin?.show();
    });

    mainWin.webContents.on('did-finish-load', () => {
        mainWin?.webContents.send('main-process-message', new Date().toLocaleString());
    });

    if (VITE_DEV_SERVER_URL) {
        mainWin.loadURL(VITE_DEV_SERVER_URL);
    } else {
        mainWin.loadFile(path.join(DIST, 'index.html'));
    }

    // When main window is closed, minimize to tray if tracking
    mainWin.on('close', (event) => {
        if (isTracking && tray) {
            event.preventDefault();
            mainWin?.hide();
            // App stays in system tray — no floating widget
        }
    });

    // Normal minimize — stays in taskbar like regular software
    mainWin.on('minimize', () => {
        // Do nothing — normal taskbar minimize behavior
    });
}

// ==========================================
// System Tray
// ==========================================
function createTray() {
    // Create a simple 16x16 icon programmatically
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);
    for (let i = 0; i < size * size; i++) {
        // Yellow color: rgba(234, 179, 8, 255)
        canvas[i * 4] = 234;     // R
        canvas[i * 4 + 1] = 179; // G
        canvas[i * 4 + 2] = 8;   // B
        canvas[i * 4 + 3] = 255; // A
    }

    const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'KormoSync খুলুন', click: () => { mainWin?.show(); mainWin?.focus(); } },
        { type: 'separator' },
        { label: 'ট্র্যাকিং বন্ধ করুন', click: () => { mainWin?.webContents.send('STOP_TRACKING'); } },
        { type: 'separator' },
        { label: 'বন্ধ করুন', click: () => { app.quit(); } },
    ]);

    tray.setToolTip('KormoSync - Time Tracker');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWin?.show();
        mainWin?.focus();
    });
}

// ==========================================
// Input Hooks
// ==========================================
let hooksStarted = false;

function startHooks() {
    if (hooksStarted) return; // Prevent double-start (multiple tasks)
    hooksStarted = true;

    uIOhook.on('keydown', () => {
        if (isTracking) keystrokes++;
    });
    uIOhook.on('click', () => {
        if (isTracking) mouseClicks++;
    });
    uIOhook.start();
    console.log('Input hooks started');
}

function stopHooks() {
    if (!hooksStarted) return;
    hooksStarted = false;
    try {
        uIOhook.removeAllListeners();
        uIOhook.stop();
        console.log('Input hooks stopped');
    } catch (e: any) {
        console.warn('stopHooks error (non-critical):', e?.message);
    }
}

// ==========================================
// Hardware / Device ID — unique per machine
// ==========================================
let cachedDeviceId: string | null = null;

function getDeviceId(): string {
    if (cachedDeviceId) return cachedDeviceId;

    try {
        // Build fingerprint from stable hardware identifiers
        const components = [
            os.hostname(),
            os.platform(),
            os.arch(),
            os.cpus()[0]?.model || '',
            os.totalmem().toString(),
        ];

        // On Windows, add machine GUID from registry (most reliable)
        if (process.platform === 'win32') {
            try {
                const machineGuid = execSync(
                    'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
                    { timeout: 3000, windowsHide: true }
                ).toString();
                const match = machineGuid.match(/MachineGuid\s+REG_SZ\s+(.+)/);
                if (match) components.push(match[1].trim());
            } catch { /* fallback to other components */ }
        }

        const hash = crypto.createHash('sha256').update(components.join('|')).digest('hex');
        cachedDeviceId = hash.substring(0, 16); // 16-char unique ID
        console.log('Device ID:', cachedDeviceId);
    } catch {
        cachedDeviceId = 'unknown-device';
    }

    return cachedDeviceId;
}

// ==========================================
// IPC Handlers
// ==========================================
ipcMain.handle('GET_DEVICE_ID', async () => {
    return getDeviceId();
});

ipcMain.handle('CAPTURE_SCREENSHOT', async () => {
    try {
        // Use 1280x720 instead of 1920x1080 — saves ~60% memory per capture
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1280, height: 720 },
        });
        if (!sources || sources.length === 0) {
            throw new Error('No screen sources available');
        }
        const primarySource = sources[0];
        // JPEG quality 70 instead of PNG — ~5x smaller file, much less memory
        const jpegBuffer = primarySource.thumbnail.toJPEG(70);
        const base64 = jpegBuffer.toString('base64');
        // Explicitly null out references to help GC
        (primarySource as any).thumbnail = null;
        return base64;
    } catch (error) {
        console.error('Failed to capture screenshot:', error);
        throw error;
    }
});

// Get Activity Stats (read-only, does not reset)
ipcMain.handle('GET_ACTIVITY_STATS', async () => {
    return { keystrokes, mouseClicks };
});

// Reset Activity Stats (call after successful upload)
ipcMain.handle('RESET_ACTIVITY_STATS', async () => {
    keystrokes = 0;
    mouseClicks = 0;
    return { success: true };
});


// Open external URL
ipcMain.handle('OPEN_EXTERNAL', async (_, url: string) => {
    await shell.openExternal(url);
});

// Download file — shows save dialog, downloads from URL
ipcMain.handle('DOWNLOAD_FILE', async (_, { url, filename }: { url: string; filename: string }) => {
    try {
        if (!mainWin) return { success: false, error: 'No main window' };

        // Show save dialog with suggested filename
        const result = await dialog.showSaveDialog(mainWin, {
            defaultPath: filename,
            filters: [{ name: 'All Files', extensions: ['*'] }],
        });

        if (result.canceled || !result.filePath) {
            return { success: false, canceled: true };
        }

        // Download file using fetch
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(result.filePath, buffer);

        return { success: true, path: result.filePath };
    } catch (err: any) {
        console.error('DOWNLOAD_FILE error:', err?.message);
        return { success: false, error: err?.message || 'Download failed' };
    }
});

// Tracking state updates from renderer
ipcMain.on('TRACKING_STARTED', (_, data: { taskName: string; taskId: string; subTaskId?: string; subTaskName?: string; endTime?: string; monitoringMode?: string }) => {
    isTracking = true;
    currentTaskName = data.taskName;
    monitoringMode = (data.monitoringMode as any) || 'TRANSPARENT';
    hasTriggeredAutoStop = false; // Reset for new session

    // Add to multi-task list (avoid duplicates)
    if (data.subTaskId) {
        const existing = activeTasksData.findIndex(t => t.subTaskId === data.subTaskId);
        if (existing === -1) {
            activeTasksData.push({
                subTaskId: data.subTaskId,
                taskName: data.taskName?.split(' - ')[0] || data.taskName,
                subTaskName: data.subTaskName || data.taskName?.split(' - ')[1] || '',
                elapsedSeconds: 0,
                isPaused: false,
            });
        }
    }

    // Only reset counters for the first task
    if (activeTasksData.length <= 1) {
        trackingTime = 0;
        keystrokes = 0;
        mouseClicks = 0;
    }

    // Calculate remaining time if scheduled
    if (data.endTime) {
        const [h, m] = data.endTime.split(':').map(Number);
        const now = new Date();
        const endMinutes = h * 60 + m;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        remainingTime = Math.max(0, (endMinutes - nowMinutes) * 60 - now.getSeconds());
    } else {
        remainingTime = 0;
    }

    startHooks();
    startAppTracking();
    console.log('Tracking started:', currentTaskName, `(${activeTasksData.length} active tasks)`);
});

ipcMain.on('TRACKING_STOPPED', () => {
    isTracking = false;
    currentTaskName = '';
    trackingTime = 0;
    remainingTime = 0;
    activeTasksData = [];
    stopHooks();
    stopAppTracking();
    console.log('Tracking stopped');
});

// Track if we already sent auto-stop for current session
let hasTriggeredAutoStop = false;

ipcMain.on('TRACKING_TICK', (_, seconds: number) => {
    trackingTime = seconds;

    // Countdown remaining time for scheduled tasks
    if (remainingTime > 0) {
        remainingTime = Math.max(0, remainingTime - 1);

        // Trigger auto-stop when scheduled time ends
        if (remainingTime === 0 && !hasTriggeredAutoStop) {
            hasTriggeredAutoStop = true;
            console.log('Schedule ended, triggering auto-stop for:', currentTaskName);
            mainWin?.webContents.send('SCHEDULE_AUTO_STOP', {
                taskName: currentTaskName,
                reason: 'scheduled_end'
            });
        }
    }
});

// Multi-task tick — receives all active timers data
ipcMain.on('TRACKING_TICK_MULTI', (_, data: ActiveTaskData[]) => {
    const prevCount = activeTasksData.length;
    activeTasksData = data;

    // Update tracking state
    if (data.length > 0) {
        isTracking = true;
        // Update legacy single-task fields from first task
        currentTaskName = data[0].taskName + (data[0].subTaskName ? ` - ${data[0].subTaskName}` : '');
        trackingTime = data.reduce((sum, t) => sum + t.elapsedSeconds, 0);
    }

    // If no tasks left, update state
    if (data.length === 0) {
        isTracking = false;
    }
});

ipcMain.on('FOCUS_MAIN_WINDOW', () => {
    mainWin?.show();
    mainWin?.focus();
});

// Legacy IPC handlers (kept for backward compatibility)
ipcMain.on('EXPAND_APP', () => {
    mainWin?.show();
    mainWin?.focus();
});

ipcMain.on('MINIMIZE_WIDGET', () => {
    // No-op — widget removed
});

// ==========================================
// Active Window Tracking (Phase 3.3)
// ==========================================
let appUsageBuffer: { appName: string; windowTitle: string; startedAt: number }[] = [];
let lastActiveApp: { appName: string; windowTitle: string; startedAt: number } | null = null;
let appTrackingInterval: ReturnType<typeof setInterval> | null = null;

function getActiveWindow(): Promise<{ appName: string; windowTitle: string } | null> {
    return new Promise((resolve) => {
        try {
            if (process.platform === 'win32') {
                // PowerShell command to get active window process name and title
                const psScript = `Add-Type @" \nusing System; using System.Runtime.InteropServices; using System.Text; public class Win32 { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId); [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count); }\n"@\n$hwnd = [Win32]::GetForegroundWindow(); $pid = 0; [Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null; $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue; $title = New-Object System.Text.StringBuilder 256; [Win32]::GetWindowText($hwnd, $title, 256) | Out-Null; Write-Output "$($proc.ProcessName)||$($title.ToString())"`;

                execFile('powershell', ['-NoProfile', '-Command', psScript], {
                    timeout: 3000,
                    windowsHide: true,
                }, (err, stdout) => {
                    if (err) {
                        resolve(null);
                        return;
                    }
                    const output = (stdout || '').trim();
                    const [appName, windowTitle] = output.split('||');
                    if (appName) {
                        resolve({ appName: appName.trim(), windowTitle: (windowTitle || '').trim() });
                    } else {
                        resolve(null);
                    }
                });
            } else if (process.platform === 'darwin') {
                execFile('osascript', ['-e', 'tell application "System Events" to get {name, title of first window} of first application process whose frontmost is true'], {
                    timeout: 3000,
                }, (err, stdout) => {
                    if (err) { resolve(null); return; }
                    const parts = (stdout || '').trim().split(', ');
                    resolve({ appName: parts[0] || 'Unknown', windowTitle: parts[1] || '' });
                });
            } else {
                resolve(null);
            }
        } catch {
            resolve(null);
        }
    });
}

function startAppTracking() {
    if (appTrackingInterval) return;

    appUsageBuffer = [];
    lastActiveApp = null;

    // Poll active window every 5 seconds (async — doesn't block main thread)
    appTrackingInterval = setInterval(async () => {
        if (!isTracking) return;

        const current = await getActiveWindow();
        if (!current) return;

        const now = Date.now();

        // If app changed, finalize the previous entry
        if (lastActiveApp && lastActiveApp.appName !== current.appName) {
            const durationSec = Math.round((now - lastActiveApp.startedAt) / 1000);
            if (durationSec >= 3) { // Only log if used for at least 3 seconds
                appUsageBuffer.push({
                    appName: lastActiveApp.appName,
                    windowTitle: lastActiveApp.windowTitle,
                    startedAt: durationSec, // Reuse field as durationSec for buffer
                });
                // Cap buffer to prevent unbounded memory growth
                if (appUsageBuffer.length > 500) appUsageBuffer = appUsageBuffer.slice(-200);
            }
            lastActiveApp = { ...current, startedAt: now };
        } else if (!lastActiveApp) {
            lastActiveApp = { ...current, startedAt: now };
        } else {
            // Same app, update window title if changed
            lastActiveApp.windowTitle = current.windowTitle;
        }
    }, 5000);

    console.log('App tracking started');
}

function stopAppTracking() {
    if (appTrackingInterval) {
        clearInterval(appTrackingInterval);
        appTrackingInterval = null;
    }

    // Finalize last active app
    if (lastActiveApp) {
        const durationSec = Math.round((Date.now() - lastActiveApp.startedAt) / 1000);
        if (durationSec >= 3) {
            appUsageBuffer.push({
                appName: lastActiveApp.appName,
                windowTitle: lastActiveApp.windowTitle,
                startedAt: durationSec,
            });
        }
        lastActiveApp = null;
    }

    console.log('App tracking stopped');
}

// Get current active window (for heartbeat)
ipcMain.handle('GET_CURRENT_APP', async () => {
    const current = await getActiveWindow();
    return current || { appName: '', windowTitle: '' };
});

// Flush and return buffered app usage data
ipcMain.handle('GET_APP_USAGE', async () => {
    const entries = [...appUsageBuffer];
    appUsageBuffer = [];

    // Finalize current app without stopping tracking
    if (lastActiveApp) {
        const now = Date.now();
        const durationSec = Math.round((now - lastActiveApp.startedAt) / 1000);
        if (durationSec >= 3) {
            entries.push({
                appName: lastActiveApp.appName,
                windowTitle: lastActiveApp.windowTitle,
                startedAt: durationSec,
            });
        }
        lastActiveApp.startedAt = now; // Reset timer for current app
    }

    return entries.map(e => ({
        appName: e.appName,
        windowTitle: e.windowTitle,
        durationSec: e.startedAt, // startedAt was repurposed to hold durationSec
    }));
});

// ==========================================
// Auto-Updater (Phase 6.4)
// ==========================================
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater() {
    autoUpdater.on('update-available', (info) => {
        console.log('Update available:', info.version);
        mainWin?.webContents.send('UPDATE_AVAILABLE', info);
    });

    autoUpdater.on('update-not-available', () => {
        console.log('App is up to date');
    });

    autoUpdater.on('download-progress', (progress) => {
        console.log(`Download progress: ${Math.round(progress.percent)}%`);
        mainWin?.webContents.send('DOWNLOAD_PROGRESS', progress);
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded:', info.version);
        mainWin?.webContents.send('UPDATE_DOWNLOADED', info);
    });

    autoUpdater.on('error', (error) => {
        console.error('Auto-updater error:', error.message);
        mainWin?.webContents.send('UPDATE_ERROR', error.message);
    });

    // Check for updates after a short delay
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
            console.log('Update check failed (non-critical):', err.message);
        });
    }, 10000); // 10 seconds after startup
}

// IPC handlers for renderer-triggered update actions
ipcMain.handle('CHECK_FOR_UPDATES', async () => {
    try {
        const result = await autoUpdater.checkForUpdates();
        return { success: true, version: result?.updateInfo?.version };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('DOWNLOAD_UPDATE', async () => {
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.on('QUIT_AND_INSTALL', () => {
    autoUpdater.quitAndInstall(false, true);
});

// ==========================================
// App Lifecycle
// ==========================================
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

app.whenReady().then(() => {
    createMainWindow();
    createTray();
    setupAutoUpdater();

    // Periodic memory cleanup — force GC every 5 minutes if available
    setInterval(() => {
        if (global.gc) {
            global.gc();
        }
        // Clear renderer memory cache periodically
        mainWin?.webContents.session.clearCache().catch(() => {});
    }, 5 * 60 * 1000);
});
