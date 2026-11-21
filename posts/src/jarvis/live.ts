import { useSyncExternalStore } from "react";
import { api, API_URL, post } from "../api";
import { Mic, Player, toBase64 } from "./audio";

// Jarvis: one Gemini Live voice conversation about the pipeline, relayed by the API (it holds the credentials and
// runs the tools). When a session starts the dashboard puts the cards that need attention on screen right away,
// then Gemini talks about them. Gemini also drives the screen: cards, modals, page changes and links come in as
// {ui} messages. Connections last ~10 minutes, so it reconnects with a resumption handle and keeps the conversation.

export type JarvisState = "off" | "connecting" | "listening" | "speaking" | "reconnecting" | "cards" | "error";

export interface CardAction {
  label: string;
  url?: string;
  page?: string;
  modal?: { kind: ModalKind; id: number };
  api?: string;
  body?: unknown;
  worker?: string;
}
export interface JarvisCard {
  id: string;
  tone: "urgent" | "warn" | "info" | "good";
  title: string;
  body: string;
  actions: CardAction[];
  done?: string; // a button on it was pressed and worked
}
export type ModalKind = "clip" | "account" | "post" | "upload" | "custom";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface JarvisModal { kind: ModalKind; data: any; platform?: string }
export interface Line { id: number; who: "you" | "ai" | "tool" | "dash"; text: string }

interface VoiceInfo { configured: boolean; backend: string | null; model: string }
interface Context { cards: JarvisCard[]; voice: VoiceInfo }

const TOOL_LINE: Record<string, string> = {
  get_snapshot: "Reading the pipeline…",
  get_calendar: "Checking the calendar…",
  get_details: "Looking it up…",
  recent_events: "Reading the event log…",
  run_worker: "Running a worker…",
  mark_submitted: "Marking it submitted…",
  add_post_link: "Saving the post link…",
  approve_clip: "Approving the clip…",
  reject_clip: "Rejecting the clip…",
  set_account_status: "Changing the account status…",
};
const SCREEN_TOOLS = new Set(["show_cards", "clear_cards", "open_modal", "create_modal", "close_modal", "navigate", "open_link", "upload_clip"]);
const MAX_LINES = 80;
const MAX_BUFFERED = 1024 * 1024;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wsUrl = (ticket: string) => `${API_URL.replace(/^http/, "ws")}/api/assistant/live?ticket=${encodeURIComponent(ticket)}`;

class Jarvis {
  state: JarvisState = "off";
  error: string | null = null;
  muted = false;
  level = 0;
  lines: Line[] = [];
  cards: JarvisCard[] = [];
  modal: JarvisModal | null = null;
  voice: VoiceInfo | null = null;
  panelOpen = false;
  version = 0;

  private ws: WebSocket | null = null;
  private mic: Mic | null = null;
  private player: Player | null = null;
  private handle: string | null = null;
  private conn = 0;
  private open = false;
  private active = false;
  private failures = 0;
  private you: Line | null = null;
  private ai: Line | null = null;
  private seq = 0;
  private timer = 0;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  private emit() {
    this.version++;
    for (const f of this.listeners) f();
  }
  private setState(s: JarvisState) {
    if (s !== this.state) (this.state = s), this.emit();
  }
  get on() {
    return this.active;
  }

  setPanel(open: boolean) {
    this.panelOpen = open;
    this.emit();
  }

  /** Loads the cards that need attention (also used without voice). */
  async loadCards(replace = true) {
    const ctx = await api<Context>("/assistant/context");
    this.voice = ctx.voice;
    this.setCards(ctx.cards, replace);
    return ctx;
  }

  async start() {
    if (this.active) return;
    Object.assign(this, { active: true, error: null, handle: null, failures: 0, lines: [], panelOpen: true });
    this.setState("connecting");
    try {
      const ctx = await this.loadCards();
      if (!ctx.voice.configured) {
        this.active = false;
        this.push("tool", "Voice isn't set up on the server yet, so Jarvis shows cards only. Add GEMINI_API_KEY in Railway to talk to him.");
        return this.setState("cards");
      }
      this.player = new Player();
      await this.player.resume();
      try {
        this.mic = await Mic.open((pcm, level) => this.onMic(pcm, level));
      } catch {
        this.push("tool", "No microphone: type to Jarvis instead.");
      }
      await this.connect();
      this.timer = window.setInterval(() => this.tick(), 400);
    } catch (e) {
      this.fail(e);
    }
  }

