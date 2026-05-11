"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const checkDiskSpace = require("check-disk-space");
const { io: socketIo } = require("socket.io-client");
const isDev = process.env.NODE_ENV === "development";
let mainWindow = null;
let tray = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 460,
    height: 560,
    resizable: false,
    show: false,
    frame: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      webSecurity: false
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
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function createTray() {
  const icon = electron.nativeImage.createEmpty();
  tray = new electron.Tray(icon);
  tray.setToolTip("PC2CLOUD");
  function rebuildTrayMenu() {
    const launchAtStartup = electron.app.getLoginItemSettings().openAtLogin;
    tray?.setContextMenu(
      electron.Menu.buildFromTemplate([
        { label: "Open PC2CLOUD", click: () => mainWindow?.show() },
        { type: "separator" },
        {
          label: "Launch at startup",
          type: "checkbox",
          checked: launchAtStartup,
          click: () => {
            electron.app.setLoginItemSettings({ openAtLogin: !launchAtStartup });
            rebuildTrayMenu();
          }
        },
        { type: "separator" },
        { label: "Quit", click: () => {
          tray = null;
          electron.app.quit();
        } }
      ])
    );
  }
  rebuildTrayMenu();
  tray.on("double-click", () => mainWindow?.show());
}
electron.app.whenReady().then(() => {
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.ipcMain.handle("config:read", () => {
  const configPath = path.join(electron.app.getPath("userData"), "pc2cloud.json");
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
});
electron.ipcMain.handle("config:write", (_, data) => {
  const configPath = path.join(electron.app.getPath("userData"), "pc2cloud.json");
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
  }
  fs.writeFileSync(configPath, JSON.stringify({ ...existing, ...data }, null, 2), "utf-8");
});
electron.ipcMain.handle("config:clear", () => {
  const configPath = path.join(electron.app.getPath("userData"), "pc2cloud.json");
  try {
    fs.unlinkSync(configPath);
  } catch {
  }
});
let deviceSocket = null;
let sharedFolderPath = "";
let apiBaseUrl = "http://localhost:7000";
let bearerToken = "";
async function apiFetch(url, init = {}) {
  const headers = { ...init.headers };
  if (bearerToken) headers["Authorization"] = `Bearer ${bearerToken}`;
  return fetch(url, { ...init, headers });
}
function getNodePath() {
  return require("path");
}
function getNodeFs() {
  return require("fs");
}
function safeResolve(folder, relPath) {
  const nodePath = getNodePath();
  const resolved = nodePath.resolve(nodePath.join(folder, relPath));
  const root = nodePath.resolve(folder);
  return resolved.startsWith(root) ? resolved : null;
}
function getMimeTypeMain(name) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map = {
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    ts: "text/typescript",
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
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword"
  };
  return map[ext] ?? "application/octet-stream";
}
function handleFileRequest(requestId, filePath) {
  const folder = sharedFolderPath;
  const resolved = folder ? safeResolve(folder, filePath) : null;
  if (!resolved) {
    apiFetch(`${apiBaseUrl}/api/transfer/${requestId}/error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Folder not configured or path denied" })
    }).catch(() => {
    });
    return;
  }
  try {
    const nodeFs = getNodeFs();
    const nodePath = getNodePath();
    const data = nodeFs.readFileSync(resolved);
    const fileName = nodePath.basename(resolved);
    const mimeType = getMimeTypeMain(fileName);
    apiFetch(`${apiBaseUrl}/api/transfer/${requestId}`, {
      method: "POST",
      headers: {
        "Content-Type": mimeType,
        "x-file-name": encodeURIComponent(fileName),
        "x-mime-type": mimeType
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: data
    }).catch(() => {
    });
  } catch (err) {
    apiFetch(`${apiBaseUrl}/api/transfer/${requestId}/error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: err instanceof Error ? err.message : "Could not read file" })
    }).catch(() => {
    });
  }
}
async function handleFileUpload(requestId, filePath) {
  const folder = sharedFolderPath;
  const resolved = folder ? safeResolve(folder, filePath) : null;
  const rejectUpload = (msg) => apiFetch(`${apiBaseUrl}/api/transfer/${requestId}/write-error`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg })
  }).catch(() => {
  });
  if (!resolved) {
    rejectUpload("Folder not configured or path denied");
    return;
  }
  try {
    const nodeFs = getNodeFs();
    const nodePath = getNodePath();
    const res = await apiFetch(`${apiBaseUrl}/api/transfer/${requestId}/content`);
    const buf = Buffer.from(await res.arrayBuffer());
    nodeFs.mkdirSync(nodePath.dirname(resolved), { recursive: true });
    nodeFs.writeFileSync(resolved, buf);
    await apiFetch(`${apiBaseUrl}/api/transfer/${requestId}/write-done`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    });
  } catch (err) {
    rejectUpload(err instanceof Error ? err.message : "Could not write file");
  }
}
electron.ipcMain.handle("socket:connect", (_, deviceId, token, _apiUrl) => {
  bearerToken = token;
  if (_apiUrl) apiBaseUrl = _apiUrl;
  if (deviceSocket) {
    deviceSocket.disconnect();
    deviceSocket = null;
  }
  const socket = socketIo(apiBaseUrl, {
    auth: { token },
    transports: ["websocket", "polling"]
  });
  socket.on("connect", () => {
    socket.emit("device:online", { deviceId });
    mainWindow?.webContents.send("socket:connected");
  });
  socket.on("connect_error", (err) => {
    mainWindow?.webContents.send("socket:error", err.message);
  });
  socket.on("disconnect", () => {
    mainWindow?.webContents.send("socket:disconnected");
  });
  socket.on("file:request", ({ requestId, filePath }) => {
    handleFileRequest(requestId, filePath);
  });
  socket.on("file:upload", ({ requestId, filePath }) => {
    handleFileUpload(requestId, filePath).catch(() => {
    });
  });
  socket.on("folder:create", ({ folderPath }) => {
    const folder = sharedFolderPath;
    const resolved = folder ? safeResolve(folder, folderPath) : null;
    if (!resolved) return;
    try {
      getNodeFs().mkdirSync(resolved, { recursive: true });
    } catch {
    }
  });
  socket.on("file:delete", ({ filePath }) => {
    const folder = sharedFolderPath;
    const resolved = folder ? safeResolve(folder, filePath) : null;
    if (!resolved) return;
    try {
      const nodeFs = getNodeFs();
      if (nodeFs.existsSync(resolved)) nodeFs.unlinkSync(resolved);
    } catch {
    }
  });
  deviceSocket = socket;
});
electron.ipcMain.handle("socket:disconnect", () => {
  if (deviceSocket) {
    deviceSocket.disconnect();
    deviceSocket = null;
  }
});
electron.ipcMain.handle("socket:set-folder", (_, folderPath) => {
  sharedFolderPath = folderPath;
});
electron.ipcMain.handle("dialog:pick-folder", async () => {
  if (!mainWindow) return null;
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Choose where to create your PC2CLOUD folder",
    buttonLabel: "Select Folder"
  });
  return result.canceled ? null : result.filePaths[0];
});
electron.ipcMain.handle("app:open-dashboard", () => {
  electron.shell.openExternal(process.env["VITE_DASHBOARD_URL"] ?? "http://localhost:8000");
});
electron.ipcMain.handle("app:minimize-tray", () => {
  if (!tray) createTray();
  mainWindow?.hide();
});
electron.ipcMain.handle("window:minimize", () => mainWindow?.minimize());
electron.ipcMain.handle("window:close", () => {
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
      const full = path.join(dir, entry.name);
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
electron.ipcMain.handle("folder:scan", (_, folderPath) => scanFolder(folderPath));
electron.ipcMain.handle("folder:watch", (_, folderPath) => {
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
electron.ipcMain.handle("folder:unwatch", () => {
  if (folderWatcher) {
    folderWatcher.close();
    folderWatcher = null;
  }
  if (watchDebounce) {
    clearTimeout(watchDebounce);
    watchDebounce = null;
  }
});
electron.ipcMain.handle("file:read", async (_, absolutePath) => {
  const stat = fs.statSync(absolutePath);
  if (stat.size > 500 * 1024 * 1024) {
    throw new Error("File too large to download via relay (max 500 MB)");
  }
  const data = fs.readFileSync(absolutePath);
  const fileName = absolutePath.split(/[/\\]/).pop() ?? "download";
  return { data, fileName, mimeType: getMimeType(fileName) };
});
electron.ipcMain.handle("file:write", (_, absolutePath, data) => {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, Buffer.from(data));
});
electron.ipcMain.handle("file:delete", (_, absolutePath) => {
  if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
});
electron.ipcMain.handle("storage:get-info", async (_, folderPath) => {
  function folderSize(dir) {
    let total = 0;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
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
