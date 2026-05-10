import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("pc2cloud", {
  pickFolder: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:pick-folder"),

  getDiskInfo: (folderPath: string): Promise<{ free: number; total: number }> =>
    ipcRenderer.invoke("disk:get-info", folderPath),

  createFolder: (dirPath: string): Promise<string> =>
    ipcRenderer.invoke("folder:create", dirPath),

  minimizeToTray: (): Promise<void> =>
    ipcRenderer.invoke("app:minimize-tray"),

  openDashboard: (): Promise<void> =>
    ipcRenderer.invoke("app:open-dashboard"),

  minimizeWindow: (): Promise<void> =>
    ipcRenderer.invoke("window:minimize"),

  closeWindow: (): Promise<void> =>
    ipcRenderer.invoke("window:close"),
});
