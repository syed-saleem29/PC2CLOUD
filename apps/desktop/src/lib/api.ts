export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:7000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipc = () => (window as any).require("electron").ipcRenderer;

let _token = "";
let _refreshToken = "";

export function setToken(t: string) { _token = t; }
export function getToken() { return _token; }
export function setRefreshToken(t: string) { _refreshToken = t; }
export function getRefreshToken() { return _refreshToken; }

export async function apiFetch(url: string, init: RequestInit = {}, _retry = false): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;

  const res = await fetch(url, { ...init, headers, credentials: "include" });

  if (res.status === 401 && !_retry && _refreshToken) {
    try {
      const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ refreshToken: _refreshToken }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        _token = data.token;
        _refreshToken = data.refreshToken;
        const config = await ipc().invoke("config:read");
        await ipc().invoke("config:write", { ...config, authToken: data.token, refreshToken: data.refreshToken });
        return apiFetch(url, init, true);
      }
    } catch { /* ignore */ }
    _token = "";
    _refreshToken = "";
  }

  return res;
}
