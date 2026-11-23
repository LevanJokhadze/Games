import { useCallback, useEffect, useRef, useState } from "react";
import type { GameConfig, GameRecord, Match, Profile, RoomView, Sheet, SheetDeal } from "./types";

const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
export const API_URL =
  envUrl || (location.hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(location.hostname)
    ? `${location.protocol}//${location.hostname}:8787`
    : location.origin);

/** Turns a server-relative URL (avatars) into an absolute one. */
export function absUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  return u.startsWith("/") ? `${API_URL}${u}` : u;
}

const TOKEN_KEY = "joker.token";

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
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status);
  return body as T;
}

export interface ProfileInput {
  nickname: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  password?: string;
}

export async function register(p: ProfileInput): Promise<Profile> {
  const r = await api<{ token: string; user: Profile }>("/api/register", { method: "POST", body: JSON.stringify(p) });
  setToken(r.token);
  return r.user;
}

/** Log in on this device with nickname + password. */
export async function login(nickname: string, password: string): Promise<Profile> {
  const r = await api<{ token: string; user: Profile }>("/api/login", { method: "POST", body: JSON.stringify({ nickname, password }) });
  setToken(r.token);
  return r.user;
}

export async function logout(): Promise<void> {
  try {
    await api("/api/logout", { method: "POST" });
  } catch {
    /* offline: forget the token anyway */
  }
  setToken(null);
}

export async function fetchMe(): Promise<Profile | null> {
  if (!getToken()) return null;
  try {
    return (await api<{ user: Profile }>("/api/me")).user;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      setToken(null);
      return null;
    }
    throw e;
  }
}

export async function updateMe(p: Partial<ProfileInput>): Promise<Profile> {
  return (await api<{ user: Profile }>("/api/me", { method: "PUT", body: JSON.stringify(p) })).user;
}

export async function fetchLeaderboard(): Promise<(Profile & { rank: number })[]> {
  return (await api<{ players: (Profile & { rank: number })[] }>("/api/leaderboard?limit=100")).players;
}

export async function fetchUser(id: string): Promise<{ user: Profile; games: GameRecord[] }> {
  return api(`/api/users/${encodeURIComponent(id)}`);
}

export const HISTORY_PAGE = 20;

/** A page of a player's games, newest first; pass the last game's finishedAt to get the next page. */
export async function fetchUserGames(id: string, before?: string): Promise<GameRecord[]> {
  const q = new URLSearchParams({ limit: String(HISTORY_PAGE) });
  if (before) q.set("before", before);
  return (await api<{ games: GameRecord[] }>(`/api/users/${encodeURIComponent(id)}/games?${q}`)).games;
}

export async function fetchMatch(id: string): Promise<Match> {
  return (await api<{ match: Match }>(`/api/games/${encodeURIComponent(id)}`)).match;
}

/** Registered players by nickname or name, for picking who sits at a score sheet. */
export async function searchPlayers(q: string): Promise<Profile[]> {
  return (await api<{ players: Profile[] }>(`/api/users/search?q=${encodeURIComponent(q)}`)).players;
}

export async function fetchSheets(): Promise<Sheet[]> {
  return (await api<{ sheets: Sheet[] }>("/api/sheets")).sheets;
}

export async function createSheet(p: { players: string[]; firstDealer: number; config: GameConfig }): Promise<Sheet> {
  return (await api<{ sheet: Sheet }>("/api/sheets", { method: "POST", body: JSON.stringify(p) })).sheet;
}

export async function fetchSheet(id: string): Promise<Sheet> {
  return (await api<{ sheet: Sheet }>(`/api/sheets/${encodeURIComponent(id)}`)).sheet;
}

export async function saveSheetDeals(s: Sheet, deals: SheetDeal[]): Promise<Sheet> {
  return (await api<{ sheet: Sheet }>(`/api/sheets/${s.id}/deals`, { method: "PUT", body: JSON.stringify({ version: s.version, deals }) })).sheet;
}

export async function sheetAction(s: Sheet, action: "submit" | "confirm" | "reject"): Promise<Sheet> {
  return (await api<{ sheet: Sheet }>(`/api/sheets/${s.id}/${action}`, { method: "POST", body: JSON.stringify({ version: s.version }) })).sheet;
}

export async function deleteSheet(s: Sheet): Promise<void> {
  await api(`/api/sheets/${s.id}`, { method: "DELETE" });
}

export async function createRoom(game: "joker" | "bura" | "poker" = "joker"): Promise<string> {
  const res = await fetch(`${API_URL}/api/rooms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game }) });
  if (!res.ok) throw new Error("create failed");
  return ((await res.json()) as { code: string }).code;
}

export async function roomExists(code: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(code)}`);
  return res.ok;
}

export function playerId(): string {
  const key = "joker.playerId";
  let id: string | null = null;
  try {
    id = localStorage.getItem(key);
  } catch {
    /* private mode */
  }
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    try {
      localStorage.setItem(key, id);
    } catch {
      /* ignore */
    }
  }
  return id;
}

export type Status = "connecting" | "open" | "closed" | "notfound";

/** Connects to a room, keeps the connection alive and reconnects on drops. */
export function useRoom(code: string, name: string, onAuthError?: () => void) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const clockOffset = useRef(0);
  const listeners = useRef(new Set<(m: { t: string; [k: string]: unknown }) => void>());

  useEffect(() => {
    let stopped = false;
    let retry = 0;
    let ping: number | undefined;
    let timer: number | undefined;

    const connect = () => {
      if (stopped) return;
      setStatus("connecting");
      const ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/api/rooms/${code}/ws`);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setStatus("open");
        ws.send(JSON.stringify({ t: "hello", token: getToken(), playerId: playerId(), name }));
        ping = window.setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ t: "ping" })), 25_000);
      };
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.t === "state") {
          clockOffset.current = m.room.serverTime - Date.now();
          setRoom(m.room);
        } else if (m.t === "rtc" || m.t === "talk" || m.t === "pcm") {
          listeners.current.forEach((fn) => fn(m));
        } else if (m.t === "error") {
          if (m.code === "auth") onAuthError?.();
          else setError(m.message);
        }
      };
      ws.onclose = async (e) => {
        window.clearInterval(ping);
        if (stopped) return;
        if (e.code === 4004) {
          setStatus("notfound");
          return;
        }
        setStatus("closed");
        // A room that never existed returns 404 on upgrade; check before retrying forever.
        if (retry >= 1) {
          try {
            if (!(await roomExists(code))) {
              setStatus("notfound");
              return;
            }
          } catch {
            /* offline: keep retrying */
          }
        }
        retry++;
        timer = window.setTimeout(connect, Math.min(8000, 500 * 2 ** retry));
      };
    };
    connect();

    const onVisible = () => {
      if (document.visibilityState === "visible" && wsRef.current?.readyState !== 1) {
        window.clearTimeout(timer);
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(ping);
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      wsRef.current?.close();
    };
  }, [code, name]);

  const send = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }, []);

  /** Listen to voice-chat messages (WebRTC signalling and push-to-talk); returns an unsubscribe. */
  const subscribe = useCallback((fn: (m: { t: string; [k: string]: unknown }) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  return { room, status, error, clearError: () => setError(null), send, clockOffset, subscribe };
}