  stop() {
    this.active = false;
    this.teardown();
    this.setState("off");
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m && this.open) this.send({ audioEnd: true });
    this.emit();
  }

  /** Typed message from the panel. */
  sendText(text: string) {
    const t = text.trim();
    if (!t) return;
    if (!this.open) return void this.push("tool", "Jarvis isn't connected. Press Start to talk to him.");
    this.push("you", t);
    this.you = null;
    this.send({ text: t });
  }

  /** Tells Gemini what happened on screen, without asking for a reply. */
  private note(text: string) {
    if (this.open) this.send({ text: `[Dashboard] ${text}`, reply: false });
  }

  dismissCard(id: string) {
    this.cards = this.cards.filter((c) => c.id !== id);
    this.emit();
  }

  clearCards() {
    this.cards = [];
    this.emit();
  }

  closeModal() {
    this.modal = null;
    this.emit();
  }

  async openModal(kind: ModalKind, id: number) {
    try {
      const data = await api(`/assistant/modal/${kind}/${id}`);
      this.modal = { kind, data };
      this.emit();
    } catch (e) {
      this.push("tool", `Couldn't open it: ${(e as Error).message}`);
    }
  }

  /** A button on a card or modal. Pressing it is the user's own decision, so it runs straight away. */
  async run(a: CardAction, card?: JarvisCard) {
    try {
      if (a.url) this.openLink(a.url, a.label);
      else if (a.page) location.hash = a.page;
      else if (a.modal) await this.openModal(a.modal.kind, a.modal.id);
      else if (a.worker) {
        await post(`/workers/${a.worker}/run`);
        this.markDone(card, `${a.worker} started`);
      } else if (a.api) {
        await post(a.api, a.body);
        this.markDone(card, "Done");
        window.dispatchEvent(new Event("posts:changed"));
      }
      if (card) this.note(`Levan pressed "${a.label}" on the card "${card.title}".`);
    } catch (e) {
      this.markDone(card, `Failed: ${(e as Error).message}`);
    }
  }

  private markDone(card: JarvisCard | undefined, text: string) {
    if (!card) return;
    this.cards = this.cards.map((c) => (c.id === card.id ? { ...c, done: text } : c));
    this.emit();
  }

  /** New tabs opened from a voice command aren't a click, so the browser may block them: then it becomes a card. */
  openLink(url: string, label?: string) {
    const w = window.open(url, "_blank", "noopener");
    if (!w) {
      this.setCards([{ id: `open-${url}`, tone: "info", title: label || "Open link", body: url, actions: [{ label: "Open", url }] }], false);
    }
  }

  private setCards(cards: JarvisCard[], replace: boolean) {
    const fresh = new Set(cards.map((c) => c.id));
    this.cards = replace ? cards : [...cards, ...this.cards.filter((c) => !fresh.has(c.id))];
    this.emit();
  }

  private teardown() {
    clearInterval(this.timer);
    this.conn++;
    this.ws?.close();
    this.ws = null;
    this.open = false;
    this.mic?.close();
    this.mic = null;
    this.player?.close();
    this.player = null;
  }

  private fail(e: unknown) {
    this.active = false;
    this.error = (e as Error)?.message || String(e);
    this.teardown();
    this.setState("error");
  }

  private onMic(pcm: ArrayBuffer, level: number) {
    this.level = this.muted ? 0 : level;
    if (this.muted || !this.open || (this.ws?.bufferedAmount ?? 0) > MAX_BUFFERED) return;
    this.send({ audio: toBase64(pcm) });
  }

  private send(m: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  private async connect() {
    const { ticket } = await post<{ ticket: string }>("/assistant/session");
    const id = ++this.conn;
    const resuming = !!this.handle;
    this.open = false;
    const ws = new WebSocket(wsUrl(ticket));
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ start: { handle: this.handle ?? undefined } }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ws.onmessage = (e) => {
      if (id !== this.conn || typeof e.data !== "string") return;
      try {
        this.onMessage(JSON.parse(e.data), resuming);
      } catch {
        /* not json */
      }
    };
    ws.onclose = (e) => id === this.conn && this.onClose(e);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onMessage(m: any, resuming: boolean) {
    if (m.ready) {
      this.open = true;
      this.failures = 0;
      this.setState("listening");
      if (!resuming) {
        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const shown = this.cards.map((c) => `- ${c.title}`).join("\n") || "- nothing needs him right now";
        this.send({
          text: `[Dashboard] Levan started a Jarvis session (${time}). The dashboard put these cards on screen:\n${shown}\n\nGreet him in one short sentence and tell him the two or three things that matter most for views right now. Then wait.`,
        });
      }
    }
    if (m.handle) this.handle = m.handle;
    if (m.goAway) void this.reconnect();
    if (m.audio) this.player?.play(m.audio);
    if (m.interrupted) this.player?.stop();
    if (m.you) {
      this.you = this.append(this.you, "you", m.you);
      this.ai = null;
    }
    if (m.ai) {
      this.ai = this.append(this.ai, "ai", m.ai);
      this.you = null;
    }
    if (m.turnComplete) this.you = this.ai = null;
    if (m.tool && !SCREEN_TOOLS.has(m.tool)) this.push("tool", TOOL_LINE[m.tool] ?? `Checking ${String(m.tool).replace(/_/g, " ")}…`);
    if (m.changed) window.dispatchEvent(new Event("posts:changed"));
    if (m.ui) this.onUi(m.ui);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onUi(u: any) {
    switch (u.type) {
      case "cards":
        return this.setCards(u.cards, !!u.replace);
      case "clear_cards":
        return this.clearCards();
      case "modal":
        this.modal = { kind: u.kind, data: u.data };
        return this.emit();
      case "close_modal":
        return this.closeModal();
      case "navigate":
        location.hash = u.page;
        return;
      case "open":
        return this.openLink(u.url, u.label);
      case "upload":
        this.modal = { kind: "clip", data: u.data, platform: u.platform };
        this.emit();
        if (u.url) this.openLink(u.url, `Open the ${u.platform} upload page`);
        return;
    }
  }

  private onClose(e: CloseEvent) {
    if (!this.active) return;
    if (!this.open || e.code !== 4001) this.failures++;
    if (e.code === 4003) return this.fail(new Error(e.reason || "Jarvis can't reach Gemini as configured."));
    if (this.failures >= 2) this.handle = null;
    if (this.failures > 4) return this.fail(new Error(e.reason || `Connection closed (${e.code})`));
    void this.reconnect();
  }

  private reconnecting = false;
  private async reconnect(): Promise<void> {
    if (this.reconnecting || !this.active) return;
    this.reconnecting = true;
    this.setState("reconnecting");
    this.conn++;
    this.ws?.close();
    this.ws = null;
    this.open = false;
    this.player?.stop();
    try {
      if (this.failures) await sleep(Math.min(1000 * 2 ** this.failures, 15_000));
      if (this.active) await this.connect();
    } catch (e) {
      this.failures++;
      this.reconnecting = false;
      if (this.failures > 4) return this.fail(e);
      return this.reconnect();
    }
    this.reconnecting = false;
  }

  private tick() {
    if (!this.active || !this.open) return;
    this.setState(this.player?.speaking ? "speaking" : "listening");
  }

  private push(who: Line["who"], text: string): Line {
    const line = { id: ++this.seq, who, text };
    this.lines = [...this.lines, line].slice(-MAX_LINES);
    this.emit();
    return line;
  }

  private append(line: Line | null, who: Line["who"], text: string): Line {
    if (!line || !this.lines.includes(line)) return this.push(who, text.trimStart());
    line.text += text;
    this.lines = [...this.lines];
    this.emit();
    return line;
  }
}

export const jarvis = new Jarvis();

export function useJarvis() {
  useSyncExternalStore(jarvis.subscribe, () => jarvis.version);
  return jarvis;
}
