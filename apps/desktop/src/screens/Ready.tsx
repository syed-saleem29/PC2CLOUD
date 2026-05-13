import { ArrowDownToLine, ExternalLink, Minus, RefreshCcw, Unplug, Upload, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = window as any;

type Props = {
  onDisconnect: () => void;
  syncStatus: "idle" | "syncing" | "done" | "error";
  lastSyncTime: Date | null;
  onSyncNow: () => void;
};

type Transfer = {
  id: string;
  name: string;
  type: "upload" | "delete";
  percent: number;
  status: "active" | "done" | "error";
};

export default function Ready({ onDisconnect, syncStatus, lastSyncTime, onSyncNow }: Props) {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const ipc = w.require("electron").ipcRenderer;

    const onUpdateAvailable = (_: unknown, { version }: { version: string }) => setUpdateVersion(version);

    const onStart = (_: unknown, { id, name, type }: { id: string; name: string; type: "upload" | "delete" }) => {
      setTransfers((prev) => {
        const existing = prev.find((t) => t.id === id);
        if (existing) return prev;
        return [...prev, { id, name, type, percent: 0, status: "active" }];
      });
    };

    const onProgress = (_: unknown, { id, percent }: { id: string; percent: number }) => {
      setTransfers((prev) => prev.map((t) => t.id === id ? { ...t, percent } : t));
    };

    const scheduleDismiss = (id: string) => {
      const existing = dismissTimers.current.get(id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        setTransfers((prev) => prev.filter((t) => t.id !== id));
        dismissTimers.current.delete(id);
      }, 3000);
      dismissTimers.current.set(id, timer);
    };

    const onDone = (_: unknown, { id }: { id: string }) => {
      setTransfers((prev) => prev.map((t) => t.id === id ? { ...t, status: "done", percent: 100 } : t));
      scheduleDismiss(id);
    };

    const onError = (_: unknown, { id }: { id: string }) => {
      setTransfers((prev) => prev.map((t) => t.id === id ? { ...t, status: "error" } : t));
      scheduleDismiss(id);
    };

    ipc.on("update:available", onUpdateAvailable);
    ipc.on("transfer:start", onStart);
    ipc.on("transfer:progress", onProgress);
    ipc.on("transfer:done", onDone);
    ipc.on("transfer:error", onError);

    return () => {
      ipc.removeListener("update:available", onUpdateAvailable);
      ipc.removeListener("transfer:start", onStart);
      ipc.removeListener("transfer:progress", onProgress);
      ipc.removeListener("transfer:done", onDone);
      ipc.removeListener("transfer:error", onError);
      dismissTimers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  function syncLabel() {
    if (syncStatus === "syncing") return "Syncing files…";
    if (syncStatus === "error") return "Sync failed — click to retry";
    if (lastSyncTime) return `Synced at ${lastSyncTime.toLocaleTimeString()}`;
    return "Not synced yet";
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      <div className="relative flex size-16 items-center justify-center rounded-full bg-green-50">
        <span className="absolute size-3 rounded-full bg-green-500 top-0 right-0 animate-pulse" />
        <span className="text-2xl">🖥️</span>
      </div>

      <div className="text-center">
        <h2 className="text-xl font-semibold">Your PC is connected</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          PC2CLOUD is running in the background.
          <br />
          Access your files from any device.
        </p>
      </div>

      {/* Sync status */}
      <button
        onClick={onSyncNow}
        disabled={syncStatus === "syncing"}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <RefreshCcw
          size={13}
          className={syncStatus === "syncing" ? "animate-spin" : ""}
          aria-hidden="true"
        />
        {syncLabel()}
      </button>

      {/* Active transfers */}
      {transfers.length > 0 && (
        <div className="w-full max-w-xs flex flex-col gap-1.5">
          {transfers.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border px-3 py-2 text-xs ${
                t.status === "error"
                  ? "border-red-200 bg-red-50"
                  : t.type === "delete"
                  ? "border-orange-200 bg-orange-50"
                  : "border-blue-200 bg-blue-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {t.type === "upload" ? (
                  <Upload size={11} className="shrink-0 text-blue-600" aria-hidden="true" />
                ) : (
                  <Trash2 size={11} className="shrink-0 text-orange-600" aria-hidden="true" />
                )}
                <span className="flex-1 truncate font-medium text-foreground">{t.name}</span>
                <span className={`shrink-0 ${t.status === "error" ? "text-red-600" : t.status === "done" ? "text-green-600" : "text-muted-foreground"}`}>
                  {t.status === "error" ? "Failed" : t.status === "done" ? "Done" : t.type === "delete" ? "Deleting…" : `${t.percent}%`}
                </span>
              </div>
              {t.type === "upload" && t.status !== "error" && (
                <div className="h-1 w-full rounded-full bg-blue-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${t.status === "done" ? "bg-green-500" : "bg-blue-500"}`}
                    style={{ width: `${t.status === "active" && t.percent === 0 ? 8 : t.percent}%` }}
                  />
                </div>
              )}
              {t.type === "delete" && t.status === "active" && (
                <div className="h-1 w-full rounded-full bg-orange-100 overflow-hidden">
                  <div className="h-full w-full rounded-full bg-orange-400 animate-pulse" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {updateVersion && (
        <div className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <ArrowDownToLine size={13} aria-hidden="true" className="shrink-0" />
          <span className="flex-1">Update {updateVersion} available</span>
          <button
            onClick={() => w.require("electron").ipcRenderer.invoke("app:open-dashboard")}
            className="font-medium underline"
          >
            Download
          </button>
        </div>
      )}

      <div className="flex w-full max-w-xs flex-col gap-2">
        <button
          onClick={() => w.require("electron").ipcRenderer.invoke("app:open-dashboard")}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          <ExternalLink size={16} aria-hidden="true" />
          Open Dashboard
        </button>
        <button
          onClick={() => w.require("electron").ipcRenderer.invoke("app:minimize-tray")}
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium"
        >
          <Minus size={16} aria-hidden="true" />
          Minimize to tray
        </button>
        <button
          onClick={onDisconnect}
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <Unplug size={16} aria-hidden="true" />
          Disconnect this PC
        </button>
      </div>
    </div>
  );
}
