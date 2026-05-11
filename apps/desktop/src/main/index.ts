import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } from "electron";
import { join, dirname } from "path";
import fs from "fs";
import checkDiskSpace from "check-disk-space";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { io: socketIo } = require("socket.io-client");

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
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      webSecurity: false,
    },
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

function createTray(): void {
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
          },
        },
        { type: "separator" },
        { label: "Quit", click: () => { tray = null; app.quit(); } },
      ]),
    );
  }

  rebuildTrayMenu();
  tray.on("double-click", () => mainWindow?.show());
}

async function checkForUpdates(): Promise<void> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/releases/latest`);
    if (!res.ok) return;
    const { version } = await res.json() as { version?: string; downloadUrl?: string };
    if (version && version !== app.getVersion()) {
      mainWindow?.webContents.send("update:available", { version });
    }
  } catch { /* server not reachable yet */ }
}

app.whenReady().then(() => {
  createWindow();
  setTimeout(() => checkForUpdates(), 8000);
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

ipcMain.handle("config:write", (_, data: unknown) => {
  const configPath = join(app.getPath("userData"), "pc2cloud.json");
  let existing: Record<string, unknown> = {};
  try { existing = JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch { /* first write */ }
  fs.writeFileSync(configPath, JSON.stringify({ ...existing, ...(data as Record<string, unknown>) }, null, 2), "utf-8");
});

ipcMain.handle("config:clear", () => {
  const configPath = join(app.getPath("userData"), "pc2cloud.json");
  try { fs.unlinkSync(configPath); } catch { /* already gone */ }
});

// ── Socket.io — runs in main process (Node.js) so no browser CORS applies ────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deviceSocket: any = null;
let sharedFolderPath = "";
let apiBaseUrl = "http://localhost:7000";
let bearerToken = "";

// Node.js fetch helper — no CORS restrictions
async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (bearerToken) headers["Authorization"] = `Bearer ${bearerToken}`;
  return fetch(url, { ...init, headers });
}

function getNodePath() { return require("path") as typeof import("path"); }
function getNodeFs()   { return require("fs")   as typeof import("fs"); }

function safeResolve(folder: string, relPath: string): string | null {
  const nodePath = getNodePath();
  const resolved = nodePath.resolve(nodePath.join(folder, relPath));
  const root     = nodePath.resolve(folder);
  return resolved.startsWith(root) ? resolved : null;
}

function getMimeTypeMain(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf", txt: "text/plain", md: "text/markdown",
    json: "application/json", html: "text/html", css: "text/css",
    js: "text/javascript", ts: "text/typescript",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    mp4: "video/mp4", mkv: "video/x-matroska", mp3: "audio/mpeg",
    zip: "application/zip",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
  };
  return map[ext] ?? "application/octet-stream";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleFileRequest(requestId: string, filePath: string): void {
  const folder = sharedFolderPath;
  const resolved = folder ? safeResolve(folder, filePath) : null;
  if (!resolved) {
    apiFetch(`${apiBaseUrl}/api/transfer/${requestId}/error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Folder not configured or path denied" }),
    }).catch(() => {});
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
        "x-mime-type": mimeType,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: data as any,
    }).catch(() => {});
  } catch (err) {
    apiFetch(`${apiBaseUrl}/api/transfer/${requestId}/error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: err instanceof Error ? err.message : "Could not read file" }),
    }).catch(() => {});
  }
}

async function handleFileUpload(requestId: string, filePath: string): Promise<void> {
  const folder = sharedFolderPath;
  const resolved = folder ? safeResolve(folder, filePath) : null;
  const rejectUpload = (msg: string) =>
    apiFetch(`${apiBaseUrl}/api/transfer/${requestId}/write-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    }).catch(() => {});

  if (!resolved) { rejectUpload("Folder not configured or path denied"); return; }
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
      body: JSON.stringify({ ok: true }),
    });
  } catch (err) {
    rejectUpload(err instanceof Error ? err.message : "Could not write file");
  }
}

