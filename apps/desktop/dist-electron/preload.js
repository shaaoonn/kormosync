"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  // Screenshot
  captureScreenshot: () => electron.ipcRenderer.invoke("CAPTURE_SCREENSHOT"),
  // Activity Stats (Get and Reset)
  getActivityStats: () => electron.ipcRenderer.invoke("GET_ACTIVITY_STATS"),
  // Open external URL
  openExternal: (url) => electron.ipcRenderer.invoke("OPEN_EXTERNAL", url),
  // Tracking notifications to main process
  trackingStarted: (data) => electron.ipcRenderer.send("TRACKING_STARTED", data),
  trackingStopped: () => electron.ipcRenderer.send("TRACKING_STOPPED"),
  trackingTick: (seconds) => electron.ipcRenderer.send("TRACKING_TICK", seconds),
  // Listen for stop command from main process (tray/widget)
  onStopTracking: (callback) => electron.ipcRenderer.on("STOP_TRACKING", () => callback()),
  // Listen for schedule-based auto-stop from main process
  onScheduleAutoStop: (callback) => electron.ipcRenderer.on("SCHEDULE_AUTO_STOP", (_event, data) => callback(data)),
  // General updates
  onUpdate: (callback) => electron.ipcRenderer.on("main-process-message", (_event, value) => callback(value))
});
