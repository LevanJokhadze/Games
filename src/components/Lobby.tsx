import { useState } from "react";
import { useI18n } from "../i18n";
import type { RoomView } from "../types";
import type { Voice } from "../voice";
import { Avatar } from "./Avatar";
import { ChatBody, VoiceControl } from "./Chat";
import { pts } from "../points";
import { GAMES, gameLabel } from "./Home";

interface Props {
  room: RoomView;
  send: (m: object) => void;
  leave: () => void;
  voice: Voice;
}

export function Lobby({ room, send, leave, voice }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}#/room/${room.code}`;

  const game = room.config.game ?? "joker";
  const bura = game === "bura";
  const poker = game === "poker";
  const bg = game === "backgammon";
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Older browsers: select the text so the player can copy it by hand.
      const el = document.getElementById("invite-link") as HTMLInputElement | null;
      el?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    try {
      await navigator.share({ title: t("title"), text: `${t("inviteTitle")}: ${t("room")} ${room.code}`, url: link });
    } catch {
      /* cancelled */
    }
  };

  return (
    <main className="lobby">
      <header className="lobby-head">
        <button className="btn btn-ghost" onClick={leave}>← {t("leave")}</button>
        <div className="room-code">
          <span>{t("room")}</span>
          <strong>{room.code}</strong>
        </div>
      </header>

      <section className="panel invite">
        <h3>🔗 {t("inviteTitle")}</h3>
        <div className="invite-row">
          <input id="invite-link" className="invite-link" value={link} readOnly onFocus={(e) => e.target.select()} aria-label={t("inviteTitle")} />
          <button className="btn btn-primary" onClick={copy}>{copied ? "✓" : t("copy")}</button>
        </div>
        {copied && <p className="hint ok-text">{t("copied")}</p>}
        {canShare && (
          <button className="btn btn-big" onClick={share}>📤 {t("shareVia")}</button>
        )}
        <p className="hint left">{t("inviteHint")}</p>
      </section>

      <section className="panel">
        <ul className="seat-list">
          {room.seats.map((s, i) => (
            <li key={i} className={`seat-row ${s?.you ? "me" : ""} ${room.config.pairs ? `team-${i % 2}` : ""}`}>
              <span className="seat-num">{room.config.pairs ? (i % 2 === 0 ? "A" : "B") : i + 1}</span>
              {s ? (
                <>
                  <Avatar url={s.avatarUrl} name={s.name} bot={s.bot} size={34} />
                  <span className="seat-name">
                    {s.name}
                    {s.you && <em> ({t("you")})</em>}
                    {s.rating !== null && <small className="seat-rating">{s.rating}</small>}
                  </span>
                  <span className="tags">
                    {s.host && <span className="tag">{t("host")}</span>}
                    {s.bot && <span className="tag">{t("bot")}</span>}
                    {!s.connected && <span className="tag tag-warn">{t("offline")}</span>}
                  </span>
                  {room.isHost && !s.you && (
                    <button className="btn btn-small btn-ghost" onClick={() => send({ t: "removeSeat", seat: i })}>
                      {t("remove")}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span className="seat-name muted">{t("emptySeat")}</span>
                  <span className="seat-actions">
                    {room.you !== null && (
                      <button className="btn btn-small btn-ghost" onClick={() => send({ t: "seat", seat: i })}>
                        {t("sitHere")}
                      </button>
                    )}
                    {room.isHost && (
                      <button className="btn btn-small" onClick={() => send({ t: "addBot", seat: i })}>
                        + {t("addBot")}
                      </button>
                    )}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="field">
          <span>{t("chooseGame")}</span>
          <div className="segmented four" role="radiogroup" aria-label={t("chooseGame")}>
            {GAMES.map((g) => (
              <button
                key={g}
                role="radio"
                aria-checked={game === g}
                className={game === g ? "on" : ""}
                disabled={!room.isHost}
                onClick={() => send({ t: "config", config: { game: g } })}
              >
                {gameLabel(t, g)}
              </button>
            ))}
          </div>
          {bura && <p className="hint left">{t("buraHint")}</p>}
          {poker && <p className="hint left">{t("pokerHint")}</p>}
          {bg && <p className="hint left">{t("bgHint")}</p>}
        </div>
        {bg && (
          <label className="field">
            <span>{t("bgMatchTo")}</span>
            <select
              value={room.config.matchTo ?? 5}
              disabled={!room.isHost}
              onChange={(e) => send({ t: "config", config: { matchTo: Number(e.target.value) } })}
            >
              {[1, 3, 5, 7, 11].map((n) => (
                <option key={n} value={n}>{n === 1 ? t("bgPoint1") : t("bgPointsN", { n })}</option>
              ))}
            </select>
          </label>
        )}
        {poker && (
          <>
            <label className="field">
              <span>{t("pTableSize")}</span>
              <select
                value={room.config.seats ?? room.seats.length}
                disabled={!room.isHost}
                onChange={(e) => send({ t: "config", config: { seats: Number(e.target.value) } })}
              >
                {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("pBlinds")}</span>
              <select
                value={room.config.bb ?? 20}
                disabled={!room.isHost}
                onChange={(e) => send({ t: "config", config: { bb: Number(e.target.value) } })}
              >
                {[10, 20, 50, 100].map((bb) => (
                  <option key={bb} value={bb}>{bb / 2} / {bb}</option>
                ))}
              </select>
              <small className="hint left">{t("pBuyIn", { n: ((room.config.bb ?? 20) * 100).toLocaleString("en-US") })}</small>
            </label>
          </>
        )}
        {!bura && !poker && !bg && (<>
        <div className="field">
          <span>{t("pairs")}</span>
          <div className="segmented" role="radiogroup" aria-label={t("pairs")}>
            {[false, true].map((v) => (
              <button
                key={String(v)}
                role="radio"
                aria-checked={room.config.pairs === v}
                className={room.config.pairs === v ? "on" : ""}
                disabled={!room.isHost}
                onClick={() => send({ t: "config", config: { pairs: v } })}
              >
                {v ? `👥 ${t("pairs")}` : t("solo")}
              </button>
            ))}
          </div>
          {room.config.pairs && <p className="hint left">{t("pairsHint")}</p>}
        </div>
        <label className="field">
          <span>{t("mode")}</span>
          <select
            value={room.config.mode}
            disabled={!room.isHost}
            onChange={(e) => send({ t: "config", config: { mode: e.target.value } })}
          >
            <option value="standard">{t("modeStandard")}</option>
            <option value="nines">{t("modeNines")}</option>
          </select>
        </label>
        <label className="field">
          <span>{t("khishti")}</span>
          <select
            value={room.config.khishti}
            disabled={!room.isHost}
            onChange={(e) => send({ t: "config", config: { khishti: Number(e.target.value) } })}
          >
            {[-200, -500, -900].map((v) => (
              <option key={v} value={v}>{pts(v)}</option>
            ))}
          </select>
        </label>
        </>)}
        {room.isHost ? (
          <>
            <button className="btn btn-primary btn-big" onClick={() => send({ t: "start" })}>
              {t("start")}
            </button>
            <p className="hint">{t("startHint")}</p>
          </>
        ) : (
          <p className="hint">{room.you === null ? t("spectating") : t("onlyHost")}</p>
        )}
      </section>
      <section className="panel">
        <h3>💬 {t("chat")}</h3>
        <VoiceControl voice={voice} people={room.people} />
        <ChatBody room={room} send={send} voice={voice} />
      </section>
    </main>
  );
}
