export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:7000";

let _token = "";

export function setToken(t: string) {
  _token = t;
}

export function getToken() {
  return _token;
}

export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  return fetch(url, { ...init, headers, credentials: "include" });
}
