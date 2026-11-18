import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomView } from "./types";

const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
export const API_URL =
  envUrl || (location.hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(location.hostname)
    ? `${location.protocol}//${location.hostname}:8787`
    : location.origin);

export async function createRoom(): Promise<string> {
  const res = await fetch(`${API_URL}/api/rooms`, { method: "POST" });
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
export function useRoom(code: string, name: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const clockOffset = useRef(0);

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
        ws.send(JSON.stringify({ t: "hello", playerId: playerId(), name }));
        ping = window.setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ t: "ping" })), 25_000);
      };
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.t === "state") {
          clockOffset.current = m.room.serverTime - Date.now();
          setRoom(m.room);
        } else if (m.t === "error") {
          setError(m.message);
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

  return { room, status, error, clearError: () => setError(null), send, clockOffset };
}
