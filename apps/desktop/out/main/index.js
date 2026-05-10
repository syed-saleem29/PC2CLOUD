import { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, Tray, Menu } from "electron";
import { join, dirname } from "path";
import fs from "fs";
import checkDiskSpace from "check-disk-space";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const isDev = process.env.NODE_ENV === "development";
let mainWindow = null;
let tray = null;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 560,
    resizable: false,
    show: false,
    frame: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => mainWindow?.show());
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
function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("PC2CLOUD");
  function rebuildTrayMenu() {
    const launchAtStartup = app.getLoginItemSettings().openAtLogin;
    tray?.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open PC2CLOUD", click: () => mainWindow?.show() },
        { type: "separator" },
        {
          label: "Launch at startup",
          type: "checkbox",
          checked: launchAtStartup,
          click: () => {
            app.setLoginItemSettings({ openAtLogin: !launchAtStartup });
            rebuildTrayMenu();
          }
        },
        { type: "separator" },
        { label: "Quit", click: () => {
          tray = null;
          app.quit();
        } }
      ])
    );
  }
  rebuildTrayMenu();
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
ipcMain.handle("config:read", () => {
  const configPath = join(app.getPath("userData"), "pc2cloud.json");
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
});
ipcMain.handle("config:write", (_, data) => {
  const configPath = join(app.getPath("userData"), "pc2cloud.json");
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), "utf-8");
});
ipcMain.handle("config:clear", () => {
  const configPath = join(app.getPath("userData"), "pc2cloud.json");
  try {
    fs.unlinkSync(configPath);
  } catch {
  }
});
ipcMain.handle("dialog:pick-folder", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Choose where to create your PC2CLOUD folder",
    buttonLabel: "Select Folder"
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("app:open-dashboard", () => {
  shell.openExternal(process.env["VITE_DASHBOARD_URL"] ?? "http://localhost:8000");
});
ipcMain.handle("app:minimize-tray", () => {
  if (!tray) createTray();
  mainWindow?.hide();
});
ipcMain.handle("window:minimize", () => mainWindow?.minimize());
ipcMain.handle("window:close", () => {
  if (tray) {
    mainWindow?.hide();
  } else {
    mainWindow?.close();
  }
});
const MIME_TYPES = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  zip: "application/zip",
  rar: "application/x-rar-compressed",
  json: "application/json",
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  ts: "text/typescript"
};
function getMimeType(name) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[ext] ?? null;
}
function scanFolder(rootDir) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = full.slice(rootDir.length).replace(/\\/g, "/");
      const filePath = rel.startsWith("/") ? rel : `/${rel}`;
      if (entry.isDirectory()) {
        results.push({ fileName: entry.name, filePath, itemType: "folder", sizeBytes: 0, mimeType: null, modifiedAt: (/* @__PURE__ */ new Date()).toISOString() });
        walk(full);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(full);
          results.push({ fileName: entry.name, filePath, itemType: "file", sizeBytes: stat.size, mimeType: getMimeType(entry.name), modifiedAt: stat.mtime.toISOString() });
        } catch {
        }
      }
    }
  }
  if (fs.existsSync(rootDir)) walk(rootDir);
  return results;
}
let folderWatcher = null;
let watchDebounce = null;
ipcMain.handle("folder:scan", (_, folderPath) => scanFolder(folderPath));
ipcMain.handle("folder:watch", (_, folderPath) => {
  if (folderWatcher) {
    folderWatcher.close();
    folderWatcher = null;
  }
  if (!fs.existsSync(folderPath)) return;
  folderWatcher = fs.watch(folderPath, { recursive: true }, () => {
    if (watchDebounce) clearTimeout(watchDebounce);
    watchDebounce = setTimeout(() => {
      mainWindow?.webContents.send("folder:changed");
    }, 1500);
  });
});
ipcMain.handle("folder:unwatch", () => {
  if (folderWatcher) {
    folderWatcher.close();
    folderWatcher = null;
  }
  if (watchDebounce) {
    clearTimeout(watchDebounce);
    watchDebounce = null;
  }
});
ipcMain.handle("file:read", async (_, absolutePath) => {
  const stat = fs.statSync(absolutePath);
  if (stat.size > 500 * 1024 * 1024) {
    throw new Error("File too large to download via relay (max 500 MB)");
  }
  const data = fs.readFileSync(absolutePath);
  const fileName = absolutePath.split(/[/\\]/).pop() ?? "download";
  return { data, fileName, mimeType: getMimeType(fileName) };
});
ipcMain.handle("file:write", (_, absolutePath, data) => {
  fs.mkdirSync(dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, Buffer.from(data));
});
ipcMain.handle("file:delete", (_, absolutePath) => {
  if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
});
ipcMain.handle("storage:get-info", async (_, folderPath) => {
  function folderSize(dir) {
    let total = 0;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) total += folderSize(full);
        else if (entry.isFile()) total += fs.statSync(full).size;
      }
    } catch {
    }
    return total;
  }
  const used = fs.existsSync(folderPath) ? folderSize(folderPath) : 0;
  const disk = await checkDiskSpace(folderPath);
  return { usedStorageBytes: used, storageLimitBytes: disk.free };
});
