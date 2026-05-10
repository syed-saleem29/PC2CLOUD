import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import Login from "./screens/Login";
import Setup from "./screens/Setup";
import Ready from "./screens/Ready";

type Screen = "loading" | "login" | "setup" | "ready";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipc = () => (window as any).require("electron").ipcRenderer;
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:7000";

const STORAGE_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [hasConfig, setHasConfig] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const storageSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceIdRef = useRef<string>("");
  const folderPathRef = useRef<string>("");
  const fileSyncBusyRef = useRef(false);

  function connectSocket(deviceId: string) {
    socketRef.current?.disconnect();
    const socket = io(API_URL, { withCredentials: true });

    socket.on("connect", () => socket.emit("device:online", { deviceId }));

    socket.on("connect_error", (err) => {
      if (err.message === "Authentication required" || err.message.includes("authentication")) {
        socket.disconnect();
        handleDisconnect();
      }
    });

    socket.on("file:request", async ({ requestId, filePath }: { requestId: string; filePath: string }) => {
      const folder = folderPathRef.current;
      if (!folder) {
        socket.emit("file:error", { requestId, message: "Folder path not configured on this device" });
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodePath = (window as any).require("path");
      const fullPath: string = nodePath.join(folder, filePath);
      // Prevent path traversal
      const resolved: string = nodePath.resolve(fullPath);
      const root: string = nodePath.resolve(folder);
      if (!resolved.startsWith(root)) {
        socket.emit("file:error", { requestId, message: "Access denied" });
        return;
      }
      try {
        const result = await ipc().invoke("file:read", resolved);
        await fetch(`${API_URL}/api/transfer/${requestId}`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": result.mimeType || "application/octet-stream",
            "x-file-name": encodeURIComponent(result.fileName),
            "x-mime-type": result.mimeType || "application/octet-stream",
          },
          body: result.data,
        });
      } catch (err) {
        fetch(`${API_URL}/api/transfer/${requestId}/error`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: err instanceof Error ? err.message : "Could not read file" }),
        }).catch(() => {});
      }
    });

    socket.on("file:upload", async ({ requestId, filePath }: { requestId: string; filePath: string }) => {
      const folder = folderPathRef.current;
      const rejectUpload = (message: string) =>
        fetch(`${API_URL}/api/transfer/${requestId}/write-error`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        }).catch(() => {});

      if (!folder) { rejectUpload("Folder not configured on this device"); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const nodePath = w.require("path");
      const fullPath: string = nodePath.join(folder, filePath);
      const resolved: string = nodePath.resolve(fullPath);
      const root: string = nodePath.resolve(folder);
      if (!resolved.startsWith(root)) { rejectUpload("Access denied"); return; }

      try {
        const res = await fetch(`${API_URL}/api/transfer/${requestId}/content`, { credentials: "include" });
        const arrayBuffer = await res.arrayBuffer();
        // Write directly via Node.js fs — avoids Electron IPC size limits
        const nodeFs = w.require("fs");
        nodeFs.mkdirSync(nodePath.dirname(resolved), { recursive: true });
        nodeFs.writeFileSync(resolved, Buffer.from(arrayBuffer));
        await fetch(`${API_URL}/api/transfer/${requestId}/write-done`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true }),
        });
      } catch (err) {
        rejectUpload(err instanceof Error ? err.message : "Could not write file");
      }
    });

    socket.on("folder:create", ({ folderPath }: { folderPath: string }) => {
      const folder = folderPathRef.current;
      if (!folder) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const nodePath = w.require("path");
      const fullPath: string = nodePath.join(folder, folderPath);
      const resolved: string = nodePath.resolve(fullPath);
      const root: string = nodePath.resolve(folder);
      if (!resolved.startsWith(root)) return;
      try {
        w.require("fs").mkdirSync(resolved, { recursive: true });
      } catch { /* ignore */ }
    });

    socket.on("file:delete", ({ filePath }: { filePath: string }) => {
      const folder = folderPathRef.current;
      if (!folder) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const nodePath = w.require("path");
      const fullPath: string = nodePath.join(folder, filePath);
      const resolved: string = nodePath.resolve(fullPath);
      const root: string = nodePath.resolve(folder);
      if (!resolved.startsWith(root)) return;
      // Delete directly via Node.js fs — no IPC round-trip needed
      try {
        const nodeFs = w.require("fs");
        if (nodeFs.existsSync(resolved)) nodeFs.unlinkSync(resolved);
      } catch { /* ignore — file may already be gone */ }
    });

    socketRef.current = socket;
  }

  async function pushStorageUpdate(deviceId: string, folderPath: string) {
    if (!folderPath) return;
    try {
      const info = await ipc().invoke("storage:get-info", folderPath);
      await fetch(`${API_URL}/api/devices/${deviceId}/storage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
      const res = await fetch(`${API_URL}/api/devices/${deviceId}/files/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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

  async function reconnectWithConfig(config: { deviceId: string; folderPath: string; deviceName?: string }) {
    deviceIdRef.current = config.deviceId;

    // Recover sharedFolderPath from the server when local config is missing it
    let folderPath = config.folderPath;
    try {
      const res = await fetch(`${API_URL}/api/devices/${config.deviceId}/heartbeat`, {
        method: "PATCH",
        credentials: "include",
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

    folderPathRef.current = folderPath;
    await pushStorageUpdate(config.deviceId, folderPath);
    await pushFileSync(config.deviceId, folderPath);
    startStorageSync(config.deviceId, folderPath);
  }

  // Watch folder for changes while on the ready screen
  useEffect(() => {
    if (screen !== "ready") return;
    const deviceId = deviceIdRef.current;
    const folderPath = folderPathRef.current;
    if (!folderPath) return;

    ipc().invoke("folder:watch", folderPath);

    const handler = () => pushFileSync(deviceId, folderPath);
    ipc().on("folder:changed", handler);

    return () => {
      ipc().invoke("folder:unwatch");
      ipc().removeListener("folder:changed", handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    (async () => {
      const authRes = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" }).catch(() => null);
      if (!authRes?.ok) {
        const config = await ipc().invoke("config:read");
        if (config?.deviceId) setHasConfig(true);
        setScreen("login");
        return;
      }

      const config = await ipc().invoke("config:read");
      if (config?.deviceId) {
        await reconnectWithConfig(config);
        setScreen("ready");
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/devices`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.devices?.length > 0) {
            const device = data.devices[0];
            const saved = { deviceId: device.deviceId, folderPath: "", deviceName: device.deviceName };
            await ipc().invoke("config:write", saved);
            await reconnectWithConfig(saved);
            setScreen("ready");
            return;
          }
        }
      } catch { /* fall through */ }

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
      await reconnectWithConfig(config);
      setHasConfig(false);
      setScreen("ready");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/devices`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.devices?.length > 0) {
          const device = data.devices[0];
          const saved = { deviceId: device.deviceId, folderPath: "", deviceName: device.deviceName };
          await ipc().invoke("config:write", saved);
          await reconnectWithConfig(saved);
          setHasConfig(false);
          setScreen("ready");
          return;
        }
      }
    } catch { /* fall through */ }

    setScreen("setup");
  }

  function handleSetupDone(deviceId: string, folderPath: string) {
    deviceIdRef.current = deviceId;
    folderPathRef.current = folderPath;
    connectSocket(deviceId);
    pushStorageUpdate(deviceId, folderPath);
    pushFileSync(deviceId, folderPath);
    startStorageSync(deviceId, folderPath);
    setScreen("ready");
  }

  async function handleDisconnect() {
    ipc().invoke("folder:unwatch");
    socketRef.current?.disconnect();
    socketRef.current = null;
    if (storageSyncRef.current) clearInterval(storageSyncRef.current);
    await ipc().invoke("config:clear");
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
        {screen === "setup" && <Setup onDone={handleSetupDone} />}
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
