import { useSyncExternalStore } from "react";

/**
 * Card-table sounds made with the Web Audio API (no sound files): dealing, playing a card,
 * taking a trick, your turn, the joker, warnings, chat and wins.
 */
export type SoundName = "deal" | "play" | "joker" | "trick" | "turn" | "bid" | "warn" | "chat" | "premium" | "win";

const KEY = "joker.sound";
let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
})();
const listeners = new Set<() => void>();

export function soundOn(): boolean {
  return enabled;
}

export function setSoundOn(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
  if (on) play("play");
}

export function useSoundOn(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => enabled,
  );
  return [on, setSoundOn];
}

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

// Browsers only allow sound after the person touches the page, so unlock on the first tap or key.
if (typeof window !== "undefined") {
  const unlock = () => {
    const c = audio();
    if (c) {
      // A silent blip finishes the unlock on iOS.
      const o = c.createOscillator();
      const g = c.createGain();
      g.gain.value = 0;
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.01);
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const len = Math.floor(c.sampleRate * 0.5);
  noise = c.createBuffer(1, len, c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

/** A short burst of filtered noise: the paper sound of a card. */
function swish(c: AudioContext, at: number, { dur = 0.08, freq = 2500, q = 0.8, vol = 0.35, sweepTo }: { dur?: number; freq?: number; q?: number; vol?: number; sweepTo?: number } = {}) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.012, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(at, Math.random() * 0.3, dur + 0.05);
}

/** A soft sine/triangle note. */
function tone(c: AudioContext, at: number, freq: number, { dur = 0.18, vol = 0.12, type = "sine" as OscillatorType, slideTo }: { dur?: number; vol?: number; type?: OscillatorType; slideTo?: number } = {}) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

let last: Partial<Record<SoundName, number>> = {};

export function play(name: SoundName): void {
  if (!enabled) return;
  const c = audio();
  if (!c || c.state !== "running") return;
  const now = c.currentTime;
  // Don't stack the same sound when several updates arrive at once.
  if ((last[name] ?? -1) > now - 0.06) return;
  last = { ...last, [name]: now };
  const t = now + 0.005;
  switch (name) {
    case "deal":
      for (let i = 0; i < 6; i++) swish(c, t + i * 0.055, { dur: 0.05, freq: 3200 + Math.random() * 800, vol: 0.22 });
      break;
    case "play":
      swish(c, t, { dur: 0.07, freq: 1800, q: 1.2, vol: 0.4 });
      tone(c, t, 180, { dur: 0.06, vol: 0.18, slideTo: 90 });
      break;
    case "joker":
      swish(c, t, { dur: 0.07, freq: 1800, q: 1.2, vol: 0.4 });
      [784, 988, 1319, 1568].forEach((f, i) => tone(c, t + 0.04 + i * 0.06, f, { dur: 0.22, vol: 0.07, type: "triangle" }));
      break;
    case "trick":
      swish(c, t, { dur: 0.22, freq: 900, q: 0.6, vol: 0.3, sweepTo: 3500 });
      swish(c, t + 0.06, { dur: 0.12, freq: 2600, vol: 0.18 });
      break;
    case "turn":
      tone(c, t, 660, { dur: 0.16, vol: 0.09 });
      tone(c, t + 0.11, 880, { dur: 0.24, vol: 0.09 });
      break;
    case "bid":
      tone(c, t, 520, { dur: 0.07, vol: 0.06, type: "triangle" });
      break;
    case "warn":
      tone(c, t, 880, { dur: 0.12, vol: 0.12, type: "square" });
      tone(c, t + 0.18, 880, { dur: 0.12, vol: 0.12, type: "square" });
      break;
    case "chat":
      tone(c, t, 520, { dur: 0.09, vol: 0.08, slideTo: 780 });
      break;
    case "premium":
      [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.09, f, { dur: 0.3, vol: 0.08, type: "triangle" }));
      break;
    case "win":
      [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.12, f, { dur: i === 5 ? 0.6 : 0.2, vol: 0.09, type: "triangle" }));
      break;
  }
}
