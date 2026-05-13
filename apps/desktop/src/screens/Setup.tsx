import React, { useState } from "react";
import { ArrowLeft, Check, CheckCircle2, FolderOpen, HardDrive, Loader2 } from "lucide-react";
import { API_URL, apiFetch } from "../lib/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = window as any;
const ipc = () => w.require("electron").ipcRenderer;

function formatGB(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

type Step = "pick" | "confirm" | "setting-up" | "done";

const inputCls =
  "h-10 w-full rounded-xl border border-border bg-surface px-3 outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15";

export default function Setup({ onDone, onLogout }: { onDone: (deviceId: string, folderPath: string) => void; onLogout: () => void }) {
  const [step, setStep] = useState<Step>("pick");
  const [selectedDir, setSelectedDir] = useState("");
  const [diskInfo, setDiskInfo] = useState<{ free: number; total: number } | null>(null);
  const [deviceName, setDeviceName] = useState("My PC");
  const [error, setError] = useState("");

  async function handlePickFolder() {
    try {
      const dir: string | null = await ipc().invoke("dialog:pick-folder");
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

      const res = await apiFetch(`${API_URL}/api/devices/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setTimeout(() => onDone(data.device.deviceId, folderPath), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
      setStep("confirm");
    }
  }

  const usedPercent = diskInfo
    ? Math.round(((diskInfo.total - diskInfo.free) / diskInfo.total) * 100)
    : 0;

  const folderPreviewPath = selectedDir
    ? `${selectedDir.replace(/\\/g, "/")}  /  PC2CLOUD`
    : "";

  return (
    <div className="flex flex-1 flex-col justify-center">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Set up storage</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {step === "pick" && "Choose where to store your PC2CLOUD files."}
            {(step === "confirm" || step === "setting-up") && "Confirm the location and name your PC."}
            {step === "done" && "All set!"}
          </p>
        </div>
        {step !== "done" && (
          <button
            type="button"
            onClick={onLogout}
            className="mt-0.5 shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign out
          </button>
        )}
      </div>

      {/* Step indicator */}
      {step !== "done" && (
        <div className="flex items-center gap-2 mb-5">
          {(["pick", "confirm"] as Step[]).map((s, i) => {
            const active = step === s || (step === "setting-up" && s === "confirm");
            const done = (s === "pick" && (step === "confirm" || step === "setting-up"));
            return (
              <React.Fragment key={s}>
                {i > 0 && <div className={`h-px flex-1 rounded ${done ? "bg-primary" : "bg-border"}`} />}
                <div className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                  done ? "bg-primary text-primary-foreground" :
                  active ? "bg-primary/15 text-primary ring-2 ring-primary/30" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {done ? <Check size={12} /> : i + 1}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Step: Pick */}
      {step === "pick" && (
        <div className="grid gap-3">
          <button
            onClick={handlePickFolder}
            className="group flex h-32 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border transition-all hover:border-primary hover:bg-primary/5"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-primary/10">
              <FolderOpen size={22} className="text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">Choose folder location</p>
              <p className="mt-0.5 text-xs text-muted-foreground">e.g. D:\ or C:\Users\Name</p>
            </div>
          </button>
          {error && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500 border border-red-500/20">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Step: Confirm */}
      {(step === "confirm" || step === "setting-up") && diskInfo && (
        <form onSubmit={handleSetup} className="grid gap-3">
          {/* Folder info card */}
          <div className="rounded-2xl border border-border bg-surface p-4 grid gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <HardDrive size={17} className="text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Selected drive</p>
                <p className="truncate text-sm font-medium">{selectedDir}</p>
                <p className="text-xs text-muted-foreground">
                  {formatGB(diskInfo.free)} free · {formatGB(diskInfo.total)} total
                </p>
              </div>
            </div>
            {/* Disk usage */}
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>

          {/* Folder path preview */}
          <div className="rounded-xl bg-muted/60 border border-border px-3 py-2.5 flex items-start gap-2">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-foreground">Folder will be created at</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground font-mono break-all">{folderPreviewPath}</p>
            </div>
          </div>

          {/* Device name */}
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">PC Name</span>
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="My PC"
              className={inputCls}
            />
            <span className="text-xs text-muted-foreground">Shown on your dashboard.</span>
          </label>

          {error && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500 border border-red-500/20">
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => { setStep("pick"); setSelectedDir(""); setDiskInfo(null); }}
              disabled={step === "setting-up"}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back
            </button>
            <button
              type="submit"
              disabled={step === "setting-up"}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:opacity-90 disabled:opacity-60"
            >
              {step === "setting-up" ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  Setting up…
                </>
              ) : (
                <>
                  <Check size={15} aria-hidden="true" />
                  Confirm & start
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Done */}
      {step === "done" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl" />
            <div className="relative flex size-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
              <Check size={30} className="text-green-500" aria-hidden="true" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">You&apos;re all set!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your PC is now connected to PC2CLOUD.
              <br />Opening your dashboard…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
