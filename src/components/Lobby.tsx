import { useState } from "react";
import { useI18n } from "../i18n";
import type { RoomView } from "../types";

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
            <li key={i} className={`seat-row ${s?.you ? "me" : ""}`}>
              <span className="seat-num">{i + 1}</span>
              {s ? (
                <>
                  <span className="seat-name">
                    {s.name}
                    {s.you && <em> ({t("you")})</em>}
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
