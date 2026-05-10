import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("pc2cloud", {
  pickFolder: () => ipcRenderer.invoke("dialog:pick-folder"),
  getDiskInfo: (folderPath) => ipcRenderer.invoke("disk:get-info", folderPath),
  createFolder: (dirPath) => ipcRenderer.invoke("folder:create", dirPath),
  minimizeToTray: () => ipcRenderer.invoke("app:minimize-tray"),
  openDashboard: () => ipcRenderer.invoke("app:open-dashboard"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  closeWindow: () => ipcRenderer.invoke("window:close")
});
