"use client";

import {
  ArrowDownToLine,
  Check,
  ChevronRight,
  Cloud,
  Computer,
  Eye,
  FileText,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Loader2,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  ApiError,
  AuthMode,
  CloudFile,
  Device,
  authenticateUser,
  createFolder,
  deleteFile,
  getCurrentUser,
  getDeviceFiles,
  getDevices,
  getDownloadUrl,
  getViewUrl,
  logoutUser,
  renameItem,
  searchDeviceFiles,
  unlinkDevice,
  updateDeviceName,
} from "@/lib/api";

type Section = "devices" | "storage" | "security";

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes >= 1024 ** 3) {
    const gb = bytes / 1024 ** 3;
    return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  }
  if (bytes >= 1024 ** 2) {
    const mb = bytes / 1024 ** 2;
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function storagePercent(device: Device) {
  if (!device.storageLimitBytes) return 0;
  return Math.min(100, Math.round((device.usedStorageBytes / device.storageLimitBytes) * 100));
}


function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildBreadcrumbs(path: string) {
  if (path === "/") return [{ label: "Home", path: "/" }];
  const parts = path.split("/").filter(Boolean);
  const crumbs = [{ label: "Home", path: "/" }];
  let accumulated = "";
  for (const part of parts) {
    accumulated += `/${part}`;
    crumbs.push({ label: part, path: accumulated });
  }
  return crumbs;
}

export function Dashboard() {
  const [activeSection, setActiveSection] = useState<Section>("devices");
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState("/");
  const [authMessage, setAuthMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [user, setUser] = useState<{ userName?: string; userEmail: string } | null>(null);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editDeviceName, setEditDeviceName] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewState, setPreviewState] = useState<
    | { type: "image" | "pdf"; url: string; name: string }
    | { type: "text"; content: string; name: string }
    | { type: "spreadsheet"; html: string; name: string }
    | null
  >(null);
  const [previewLoadingFile, setPreviewLoadingFile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newFolderName, setNewFolderName] = useState<string | null>(null);
  const [renamingFile, setRenamingFile] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CloudFile[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const selectedDeviceIdRef = useRef<string | null>(null);
  const selectedPathRef = useRef<string>("/");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7000";

  function connectDashboardSocket() {
    socketRef.current?.disconnect();
    const socket = io(API_URL, { withCredentials: true });

    socket.on("connect", () => {
      // Re-fetch devices on reconnect so status is fresh
      getDevices().then((d) => setDevices(d.devices)).catch(() => {});
    });

    socket.on("device:status", ({ deviceId, status, lastSeen }: { deviceId: string; status: string; lastSeen: string }) => {
      setDevices((prev) =>
        prev.map((d) => (d.deviceId === deviceId ? { ...d, status: status as Device["status"], lastSeen } : d)),
      );
    });

    socket.on("connect_error", () => {
      // Socket failed — fall back to polling until it recovers
    });

    socketRef.current = socket;
  }

  const totalStorage = useMemo(
    () => devices.reduce((sum, d) => sum + d.storageLimitBytes, 0),
    [devices],
  );
  const onlineDevices = devices.filter((d) => d.status === "online").length;
  const selectedDevice = useMemo(
    () => devices.find((d) => d.deviceId === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  }

  function handleApiError(error: unknown): boolean {
    if (error instanceof ApiError && error.status === 401) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setUser(null);
      setIsAuthenticated(false);
      setDevices([]);
      setFiles([]);
      setSelectedDeviceId(null);
      return true;
    }
    return false;
  }

  // Initial auth check
  useEffect(() => {
    (async () => {
      try {
        const data = await getCurrentUser();
        setUser(data.user);
        setIsAuthenticated(true);
        const devData = await getDevices();
        setDevices(devData.devices);
      } catch {
        setIsAuthenticated(false);
      }
    })();
  }, []);

  // Socket — reconnects whenever auth state changes
  useEffect(() => {
    if (!isAuthenticated) return;
    connectDashboardSocket();
    return () => { socketRef.current?.disconnect(); socketRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Keep refs in sync so the polling interval can read the latest values without restarting
  useEffect(() => { selectedDeviceIdRef.current = selectedDeviceId; }, [selectedDeviceId]);
  useEffect(() => { selectedPathRef.current = selectedPath; }, [selectedPath]);

  // Debounced search — fires 400 ms after the query stops changing
  useEffect(() => {
    if (!selectedDevice || !searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await searchDeviceFiles(selectedDevice.deviceId, searchQuery.trim());
        setSearchResults(data.files);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedDevice]);

  // Poll every 10 s — refresh devices AND currently viewed file list
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(async () => {
      try {
        const d = await getDevices();
        setDevices(d.devices);
        if (selectedDeviceIdRef.current) {
          const f = await getDeviceFiles(selectedDeviceIdRef.current, selectedPathRef.current);
          setFiles(f.files);
        }
      } catch (error) {
        handleApiError(error);
      }
    }, 5_000);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  async function refreshDevices() {
    setIsLoading(true);
    try {
      const data = await getDevices();
      setDevices(data.devices);
    } catch (error) {
      handleApiError(error);
    } finally { setIsLoading(false); }
  }

  async function handleAuth(event: React.BaseSyntheticEvent) {
    event.preventDefault();
    setIsLoading(true);
    setAuthMessage("");
    try {
      const data = await authenticateUser(mode, {
        username: mode === "register" ? username : undefined,
        email,
        password,
      });
      setUser(data.user);
      setIsAuthenticated(true);
      setPassword("");
      const devData = await getDevices();
      setDevices(devData.devices);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    setIsLoading(true);
    socketRef.current?.disconnect();
    socketRef.current = null;
    try {
      await logoutUser();
    } catch {}
    finally {
      setUser(null);
      setIsAuthenticated(false);
      setDevices([]);
      setFiles([]);
      setSelectedDeviceId(null);
      setPassword("");
      setIsLoading(false);
    }
  }

  function beginEditDevice(device: Device) {
    setEditingDeviceId(device.deviceId);
    setEditDeviceName(device.deviceName);
  }

  async function handleUpdateDevice(event: React.BaseSyntheticEvent, device: Device) {
    event.preventDefault();
    if (!editDeviceName.trim()) {
      showToast("Device name is required.");
      return;
    }
    setIsLoading(true);
    try {
      const data = await updateDeviceName(device.deviceId, editDeviceName.trim());
      setDevices((prev) => prev.map((d) => (d.deviceId === device.deviceId ? data.device : d)));
      setEditingDeviceId(null);
      showToast("Device name updated.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update device");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUnlinkDevice(device: Device) {
    if (!window.confirm(`Unlink "${device.deviceName}" from your account?`)) return;
    setIsLoading(true);
    try {
      await unlinkDevice(device.deviceId);
      setDevices((prev) => prev.filter((d) => d.deviceId !== device.deviceId));
      if (selectedDeviceId === device.deviceId) {
        setSelectedDeviceId(null);
        setFiles([]);
        setSelectedPath("/");
      }
      showToast("Device unlinked.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not unlink device");
    } finally {
      setIsLoading(false);
    }
  }

  async function openDeviceStorage(device: Device, path = "/") {
    setSelectedDeviceId(device.deviceId);
    setActiveSection("storage");
    setSearchQuery("");
    setSearchResults(null);
    setIsLoading(true);
    try {
      const data = await getDeviceFiles(device.deviceId, path);
      setSelectedPath(data.path);
      setFiles(data.files);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not load files");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDownload(file: CloudFile) {
    if (!selectedDevice) return;
    if (selectedDevice.status !== "online") {
      showToast("Device is offline — cannot download files right now.");
      return;
    }
    try {
      const res = await fetch(getDownloadUrl(selectedDevice.deviceId, file.filePath), { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast((data as { message?: string }).message || "Download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showToast("Download failed");
    }
  }

  async function handlePreview(file: CloudFile) {
    if (!selectedDevice) return;
    if (selectedDevice.status !== "online") {
      showToast("Device is offline — cannot preview files right now.");
      return;
    }
    setPreviewLoadingFile(file.id);
    try {
      const res = await fetch(getViewUrl(selectedDevice.deviceId, file.filePath), { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast((data as { message?: string }).message || "Could not load preview");
        return;
      }
      const blob = await res.blob();
      const mime = file.mimeType || "";

      if (mime.startsWith("image/")) {
        setPreviewState({ type: "image", url: URL.createObjectURL(blob), name: file.fileName });
      } else if (mime === "application/pdf") {
        setPreviewState({ type: "pdf", url: URL.createObjectURL(blob), name: file.fileName });
      } else if (mime.startsWith("text/") || mime === "application/json") {
        const content = await blob.text();
        setPreviewState({ type: "text", content, name: file.fileName });
      } else if (
        mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        mime === "application/vnd.ms-excel"
      ) {
        const { read, utils } = await import("xlsx");
        const arrayBuffer = await blob.arrayBuffer();
        const workbook = read(new Uint8Array(arrayBuffer));
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const html = utils.sheet_to_html(sheet);
        setPreviewState({ type: "spreadsheet", html, name: file.fileName });
      }
    } catch {
      showToast("Could not load preview");
    } finally {
      setPreviewLoadingFile(null);
    }
  }

  function closePreview() {
    setPreviewState((prev) => {
      if (prev && (prev.type === "image" || prev.type === "pdf")) URL.revokeObjectURL(prev.url);
      return null;
    });
  }

  async function handleDeleteFile(file: CloudFile) {
    if (!selectedDevice) return;
    const msg = file.itemType === "folder"
      ? `Delete folder "${file.fileName}" and all its contents? This cannot be undone.`
      : `Delete "${file.fileName}" from your PC? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    try {
      await deleteFile(selectedDevice.deviceId, file.filePath);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (error) {
      if (!handleApiError(error)) showToast(error instanceof Error ? error.message : "Could not delete file");
    }
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !selectedDevice) return;
    if (selectedDevice.status !== "online") {
      showToast("Device is offline — cannot upload files right now.");
      return;
    }
    setIsUploading(true);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7000";
    let uploaded = 0;
    for (const file of Array.from(fileList)) {
      const destPath = selectedPath === "/" ? `/${file.name}` : `${selectedPath}/${file.name}`;
      try {
        const res = await fetch(
          `${API_URL}/api/devices/${selectedDevice.deviceId}/upload?path=${encodeURIComponent(destPath)}`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
              "x-file-name": encodeURIComponent(file.name),
            },
            body: file,
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          showToast(`${file.name}: ${(data as { message?: string }).message || "Upload failed"}`);
        } else {
          uploaded++;
        }
      } catch {
        showToast(`${file.name}: Upload failed`);
      }
    }
    setIsUploading(false);
    if (uploadInputRef.current) uploadInputRef.current.value = "";
    if (uploaded > 0) {
      showToast(`${uploaded} file${uploaded > 1 ? "s" : ""} uploaded`);
      const data = await getDeviceFiles(selectedDevice.deviceId, selectedPath).catch(() => null);
      if (data) setFiles(data.files);
    }
  }

  async function handleCreateFolder(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    if (!selectedDevice || !newFolderName?.trim()) return;
    const name = newFolderName.trim();
    const folderPath = selectedPath === "/" ? `/${name}` : `${selectedPath}/${name}`;
    try {
      await createFolder(selectedDevice.deviceId, folderPath);
      setNewFolderName(null);
      setFiles((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          fileName: name,
          filePath: folderPath,
          parentPath: selectedPath,
          itemType: "folder" as const,
          sizeBytes: 0,
          mimeType: null,
          modifiedAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      if (!handleApiError(error)) showToast(error instanceof Error ? error.message : "Could not create folder");
    }
  }

  async function handleRenameItem(e: React.BaseSyntheticEvent, file: CloudFile) {
    e.preventDefault();
    if (!selectedDevice || !renamingFile) return;
    const newName = renamingFile.name.trim();
    if (!newName || newName === file.fileName) { setRenamingFile(null); return; }
    try {
      const { newPath } = await renameItem(selectedDevice.deviceId, file.filePath, newName);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? { ...f, fileName: newName, filePath: newPath }
            : f,
        ),
      );
      setRenamingFile(null);
    } catch (error) {
      if (!handleApiError(error)) showToast(error instanceof Error ? error.message : "Could not rename");
    }
  }

  // ── Auth screen ──────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Cloud size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-semibold">PC2CLOUD</p>
              <p className="text-sm text-muted-foreground">Private storage</p>
            </div>
          </div>

          <form
            onSubmit={handleAuth}
            className="rounded-md border border-border bg-white p-5 shadow-soft"
          >
            <div className="grid grid-cols-2 rounded-md bg-muted p-1 text-sm">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-md px-3 py-2 font-medium ${mode === "login" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`rounded-md px-3 py-2 font-medium ${mode === "register" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
              >
                Register
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {mode === "register" && (
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="h-11 rounded-md border border-border px-3 outline-none focus:border-primary"
                />
              )}
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                type="email"
                className="h-11 rounded-md border border-border px-3 outline-none focus:border-primary"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                className="h-11 rounded-md border border-border px-3 outline-none focus:border-primary"
              />
            </div>

            <button
              disabled={isLoading}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {mode === "login" ? <LogIn size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}
              {mode === "login" ? "Login" : "Create account"}
            </button>

            {authMessage && (
              <p className="mt-3 text-sm text-red-600">{authMessage}</p>
            )}
          </form>
        </div>
      </div>
    );
  }

  // ── App shell ────────────────────────────────────────────────────────────────

  const breadcrumbs = buildBreadcrumbs(selectedPath);

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-white">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Cloud size={16} aria-hidden="true" />
          </div>
          <p className="font-semibold">PC2CLOUD</p>
        </div>

        <nav className="grid gap-0.5 px-2 text-sm">
          {(
            [
              { id: "devices", label: "Devices", icon: <Computer size={16} aria-hidden="true" /> },
              { id: "storage", label: "Storage", icon: <HardDrive size={16} aria-hidden="true" /> },
              { id: "security", label: "Security", icon: <ShieldCheck size={16} aria-hidden="true" /> },
            ] as { id: Section; label: string; icon: React.ReactNode }[]
          ).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-left font-medium transition-colors ${
                activeSection === id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>

        <div className="mx-2 mt-4 rounded-md border border-border p-3">
          <p className="text-sm font-medium">Windows app</p>
          <p className="mt-0.5 text-xs text-muted-foreground">One-click installer</p>
          <button className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium">
            <ArrowDownToLine size={13} aria-hidden="true" />
            Download
          </button>
        </div>

        <div className="mt-auto border-t border-border px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {(user?.userName || user?.userEmail || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-none">
                  {user?.userName || "User"}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {user?.userEmail}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoading}
              title="Logout"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <LogOut size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1 overflow-auto">
        {/* ── Devices ─────────────────────────────────────────────────────── */}
        {activeSection === "devices" && (
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold">Devices</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connected Windows PCs on your account.
                </p>
              </div>
              <button
                onClick={refreshDevices}
                disabled={isLoading}
                className="flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium disabled:opacity-50"
              >
                <RefreshCcw size={15} className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
                Refresh
              </button>
            </div>

            {/* Stats */}
            <div className="mt-5 grid grid-cols-3 gap-4">
              {[
                { label: "Connected PCs", value: devices.length },
                { label: "Online now", value: onlineDevices },
                { label: "Total storage", value: formatBytes(totalStorage) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-md border border-border bg-white p-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1.5 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>

            {/* Device list */}
            <div className="mt-5 grid gap-3">
              {devices.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-white p-10 text-center">
                  <Computer className="mx-auto text-muted-foreground" size={36} aria-hidden="true" />
                  <p className="mt-3 font-medium">No PCs connected yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Install the Windows desktop app to connect your first PC.
                  </p>
                </div>
              ) : (
                devices.map((device) => {
                  const percent = storagePercent(device);
                  return (
                    <div
                      key={device.deviceId}
                      className="rounded-md border border-border bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                            <Computer size={20} aria-hidden="true" />
                          </div>
                          <div>
                            <p className="font-semibold">{device.deviceName}</p>
                            <p className="text-sm text-muted-foreground">
                              {device.sharedFolderName} · {device.platform}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                              device.status === "online"
                                ? "bg-green-50 text-green-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {device.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => openDeviceStorage(device)}
                            disabled={isLoading}
                            title="Open storage"
                            className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            <FolderOpen size={15} aria-hidden="true" />
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={() => beginEditDevice(device)}
                            disabled={isLoading}
                            title="Edit storage"
                            className="flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUnlinkDevice(device)}
                            disabled={isLoading}
                            title="Unlink device"
                            className="flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {/* Edit form */}
                      {editingDeviceId === device.deviceId && (
                        <form
                          onSubmit={(e) => handleUpdateDevice(e, device)}
                          className="mt-4 flex items-end gap-2 rounded-md border border-border bg-muted/30 p-3"
                        >
                          <label className="grid flex-1 gap-1 text-sm font-medium">
                            Device name
                            <input
                              value={editDeviceName}
                              onChange={(e) => setEditDeviceName(e.target.value)}
                              autoFocus
                              className="h-9 rounded-md border border-border bg-white px-3 font-normal outline-none focus:border-primary"
                            />
                          </label>
                          <button
                            type="submit"
                            disabled={isLoading}
                            title="Save"
                            className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                          >
                            <Check size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDeviceId(null)}
                            className="h-9 rounded-md border border-border bg-white px-3 text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </form>
                      )}

                      {/* Storage bar */}
                      <div className="mt-4">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatBytes(device.usedStorageBytes)} used</span>
                          <span className="font-medium text-foreground">
                            {formatBytes(device.storageLimitBytes)} available
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── Storage ─────────────────────────────────────────────────────── */}
        {activeSection === "storage" && (
          <div className="flex h-full flex-col">
            {/* Device tabs */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-white px-4 py-2">
              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No devices connected.</p>
              ) : (
                devices.map((device) => (
                  <button
                    key={device.deviceId}
                    onClick={() => openDeviceStorage(device)}
                    disabled={isLoading}
                    className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                      selectedDeviceId === device.deviceId
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <Computer size={14} aria-hidden="true" />
                    {device.deviceName}
                    <span
                      className={`size-1.5 rounded-full ${
                        device.status === "online" ? "bg-green-500" : "bg-slate-300"
                      }`}
                    />
                  </button>
                ))
              )}
              <button
                onClick={() => setActiveSection("devices")}
                className="ml-1 flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted/50"
              >
                <Plus size={14} aria-hidden="true" />
                Add
              </button>
            </div>

            {!selectedDevice ? (
              <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
                <HardDrive className="text-muted-foreground" size={40} aria-hidden="true" />
                <p className="mt-3 font-medium">Select a device above</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a connected PC to browse its files.
                </p>
              </div>
            ) : (
              <div className="flex-1 p-6">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Breadcrumb — hidden while searching */}
                  {!searchQuery ? (
                    <nav className="flex items-center gap-1 text-sm">
                      {breadcrumbs.map((crumb, i) => (
                        <span key={crumb.path} className="flex items-center gap-1">
                          {i > 0 && <ChevronRight size={14} className="text-muted-foreground" aria-hidden="true" />}
                          {i < breadcrumbs.length - 1 ? (
                            <button
                              onClick={() => openDeviceStorage(selectedDevice, crumb.path)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {crumb.label}
                            </button>
                          ) : (
                            <span className="font-medium">{crumb.label}</span>
                          )}
                        </span>
                      ))}
                    </nav>
                  ) : (
                    <p className="text-sm font-medium text-muted-foreground">
                      {isSearching ? "Searching…" : `${searchResults?.length ?? 0} result${searchResults?.length === 1 ? "" : "s"} for "${searchQuery}"`}
                    </p>
                  )}

                  <div className="flex gap-2">
                    {/* Search input */}
                    <div className="relative flex items-center">
                      <Search size={14} className="pointer-events-none absolute left-3 text-muted-foreground" aria-hidden="true" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search files…"
                        className="h-9 w-44 rounded-md border border-border bg-white pl-8 pr-3 text-sm outline-none focus:border-primary focus:w-60 transition-all"
                      />
                    </div>
                    <button
                      onClick={() => openDeviceStorage(selectedDevice, selectedPath)}
                      disabled={isLoading}
                      className="flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium disabled:opacity-50"
                    >
                      <RefreshCcw size={14} className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
                      Refresh
                    </button>
                    <button
                      onClick={() => uploadInputRef.current?.click()}
                      disabled={isUploading || selectedDevice.status !== "online"}
                      className="flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium disabled:opacity-50"
                    >
                      {isUploading
                        ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        : <Upload size={14} aria-hidden="true" />}
                      {isUploading ? "Uploading…" : "Upload"}
                    </button>
                    <input
                      ref={uploadInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleUpload(e.target.files)}
                    />
                    <button
                      onClick={() => setNewFolderName("")}
                      disabled={selectedDevice.status !== "online"}
                      className="flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium disabled:opacity-50"
                    >
                      <FolderPlus size={14} aria-hidden="true" />
                      New Folder
                    </button>
                  </div>
                </div>

                {/* New folder inline form */}
                {newFolderName !== null && (
                  <form
                    onSubmit={handleCreateFolder}
                    className="mt-3 flex items-center gap-2"
                  >
                    <div className="flex flex-1 items-center gap-2 rounded-md border border-primary bg-white px-3">
                      <FolderPlus size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                      <input
                        autoFocus
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder name"
                        className="h-9 flex-1 bg-transparent text-sm outline-none"
                        onKeyDown={(e) => e.key === "Escape" && setNewFolderName(null)}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!newFolderName.trim()}
                      className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                      <Check size={14} aria-hidden="true" />
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewFolderName(null)}
                      className="flex h-9 items-center px-3 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </form>
                )}

                {/* File table */}
                <div className="mt-4 overflow-hidden rounded-md border border-border bg-white">
                  {(() => {
                    const displayFiles = searchResults ?? files;
                    const isEmpty = displayFiles.length === 0;

                    if (isSearching) {
                      return (
                        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
                          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                          Searching…
                        </div>
                      );
                    }

                    if (isEmpty) {
                      return (
                        <div className="p-10 text-center">
                          <FolderOpen className="mx-auto text-muted-foreground" size={36} aria-hidden="true" />
                          <p className="mt-3 font-medium">
                            {searchResults !== null ? "No files found" : "This folder is empty"}
                          </p>
                          {searchResults !== null && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              Try a different search term.
                            </p>
                          )}
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="grid grid-cols-[1fr_110px_160px_148px] border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                          <span>Name</span>
                          <span>Size</span>
                          <span>Modified</span>
                          <span />
                        </div>
                        <div className="divide-y divide-border">
                          {displayFiles.map((file) => {
                            const isViewable = file.itemType === "file" && (
                              file.mimeType?.startsWith("image/") ||
                              file.mimeType?.startsWith("text/") ||
                              file.mimeType === "application/pdf" ||
                              file.mimeType === "application/json" ||
                              file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                              file.mimeType === "application/vnd.ms-excel"
                            );
                            const isRenaming = renamingFile?.id === file.id;
                            return (
                              <div
                                key={file.id}
                                onClick={() => {
                                  if (file.itemType === "folder" && !isRenaming) {
                                    openDeviceStorage(selectedDevice, file.filePath);
                                  }
                                }}
                                className={`grid grid-cols-[1fr_110px_160px_148px] items-center px-4 py-3 text-sm ${
                                  file.itemType === "folder" && !isRenaming
                                    ? "cursor-pointer hover:bg-muted/30"
                                    : "hover:bg-muted/10"
                                }`}
                              >
                                {isRenaming ? (
                                  <form
                                    onSubmit={(e) => handleRenameItem(e, file)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex min-w-0 items-center gap-2"
                                  >
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                                      {file.itemType === "folder" ? (
                                        <FolderOpen size={16} aria-hidden="true" />
                                      ) : (
                                        <FileText size={16} aria-hidden="true" />
                                      )}
                                    </div>
                                    <input
                                      autoFocus
                                      value={renamingFile.name}
                                      onChange={(e) => setRenamingFile({ id: file.id, name: e.target.value })}
                                      onKeyDown={(e) => e.key === "Escape" && setRenamingFile(null)}
                                      className="h-7 min-w-0 flex-1 rounded border border-primary px-2 text-sm outline-none"
                                    />
                                    <button type="submit" title="Save" className="flex size-7 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground">
                                      <Check size={13} aria-hidden="true" />
                                    </button>
                                  </form>
                                ) : (
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                                      {file.itemType === "folder" ? (
                                        <FolderOpen size={16} aria-hidden="true" />
                                      ) : (
                                        <FileText size={16} aria-hidden="true" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate font-medium">{file.fileName}</p>
                                      {searchResults !== null && (
                                        <p className="truncate text-xs text-muted-foreground">{file.parentPath}</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                                <span className="text-muted-foreground">
                                  {file.itemType === "folder" ? "—" : formatBytes(file.sizeBytes)}
                                </span>
                                <span className="text-muted-foreground">
                                  {formatDate(file.modifiedAt)}
                                </span>
                                <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  {isViewable && (
                                    <button
                                      type="button"
                                      onClick={() => handlePreview(file)}
                                      disabled={previewLoadingFile === file.id}
                                      title="Preview"
                                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                                    >
                                      {previewLoadingFile === file.id
                                        ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                                        : <Eye size={15} aria-hidden="true" />}
                                    </button>
                                  )}
                                  {file.itemType === "file" && (
                                    <button
                                      type="button"
                                      onClick={() => handleDownload(file)}
                                      title="Download"
                                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                    >
                                      <ArrowDownToLine size={15} aria-hidden="true" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setRenamingFile({ id: file.id, name: file.fileName })}
                                    title="Rename"
                                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                  >
                                    <Pencil size={15} aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFile(file)}
                                    title="Delete"
                                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 size={15} aria-hidden="true" />
                                  </button>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Security ────────────────────────────────────────────────────── */}
        {activeSection === "security" && (
          <div className="p-6">
            <div className="mb-5">
              <h1 className="text-2xl font-semibold">Security</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Device sessions and access information.
              </p>
            </div>

            <div className="rounded-md border border-border bg-white">
              {devices.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No devices linked to this account.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_120px_100px_160px] border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                    <span>Device</span>
                    <span>Platform</span>
                    <span>Status</span>
                    <span>Last seen</span>
                  </div>
                  <div className="divide-y divide-border">
                    {devices.map((device) => (
                      <div
                        key={device.deviceId}
                        className="grid grid-cols-[1fr_120px_100px_160px] items-center px-4 py-3 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                            <Computer size={15} aria-hidden="true" />
                          </div>
                          <span className="font-medium">{device.deviceName}</span>
                        </div>
                        <span className="text-muted-foreground">{device.platform}</span>
                        <span
                          className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${
                            device.status === "online"
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {device.status}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(device.lastSeen)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Preview modal */}
      {previewState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closePreview}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <span className="truncate text-sm font-medium">{previewState.name}</span>
              <button
                onClick={closePreview}
                className="ml-4 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-1 overflow-auto bg-muted/20">
              {previewState.type === "image" && (
                <img
                  src={previewState.url}
                  alt={previewState.name}
                  className="m-auto max-h-[80vh] max-w-full object-contain p-4"
                />
              )}
              {previewState.type === "pdf" && (
                <iframe
                  src={previewState.url}
                  title={previewState.name}
                  className="h-[80vh] w-full"
                />
              )}
              {previewState.type === "text" && (
                <pre className="h-[80vh] w-full overflow-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {previewState.content}
                </pre>
              )}
              {previewState.type === "spreadsheet" && (
                <div className="h-[80vh] w-full overflow-auto p-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:text-sm [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-sm [&_th]:font-medium">
                  <div dangerouslySetInnerHTML={{ __html: previewState.html }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 rounded-md border border-border bg-white px-4 py-3 text-sm shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
