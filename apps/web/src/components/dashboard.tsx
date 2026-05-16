"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowUpDown,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Computer,
  Database,
  Eye,
  FileText,
  FolderOpen,
  FolderPlus,
  Globe,
  HardDrive,
  ImageIcon,
  Loader2,
  LogOut,
  Moon,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  ApiError,
  AuditLog,
  AuthMode,
  AuthScreen,
  CloudFile,
  Device,
  authenticateUser,
  clearWebToken,
  createFolder,
  deleteFile,
  getAuditLogs,
  getCurrentUser,
  getDeviceFiles,
  getDevices,
  getDownloadUrl,
  getViewUrl,
  logoutUser,
  moveItem,
  renameItem,
  resetPassword,
  searchDeviceFiles,
  sendOtp,
  setWebToken,
  unlinkDevice,
  updateDeviceName,
  verifyEmail,
} from "@/lib/api";
import {
  clearSessionKey,
  decryptFile,
  deriveEncryptionKey,
  encryptFile,
  getSessionKey,
  loadSessionKey,
  setSessionKey,
} from "@/lib/crypto";

type Section = "devices" | "storage" | "activity" | "security" | "settings" | "help";

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
  const total = device.usedStorageBytes + device.storageLimitBytes;
  if (!total) return 0;
  return Math.min(100, (device.usedStorageBytes / total) * 100);
}

