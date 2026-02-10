"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  // Device ID (hardware fingerprint)
  getDeviceId: () => electron.ipcRenderer.invoke("GET_DEVICE_ID"),
  // Screenshot
  captureScreenshot: () => electron.ipcRenderer.invoke("CAPTURE_SCREENSHOT"),
  // Activity Stats (read-only)
  getActivityStats: () => electron.ipcRenderer.invoke("GET_ACTIVITY_STATS"),
  // Reset Activity Stats (call after successful upload)
  resetActivityStats: () => electron.ipcRenderer.invoke("RESET_ACTIVITY_STATS"),
  // Get app usage data (returns buffered entries and resets buffer)
  getAppUsage: () => electron.ipcRenderer.invoke("GET_APP_USAGE"),
  // Get current active window (for heartbeat)
  getCurrentApp: () => electron.ipcRenderer.invoke("GET_CURRENT_APP"),
  // Open external URL
  openExternal: (url) => electron.ipcRenderer.invoke("OPEN_EXTERNAL", url),
  // Download file with save dialog
  downloadFile: (data) => electron.ipcRenderer.invoke("DOWNLOAD_FILE", data),
  // Tracking notifications to main process
  trackingStarted: (data) => electron.ipcRenderer.send("TRACKING_STARTED", data),
  trackingStopped: () => electron.ipcRenderer.send("TRACKING_STOPPED"),
  trackingTick: (seconds) => electron.ipcRenderer.send("TRACKING_TICK", seconds),
  trackingTickMulti: (data) => electron.ipcRenderer.send("TRACKING_TICK_MULTI", data),
  // Focus main window (from MiniWidget or floating widget)
  focusMainWindow: () => electron.ipcRenderer.send("FOCUS_MAIN_WINDOW"),
  // Listen for stop command from main process (tray/widget)
  // Returns cleanup function to prevent listener accumulation
  onStopTracking: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("STOP_TRACKING", handler);
    return () => electron.ipcRenderer.removeListener("STOP_TRACKING", handler);
  },
  // Listen for schedule-based auto-stop from main process
  onScheduleAutoStop: (callback) => {
    const handler = (_event, data) => callback(data);
    electron.ipcRenderer.on("SCHEDULE_AUTO_STOP", handler);
    return () => electron.ipcRenderer.removeListener("SCHEDULE_AUTO_STOP", handler);
  },
  // General updates
  onUpdate: (callback) => {
    const handler = (_event, value) => callback(value);
    electron.ipcRenderer.on("main-process-message", handler);
    return () => electron.ipcRenderer.removeListener("main-process-message", handler);
  },
  // Auto-Updater (Phase 6.4)
  checkForUpdates: () => electron.ipcRenderer.invoke("CHECK_FOR_UPDATES"),
  downloadUpdate: () => electron.ipcRenderer.invoke("DOWNLOAD_UPDATE"),
  quitAndInstall: () => electron.ipcRenderer.send("QUIT_AND_INSTALL"),
  onUpdateAvailable: (callback) => {
    const handler = (_event, info) => callback(info);
    electron.ipcRenderer.on("UPDATE_AVAILABLE", handler);
    return () => electron.ipcRenderer.removeListener("UPDATE_AVAILABLE", handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_event, info) => callback(info);
    electron.ipcRenderer.on("UPDATE_DOWNLOADED", handler);
    return () => electron.ipcRenderer.removeListener("UPDATE_DOWNLOADED", handler);
  },
  onDownloadProgress: (callback) => {
    const handler = (_event, progress) => callback(progress);
    electron.ipcRenderer.on("DOWNLOAD_PROGRESS", handler);
    return () => electron.ipcRenderer.removeListener("DOWNLOAD_PROGRESS", handler);
  },
  onUpdateError: (callback) => {
    const handler = (_event, error) => callback(error);
    electron.ipcRenderer.on("UPDATE_ERROR", handler);
    return () => electron.ipcRenderer.removeListener("UPDATE_ERROR", handler);
  }
});
