"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("pc2cloud", {
  pickFolder: () => electron.ipcRenderer.invoke("dialog:pick-folder"),
  getDiskInfo: (folderPath) => electron.ipcRenderer.invoke("disk:get-info", folderPath),
  createFolder: (dirPath) => electron.ipcRenderer.invoke("folder:create", dirPath),
  minimizeToTray: () => electron.ipcRenderer.invoke("app:minimize-tray"),
  openDashboard: () => electron.ipcRenderer.invoke("app:open-dashboard"),
  minimizeWindow: () => electron.ipcRenderer.invoke("window:minimize"),
  closeWindow: () => electron.ipcRenderer.invoke("window:close")
});
