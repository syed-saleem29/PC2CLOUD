import React, { useState } from "react";
import { Check, FolderOpen, HardDrive } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:7000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = window as any;
const ipc = () => w.require("electron").ipcRenderer;

function formatGB(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

type Step = "pick" | "confirm" | "setting-up" | "done";

export default function Setup({ onDone }: { onDone: (deviceId: string, folderPath: string) => void }) {
  const [step, setStep] = useState<Step>("pick");
  const [selectedDir, setSelectedDir] = useState("");
  const [diskInfo, setDiskInfo] = useState<{ free: number; total: number } | null>(null);
  const [deviceName, setDeviceName] = useState("My PC");
  const [error, setError] = useState("");

  async function handlePickFolder() {
    try {
      const { ipcRenderer } = w.require("electron");
      const dir: string | null = await ipcRenderer.invoke("dialog:pick-folder");
      if (!dir) return;

      setSelectedDir(dir);

      const checkDiskSpaceMod = w.require("check-disk-space");
      const checkDiskSpace = checkDiskSpaceMod.default ?? checkDiskSpaceMod;
      const info = await checkDiskSpace(dir);
      setDiskInfo({ free: info.free, total: info.size });
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open folder picker");
    }
  }

  async function handleSetup(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    if (!selectedDir || !diskInfo) return;
    setStep("setting-up");
    setError("");

    try {
      const nodePath = w.require("path");
      const nodeFs = w.require("fs");
      const folderPath: string = nodePath.join(selectedDir, "PC2CLOUD");
      nodeFs.mkdirSync(folderPath, { recursive: true });

      const res = await fetch(`${API_URL}/api/devices/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          deviceName: deviceName.trim() || "My PC",
          platform: "windows",
          sharedFolderName: "PC2CLOUD",
          sharedFolderPath: folderPath,
          storageLimitBytes: diskInfo.free,
          usedStorageBytes: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");

      await ipc().invoke("config:write", {
        deviceId: data.device.deviceId,
        folderPath: folderPath,
        deviceName: deviceName.trim() || "My PC",
      });

      setStep("done");
      setTimeout(() => onDone(data.device.deviceId, folderPath), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
      setStep("confirm");
    }
  }

  const usedPercent = diskInfo
    ? Math.round(((diskInfo.total - diskInfo.free) / diskInfo.total) * 100)
    : 0;

  return (
    <div className="flex flex-1 flex-col justify-center">
      <h2 className="text-xl font-semibold">Set up your storage</h2>
      <p className="mt-1 text-sm text-muted-foreground mb-6">
        Choose a folder location for your PC2CLOUD drive.
      </p>

      {step === "pick" && (
        <button
          onClick={handlePickFolder}
          className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-primary/5"
        >
          <FolderOpen size={28} className="text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">Choose folder location</span>
          <span className="text-xs text-muted-foreground">e.g. D:\ or C:\Users\Name</span>
        </button>
      )}

      {(step === "confirm" || step === "setting-up") && diskInfo && (
        <form onSubmit={handleSetup} className="grid gap-4">
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <HardDrive size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{selectedDir}</p>
                <p className="text-xs text-muted-foreground">
                  {formatGB(diskInfo.free)} free · {formatGB(diskInfo.total)} total
                </p>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              A <strong>PC2CLOUD</strong> folder will be created here.
            </p>
          </div>

          <label className="grid gap-1.5 text-sm font-medium">
            PC name (shown on dashboard)
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="My PC"
              className="h-10 rounded-lg border border-border px-3 font-normal outline-none focus:border-primary"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={step === "setting-up"}
              className="flex h-10 flex-1 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60"
            >
              {step === "setting-up" ? "Setting up..." : "Start setup"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("pick"); setSelectedDir(""); setDiskInfo(null); }}
              disabled={step === "setting-up"}
              className="h-10 rounded-lg border border-border px-4 text-sm font-medium disabled:opacity-50"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="flex size-14 items-center justify-center rounded-full bg-green-50">
            <Check size={28} className="text-green-600" aria-hidden="true" />
          </div>
          <p className="font-semibold">All done!</p>
          <p className="text-sm text-muted-foreground text-center">
            Your PC is now connected to PC2CLOUD.
          </p>
        </div>
      )}
    </div>
  );
}