function formatBytesDetailed(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
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
  const [authScreen, setAuthScreen] = useState<AuthScreen>("credentials");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
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
    | { type: "image" | "pdf" | "audio" | "video"; url: string; name: string }
    | { type: "text"; content: string; name: string }
    | { type: "spreadsheet"; html: string; name: string }
    | null
  >(null);
  const [previewLoadingFile, setPreviewLoadingFile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fileProgress, setFileProgress] = useState<Record<string, number>>({});
  const [newFolderName, setNewFolderName] = useState<string | null>(null);
  const [renamingFile, setRenamingFile] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CloudFile[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [fingerprintWarnings, setFingerprintWarnings] = useState<{ deviceId: string; deviceName: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingFile, setDraggingFile] = useState<CloudFile | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"name" | "size" | "date" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const socketRef = useRef<Socket | null>(null);
  const selectedDeviceIdRef = useRef<string | null>(null);
  const selectedPathRef = useRef<string>("/");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadFolderInputRef = useRef<HTMLInputElement | null>(null);
  const uploadMenuRef = useRef<HTMLDivElement | null>(null);
  const moveMenuRef = useRef<HTMLDivElement | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7000";

  function connectDashboardSocket() {
    socketRef.current?.disconnect();
    const token = typeof window !== "undefined" ? localStorage.getItem("pc2cloud_token") : null;
    const socket = io(API_URL, { withCredentials: true, auth: token ? { token } : undefined });

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

    socket.on("device:fingerprint_warning", ({ deviceId, deviceName }: { deviceId: string; deviceName: string }) => {
      setFingerprintWarnings((prev) =>
        prev.find((w) => w.deviceId === deviceId) ? prev : [...prev, { deviceId, deviceName }],
      );
    });

    socketRef.current = socket;
  }

  const totalStorage = useMemo(
    () => devices.reduce((sum, d) => sum + d.usedStorageBytes + d.storageLimitBytes, 0),
    [devices],
  );
  const totalUsed = useMemo(
    () => devices.reduce((sum, d) => sum + d.usedStorageBytes, 0),
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

  // Theme — init from localStorage, sync to <html>
  useEffect(() => {
    const saved = (typeof window !== "undefined" ? localStorage.getItem("pc2cloud_theme") : null) as "light" | "dark" | null;
    const preferred = saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(preferred);
    document.documentElement.classList.toggle("dark", preferred === "dark");
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("pc2cloud_theme", next);
      return next;
    });
  }

  // Initial auth check — also restores encryption key from sessionStorage if present
  useEffect(() => {
    (async () => {
      try {
        await loadSessionKey();
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

  async function fetchAuditLogs() {
    setIsLoadingActivity(true);
    try {
      const data = await getAuditLogs();
      setAuditLogs(data.logs);
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsLoadingActivity(false);
    }
  }

  // Load audit logs whenever the Activity tab becomes active
  useEffect(() => {
    if (activeSection === "activity" && isAuthenticated) fetchAuditLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, isAuthenticated]);

  async function refreshDevices() {
    setIsLoading(true);
    try {
      const data = await getDevices();
      setDevices(data.devices);
    } catch (error) {
      handleApiError(error);
    } finally { setIsLoading(false); }
  }

  function getOtp() { return otpDigits.join(""); }

  function handleOtpInput(i: number, value: string) {
    // Handle paste of full 6-digit code
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const next = ["", "", "", "", "", ""];
      digits.forEach((d, idx) => { next[idx] = d; });
      setOtpDigits(next);
      otpRefs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...otpDigits];
    next[i] = value;
    setOtpDigits(next);
    if (value && i < 5) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otpDigits[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  }

  function resetOtp() { setOtpDigits(["", "", "", "", "", ""]); otpRefs.current[0]?.focus(); }

  async function handleAuth(event: React.BaseSyntheticEvent) {
    event.preventDefault();
    if (mode === "register" && password !== confirmPassword) {
      setAuthMessage("Passwords do not match");
      return;
    }
    setIsLoading(true);
    setAuthMessage("");
    try {
      const data = await authenticateUser(mode, {
        username: mode === "register" ? username : undefined,
        email,
        password,
      });
      if (data.requiresVerification) {
        setPendingEmail(email);
        resetOtp();
        setAuthScreen("verify-email");
        return;
      }
      if (data.token) setWebToken(data.token);
      setUser(data.user ?? null);
      setIsAuthenticated(true);
      try {
        const encKey = await deriveEncryptionKey(password, email);
        await setSessionKey(encKey);
      } catch { /* non-fatal: encryption unavailable this session */ }
      setPassword("");
      const devData = await getDevices();
      setDevices(devData.devices);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setPendingEmail(email);
        resetOtp();
        setAuthScreen("verify-email");
        return;
      }
      setAuthMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyEmail(event: React.BaseSyntheticEvent) {
    event.preventDefault();
    setIsLoading(true);
    setAuthMessage("");
    try {
      const data = await verifyEmail(pendingEmail, getOtp());
      if (data.token) setWebToken(data.token);
      setUser(data.user);
      setIsAuthenticated(true);
      try {
        const encKey = await deriveEncryptionKey(password, pendingEmail);
        await setSessionKey(encKey);
      } catch { /* non-fatal */ }
      setPassword("");
      setAuthScreen("credentials");
      const devData = await getDevices();
      setDevices(devData.devices);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Verification failed");
      resetOtp();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendOtp(type: "verify" | "reset") {
    setIsLoading(true);
    setAuthMessage("");
    try {
      await sendOtp(pendingEmail, type);
      resetOtp();
      showToast("New code sent to your email");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Could not resend code");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotEmail(event: React.BaseSyntheticEvent) {
    event.preventDefault();
    setIsLoading(true);
    setAuthMessage("");
    try {
      await sendOtp(pendingEmail, "reset");
      resetOtp();
      setNewPassword("");
      setConfirmPassword("");
      setAuthScreen("reset-password");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Could not send code");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetPassword(event: React.BaseSyntheticEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setAuthMessage("Passwords do not match");
      return;
    }
    setIsLoading(true);
    setAuthMessage("");
    try {
      await resetPassword(pendingEmail, getOtp(), newPassword);
      setAuthScreen("credentials");
      setMode("login");
      setNewPassword("");
      setConfirmPassword("");
      resetOtp();
      showToast("Password reset! You can now log in.");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Reset failed");
      resetOtp();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    setIsLoading(true);
    socketRef.current?.disconnect();
    socketRef.current = null;
    clearWebToken();
    clearSessionKey();
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
      setFingerprintWarnings([]);
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
    setSelectedFiles(new Set());
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

  function triggerBlobDownload(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      const contentLength = res.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const encKey = getSessionKey();

      if (total > 0 && res.body) {
        const reader = res.body.getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let received = 0;
        setFileProgress((prev) => ({ ...prev, [file.id]: 0 }));
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          setFileProgress((prev) => ({ ...prev, [file.id]: Math.min(99, Math.round((received / total) * 100)) }));
        }
        setFileProgress((prev) => { const n = { ...prev }; delete n[file.id]; return n; });
        const raw = await new Blob(chunks).arrayBuffer();
        const finalBytes = encKey ? await decryptFile(encKey, raw) : raw;
        triggerBlobDownload(new Blob([finalBytes]), file.fileName);
      } else {
        const raw = await res.arrayBuffer();
        const finalBytes = encKey ? await decryptFile(encKey, raw) : raw;
        triggerBlobDownload(new Blob([finalBytes]), file.fileName);
      }
    } catch {
      setFileProgress((prev) => { const n = { ...prev }; delete n[file.id]; return n; });
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
      const encKey = getSessionKey();
      const rawBytes = await res.arrayBuffer();
      const decryptedBytes = encKey ? await decryptFile(encKey, rawBytes) : rawBytes;
      const blob = new Blob([decryptedBytes], { type: file.mimeType || "application/octet-stream" });
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
      } else if (mime.startsWith("audio/")) {
        setPreviewState({ type: "audio", url: URL.createObjectURL(blob), name: file.fileName });
      } else if (mime.startsWith("video/")) {
        setPreviewState({ type: "video", url: URL.createObjectURL(blob), name: file.fileName });
      }
    } catch {
      showToast("Could not load preview");
    } finally {
      setPreviewLoadingFile(null);
    }
  }

  function closePreview() {
    setPreviewState((prev) => {
      if (prev && "url" in prev) URL.revokeObjectURL(prev.url);
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

  async function uploadFileXhr(deviceId: string, file: File, destPath: string): Promise<boolean> {
    const encKey = getSessionKey();
    let body: Blob;
    if (encKey) {
      const plaintext = await file.arrayBuffer();
      const ciphertext = await encryptFile(encKey, plaintext);
      body = new Blob([ciphertext], { type: "application/octet-stream" });
    } else {
      body = file;
    }

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const progressKey = `upload:${destPath}`;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setFileProgress((prev) => ({ ...prev, [progressKey]: Math.round((e.loaded / e.total) * 100) }));
        }
      };
      const cleanup = () => setFileProgress((prev) => { const n = { ...prev }; delete n[progressKey]; return n; });
      xhr.onload = () => { cleanup(); resolve(xhr.status >= 200 && xhr.status < 300); };
      xhr.onerror = () => { cleanup(); resolve(false); };
      xhr.open("POST", `${API_URL}/api/devices/${deviceId}/upload?path=${encodeURIComponent(destPath)}`);
      xhr.setRequestHeader("Content-Type", encKey ? "application/octet-stream" : (file.type || "application/octet-stream"));
      xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
      xhr.withCredentials = true;
      const uploadToken = typeof window !== "undefined" ? localStorage.getItem("pc2cloud_token") : null;
      if (uploadToken) xhr.setRequestHeader("Authorization", `Bearer ${uploadToken}`);
      xhr.send(body);
    });
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !selectedDevice) return;
    if (selectedDevice.status !== "online") {
      showToast("Device is offline — cannot upload files right now.");
      return;
    }
    setIsUploading(true);
    let uploaded = 0;
    for (const file of Array.from(fileList)) {
      const destPath = selectedPath === "/" ? `/${file.name}` : `${selectedPath}/${file.name}`;
      const ok = await uploadFileXhr(selectedDevice.deviceId, file, destPath);
      if (ok) uploaded++;
      else showToast(`${file.name}: Upload failed`);
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

  // Close upload menu on outside click
  useEffect(() => {
    if (!uploadMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!uploadMenuRef.current?.contains(e.target as Node)) setUploadMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [uploadMenuOpen]);

  // Close move menu on outside click
  useEffect(() => {
    if (!moveMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!moveMenuRef.current?.contains(e.target as Node)) setMoveMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moveMenuOpen]);

  async function getFilesFromDrop(items: DataTransferItemList): Promise<Array<{ file: File; relativePath: string }>> {
    const results: Array<{ file: File; relativePath: string }> = [];

    async function readDir(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
      const all: FileSystemEntry[] = [];
      const read = (): Promise<FileSystemEntry[]> => new Promise((res) => reader.readEntries(res));
      let batch = await read();
      while (batch.length > 0) { all.push(...batch); batch = await read(); }
      return all;
    }

    async function processEntry(entry: FileSystemEntry, parentPath = "") {
      if (entry.isFile) {
        const file = await new Promise<File>((res) => (entry as FileSystemFileEntry).file(res));
        results.push({ file, relativePath: parentPath ? `${parentPath}/${entry.name}` : entry.name });
      } else if (entry.isDirectory) {
        const subPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
        for (const child of await readDir((entry as FileSystemDirectoryEntry).createReader())) {
          await processEntry(child, subPath);
        }
      }
    }

    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) await processEntry(entry);
    }
    return results;
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (!selectedDevice || selectedDevice.status !== "online") return;
    const items = e.dataTransfer.items;
    if (!items.length) return;
    setIsUploading(true);
    const entries = await getFilesFromDrop(items);
    let uploaded = 0;
    for (const { file, relativePath } of entries) {
      const destPath = selectedPath === "/" ? `/${relativePath}` : `${selectedPath}/${relativePath}`;
      const ok = await uploadFileXhr(selectedDevice.deviceId, file, destPath);
      if (ok) uploaded++; else showToast(`${file.name}: Upload failed`);
    }
    setIsUploading(false);
    if (uploaded > 0) {
      showToast(`${uploaded} file${uploaded > 1 ? "s" : ""} uploaded`);
      const data = await getDeviceFiles(selectedDevice.deviceId, selectedPath).catch(() => null);
      if (data) setFiles(data.files);
    }
  }

  async function handleMoveFile(file: CloudFile, destFolderPath: string) {
    if (!selectedDevice || file.parentPath === destFolderPath) return;
    try {
      await moveItem(selectedDevice.deviceId, file.filePath, destFolderPath);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      const label = destFolderPath === "/" ? "Home" : destFolderPath.split("/").pop();
      showToast(`Moved to ${label}`);
    } catch (error) {
      if (!handleApiError(error)) showToast(error instanceof Error ? error.message : "Could not move item");
    }
  }

  function handleSort(key: "name" | "size" | "date") {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  async function handleFolderUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !selectedDevice) return;
    if (selectedDevice.status !== "online") {
      showToast("Device is offline — cannot upload files right now.");
      return;
    }
    setIsUploading(true);
    let uploaded = 0;
    for (const file of Array.from(fileList)) {
      const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const destPath = selectedPath === "/" ? `/${relPath}` : `${selectedPath}/${relPath}`;
      const ok = await uploadFileXhr(selectedDevice.deviceId, file, destPath);
      if (ok) uploaded++;
      else showToast(`${file.name}: Upload failed`);
    }
    setIsUploading(false);
    if (uploadFolderInputRef.current) uploadFolderInputRef.current.value = "";
    if (uploaded > 0) {
      showToast(`${uploaded} file${uploaded > 1 ? "s" : ""} uploaded`);
      const data = await getDeviceFiles(selectedDevice.deviceId, selectedPath).catch(() => null);
      if (data) setFiles(data.files);
    }
  }

  function toggleSelect(fileId: string) {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId); else next.add(fileId);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (!selectedDevice || selectedFiles.size === 0) return;
    if (!window.confirm(`Delete ${selectedFiles.size} selected item(s)? This cannot be undone.`)) return;
    const displayFiles = searchResults ?? files;
    const toDelete = displayFiles.filter((f) => selectedFiles.has(f.id));
    for (const file of toDelete) {
      try { await deleteFile(selectedDevice.deviceId, file.filePath); } catch {}
    }
    setFiles((prev) => prev.filter((f) => !selectedFiles.has(f.id)));
    if (searchResults) setSearchResults((prev) => prev ? prev.filter((f) => !selectedFiles.has(f.id)) : null);
    setSelectedFiles(new Set());
    showToast(`${toDelete.length} item(s) deleted`);
  }

  async function handleBulkDownload() {
    if (!selectedDevice || selectedFiles.size === 0) return;
    const displayFiles = searchResults ?? files;
    const toDownload = displayFiles.filter((f) => selectedFiles.has(f.id) && f.itemType === "file");
    for (const file of toDownload) {
      await handleDownload(file);
    }
    setSelectedFiles(new Set());
  }

  async function handleBulkMove(destFolderPath: string) {
    if (!selectedDevice || selectedFiles.size === 0) return;
    setMoveMenuOpen(false);
    const displayFiles = searchResults ?? files;
    const toMove = displayFiles.filter((f) => selectedFiles.has(f.id) && f.parentPath !== destFolderPath);
    if (toMove.length === 0) { showToast("Items are already in that folder"); return; }
    let moved = 0;
    for (const file of toMove) {
      try { await moveItem(selectedDevice.deviceId, file.filePath, destFolderPath); moved++; } catch {}
    }
    setFiles((prev) => prev.filter((f) => !toMove.some((m) => m.id === f.id)));
    if (searchResults) setSearchResults((prev) => prev ? prev.filter((f) => !toMove.some((m) => m.id === f.id)) : null);
    setSelectedFiles(new Set());
    const label = destFolderPath === "/" ? "Home" : destFolderPath.split("/").pop();
    showToast(`${moved} item(s) moved to ${label}`);
  }

  // ── Auth screen ──────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="auth">
        <button onClick={toggleTheme} title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          style={{ position: "fixed", top: 16, right: 16, width: 36, height: 36, borderRadius: "var(--r-md)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-elevated)", border: "1px solid var(--line)", cursor: "pointer", color: "var(--fg-muted)", zIndex: 10 }}>
          {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        </button>
        <div className="auth-card anim-fade-in">
          <div className="auth-header">
            <div className="auth-logo-mark">
              <Cloud size={24} color="white" aria-hidden="true" />
            </div>
            {authScreen === "credentials" && (
              <>
                <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
                <p>{mode === "login" ? "Sign in to access your devices." : "Free, forever — no card required."}</p>
              </>
            )}
            {authScreen === "verify-email" && (
              <>
                <h1>Check your email</h1>
                <p>Enter the 6-digit code sent to <strong style={{ color: "var(--fg)" }}>{pendingEmail}</strong></p>
              </>
            )}
            {authScreen === "forgot-email" && (
              <>
                <h1>Forgot password</h1>
                <p>We&apos;ll send a reset code to your email.</p>
              </>
            )}
            {authScreen === "reset-password" && (
              <>
                <h1>Reset password</h1>
                <p>Code sent to <strong style={{ color: "var(--fg)" }}>{pendingEmail}</strong></p>
              </>
            )}
          </div>

          {authScreen === "credentials" && (
            <form onSubmit={handleAuth}>
              <div className="auth-tabs">
                <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setConfirmPassword(""); setAuthMessage(""); }}>Login</button>
                <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setAuthMessage(""); }}>Register</button>
              </div>
              <div className="field-row">
                {mode === "register" && (
                  <div className="field">
                    <label>Name</label>
                    <input className="input input-lg" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your name" />
                  </div>
                )}
                <div className="field">
                  <label>Email</label>
                  <input className="input input-lg" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input className="input input-lg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                {mode === "register" && (
                  <div className="field">
                    <label>Confirm password</label>
                    <input className="input input-lg" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                  </div>
                )}
              </div>
              {mode === "login" && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button type="button" onClick={() => { setPendingEmail(email); setAuthMessage(""); setAuthScreen("forgot-email"); }}
                    style={{ fontSize: 12, color: "var(--fg-muted)", background: "none", border: "none", cursor: "pointer" }}>
                    Forgot password?
                  </button>
                </div>
              )}
              {authMessage && <p className="auth-error">{authMessage}</p>}
              <button type="submit" disabled={isLoading} className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 20 }}>
                {isLoading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              </button>
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--line)", textAlign: "center", fontSize: 12, color: "var(--fg-muted)" }}>
                By continuing, you agree to our <a href="#" style={{ color: "var(--brand-600)" }}>Terms</a> &amp; <a href="#" style={{ color: "var(--brand-600)" }}>Privacy</a>.
              </div>
            </form>
          )}

          {authScreen === "verify-email" && (
            <form onSubmit={handleVerifyEmail}>
              <div className="otp">
                {otpDigits.map((d, i) => (
                  <input key={i} ref={(el) => { otpRefs.current[i] = el; }}
                    inputMode="numeric" maxLength={6} value={d}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)} />
                ))}
              </div>
              {authMessage && <p className="auth-error">{authMessage}</p>}
              <button type="submit" disabled={isLoading || getOtp().length < 6} className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 20 }}>
                {isLoading ? "Verifying…" : "Verify email"}
              </button>
              <div className="auth-foot">
                <button type="button" onClick={() => handleResendOtp("verify")} disabled={isLoading}>Resend code</button>
                <button type="button" onClick={() => { setAuthScreen("credentials"); setAuthMessage(""); }}>Back to login</button>
              </div>
            </form>
          )}

          {authScreen === "forgot-email" && (
            <form onSubmit={handleForgotEmail}>
              <div className="field">
                <label>Email</label>
                <input className="input input-lg" type="email" value={pendingEmail} onChange={(e) => setPendingEmail(e.target.value)} required />
              </div>
              {authMessage && <p className="auth-error">{authMessage}</p>}
              <button type="submit" disabled={isLoading} className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 20 }}>
                {isLoading ? "Sending…" : "Send reset code"}
              </button>
              <div className="auth-foot" style={{ justifyContent: "center" }}>
                <button type="button" onClick={() => { setAuthScreen("credentials"); setAuthMessage(""); }}>Back to login</button>
              </div>
            </form>
          )}

          {authScreen === "reset-password" && (
            <form onSubmit={handleResetPassword}>
              <div className="otp">
                {otpDigits.map((d, i) => (
                  <input key={i} ref={(el) => { otpRefs.current[i] = el; }}
                    inputMode="numeric" maxLength={6} value={d}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)} />
                ))}
              </div>
              <div className="field-row" style={{ marginTop: 16 }}>
                <div className="field">
                  <label>New password</label>
                  <input className="input input-lg" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                </div>
                <div className="field">
                  <label>Confirm password</label>
                  <input className="input input-lg" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
              </div>
              {authMessage && <p className="auth-error">{authMessage}</p>}
              <button type="submit" disabled={isLoading || getOtp().length < 6} className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 20 }}>
                {isLoading ? "Resetting…" : "Reset password"}
              </button>
              <div className="auth-foot">
                <button type="button" onClick={() => handleResendOtp("reset")} disabled={isLoading}>Resend code</button>
                <button type="button" onClick={() => { setAuthScreen("forgot-email"); setAuthMessage(""); resetOtp(); }}>Back</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── App shell ────────────────────────────────────────────────────────────────

  const breadcrumbs = buildBreadcrumbs(selectedPath);

  const sidebarMainItems: { id: Section; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "devices",  label: "Devices",  icon: <Computer size={15} aria-hidden="true" />, badge: devices.length },
    { id: "storage",  label: "Storage",  icon: <HardDrive size={15} aria-hidden="true" /> },
    { id: "activity", label: "Activity", icon: <Activity size={15} aria-hidden="true" /> },
    { id: "security", label: "Security", icon: <ShieldCheck size={15} aria-hidden="true" /> },
  ];
  const sidebarSettingsItems: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "settings", label: "Settings", icon: <Settings2 size={15} aria-hidden="true" /> },
    { id: "help",     label: "Help",     icon: <Globe size={15} aria-hidden="true" /> },
  ];

  return (
    <div className="shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo">
            <span className="logo-mark" style={{ width: 28, height: 28, borderRadius: 7 }}>
              <Cloud size={16} color="white" aria-hidden="true" />
            </span>
            <span className="logo-text">PC2CLOUD</span>
          </div>
        </div>

        <div className="sidebar-section">
          {sidebarMainItems.map(({ id, label, icon, badge }) => (
            <button key={id} className={`nav-item${activeSection === id ? " active" : ""}`} onClick={() => setActiveSection(id)}>
              {icon}
              {label}
              {badge != null && <span className="nav-item-end mono">{badge}</span>}
            </button>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Settings</div>
          {sidebarSettingsItems.map(({ id, label, icon }) => (
            <button key={id} className={`nav-item${activeSection === id ? " active" : ""}`} onClick={() => setActiveSection(id)}>
              {icon}
              {label}
            </button>
          ))}
        </div>

        <div className="sidebar-foot">
          <div className="sidebar-upgrade">
            <div className="sidebar-upgrade-eyebrow">
              <Sparkles size={11} aria-hidden="true" /> Upgrade
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Try Pro for free</div>
            <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 8 }}>
              Multi-device, relay acceleration, snapshots.
            </div>
            <button className="btn btn-primary btn-sm" style={{ width: "100%" }}>Start trial</button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: "var(--r-sm)" }}>
            <span className="avatar" style={{ flexShrink: 0 }}>{(user?.userName || user?.userEmail || "?").slice(0, 1).toUpperCase()}</span>
            <span className="sidebar-user-info" style={{ flex: 1, minWidth: 0 }}>
              <span className="sidebar-user-name">{user?.userName || "User"}</span>
              <span className="sidebar-user-mail">{user?.userEmail}</span>
            </span>
            <button onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"}
              style={{ width: 28, height: 28, flexShrink: 0, borderRadius: "var(--r-sm)", display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--fg-subtle)" }}>
              {theme === "dark" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
            </button>
            <button onClick={handleLogout} disabled={isLoading} title="Sign out"
              style={{ width: 28, height: 28, flexShrink: 0, borderRadius: "var(--r-sm)", display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--fg-subtle)" }}>
              <LogOut size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main">

        {/* ── Fingerprint warning banners ── */}
        {fingerprintWarnings.map((w) => (
          <div key={w.deviceId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", background: "var(--warning-bg, #fef3c7)", borderBottom: "1px solid var(--warning-border, #fcd34d)", fontSize: 13, color: "var(--warning-fg, #92400e)" }}>
            <ShieldCheck size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
            <span style={{ flex: 1 }}>
              <strong>Security alert:</strong> A different PC is connecting as <strong>{w.deviceName}</strong>. If this wasn&apos;t you, unlink the device immediately.
            </span>
            <button onClick={() => { setFingerprintWarnings((prev) => prev.filter((x) => x.deviceId !== w.deviceId)); setActiveSection("security"); }}
              style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: "inherit", background: "none", border: "1px solid currentColor", borderRadius: "var(--r-sm)", padding: "3px 10px", cursor: "pointer" }}>
              Review
            </button>
            <button onClick={() => setFingerprintWarnings((prev) => prev.filter((x) => x.deviceId !== w.deviceId))}
              style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex" }}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}

        {/* ── Devices ── */}
        {activeSection === "devices" && (
          <div className="page">
            <div className="page-head">
              <div>
                <h2>Devices</h2>
                <p>Connected PCs sharing storage with your account.</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={refreshDevices} disabled={isLoading}>
                  <RefreshCcw size={14} className={isLoading ? "animate-spin" : ""} aria-hidden="true" /> Refresh
                </button>
              </div>
            </div>

            <div className="stats">
              <div className="stat-card">
                <div className="stat-card-head">
                  <span className="stat-card-label">Connected PCs</span>
                  <span className="stat-icon stat-icon-brand"><Computer size={16} aria-hidden="true" /></span>
                </div>
                <div className="stat-card-val">{devices.length}</div>
                <div className="stat-card-delta stat-card-delta-up">
                  <ArrowUpRight size={11} aria-hidden="true" /> {devices.length} total
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-head">
                  <span className="stat-card-label">Online now</span>
                  <span className="stat-icon stat-icon-success"><Wifi size={16} aria-hidden="true" /></span>
                </div>
                <div className="stat-card-val">{onlineDevices}<small>/ {devices.length}</small></div>
                <div className="stat-card-delta">
                  <span className="dot" style={{ background: "var(--success)" }}></span> All good
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-head">
                  <span className="stat-card-label">Storage used</span>
                  <span className="stat-icon"><Database size={16} aria-hidden="true" /></span>
                </div>
                <div className="stat-card-val">{formatBytes(totalUsed)}</div>
                <div className="bar" style={{ marginTop: 10 }}>
                  <div style={{ width: `${totalStorage ? (totalUsed / totalStorage) * 100 : 0}%` }}></div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-head">
                  <span className="stat-card-label">Total capacity</span>
                  <span className="stat-icon"><HardDrive size={16} aria-hidden="true" /></span>
                </div>
                <div className="stat-card-val">{formatBytes(totalStorage)}</div>
                <div className="stat-card-delta">
                  <Zap size={11} color="var(--warning)" aria-hidden="true" /> Growing
                </div>
              </div>
            </div>

            {devices.length === 0 ? (
              <div className="empty-state">
                <Computer size={36} aria-hidden="true" />
                <h3>No PCs connected yet</h3>
                <p>Install the Windows desktop app to connect your first PC.</p>
              </div>
            ) : (
              <div className="device-list">
                {devices.map((device) => {
                  const total = device.usedStorageBytes + device.storageLimitBytes;
                  const pct = total ? (device.usedStorageBytes / total) * 100 : 0;
                  return (
                    <div key={device.deviceId} className="device-row anim-fade-in">
                      <div className="device-icon"><Computer size={20} aria-hidden="true" /></div>

                      <div>
                        {editingDeviceId === device.deviceId ? (
                          <form onSubmit={(e) => handleUpdateDevice(e, device)} className="edit-device-form">
                            <input className="edit-device-input" value={editDeviceName} onChange={(e) => setEditDeviceName(e.target.value)} autoFocus />
                            <button type="submit" disabled={isLoading} className="btn btn-primary btn-sm btn-icon"><Check size={13} aria-hidden="true" /></button>
                            <button type="button" onClick={() => setEditingDeviceId(null)} className="btn btn-secondary btn-sm">Cancel</button>
                          </form>
                        ) : (
                          <div className="device-name">{device.deviceName}</div>
                        )}
                        <div className="device-meta">{device.sharedFolderName}</div>
                      </div>

                      <div>
                        <span className={`chip${device.status === "online" ? " chip-success" : ""}`}>
                          <span className={`dot${device.status === "online" ? " dot-online dot-pulse" : " dot-offline"}`}></span>
                          {device.status}
                        </span>
                        <div className="caption" style={{ marginTop: 6 }}>{device.platform}</div>
                      </div>

                      <div className="device-storage">
                        <div className="device-storage-label">
                          <span><strong className="mono">{formatBytesDetailed(device.usedStorageBytes)}</strong> used</span>
                          <span className="mono">{formatBytesDetailed(total)}</span>
                        </div>
                        <div className={`bar${pct > 80 ? " bar-warn" : ""}`}>
                          <div style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>

                      <div className="device-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => openDeviceStorage(device)}>
                          <FolderOpen size={13} aria-hidden="true" /> Open
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => beginEditDevice(device)}>
                          <Pencil size={13} aria-hidden="true" />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Unlink" onClick={() => handleUnlinkDevice(device)}>
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Storage ── */}
        {activeSection === "storage" && (
          <div className="page">
            <div className="page-head">
              <div>
                <h2>Storage</h2>
                <p>Browse files across your linked devices.</p>
              </div>
              {selectedDevice && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => setNewFolderName("")} disabled={selectedDevice.status !== "online"}>
                    <FolderPlus size={14} aria-hidden="true" /> New folder
                  </button>
                  <div ref={uploadMenuRef} style={{ position: "relative" }}>
                    <button className="btn btn-primary" onClick={() => setUploadMenuOpen((v) => !v)} disabled={isUploading || selectedDevice.status !== "online"}>
                      {isUploading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                      {isUploading ? "Uploading…" : "Upload"}
                      <ChevronDown size={12} aria-hidden="true" />
                    </button>
                    {uploadMenuOpen && (
                      <div className="upload-menu">
                        <button className="upload-menu-item" onClick={() => { setUploadMenuOpen(false); uploadInputRef.current?.click(); }}>
                          <FileText size={14} aria-hidden="true" /> Files
                        </button>
                        <button className="upload-menu-item" onClick={() => { setUploadMenuOpen(false); uploadFolderInputRef.current?.click(); }}>
                          <FolderOpen size={14} aria-hidden="true" /> Folder
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="tabs">
              {devices.map((device) => (
                <button key={device.deviceId} className={`tab${selectedDeviceId === device.deviceId ? " active" : ""}`} onClick={() => openDeviceStorage(device)} disabled={isLoading}>
                  <Computer size={13} aria-hidden="true" />
                  {device.deviceName}
                  <span className={`dot${device.status === "online" ? " dot-online dot-pulse" : " dot-offline"}`}></span>
                </button>
              ))}
              <button className="tab" onClick={() => setActiveSection("devices")}>
                <Plus size={13} aria-hidden="true" /> Add
              </button>
            </div>

            <input ref={uploadInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => handleUpload(e.target.files)} />
            <input ref={uploadFolderInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => handleFolderUpload(e.target.files)}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...({ webkitdirectory: "" } as any)} />

            {!selectedDevice ? (
              <div className="empty-state">
                <HardDrive size={40} aria-hidden="true" />
                <h3>Select a device above</h3>
                <p>Pick a connected PC to browse its files.</p>
              </div>
            ) : (
              <>
                <div className="fb-toolbar">
                  {!searchQuery ? (
                    <nav className="breadcrumb">
                      {breadcrumbs.map((crumb, i) => (
                        <React.Fragment key={crumb.path}>
                          {i > 0 && <ChevronRight size={14} aria-hidden="true" />}
                          {i < breadcrumbs.length - 1 ? (
                            <a href="#" onClick={(e) => { e.preventDefault(); openDeviceStorage(selectedDevice, crumb.path); }}>{crumb.label}</a>
                          ) : (
                            <span className="current">{crumb.label}</span>
                          )}
                        </React.Fragment>
                      ))}
                    </nav>
                  ) : (
                    <p style={{ fontSize: 14, color: "var(--fg-muted)" }}>
                      {isSearching ? "Searching…" : `${searchResults?.length ?? 0} result${searchResults?.length === 1 ? "" : "s"} for "${searchQuery}"`}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                        <Search size={14} color="var(--fg-subtle)" aria-hidden="true" />
                      </div>
                      <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search files…"
                        style={{ height: 36, width: 220, paddingLeft: 36, paddingRight: 12, background: "var(--bg-elevated)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-md)", fontSize: 13, color: "var(--fg)", fontFamily: "var(--font-sans)" }} />
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => openDeviceStorage(selectedDevice, selectedPath)} disabled={isLoading}>
                      <RefreshCcw size={14} className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {newFolderName !== null && (
                  <form onSubmit={handleCreateFolder}>
                    <div className="new-folder-row">
                      <span></span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="file-icon file-icon-folder"><FolderPlus size={14} aria-hidden="true" /></span>
                        <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name"
                          onKeyDown={(e) => e.key === "Escape" && setNewFolderName(null)} />
                        <button type="submit" disabled={!newFolderName.trim()} className="btn btn-primary btn-sm"><Check size={14} aria-hidden="true" /> Create</button>
                        <button type="button" onClick={() => setNewFolderName(null)} className="btn btn-ghost btn-sm">Cancel</button>
                      </div>
                      <span></span><span></span><span></span>
                    </div>
                  </form>
                )}

                {selectedFiles.size > 0 && (
                  <div className="sel-bar">
                    <span className="sel-bar-count">{selectedFiles.size} selected</span>
                    <button className="btn btn-sm" style={{ background: "var(--brand-600)", color: "white" }} onClick={handleBulkDownload}>
                      <ArrowDownToLine size={13} aria-hidden="true" /> Download
                    </button>
                    <div ref={moveMenuRef} style={{ position: "relative" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setMoveMenuOpen((v) => !v)}>
                        <FolderOpen size={13} aria-hidden="true" /> Move <ChevronDown size={11} aria-hidden="true" />
                      </button>
                      {moveMenuOpen && (() => {
                        const moveTargets: { label: string; path: string }[] = [];
                        if (selectedPath !== "/") {
                          const parent = selectedPath.split("/").slice(0, -1).join("/") || "/";
                          moveTargets.push({ label: parent === "/" ? "Home /" : `↑ ${parent.split("/").pop()}`, path: parent });
                        }
                        files.filter((f) => f.itemType === "folder" && !selectedFiles.has(f.id))
                          .forEach((f) => moveTargets.push({ label: f.fileName, path: f.filePath }));
                        return (
                          <div className="move-menu">
                            {moveTargets.length === 0 ? (
                              <p style={{ padding: "9px 14px", fontSize: 13, color: "var(--fg-muted)" }}>No folders available</p>
                            ) : (
                              moveTargets.map((t) => (
                                <button key={t.path} className="move-menu-item" onClick={() => handleBulkMove(t.path)}>
                                  <FolderOpen size={13} aria-hidden="true" /> {t.label}
                                </button>
                              ))
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
                      <Trash2 size={13} aria-hidden="true" /> Delete
                    </button>
                    <button onClick={() => setSelectedFiles(new Set())} style={{ width: 24, height: 24, color: "var(--brand-700)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                )}

                <div className="file-list"
                  onDragOver={(e) => { if (draggingFile) { e.preventDefault(); return; } e.preventDefault(); setIsDragging(true); }}
                  onDragEnter={(e) => { if (draggingFile) return; e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { if (draggingFile) return; if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
                  onDrop={(e) => { if (draggingFile) { e.preventDefault(); setDraggingFile(null); return; } handleDrop(e); }}
                  style={isDragging ? { outline: "2px dashed var(--brand-400)", outlineOffset: -2 } : undefined}
                >
                  {(() => {
                    const raw = searchResults ?? files;
                    const displayFiles = sortKey
                      ? [...raw].sort((a, b) => {
                          let cmp = 0;
                          if (sortKey === "name") cmp = a.fileName.localeCompare(b.fileName);
                          else if (sortKey === "size") cmp = a.sizeBytes - b.sizeBytes;
                          else if (sortKey === "date") cmp = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
                          return sortDir === "asc" ? cmp : -cmp;
                        })
                      : raw;

                    if (isSearching) {
                      return (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 40, fontSize: 13, color: "var(--fg-muted)" }}>
                          <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Searching…
                        </div>
                      );
                    }

                    if (displayFiles.length === 0) {
                      return (
                        <div className="empty-state" style={{ border: "none" }}>
                          <FolderOpen size={36} aria-hidden="true" />
                          <h3>{searchResults !== null ? "No files found" : "This folder is empty"}</h3>
                          {searchResults !== null && <p>Try a different search term.</p>}
                          {isDragging && <p style={{ color: "var(--brand-600)", fontWeight: 500 }}>Drop files to upload</p>}
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="file-header">
                          <input type="checkbox"
                            checked={displayFiles.length > 0 && displayFiles.every((f) => selectedFiles.has(f.id))}
                            onChange={(e) => { if (e.target.checked) setSelectedFiles(new Set(displayFiles.map((f) => f.id))); else setSelectedFiles(new Set()); }} />
                          <button onClick={() => handleSort("name")}>Name {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : <ArrowUpDown size={11} aria-hidden="true" />}</button>
                          <button onClick={() => handleSort("size")}>Size {sortKey === "size" ? (sortDir === "asc" ? "↑" : "↓") : <ArrowUpDown size={11} aria-hidden="true" />}</button>
                          <button onClick={() => handleSort("date")}>Modified {sortKey === "date" ? (sortDir === "asc" ? "↑" : "↓") : <ArrowUpDown size={11} aria-hidden="true" />}</button>
                          <span></span>
                        </div>
                        {displayFiles.map((file) => {
                          const isViewable = file.itemType === "file" && (
                            file.mimeType?.startsWith("image/") || file.mimeType?.startsWith("text/") ||
                            file.mimeType?.startsWith("audio/") || file.mimeType?.startsWith("video/") ||
                            file.mimeType === "application/pdf" || file.mimeType === "application/json" ||
                            file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                            file.mimeType === "application/vnd.ms-excel"
                          );
                          const isRenaming = renamingFile?.id === file.id;
                          const isSel = selectedFiles.has(file.id);
                          const iconCls = file.itemType === "folder" ? "file-icon-folder"
                            : file.mimeType?.startsWith("image/") ? "file-icon-image"
                            : file.mimeType?.startsWith("video/") ? "file-icon-video"
                            : "file-icon-doc";
                          const FileIcon = file.itemType === "folder" ? FolderOpen
                            : file.mimeType?.startsWith("image/") ? ImageIcon
                            : FileText;
                          const dlPct = fileProgress[file.id];
                          const upKey = `upload:${selectedPath === "/" ? `/${file.fileName}` : `${selectedPath}/${file.fileName}`}`;
                          const upPct = fileProgress[upKey];
                          const xferPct = dlPct ?? upPct;

                          return (
                            <div key={file.id}
                              className={`file-row${isSel ? " selected" : ""}${file.itemType === "folder" && !isRenaming ? " folder" : ""}${dragOverFolderId === file.id ? " selected" : ""}`}
                              draggable={!isRenaming}
                              onDragStart={(e) => { setDraggingFile(file); e.dataTransfer.effectAllowed = "move"; }}
                              onDragEnd={() => { setDraggingFile(null); setDragOverFolderId(null); }}
                              onDragOver={file.itemType === "folder" && !isRenaming ? (e) => {
                                if (!draggingFile || draggingFile.id === file.id) return;
                                e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; setDragOverFolderId(file.id);
                              } : undefined}
                              onDragLeave={file.itemType === "folder" ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverFolderId(null); } : undefined}
                              onDrop={file.itemType === "folder" && !isRenaming ? (e) => {
                                e.preventDefault(); e.stopPropagation(); setDragOverFolderId(null);
                                if (draggingFile && draggingFile.id !== file.id) { handleMoveFile(draggingFile, file.filePath); setDraggingFile(null); }
                              } : undefined}
                              onClick={() => { if (file.itemType === "folder" && !isRenaming) openDeviceStorage(selectedDevice, file.filePath); }}
                            >
                              <input type="checkbox" checked={isSel} onClick={(e) => e.stopPropagation()} onChange={() => toggleSelect(file.id)} />
                              <div className="file-name">
                                <span className={`file-icon ${iconCls}`}><FileIcon size={14} aria-hidden="true" /></span>
                                {isRenaming ? (
                                  <form onSubmit={(e) => handleRenameItem(e, file)} onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                                    <input autoFocus className="rename-input" value={renamingFile.name}
                                      onChange={(e) => setRenamingFile({ id: file.id, name: e.target.value })}
                                      onKeyDown={(e) => e.key === "Escape" && setRenamingFile(null)} />
                                    <button type="submit" className="btn btn-primary btn-sm btn-icon"><Check size={13} aria-hidden="true" /></button>
                                  </form>
                                ) : (
                                  <div style={{ minWidth: 0 }}>
                                    <div className="file-name-text">{file.fileName}</div>
                                    {searchResults !== null && <div style={{ fontSize: 11, color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.parentPath}</div>}
                                  </div>
                                )}
                              </div>
                              <span className="file-meta file-meta-mono">{file.itemType === "folder" ? "—" : formatBytes(file.sizeBytes)}</span>
                              <span className="file-meta">{formatDate(file.modifiedAt)}</span>
                              <div className="file-actions" onClick={(e) => e.stopPropagation()}>
                                {xferPct !== undefined ? (
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flex: 1 }}>
                                    <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{dlPct !== undefined ? "↓" : "↑"} {xferPct}%</span>
                                    <div className="bar" style={{ width: 80 }}><div style={{ width: `${xferPct}%` }}></div></div>
                                  </div>
                                ) : (
                                  <>
                                    {isViewable && (
                                      <button className="file-action-btn" title="Preview" onClick={() => handlePreview(file)} disabled={previewLoadingFile === file.id}>
                                        {previewLoadingFile === file.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                                      </button>
                                    )}
                                    {file.itemType === "file" && (
                                      <button className="file-action-btn" title="Download" onClick={() => handleDownload(file)}>
                                        <ArrowDownToLine size={14} aria-hidden="true" />
                                      </button>
                                    )}
                                    <button className="file-action-btn" title="Rename" onClick={() => setRenamingFile({ id: file.id, name: file.fileName })}>
                                      <Pencil size={14} aria-hidden="true" />
                                    </button>
                                    <button className="file-action-btn" title="Delete" onClick={() => handleDeleteFile(file)}>
                                      <Trash2 size={14} aria-hidden="true" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Activity ── */}
        {activeSection === "activity" && (
          <div className="page">
            <div className="page-head">
              <div><h2>Activity</h2><p>Recent file operations and access events on your account.</p></div>
              <button className="btn btn-secondary" onClick={fetchAuditLogs} disabled={isLoadingActivity}>
                <RefreshCcw size={14} className={isLoadingActivity ? "animate-spin" : ""} aria-hidden="true" /> Refresh
              </button>
            </div>

            {isLoadingActivity ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 48, fontSize: 13, color: "var(--fg-muted)" }}>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Loading activity…
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="empty-state">
                <Activity size={36} aria-hidden="true" />
                <h3>No activity yet</h3>
                <p>File operations, logins, and device events will appear here.</p>
              </div>
            ) : (
              <div className="device-list">
                {auditLogs.map((log) => {
                  const actionMeta: Record<string, { label: string; icon: React.ReactNode; color?: string }> = {
                    login:           { label: "Signed in",          icon: <ShieldCheck size={15} />, color: "var(--success)" },
                    login_failed:    { label: "Failed sign-in",     icon: <ShieldCheck size={15} />, color: "var(--danger, #ef4444)" },
                    logout:          { label: "Signed out",         icon: <LogOut size={15} /> },
                    register:        { label: "Account created",    icon: <ShieldCheck size={15} />, color: "var(--brand-600)" },
                    download:        { label: "Downloaded",         icon: <ArrowDownToLine size={15} /> },
                    upload:          { label: "Uploaded",           icon: <Upload size={15} />, color: "var(--brand-600)" },
                    delete:          { label: "Deleted",            icon: <Trash2 size={15} />, color: "var(--danger, #ef4444)" },
                    rename:          { label: "Renamed",            icon: <Pencil size={15} /> },
                    move:            { label: "Moved",              icon: <FolderOpen size={15} /> },
                    mkdir:           { label: "Folder created",     icon: <FolderPlus size={15} /> },
                    device_register:     { label: "Device connected",   icon: <Computer size={15} />, color: "var(--success)" },
                    device_unlink:       { label: "Device unlinked",    icon: <Computer size={15} />, color: "var(--danger, #ef4444)" },
                    fingerprint_mismatch:{ label: "Unknown device alert", icon: <ShieldCheck size={15} />, color: "var(--danger, #ef4444)" },
                  };
                  const meta = actionMeta[log.action] ?? { label: log.action, icon: <Activity size={15} /> };
                  const subject = log.filePath
                    ? log.filePath.split("/").filter(Boolean).pop() ?? log.filePath
                    : (log.details as { deviceName?: string } | null)?.deviceName ?? null;

                  return (
                    <div key={log._id} className="device-row anim-fade-in" style={{ alignItems: "center" }}>
                      <div className="device-icon" style={{ color: meta.color ?? "var(--fg-muted)", background: "var(--bg-subtle)", flexShrink: 0 }}>
                        {meta.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="device-name" style={{ fontWeight: 500 }}>
                          {meta.label}
                          {subject && (
                            <span style={{ fontWeight: 400, color: "var(--fg-muted)", marginLeft: 6 }}>— {subject}</span>
                          )}
                        </div>
                        <div className="device-meta" style={{ marginTop: 2 }}>
                          {log.filePath && <span className="mono" style={{ marginRight: 8 }}>{log.filePath}</span>}
                          {log.deviceId && !log.filePath && <span style={{ marginRight: 8 }}>Device {log.deviceId.slice(0, 8)}…</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>{formatDate(log.createdAt)}</div>
                        {log.ipAddress && (
                          <div className="mono" style={{ fontSize: 11, color: "var(--fg-subtle)", marginTop: 2 }}>{log.ipAddress}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Security ── */}
        {activeSection === "security" && (
          <div className="page page-narrow">
            <div className="page-head">
              <div><h2>Security</h2><p>Manage devices, active sessions, and authentication.</p></div>
            </div>

            <div className="settings-section">
              <h3>Two-factor authentication</h3>
              <p className="caption">An extra layer of security for your account.</p>
              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-name">Email codes</div>
                  <div className="settings-row-desc">A 6-digit code is sent to <span className="mono">{user?.userEmail}</span> for sensitive actions.</div>
                </div>
                <span className="chip chip-success"><span className="dot"></span>Enabled</span>
              </div>
              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-name">Authenticator app</div>
                  <div className="settings-row-desc">TOTP via Google Authenticator, 1Password, etc.</div>
                </div>
                <button className="btn btn-secondary btn-sm">Set up</button>
              </div>
            </div>

            <div className="settings-section">
              <h3>Linked devices</h3>
              <p className="caption">PCs running the PC2CLOUD desktop client.</p>
              {devices.length === 0 ? (
                <p style={{ fontSize: 14, color: "var(--fg-muted)" }}>No devices linked to this account.</p>
              ) : devices.map((device) => (
                <div key={device.deviceId} className="settings-row">
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
                    <span className="stat-icon"><Computer size={15} aria-hidden="true" /></span>
                    <div className="settings-row-info">
                      <div className="settings-row-name">{device.deviceName}</div>
                      <div className="settings-row-desc">{device.platform} · last seen {formatDate(device.lastSeen)}</div>
                    </div>
                  </div>
                  <span className={`chip${device.status === "online" ? " chip-success" : ""}`}>
                    <span className={`dot${device.status === "online" ? " dot-online dot-pulse" : " dot-offline"}`}></span>
                    {device.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Settings ── */}
        {activeSection === "settings" && (
          <div className="page page-narrow">
            <div className="page-head">
              <div><h2>Settings</h2><p>Manage your account and preferences.</p></div>
            </div>
            <div className="settings-section">
              <h3>Profile</h3>
              <p className="caption">Your account information.</p>
              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-name">{user?.userName || "User"}</div>
                  <div className="settings-row-desc">{user?.userEmail}</div>
                </div>
                <button className="btn btn-secondary btn-sm">Edit</button>
              </div>
            </div>
            <div className="settings-section">
              <h3>Danger zone</h3>
              <p className="caption">Irreversible actions.</p>
              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-name">Sign out</div>
                  <div className="settings-row-desc">Sign out of your account on this device.</div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={handleLogout} disabled={isLoading}>Sign out</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Help ── */}
        {activeSection === "help" && (
          <div className="page page-narrow">
            <div className="page-head">
              <div><h2>Help</h2><p>Documentation and support.</p></div>
            </div>
            <div className="empty-state">
              <Globe size={36} aria-hidden="true" />
              <h3>Documentation</h3>
              <p>Help articles and guides coming soon.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Preview modal ── */}
      {previewState && (
        <div className="preview-backdrop" onClick={closePreview}>
          <div style={{ position: "relative", maxWidth: 900, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", background: "var(--bg-elevated)", borderRadius: "var(--r-xl)", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
            onClick={(e) => e.stopPropagation()}>
            <button className="preview-close" onClick={closePreview}><X size={16} aria-hidden="true" /></button>
            <div style={{ padding: "16px 52px 16px 20px", borderBottom: "1px solid var(--line)", fontSize: 14, fontWeight: 500 }}>{previewState.name}</div>
            <div style={{ flex: 1, overflow: "auto", background: "var(--bg-subtle)" }}>
              {previewState.type === "image" && <img src={previewState.url} alt={previewState.name} style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", display: "block", margin: "auto", padding: 16 }} />}
              {previewState.type === "pdf" && <iframe src={previewState.url} title={previewState.name} style={{ width: "100%", height: "80vh", border: "none" }} />}
              {previewState.type === "text" && <pre style={{ padding: 20, fontSize: 13, fontFamily: "var(--font-mono)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all", height: "80vh", overflow: "auto", margin: 0 }}>{previewState.content}</pre>}
              {previewState.type === "spreadsheet" && <div style={{ padding: 20, height: "80vh", overflow: "auto" }} dangerouslySetInnerHTML={{ __html: previewState.html }} />}
              {previewState.type === "audio" && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}><audio controls src={previewState.url} style={{ width: "100%", maxWidth: 480 }} /></div>}
              {previewState.type === "video" && <video controls src={previewState.url} style={{ width: "100%", maxHeight: "80vh", background: "black", display: "block" }} />}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toastMessage && <div className="toast">{toastMessage}</div>}
    </div>
  );
}
