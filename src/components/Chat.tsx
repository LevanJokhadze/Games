import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { ChatLine, RoomView } from "../types";
import { voiceSupported, type Voice } from "../voice";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";

/** The text of a server notice (someone stopped responding, came back, was removed). */
export function sysText(t: ReturnType<typeof useI18n>["t"], m: ChatLine): string {
  const n = m.sys!;
  const penalty = n.penalty ? t("penaltyNote", { n: n.penalty }) : "";
  if (n.kind === "warn") return t("sysWarn", { name: n.name });
  if (n.kind === "afk") return t("sysAfk", { name: n.name, penalty });
  if (n.kind === "back") return t("sysBack", { name: n.name });
  return t("sysKicked", { name: n.name, penalty });
}

const LINK_KEY = { connecting: "voiceConnecting", connected: "voiceConnected", failed: "voiceFailedShort" } as const;

/** Overall voice state: worst link wins. */
function linkSummary(voice: Voice): "connecting" | "connected" | "failed" | "alone" {
  const v = Object.values(voice.links);
  if (!v.length) return "alone";
  if (v.includes("failed")) return "failed";
  if (v.includes("connecting")) return "connecting";
  return "connected";
}

const canHover = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

/** Messages, the box to write one, and who is here (players and spectators). */
export function ChatBody({ room, send, voice, autoFocus }: { room: RoomView; send: (m: object) => void; voice?: Voice; autoFocus?: boolean }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const meName = room.people.find((p) => p.peer === room.peer)?.name;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [room.chat.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    send({ t: "chat", text: v });
    setText("");
  };

  return (
    <div className="chat">
      <ul className="people-row" aria-label={t("people")}>
        {room.people.map((p) => (
          <li key={p.peer} className={`person ${voice?.speaking.has(p.peer) ? "speaking" : ""}`} title={p.seat === null ? t("watcher") : undefined}>
            <Avatar url={p.avatarUrl} name={p.name} size={26} />
            <span className="person-name">{p.name}</span>
            {p.seat === null && <span aria-label={t("watcher")}>👁</span>}
            {p.voice && (
              <span className={`voice-mark ${voice?.links[p.peer] ? `link-${voice.links[p.peer]}` : ""}`} aria-label={t("voice")} title={voice?.links[p.peer] ? t(LINK_KEY[voice.links[p.peer]]) : undefined}>
                🎙
              </span>
            )}
          </li>
        ))}
      </ul>
      <ol className="chat-list" ref={listRef}>
        {room.chat.length === 0 && <li className="hint">{t("noMessages")}</li>}
        {room.chat.map((m, i) =>
          m.sys ? (
            <li key={`${m.at}-${i}`} className={`chat-line sys sys-${m.sys.kind}`}>
              {sysText(t, m)}
            </li>
          ) : (
          <li key={`${m.at}-${i}`} className={`chat-line ${m.name === meName ? "mine" : ""}`}>
            <span className="chat-name">
              {m.name}
              {m.seat === null && " 👁"}
            </span>
            <span className="chat-text">{m.text}</span>
          </li>
          ),
        )}
      </ol>
      <form className="chat-form" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("typeMessage")}
          maxLength={200}
          enterKeyHint="send"
          autoFocus={autoFocus && canHover}
          aria-label={t("typeMessage")}
        />
        <button className="btn btn-primary" type="submit" disabled={!text.trim()}>
          {t("sendMsg")}
        </button>
      </form>
    </div>
  );
}

export function ChatSheet({ room, send, voice, onClose }: { room: RoomView; send: (m: object) => void; voice: Voice; onClose: () => void }) {
  const { t } = useI18n();
  const watching = room.people.filter((p) => p.seat === null).length;
  return (
    <Modal title={`💬 ${t("chat")}${watching ? ` · 👁 ${watching}` : ""}`} onClose={onClose}>
      <ChatBody room={room} send={send} voice={voice} autoFocus />
    </Modal>
  );
}

/** Join voice, then press and hold to talk (or hold B on a keyboard). */
export function VoiceControl({ voice, compact, people }: { voice: Voice; compact?: boolean; people?: { peer: string; name: string }[] }) {
  const { t } = useI18n();
  const summary = voice.joined ? linkSummary(voice) : "alone";
  const failedNames = Object.entries(voice.links)
    .filter(([, st]) => st === "failed")
    .map(([id]) => people?.find((p) => p.peer === id)?.name ?? "?");
  if (!voiceSupported) return null;
  if (!voice.joined) {
    return (
      <div className={`voice-ctl ${compact ? "compact" : ""}`}>
        <button className="btn voice-join" onClick={voice.join} aria-label={t("joinVoice")}>
          🎙{compact ? "" : ` ${t("joinVoice")}`}
        </button>
        {voice.error && <p className="error-text small">{t("micDenied")}</p>}
      </div>
    );
  }
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    voice.startTalk();
  };
  return (
    <div className={`voice-ctl joined ${compact ? "compact" : ""}`}>
      <button
        className={`ptt ${voice.talking ? "on" : ""} link-${summary}`}
        onPointerDown={down}
        onPointerUp={voice.stopTalk}
        onPointerCancel={voice.stopTalk}
        onLostPointerCapture={voice.stopTalk}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={t("holdToTalk")}
        aria-pressed={voice.talking}
      >
        <span className="ptt-icon" aria-hidden>🎙</span>
        <span className="ptt-label">{voice.talking ? t("talkingNow") : t("holdToTalk")}</span>
        {canHover && !voice.talking && <span className="ptt-hint">{t("holdB")}</span>}
        {compact && summary !== "alone" && <span className={`link-dot link-${summary}`} aria-hidden />}
      </button>
      <button className="icon-btn voice-leave" onClick={voice.leave} aria-label={t("leaveVoice")} title={t("leaveVoice")}>
        🔇
      </button>
      {!compact && (
        <p className={`voice-status small link-${summary}`}>
          {summary === "alone"
            ? t("voiceAlone")
            : summary === "connecting"
              ? t("voiceConnecting")
              : summary === "connected"
                ? t("voiceConnected")
                : t("voiceFailed", { names: failedNames.join(", ") })}
          {" "}
          <span className="muted">{t("voiceHeadphones")}</span>
        </p>
      )}
    </div>
  );
}
