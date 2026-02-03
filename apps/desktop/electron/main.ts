import { app, BrowserWindow, ipcMain, Tray, Menu, screen, shell, nativeImage } from 'electron';
import path from 'path';
import screenshot from 'screenshot-desktop';
import { fileURLToPath } from 'node:url';
import { uIOhook, UiohookKey, UiohookWheelEvent, UiohookMouseEvent } from 'uiohook-napi';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DIST = path.join(__dirname, '../dist');
const VITE_PUBLIC = app.isPackaged ? DIST : path.join(DIST, '../public');

let mainWin: BrowserWindow | null = null;
let floatingWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let isTracking = false;
let currentTaskName = '';
let trackingTime = 0;
let remainingTime = 0;

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
        },
        width: 1100,
        height: 750,
        minWidth: 800,
        minHeight: 600,
        title: 'KormoSync',
        backgroundColor: '#0a0e1a',
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
            showFloatingWidget();
        }
    });

    // When main window is minimized, show floating widget if tracking
    mainWin.on('minimize', (event: Event) => {
        if (isTracking) {
            event.preventDefault();
            mainWin?.hide();
            showFloatingWidget();
        }
    });
}

// ==========================================
// Floating Widget Window
// ==========================================
function createFloatingWidget() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    floatingWin = new BrowserWindow({
        width: 280,
        height: 100,
        x: width - 300,
        y: height - 120,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focusable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    // Load floating widget HTML from public folder
    if (VITE_DEV_SERVER_URL) {
        // In dev, load from vite server
        floatingWin.loadURL(`${VITE_DEV_SERVER_URL}/widget.html`);
    } else {
        // In production, load from dist folder
        floatingWin.loadFile(path.join(DIST, 'widget.html'));
    }

    floatingWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    console.log('Floating widget created');
}

function showFloatingWidget() {
    if (!floatingWin) {
        createFloatingWidget();
    }
    floatingWin?.show();
    updateFloatingWidget();
}

function hideFloatingWidget() {
    floatingWin?.hide();
}

function updateFloatingWidget() {
    if (floatingWin && isTracking) {
        const formatTime = (s: number) => {
            const h = Math.floor(s / 3600).toString().padStart(2, '0');
            const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
            const sec = (s % 60).toString().padStart(2, '0');
            return `${h}:${m}:${sec}`;
        };

        floatingWin.webContents.send('UPDATE_WIDGET', {
            taskName: currentTaskName,
            elapsed: formatTime(trackingTime),
            remaining: remainingTime > 0 ? formatTime(remainingTime) : null,
        });
    }
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
        { label: 'KormoSync খুলুন', click: () => { mainWin?.show(); hideFloatingWidget(); } },
        { type: 'separator' },
        { label: 'ট্র্যাকিং বন্ধ করুন', click: () => { mainWin?.webContents.send('STOP_TRACKING'); } },
        { type: 'separator' },
        { label: 'বন্ধ করুন', click: () => { app.quit(); } },
    ]);

    tray.setToolTip('KormoSync - Time Tracker');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWin?.show();
        hideFloatingWidget();
    });
}

// ==========================================
// Input Hooks
// ==========================================
function startHooks() {
    uIOhook.on('keydown', () => {
        if (isTracking) keystrokes++;
    });
    uIOhook.on('click', () => {
        if (isTracking) mouseClicks++;
    });
    uIOhook.start();
}

function stopHooks() {
    uIOhook.stop();
}

// ==========================================
// IPC Handlers
// ==========================================
ipcMain.handle('CAPTURE_SCREENSHOT', async () => {
    try {
        console.log('Main Process: Capturing screenshot...');
        const displays = await screenshot.listDisplays();
        const img = await screenshot({ screen: displays[0].id, format: 'png' });
        console.log('Main Process: Screenshot captured, size ' + img.length);
        return img.toString('base64');
    } catch (error) {
        console.error('Failed to capture screenshot:', error);
        throw error;
    }
});

// Get Activity Stats and Reset
ipcMain.handle('GET_ACTIVITY_STATS', async () => {
    const stats = { keystrokes, mouseClicks };
    keystrokes = 0;
    mouseClicks = 0;
    return stats;
});


// Open external URL
ipcMain.handle('OPEN_EXTERNAL', async (_, url: string) => {
    await shell.openExternal(url);
});

// Tracking state updates from renderer
ipcMain.on('TRACKING_STARTED', (_, data: { taskName: string; taskId: string; endTime?: string }) => {
    isTracking = true;
    currentTaskName = data.taskName;
    trackingTime = 0;
    keystrokes = 0;
    mouseClicks = 0;
    hasTriggeredAutoStop = false; // Reset for new session

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
    console.log('Tracking started:', currentTaskName);
});

ipcMain.on('TRACKING_STOPPED', () => {
    isTracking = false;
    currentTaskName = '';
    trackingTime = 0;
    remainingTime = 0;
    hideFloatingWidget();
    stopHooks();
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

    updateFloatingWidget();
});

ipcMain.on('EXPAND_APP', () => {
    mainWin?.show();
    hideFloatingWidget();
});

ipcMain.on('STOP_TRACKING_FROM_WIDGET', () => {
    mainWin?.webContents.send('STOP_TRACKING');
    hideFloatingWidget();
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
});

