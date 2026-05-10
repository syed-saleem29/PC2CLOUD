export type AuthMode = "login" | "register";

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

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

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
  return request<{ message: string; user: { userName?: string; userEmail: string } }>(
    `/api/auth/${mode}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function logoutUser() {
  return request<{ message: string }>("/api/auth/logout", {
    method: "POST",
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

export function getDownloadUrl(deviceId: string, filePath: string) {
  const params = new URLSearchParams({ path: filePath });
  return `${API_URL}/api/devices/${deviceId}/download?${params.toString()}`;
}

export function getViewUrl(deviceId: string, filePath: string) {
  const params = new URLSearchParams({ path: filePath, inline: "true" });
  return `${API_URL}/api/devices/${deviceId}/download?${params.toString()}`;
}

export function createPreviewFileIndex(deviceId: string) {
  return request<{ message: string; syncedCount: number }>(
    `/api/devices/${deviceId}/files/preview`,
    {
      method: "POST",
    },
  );
}
