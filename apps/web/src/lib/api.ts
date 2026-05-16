export type AuthMode = "login" | "register";
export type AuthScreen = "credentials" | "verify-email" | "forgot-email" | "reset-password";

export type Device = {
  deviceId: string;
  deviceName: string;
  platform: string;
  publicKey: string | null;
  sharedFolderName: string;
  storageLimitBytes: number;
  usedStorageBytes: number;
  pairingStatus: "pending" | "linked";
  status: "online" | "offline";
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
};

export type CloudFile = {
  id: string;
  fileName: string;
  filePath: string;
  parentPath: string;
  itemType: "file" | "folder";
  sizeBytes: number;
  mimeType: string | null;
  modifiedAt: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7000";
const TOKEN_KEY = "pc2cloud_token";
const REFRESH_TOKEN_KEY = "pc2cloud_refresh_token";

export function setWebToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

export function clearWebToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

function getWebToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setRefreshToken(token: string) {
  try { localStorage.setItem(REFRESH_TOKEN_KEY, token); } catch {}
}

export function clearRefreshToken() {
  try { localStorage.removeItem(REFRESH_TOKEN_KEY); } catch {}
}

function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_TOKEN_KEY); } catch { return null; }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}, _retry = false): Promise<T> {
  const token = getWebToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401 && !_retry) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setWebToken(refreshData.token);
        setRefreshToken(refreshData.refreshToken);
        return request<T>(path, options, true);
      }
      clearWebToken();
      clearRefreshToken();
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError((data as { message?: string }).message || "Request failed", response.status);
  }

  return data as T;
}

export function authenticateUser(
  mode: AuthMode,
  payload: { username?: string; email: string; password: string },
) {
  return request<{
    message: string;
    user?: { userName?: string; userEmail: string };
    requiresVerification?: boolean;
    email?: string;
    token?: string;
    refreshToken?: string;
  }>(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(payload) });
}

export function sendOtp(email: string, type: "verify" | "reset") {
  return request<{ message: string }>("/api/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email, type }),
  });
}

export function verifyEmail(email: string, otp: string) {
  return request<{ message: string; user: { userName?: string; userEmail: string }; token: string; refreshToken: string }>(
    "/api/auth/verify-email",
    { method: "POST", body: JSON.stringify({ email, otp }) },
  );
}

export function resetPassword(email: string, otp: string, newPassword: string) {
  return request<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, otp, newPassword }),
  });
}

export function logoutUser() {
  const refreshToken = getRefreshToken();
  return request<{ message: string }>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export function getCurrentUser() {
  return request<{ user: { userName?: string; userEmail: string } }>("/api/auth/me");
}

export function getDevices() {
  return request<{ devices: Device[] }>("/api/devices");
}

export function registerDevice(payload: {
  deviceName: string;
  sharedFolderName: string;
  storageCapacityBytes: number;
  usedStorageBytes: number;
  sharedFolderPath?: string;
}) {
  return request<{ message: string; device: Device }>("/api/devices/register", {
    method: "POST",
    body: JSON.stringify({
      deviceName: payload.deviceName,
      sharedFolderName: payload.sharedFolderName,
      sharedFolderPath: payload.sharedFolderPath,
      storageLimitBytes: payload.storageCapacityBytes,
      usedStorageBytes: payload.usedStorageBytes,
      platform: "windows",
    }),
  });
}

export function unlinkDevice(deviceId: string) {
  return request<{ message: string; deviceId: string }>(`/api/devices/${deviceId}`, {
    method: "DELETE",
  });
}

export function updateDeviceName(deviceId: string, deviceName: string) {
  return request<{ message: string; device: Device }>(
    `/api/devices/${deviceId}/storage`,
    {
      method: "PATCH",
      body: JSON.stringify({ deviceName }),
    },
  );
}

export function getDeviceFiles(deviceId: string, path = "/") {
  const params = new URLSearchParams({ path });

  return request<{
    device: {
      deviceId: string;
      deviceName: string;
      sharedFolderName: string;
    };
    path: string;
    files: CloudFile[];
  }>(`/api/devices/${deviceId}/files?${params.toString()}`);
}

export function createFolder(deviceId: string, folderPath: string) {
  const params = new URLSearchParams({ path: folderPath });
  return request<{ message: string }>(`/api/devices/${deviceId}/mkdir?${params.toString()}`, {
    method: "POST",
  });
}

export function deleteFile(deviceId: string, filePath: string) {
  const params = new URLSearchParams({ path: filePath });
  return request<{ message: string }>(`/api/devices/${deviceId}/files?${params.toString()}`, {
    method: "DELETE",
  });
}

export function moveItem(deviceId: string, sourcePath: string, destFolderPath: string) {
  return request<{ message: string; newPath: string }>(`/api/devices/${deviceId}/files/move`, {
    method: "PATCH",
    body: JSON.stringify({ sourcePath, destFolderPath }),
  });
}

export function renameItem(deviceId: string, filePath: string, newName: string) {
  const params = new URLSearchParams({ path: filePath });
  return request<{ message: string; newPath: string }>(`/api/devices/${deviceId}/files?${params.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({ newName }),
  });
}

export function getDownloadUrl(deviceId: string, filePath: string) {
  const params = new URLSearchParams({ path: filePath });
  return `${API_URL}/api/devices/${deviceId}/download?${params.toString()}`;
}

export function getViewUrl(deviceId: string, filePath: string) {
  const params = new URLSearchParams({ path: filePath, inline: "true" });
  return `${API_URL}/api/devices/${deviceId}/download?${params.toString()}`;
}

export function searchDeviceFiles(deviceId: string, query: string) {
  const params = new URLSearchParams({ q: query });
  return request<{ files: CloudFile[] }>(`/api/devices/${deviceId}/files/search?${params.toString()}`);
}

export function createPreviewFileIndex(deviceId: string) {
  return request<{ message: string; syncedCount: number }>(
    `/api/devices/${deviceId}/files/preview`,
    {
      method: "POST",
    },
  );
}

export type Subscription = {
  plan: "free" | "pro" | "team";
  status: "active" | "cancelled" | "expired";
  renewalDate: string | null;
  cancelledAt: string | null;
  devices: { used: number; limit: number };
  bandwidth: { usedBytes: number; limitBytes: number | null };
};

export const PLAN_DEVICE_LIMITS: Record<string, number> = { free: 1, pro: 3, team: 10 };

export function getSubscription() {
  return request<Subscription>("/api/subscription");
}

export type RazorpayOrder = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  plan: string;
};

export function createSubscriptionOrder(plan: "pro" | "team") {
  return request<RazorpayOrder>("/api/subscription/create-order", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

export function verifySubscriptionPayment(payload: {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  plan: string;
}) {
  return request<{ message: string; plan: string; renewalDate: string }>(
    "/api/subscription/verify-payment",
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export type AuditLog = {
  _id: string;
  action: string;
  deviceId: string | null;
  filePath: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};

export function getAuditLogs(page = 1, limit = 50) {
  return request<{ logs: AuditLog[]; page: number; limit: number }>(
    `/api/audit?page=${page}&limit=${limit}`,
  );
}
