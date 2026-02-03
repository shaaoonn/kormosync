"use strict";
const electron = require("electron");
const path = require("path");
const screenshot = require("screenshot-desktop");
const node_url = require("node:url");
const uiohookNapi = require("uiohook-napi");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
const __dirname$1 = path.dirname(node_url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("main.js", document.baseURI).href));
const DIST = path.join(__dirname$1, "../dist");
const VITE_PUBLIC = electron.app.isPackaged ? DIST : path.join(DIST, "../public");
let mainWin = null;
let floatingWin = null;
let tray = null;
let isTracking = false;
let currentTaskName = "";
let trackingTime = 0;
let remainingTime = 0;
let keystrokes = 0;
let mouseClicks = 0;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
function createMainWindow() {
  mainWin = new electron.BrowserWindow({
    icon: path.join(VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      backgroundThrottling: false
      // Critical: Prevent timer from pausing in background
    },
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: "KormoSync",
    backgroundColor: "#0a0e1a"
  });
  mainWin.webContents.on("did-finish-load", () => {
    mainWin?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    mainWin.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWin.loadFile(path.join(DIST, "index.html"));
  }
  mainWin.on("close", (event) => {
    if (isTracking && tray) {
      event.preventDefault();
      mainWin?.hide();
      showFloatingWidget();
    }
  });
  mainWin.on("minimize", (event) => {
    if (isTracking) {
      event.preventDefault();
      mainWin?.hide();
      showFloatingWidget();
    }
  });
}
function createFloatingWidget() {
  const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  floatingWin = new electron.BrowserWindow({
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
      contextIsolation: false
    }
  });
  if (VITE_DEV_SERVER_URL) {
    floatingWin.loadURL(`${VITE_DEV_SERVER_URL}/widget.html`);
  } else {
    floatingWin.loadFile(path.join(DIST, "widget.html"));
  }
  floatingWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  console.log("Floating widget created");
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
    const formatTime = (s) => {
      const h = Math.floor(s / 3600).toString().padStart(2, "0");
      const m = Math.floor(s % 3600 / 60).toString().padStart(2, "0");
      const sec = (s % 60).toString().padStart(2, "0");
      return `${h}:${m}:${sec}`;
    };
    floatingWin.webContents.send("UPDATE_WIDGET", {
      taskName: currentTaskName,
      elapsed: formatTime(trackingTime),
      remaining: remainingTime > 0 ? formatTime(remainingTime) : null
    });
  }
}
function createTray() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 234;
    canvas[i * 4 + 1] = 179;
    canvas[i * 4 + 2] = 8;
    canvas[i * 4 + 3] = 255;
  }
  const icon = electron.nativeImage.createFromBuffer(canvas, { width: size, height: size });
  tray = new electron.Tray(icon);
  const contextMenu = electron.Menu.buildFromTemplate([
    { label: "KormoSync খুলুন", click: () => {
      mainWin?.show();
      hideFloatingWidget();
    } },
    { type: "separator" },
    { label: "ট্র্যাকিং বন্ধ করুন", click: () => {
      mainWin?.webContents.send("STOP_TRACKING");
    } },
    { type: "separator" },
    { label: "বন্ধ করুন", click: () => {
      electron.app.quit();
    } }
  ]);
  tray.setToolTip("KormoSync - Time Tracker");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    mainWin?.show();
    hideFloatingWidget();
  });
}
function startHooks() {
  uiohookNapi.uIOhook.on("keydown", () => {
    if (isTracking) keystrokes++;
  });
  uiohookNapi.uIOhook.on("click", () => {
    if (isTracking) mouseClicks++;
  });
  uiohookNapi.uIOhook.start();
}
function stopHooks() {
  uiohookNapi.uIOhook.stop();
}
electron.ipcMain.handle("CAPTURE_SCREENSHOT", async () => {
  try {
    console.log("Main Process: Capturing screenshot...");
    const displays = await screenshot.listDisplays();
    const img = await screenshot({ screen: displays[0].id, format: "png" });
    console.log("Main Process: Screenshot captured, size " + img.length);
    return img.toString("base64");
  } catch (error) {
    console.error("Failed to capture screenshot:", error);
    throw error;
  }
});
electron.ipcMain.handle("GET_ACTIVITY_STATS", async () => {
  const stats = { keystrokes, mouseClicks };
  keystrokes = 0;
  mouseClicks = 0;
  return stats;
});
electron.ipcMain.handle("OPEN_EXTERNAL", async (_, url) => {
  await electron.shell.openExternal(url);
});
electron.ipcMain.on("TRACKING_STARTED", (_, data) => {
  isTracking = true;
  currentTaskName = data.taskName;
  trackingTime = 0;
  keystrokes = 0;
  mouseClicks = 0;
  hasTriggeredAutoStop = false;
  if (data.endTime) {
    const [h, m] = data.endTime.split(":").map(Number);
    const now = /* @__PURE__ */ new Date();
    const endMinutes = h * 60 + m;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    remainingTime = Math.max(0, (endMinutes - nowMinutes) * 60 - now.getSeconds());
  } else {
    remainingTime = 0;
  }
  startHooks();
  console.log("Tracking started:", currentTaskName);
});
electron.ipcMain.on("TRACKING_STOPPED", () => {
  isTracking = false;
  currentTaskName = "";
  trackingTime = 0;
  remainingTime = 0;
  hideFloatingWidget();
  stopHooks();
  console.log("Tracking stopped");
});
let hasTriggeredAutoStop = false;
electron.ipcMain.on("TRACKING_TICK", (_, seconds) => {
  trackingTime = seconds;
  if (remainingTime > 0) {
    remainingTime = Math.max(0, remainingTime - 1);
    if (remainingTime === 0 && !hasTriggeredAutoStop) {
      hasTriggeredAutoStop = true;
      console.log("Schedule ended, triggering auto-stop for:", currentTaskName);
      mainWin?.webContents.send("SCHEDULE_AUTO_STOP", {
        taskName: currentTaskName,
        reason: "scheduled_end"
      });
    }
  }
  updateFloatingWidget();
});
electron.ipcMain.on("EXPAND_APP", () => {
  mainWin?.show();
  hideFloatingWidget();
});
electron.ipcMain.on("STOP_TRACKING_FROM_WIDGET", () => {
  mainWin?.webContents.send("STOP_TRACKING");
  hideFloatingWidget();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
electron.app.whenReady().then(() => {
  createMainWindow();
  createTray();
});
