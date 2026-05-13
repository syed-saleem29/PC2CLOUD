import {
  ArrowDownToLine,
  ExternalLink,
  Minus,
  MonitorSmartphone,
  RefreshCcw,
  Trash2,
  Unplug,
  Upload,
} from "lucide-react";
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

    const onUpdateAvailable = (_: unknown, { version }: { version: string }) =>
      setUpdateVersion(version);

    const onStart = (_: unknown, { id, name, type }: { id: string; name: string; type: "upload" | "delete" }) => {
      setTransfers((prev) => prev.find((t) => t.id === id) ? prev : [...prev, { id, name, type, percent: 0, status: "active" }]);
    };

    const onProgress = (_: unknown, { id, percent }: { id: string; percent: number }) => {
      setTransfers((prev) => prev.map((t) => t.id === id ? { ...t, percent } : t));
    };

    const scheduleDismiss = (id: string) => {
      const ex = dismissTimers.current.get(id);
      if (ex) clearTimeout(ex);
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
    if (syncStatus === "syncing") return "Syncing…";
    if (syncStatus === "error") return "Sync failed · retry";
    if (lastSyncTime) return `Synced ${lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    return "Not synced yet";
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      {/* Connected icon */}
      <div className="relative flex items-center justify-center">
        <div className="absolute size-36 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex size-20 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5">
          <MonitorSmartphone size={36} className="text-primary" aria-hidden="true" />
          <div className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center">
            <div className="absolute size-4 animate-ping rounded-full bg-green-500 opacity-50" />
            <div className="size-3 rounded-full bg-green-500 border-2 border-background" />
          </div>
        </div>
      </div>

      {/* Status text */}
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-tight">PC is connected</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          PC2CLOUD is running in the background.
          <br />
          Access your files from any device.
        </p>
      </div>

      {/* Sync status pill */}
      <button
        onClick={onSyncNow}
        disabled={syncStatus === "syncing"}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all hover:border-primary hover:text-primary disabled:opacity-50 ${
          syncStatus === "error"
            ? "border-red-300 text-red-500 dark:border-red-800 dark:text-red-400"
            : "border-border text-muted-foreground"
        }`}
      >
        <RefreshCcw
          size={11}
          className={syncStatus === "syncing" ? "animate-spin" : ""}
          aria-hidden="true"
        />
        {syncLabel()}
      </button>

      {/* Transfer notifications */}
      {transfers.length > 0 && (
        <div className="w-full max-w-xs flex flex-col gap-1.5">
          {transfers.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border px-3 py-2.5 transition-all ${
                t.status === "error"
                  ? "border-red-500/25 bg-red-500/8"
                  : t.type === "delete"
                  ? "border-orange-500/25 bg-orange-500/8"
                  : "border-primary/25 bg-primary/8"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {t.type === "upload" ? (
                  <Upload size={11} className={`shrink-0 ${t.status === "error" ? "text-red-500" : "text-primary"}`} aria-hidden="true" />
                ) : (
                  <Trash2 size={11} className="shrink-0 text-orange-500" aria-hidden="true" />
                )}
                <span className="flex-1 truncate text-xs font-medium">{t.name}</span>
                <span className={`shrink-0 text-[11px] font-semibold ${
                  t.status === "error" ? "text-red-500" :
                  t.status === "done" ? "text-green-500" :
                  "text-muted-foreground"
                }`}>
                  {t.status === "error" ? "Failed" :
                   t.status === "done" ? "Done" :
                   t.type === "delete" ? "Deleting…" :
                   `${t.percent}%`}
                </span>
              </div>
              {t.type === "upload" && t.status !== "error" && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-primary/15">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${t.status === "done" ? "bg-green-500" : "bg-primary"}`}
                    style={{ width: `${t.status === "active" && t.percent === 0 ? 6 : t.percent}%` }}
                  />
                </div>
              )}
              {t.type === "delete" && t.status === "active" && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-orange-500/15">
                  <div className="h-full w-full animate-pulse rounded-full bg-orange-500" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Update banner */}
      {updateVersion && (
        <div className="flex w-full max-w-xs items-center gap-2 rounded-xl border border-primary/25 bg-primary/8 px-3 py-2.5 text-xs">
          <ArrowDownToLine size={13} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="flex-1 text-foreground">Update {updateVersion} available</span>
          <button
            onClick={() => w.require("electron").ipcRenderer.invoke("app:open-dashboard")}
            className="font-semibold text-primary hover:underline"
          >
            Download
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex w-full max-w-xs flex-col gap-2">
        <button
          onClick={() => w.require("electron").ipcRenderer.invoke("app:open-dashboard")}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:opacity-90 active:scale-[0.99]"
        >
          <ExternalLink size={15} aria-hidden="true" />
          Open Dashboard
        </button>
        <button
          onClick={() => w.require("electron").ipcRenderer.invoke("app:minimize-tray")}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium transition-colors hover:bg-muted"
        >
          <Minus size={15} aria-hidden="true" />
          Minimize to tray
        </button>
        <button
          onClick={onDisconnect}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-muted-foreground transition-colors hover:border-red-500/30 hover:bg-red-500/8 hover:text-red-500"
        >
          <Unplug size={15} aria-hidden="true" />
          Disconnect this PC
        </button>
      </div>
    </div>
  );
}
