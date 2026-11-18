import { useState } from "react";
import { useI18n } from "../i18n";
import type { RoomView } from "../types";
import { Avatar } from "./Avatar";

interface Props {
  room: RoomView;
  send: (m: object) => void;
  leave: () => void;
}

export function Lobby({ room, send, leave }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}#/room/${room.code}`;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: t("title"), text: `${t("room")} ${room.code}`, url: link });
        return;
      }
    } catch {
      /* cancelled */
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt(t("share"), link);
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

      <section className="panel">
        <button className="btn btn-big" onClick={share}>
          {copied ? `✓ ${t("copied")}` : `🔗 ${t("share")}`}
        </button>
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
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
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
    </main>
  );
}
