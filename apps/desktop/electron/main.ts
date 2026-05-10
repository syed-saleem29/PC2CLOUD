import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } from "electron";
import { join } from "path";
import checkDiskSpace from "check-disk-space";
import fs from "fs";

const isDev = process.env.NODE_ENV === "development";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 560,
    resizable: false,
    show: false,
    frame: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    if (tray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function createTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("PC2CLOUD");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open PC2CLOUD", click: () => mainWindow?.show() },
      { type: "separator" },
      { label: "Quit", click: () => { tray = null; app.quit(); } },
    ]),
  );
  tray.on("double-click", () => mainWindow?.show());
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("dialog:pick-folder", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Choose where to create your PC2CLOUD folder",
    buttonLabel: "Select Folder",
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("disk:get-info", async (_, folderPath: string) => {
  const info = await checkDiskSpace(folderPath);
  return { free: info.free, total: info.size };
});

ipcMain.handle("folder:create", async (_, dirPath: string) => {
  const folderPath = join(dirPath, "PC2CLOUD");
  fs.mkdirSync(folderPath, { recursive: true });
  return folderPath;
});

ipcMain.handle("app:minimize-tray", () => {
  if (!tray) createTray();
  mainWindow?.hide();
});

ipcMain.handle("app:open-dashboard", () => {
  shell.openExternal(process.env["VITE_DASHBOARD_URL"] ?? "http://localhost:3000");
});

ipcMain.handle("window:minimize", () => mainWindow?.minimize());

ipcMain.handle("window:close", () => {
  if (tray) {
    mainWindow?.hide();
  } else {
    mainWindow?.close();
  }
});