ipcMain.handle("socket:connect", (_, deviceId: string, token: string, _apiUrl: string) => {
  bearerToken = token;
  if (_apiUrl) apiBaseUrl = _apiUrl;

  if (deviceSocket) {
    deviceSocket.disconnect();
    deviceSocket = null;
  }
  const socket = socketIo(apiBaseUrl, {
    auth: { token },
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    socket.emit("device:online", { deviceId });
    mainWindow?.webContents.send("socket:connected");
  });

  socket.on("connect_error", (err: Error) => {
    mainWindow?.webContents.send("socket:error", err.message);
  });

  socket.on("disconnect", () => {
    mainWindow?.webContents.send("socket:disconnected");
  });

  socket.on("file:request", ({ requestId, filePath }: { requestId: string; filePath: string }) => {
    handleFileRequest(requestId, filePath);
  });

  socket.on("file:upload", ({ requestId, filePath }: { requestId: string; filePath: string }) => {
    handleFileUpload(requestId, filePath).catch(() => {});
  });

  socket.on("folder:create", ({ folderPath }: { folderPath: string }) => {
    const folder = sharedFolderPath;
    const resolved = folder ? safeResolve(folder, folderPath) : null;
    if (!resolved) return;
    try { getNodeFs().mkdirSync(resolved, { recursive: true }); } catch { /* ignore */ }
  });

  socket.on("file:delete", ({ filePath }: { filePath: string }) => {
    const folder = sharedFolderPath;
    const resolved = folder ? safeResolve(folder, filePath) : null;
    if (!resolved) return;
    try {
      const nodeFs = getNodeFs();
      if (nodeFs.existsSync(resolved)) nodeFs.unlinkSync(resolved);
    } catch { /* ignore */ }
  });

  socket.on("folder:delete", ({ folderPath }: { folderPath: string }) => {
    const folder = sharedFolderPath;
    const resolved = folder ? safeResolve(folder, folderPath) : null;
    if (!resolved) return;
    try {
      const nodeFs = getNodeFs();
      if (nodeFs.existsSync(resolved)) nodeFs.rmSync(resolved, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  socket.on("file:rename", ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
    const folder = sharedFolderPath;
    const oldResolved = folder ? safeResolve(folder, oldPath) : null;
    const newResolved = folder ? safeResolve(folder, newPath) : null;
    if (!oldResolved || !newResolved) return;
    try {
      const nodeFs = getNodeFs();
      if (nodeFs.existsSync(oldResolved)) nodeFs.renameSync(oldResolved, newResolved);
    } catch { /* ignore */ }
  });

  deviceSocket = socket;
});

ipcMain.handle("socket:disconnect", () => {
  if (deviceSocket) {
    deviceSocket.disconnect();
    deviceSocket = null;
  }
});

ipcMain.handle("socket:set-folder", (_, folderPath: string) => {
  sharedFolderPath = folderPath;
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

// ── Folder scan & watch ──────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf", txt: "text/plain", md: "text/markdown",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  mp4: "video/mp4", mkv: "video/x-matroska", mp3: "audio/mpeg",
  zip: "application/zip", rar: "application/x-rar-compressed",
  json: "application/json", html: "text/html", css: "text/css",
  js: "text/javascript", ts: "text/typescript",
};

function getMimeType(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[ext] ?? null;
}

interface FileEntry {
  fileName: string;
  filePath: string;
  itemType: "file" | "folder";
  sizeBytes: number;
  mimeType: string | null;
  modifiedAt: string;
}

function scanFolder(rootDir: string): FileEntry[] {
  const results: FileEntry[] = [];

  function walk(dir: string) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = full.slice(rootDir.length).replace(/\\/g, "/");
      const filePath = rel.startsWith("/") ? rel : `/${rel}`;

      if (entry.isDirectory()) {
        results.push({ fileName: entry.name, filePath, itemType: "folder", sizeBytes: 0, mimeType: null, modifiedAt: new Date().toISOString() });
        walk(full);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(full);
          results.push({ fileName: entry.name, filePath, itemType: "file", sizeBytes: stat.size, mimeType: getMimeType(entry.name), modifiedAt: stat.mtime.toISOString() });
        } catch { /* skip */ }
      }
    }
  }

  if (fs.existsSync(rootDir)) walk(rootDir);
  return results;
}

let folderWatcher: fs.FSWatcher | null = null;
let watchDebounce: ReturnType<typeof setTimeout> | null = null;

ipcMain.handle("folder:scan", (_, folderPath: string) => scanFolder(folderPath));

ipcMain.handle("folder:watch", (_, folderPath: string) => {
  if (folderWatcher) { folderWatcher.close(); folderWatcher = null; }
  if (!fs.existsSync(folderPath)) return;
  folderWatcher = fs.watch(folderPath, { recursive: true }, () => {
    if (watchDebounce) clearTimeout(watchDebounce);
    watchDebounce = setTimeout(() => {
      mainWindow?.webContents.send("folder:changed");
    }, 1500);
  });
});

ipcMain.handle("folder:unwatch", () => {
  if (folderWatcher) { folderWatcher.close(); folderWatcher = null; }
  if (watchDebounce) { clearTimeout(watchDebounce); watchDebounce = null; }
});

ipcMain.handle("file:read", async (_, absolutePath: string) => {
  const stat = fs.statSync(absolutePath);
  if (stat.size > 500 * 1024 * 1024) {
    throw new Error("File too large to download via relay (max 500 MB)");
  }
  const data = fs.readFileSync(absolutePath);
  const fileName = absolutePath.split(/[/\\]/).pop() ?? "download";
  return { data, fileName, mimeType: getMimeType(fileName) };
});

ipcMain.handle("file:write", (_, absolutePath: string, data: Uint8Array) => {
  fs.mkdirSync(dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, Buffer.from(data));
});

ipcMain.handle("file:delete", (_, absolutePath: string) => {
  if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
});

ipcMain.handle("storage:get-info", async (_, folderPath: string) => {
  function folderSize(dir: string): number {
    let total = 0;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) total += folderSize(full);
        else if (entry.isFile()) total += fs.statSync(full).size;
      }
    } catch { /* skip unreadable paths */ }
    return total;
  }

  const used = fs.existsSync(folderPath) ? folderSize(folderPath) : 0;
  const disk = await checkDiskSpace(folderPath);
  return { usedStorageBytes: used, storageLimitBytes: disk.free };
});
