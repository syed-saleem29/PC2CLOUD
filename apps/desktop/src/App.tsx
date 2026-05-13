import { useEffect, useRef, useState } from "react";
import { Cloud, Minus, Moon, Sun, X } from "lucide-react";
import Login from "./screens/Login";
import Setup from "./screens/Setup";
import Ready from "./screens/Ready";
import { API_URL, apiFetch, setToken, getToken } from "./lib/api";

type Screen = "loading" | "login" | "setup" | "folder-missing" | "ready";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipc = () => (window as any).require("electron").ipcRenderer;

const STORAGE_SYNC_INTERVAL = 5 * 60 * 1000;

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [hasConfig, setHasConfig] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("pc2cloud_theme");
      if (saved) return saved === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch { return false; }
  });

  const storageSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceIdRef = useRef<string>("");
  const folderPathRef = useRef<string>("");
  const fileSyncBusyRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("pc2cloud_theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);

  function connectSocket(deviceId: string) {
    ipc().invoke("socket:connect", deviceId, getToken(), API_URL);
  }

  async function pushStorageUpdate(deviceId: string, folderPath: string) {
    if (!folderPath) return;
    try {
      const info = await ipc().invoke("storage:get-info", folderPath);
      await apiFetch(`${API_URL}/api/devices/${deviceId}/storage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info),
      });
    } catch { /* ignore */ }
  }

  async function pushFileSync(deviceId: string, folderPath: string) {
    if (!folderPath || fileSyncBusyRef.current) return;
    fileSyncBusyRef.current = true;
    setSyncStatus("syncing");
    try {
      const files = await ipc().invoke("folder:scan", folderPath);
      if (!files || files.length === 0) {
        setSyncStatus("done");
        setLastSyncTime(new Date());
        return;
      }
      const res = await apiFetch(`${API_URL}/api/devices/${deviceId}/files/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) throw new Error("Sync failed");
      setSyncStatus("done");
      setLastSyncTime(new Date());
    } catch {
      setSyncStatus("error");
    } finally { fileSyncBusyRef.current = false; }
  }

  function startStorageSync(deviceId: string, folderPath: string) {
    if (storageSyncRef.current) clearInterval(storageSyncRef.current);
    if (!folderPath) return;
    storageSyncRef.current = setInterval(
      () => pushStorageUpdate(deviceId, folderPath),
      STORAGE_SYNC_INTERVAL,
    );
  }

  async function reconnectWithConfig(config: { deviceId: string; folderPath: string; deviceName?: string }): Promise<boolean | "setup"> {
    deviceIdRef.current = config.deviceId;
    let folderPath = config.folderPath;
    try {
      const res = await apiFetch(`${API_URL}/api/devices/${config.deviceId}/heartbeat`, {
        method: "PATCH",
      });
      if (res.status === 404) return "setup";
      if (res.ok) {
        const data = await res.json();
        if (!folderPath && data.sharedFolderPath) {
          folderPath = data.sharedFolderPath;
          await ipc().invoke("config:write", { ...config, folderPath });
        }
      }
      connectSocket(config.deviceId);
    } catch { /* network error — proceed to ready with cached config */ }

    if (folderPath) {
      const exists: boolean = await ipc().invoke("folder:exists", folderPath);
      if (!exists) return false;
    }

    folderPathRef.current = folderPath;
    if (folderPath) ipc().invoke("socket:set-folder", folderPath);
    await pushStorageUpdate(config.deviceId, folderPath);
    await pushFileSync(config.deviceId, folderPath);
    startStorageSync(config.deviceId, folderPath);
    return true;
  }

  async function handleRePickFolder() {
    const dir: string | null = await ipc().invoke("dialog:pick-folder");
    if (!dir) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const nodePath = w.require("path");
    const nodeFs = w.require("fs");
    const folderPath: string = nodePath.join(dir, "PC2CLOUD");
    nodeFs.mkdirSync(folderPath, { recursive: true });

    const config = await ipc().invoke("config:read");
    const deviceId = deviceIdRef.current;
    await ipc().invoke("config:write", { ...config, folderPath });

    folderPathRef.current = folderPath;
    ipc().invoke("socket:set-folder", folderPath);

    apiFetch(`${API_URL}/api/devices/${deviceId}/storage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sharedFolderPath: folderPath }),
    }).catch(() => {});

    pushStorageUpdate(deviceId, folderPath);
    pushFileSync(deviceId, folderPath);
    startStorageSync(deviceId, folderPath);
    setScreen("ready");
  }

  useEffect(() => {
    if (screen !== "ready") return;
    const deviceId = deviceIdRef.current;
    const folderPath = folderPathRef.current;
    if (!folderPath) return;

    ipc().invoke("folder:watch", folderPath);

    const handler = () => {
      pushFileSync(deviceId, folderPath);
      pushStorageUpdate(deviceId, folderPath);
    };
    const missingHandler = () => {
      if (storageSyncRef.current) clearInterval(storageSyncRef.current);
      setScreen("folder-missing");
    };
    ipc().on("folder:changed", handler);
    ipc().on("folder:missing", missingHandler);

    return () => {
      ipc().invoke("folder:unwatch");
      ipc().removeListener("folder:changed", handler);
      ipc().removeListener("folder:missing", missingHandler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    (async () => {
      const config = await ipc().invoke("config:read");
      if (config?.authToken) setToken(config.authToken);

      const authRes = await apiFetch(`${API_URL}/api/auth/me`).catch(() => null);
      if (!authRes?.ok) {
        if (config?.deviceId) setHasConfig(true);
        setScreen("login");
        return;
      }

      if (config?.deviceId) {
        const result = await reconnectWithConfig(config);
        if (result === "setup") { await ipc().invoke("config:clear"); setScreen("setup"); return; }
        setScreen(result ? "ready" : "folder-missing");
        return;
      }

      setScreen("setup");
    })();

    return () => {
      if (storageSyncRef.current) clearInterval(storageSyncRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLoginDone() {
    const config = await ipc().invoke("config:read");
    if (config?.deviceId) {
      const result = await reconnectWithConfig(config);
      setHasConfig(false);
      if (result === "setup") { await ipc().invoke("config:clear"); setScreen("setup"); return; }
      setScreen(result ? "ready" : "folder-missing");
      return;
    }
    setScreen("setup");
  }

  async function handleSetupLogout() {
    await apiFetch(`${API_URL}/api/auth/logout`, { method: "POST" }).catch(() => {});
    await ipc().invoke("config:clear");
    setToken("");
    setScreen("login");
  }

  function handleSetupDone(deviceId: string, folderPath: string) {
    deviceIdRef.current = deviceId;
    folderPathRef.current = folderPath;
    if (folderPath) ipc().invoke("socket:set-folder", folderPath);
    connectSocket(deviceId);
    pushStorageUpdate(deviceId, folderPath);
    pushFileSync(deviceId, folderPath);
    startStorageSync(deviceId, folderPath);
    setScreen("ready");
  }

  async function handleDisconnect() {
    ipc().invoke("folder:unwatch");
    await ipc().invoke("socket:disconnect");
    if (storageSyncRef.current) clearInterval(storageSyncRef.current);
    const savedDeviceId = deviceIdRef.current;
    const savedFolderPath = folderPathRef.current;
    await ipc().invoke("config:clear");
    if (savedDeviceId || savedFolderPath) {
      await ipc().invoke("config:write", { deviceId: savedDeviceId, folderPath: savedFolderPath });
    }
    setToken("");
    setHasConfig(false);
    setScreen("login");
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Title bar */}
      <div className="drag-region flex h-9 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded-md bg-primary">
            <Cloud size={11} className="text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase select-none">
            PC2CLOUD
          </span>
        </div>
        <div className="no-drag flex items-center gap-0.5">
          <button
            onClick={() => setDark(d => !d)}
            className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun size={12} aria-hidden="true" /> : <Moon size={12} aria-hidden="true" />}
          </button>
          <button
            onClick={() => ipc().invoke("window:minimize")}
            className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Minus size={12} aria-hidden="true" />
          </button>
          <button
            onClick={() => ipc().invoke("window:close")}
            className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-red-500/15 hover:text-red-500"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Screen content */}
      <div className="flex flex-1 flex-col overflow-hidden px-7 pb-7">
        {screen === "loading" && (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-xs text-muted-foreground">Connecting…</span>
            </div>
          </div>
        )}
        {screen === "login" && <Login onDone={handleLoginDone} hasConfig={hasConfig} />}
        {screen === "setup" && <Setup onDone={handleSetupDone} onLogout={handleSetupLogout} />}
        {screen === "folder-missing" && (
          <div className="flex flex-1 flex-col justify-center gap-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                <span className="text-2xl">📁</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Folder not found</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your PC2CLOUD folder was moved or deleted.
                  <br />Pick a new location to continue.
                </p>
              </div>
            </div>
            <button
              onClick={handleRePickFolder}
              className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-primary/5"
            >
              <span className="text-sm font-medium">Choose new folder location</span>
              <span className="text-xs text-muted-foreground">A PC2CLOUD subfolder will be created here</span>
            </button>
          </div>
        )}
        {screen === "ready" && (
          <Ready
            onDisconnect={handleDisconnect}
            syncStatus={syncStatus}
            lastSyncTime={lastSyncTime}
            onSyncNow={() => pushFileSync(deviceIdRef.current, folderPathRef.current)}
          />
        )}
      </div>
    </div>
  );
}
