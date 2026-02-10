"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronWidget", {
  expandApp: () => electron.ipcRenderer.send("EXPAND_APP"),
  minimizeWidget: () => electron.ipcRenderer.send("MINIMIZE_WIDGET"),
  onUpdate: (callback) => {
    electron.ipcRenderer.on("UPDATE_WIDGET", (_event, data) => callback(data));
  }
});
