import { useEffect, useRef, useState } from "react";
import Login from "./screens/Login";
import Setup from "./screens/Setup";
import Ready from "./screens/Ready";
import { API_URL, apiFetch, setToken, getToken } from "./lib/api";

type Screen = "loading" | "login" | "setup" | "folder-missing" | "ready";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipc = () => (window as any).require("electron").ipcRenderer;

const STORAGE_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [hasConfig, setHasConfig] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const storageSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceIdRef = useRef<string>("");
  const folderPathRef = useRef<string>("");
  const fileSyncBusyRef = useRef(false);

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
    }
    finally { fileSyncBusyRef.current = false; }
  }

  function startStorageSync(deviceId: string, folderPath: string) {
    if (storageSyncRef.current) clearInterval(storageSyncRef.current);
    if (!folderPath) return;
    storageSyncRef.current = setInterval(
      () => pushStorageUpdate(deviceId, folderPath),
      STORAGE_SYNC_INTERVAL,
    );
  }

  async function reconnectWithConfig(config: { deviceId: string; folderPath: string; deviceName?: string }): Promise<boolean> {
    deviceIdRef.current = config.deviceId;

    // Recover sharedFolderPath from the server when local config is missing it
    let folderPath = config.folderPath;
    try {
      const res = await apiFetch(`${API_URL}/api/devices/${config.deviceId}/heartbeat`, {
        method: "PATCH",
      });
      if (res.ok) {
        const data = await res.json();
        if (!folderPath && data.sharedFolderPath) {
          folderPath = data.sharedFolderPath;
          await ipc().invoke("config:write", { ...config, folderPath });
        }
      }
      connectSocket(config.deviceId);
    } catch { /* go to ready anyway */ }

    // If a folder path is configured but no longer exists on disk, prompt re-pick
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

    // Update server with new folder path
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

  // Watch folder for changes while on the ready screen
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
      // Restore persisted token so Bearer auth works before any API call
      const config = await ipc().invoke("config:read");
      if (config?.authToken) setToken(config.authToken);

      const authRes = await apiFetch(`${API_URL}/api/auth/me`).catch(() => null);
      if (!authRes?.ok) {
        if (config?.deviceId) setHasConfig(true);
        setScreen("login");
        return;
      }

      if (config?.deviceId) {
        const ok = await reconnectWithConfig(config);
        setScreen(ok ? "ready" : "folder-missing");
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
      const ok = await reconnectWithConfig(config);
      setHasConfig(false);
      setScreen(ok ? "ready" : "folder-missing");
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
    // Preserve deviceId + folderPath so next login reconnects to the same device without re-running Setup
    if (savedDeviceId || savedFolderPath) {
      await ipc().invoke("config:write", { deviceId: savedDeviceId, folderPath: savedFolderPath });
    }
    setToken("");
    setHasConfig(false);
    setScreen("login");
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="drag-region flex h-8 shrink-0 items-center justify-between px-4">
        <span className="text-xs font-medium text-muted-foreground">PC2CLOUD</span>
        <div className="no-drag flex gap-1">
          <button
            onClick={() => ipc().invoke("window:minimize")}
            className="flex size-5 items-center justify-center rounded text-xs text-muted-foreground hover:bg-muted"
          >
            –
          </button>
          <button
            onClick={() => ipc().invoke("window:close")}
            className="flex size-5 items-center justify-center rounded text-xs text-muted-foreground hover:bg-red-100 hover:text-red-600"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden px-8 pb-8">
        {screen === "loading" && (
          <div className="flex flex-1 items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {screen === "login" && <Login onDone={handleLoginDone} />}
        {screen === "setup" && <Setup onDone={handleSetupDone} onLogout={handleSetupLogout} />}
        {screen === "folder-missing" && (
          <div className="flex flex-1 flex-col justify-center gap-5">
            <div>
              <h2 className="text-xl font-semibold">Folder not found</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your PC2CLOUD folder was moved or deleted. Pick a new location to continue.
              </p>
            </div>
            <button
              onClick={handleRePickFolder}
              className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-primary/5"
            >
              <span className="text-2xl">📁</span>
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
