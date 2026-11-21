import { useCallback, useEffect, useState } from "react";

const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
export const API_URL = envUrl || (location.hostname === "localhost" ? "http://localhost:8099" : location.origin);

const TOKEN_KEY = "posts.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: stay logged in for this tab only */
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event("posts:logout"));
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).detail || msg;
    } catch {
      /* not json */
    }
    throw new ApiError(String(msg), res.status);
  }
  return res.json() as Promise<T>;
}

export const post = <T = unknown>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const put = <T = unknown>(path: string, body: unknown) => api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const patch = <T = unknown>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body) });

/** Loads a GET endpoint, refreshes every `everyMs` (0 = never) and on reload(). */
export function useApi<T>(path: string, everyMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    api<T>(path)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [path]);
  useEffect(() => {
    reload();
    if (!everyMs) return;
    const t = setInterval(reload, everyMs);
    return () => clearInterval(t);
  }, [reload, everyMs]);
  return { data, error, reload };
}
export const del = <T = unknown>(path: string) => api<T>(path, { method: "DELETE" });

/** Sends a file as the raw request body (videos are too big for JSON). */
export async function upload<T = unknown>(path: string, file: File): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api${path}`, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).detail || msg;
    } catch {
      /* not json */
    }
    throw new ApiError(String(msg), res.status);
  }
  return res.json() as Promise<T>;
}
