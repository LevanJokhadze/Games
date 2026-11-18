// Push-to-talk voice chat: a WebRTC audio mesh between everyone at the table who joined voice.
// Signalling (offers, answers, ICE candidates) goes through the room's WebSocket; the audio
// itself flows directly between browsers.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomView } from "./types";

type Msg = { t: string; [k: string]: unknown };

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
  const env = import.meta.env as Record<string, string | undefined>;
  // Optional TURN relay for players behind strict mobile networks.
  if (env.VITE_TURN_URLS) {
    servers.push({ urls: env.VITE_TURN_URLS.split(","), username: env.VITE_TURN_USERNAME, credential: env.VITE_TURN_CREDENTIAL });
  }
  return servers;
}

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
}

export const voiceSupported =
  typeof window !== "undefined" && typeof RTCPeerConnection !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

export function useVoice(room: RoomView | null, send: (m: object) => void, subscribe: (fn: (m: Msg) => void) => () => void) {
  const [joined, setJoined] = useState(false);
  const [talking, setTalking] = useState(false);
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const peers = useRef(new Map<string, Peer>());
  const me = room?.peer ?? "";
  const meRef = useRef(me);
  meRef.current = me;

  const closePeer = (id: string) => {
    const p = peers.current.get(id);
    if (!p) return;
    p.pc.close();
    p.audio.srcObject = null;
    p.audio.remove();
    peers.current.delete(id);
  };

  const getPeer = useCallback(
    (id: string): Peer => {
      const existing = peers.current.get(id);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("playsinline", "");
      audio.style.display = "none";
      document.body.appendChild(audio);
      const peer: Peer = { pc, audio, polite: meRef.current < id, makingOffer: false, ignoreOffer: false };
      peers.current.set(id, peer);
      stream.current?.getTracks().forEach((t) => pc.addTrack(t, stream.current!));
      pc.onicecandidate = ({ candidate }) => candidate && send({ t: "rtc", to: id, data: { candidate } });
      pc.onnegotiationneeded = async () => {
        try {
          peer.makingOffer = true;
          await pc.setLocalDescription();
          send({ t: "rtc", to: id, data: { description: pc.localDescription } });
        } catch (e) {
          console.warn("voice offer failed", e);
        } finally {
          peer.makingOffer = false;
        }
      };
      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
        audio.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") pc.restartIce();
      };
      return peer;
    },
    [send],
  );

  // Signalling and push-to-talk messages from the server.
  useEffect(
    () =>
      subscribe(async (m) => {
        if (m.t === "talk") {
          const peer = String(m.peer);
          setSpeaking((prev) => {
            const next = new Set(prev);
            if (m.on) next.add(peer);
            else next.delete(peer);
            return next;
          });
          return;
        }
        if (m.t !== "rtc" || !stream.current) return;
        const from = String(m.from);
        const data = (m.data ?? {}) as { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
        const peer = getPeer(from);
        const pc = peer.pc;
        try {
          if (data.description) {
            const collision = data.description.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
            peer.ignoreOffer = !peer.polite && collision;
            if (peer.ignoreOffer) return;
            await pc.setRemoteDescription(data.description);
            if (data.description.type === "offer") {
              await pc.setLocalDescription();
              send({ t: "rtc", to: from, data: { description: pc.localDescription } });
            }
          } else if (data.candidate) {
            try {
              await pc.addIceCandidate(data.candidate);
            } catch (e) {
              if (!peer.ignoreOffer) throw e;
            }
          }
        } catch (e) {
          console.warn("voice signalling failed", e);
        }
      }),
    [subscribe, getPeer, send],
  );

  // Connect to everyone else in voice; drop people who left.
  const voicePeers = (room?.people ?? []).filter((p) => p.voice && p.peer !== me).map((p) => p.peer);
  const key = voicePeers.sort().join(",");
  useEffect(() => {
    if (!joined) return;
    const want = new Set(voicePeers);
    for (const id of [...peers.current.keys()]) if (!want.has(id)) closePeer(id);
    // The impolite side starts; the polite side answers (both work thanks to perfect negotiation).
    for (const id of want) getPeer(id);
  }, [joined, key]);

  const stopTalk = useCallback(() => {
    const track = stream.current?.getAudioTracks()[0];
    if (!track || !track.enabled) return;
    track.enabled = false;
    setTalking(false);
    send({ t: "talk", on: false });
  }, [send]);

  const startTalk = useCallback(() => {
    const track = stream.current?.getAudioTracks()[0];
    if (!track || track.enabled) return;
    track.enabled = true;
    setTalking(true);
    send({ t: "talk", on: true });
  }, [send]);

  const join = useCallback(async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      s.getAudioTracks().forEach((t) => (t.enabled = false));
      stream.current = s;
      setJoined(true);
      send({ t: "voice", on: true });
    } catch {
      setError("mic");
    }
  }, [send]);

  const leave = useCallback(() => {
    stopTalk();
    for (const id of [...peers.current.keys()]) closePeer(id);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setJoined(false);
    send({ t: "voice", on: false });
  }, [send, stopTalk]);

  // Hold B to talk (by physical key, so it works on a Georgian keyboard layout too).
  useEffect(() => {
    if (!joined) return;
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "KeyB" && !e.repeat && !typing(e)) startTalk();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "KeyB") stopTalk();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", stopTalk);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stopTalk);
    };
  }, [joined, startTalk, stopTalk]);

  // Leave cleanly when the table closes.
  useEffect(
    () => () => {
      for (const id of [...peers.current.keys()]) closePeer(id);
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    },
    [],
  );

  const all = new Set(speaking);
  if (talking && me) all.add(me);
  return { joined, join, leave, talking, startTalk, stopTalk, speaking: all, error };
}

export type Voice = ReturnType<typeof useVoice>;
