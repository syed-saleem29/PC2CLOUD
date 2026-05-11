import { ArrowDownToLine, ExternalLink, Minus, RefreshCcw, Unplug } from "lucide-react";
import { useEffect, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = window as any;

type Props = {
  onDisconnect: () => void;
  syncStatus: "idle" | "syncing" | "done" | "error";
  lastSyncTime: Date | null;
  onSyncNow: () => void;
};

export default function Ready({ onDisconnect, syncStatus, lastSyncTime, onSyncNow }: Props) {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);

  useEffect(() => {
    const ipc = w.require("electron").ipcRenderer;
    const handler = (_: unknown, { version }: { version: string }) => setUpdateVersion(version);
    ipc.on("update:available", handler);
    return () => ipc.removeListener("update:available", handler);
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
