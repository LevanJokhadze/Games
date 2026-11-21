import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { BuraPlay, BuraRound, BuraView, Card, RoomView } from "../types";
import type { Voice } from "../voice";
import { Avatar } from "./Avatar";
import { CardBack, CardView, RANK_LABEL, SUIT_SYMBOL, SuitBadge } from "./CardView";
import { ChatSheet, VoiceControl, sysText } from "./Chat";
import { Modal } from "./Modal";
import { Rules } from "./Rules";

interface Props {
  room: RoomView;
  send: (m: object) => void;
  leave: () => void;
  clockOffset: number;
  openMatch: (id: string) => void;
  voice: Voice;
}

const POS = ["bottom", "left", "top", "right"] as const;
export const RAISE_NAMES: Record<string, string[]> = {
  ka: ["", "", "დავი", "სე", "ჩარი", "ფანჯი", "შაში"],
  en: ["", "", "davi", "se", "chari", "panji", "shashi"],
};

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const cardName = (c: Card) => `${RANK_LABEL[c.rank]}${SUIT_SYMBOL[c.suit!]}`;

export function BuraTable({ room, send, leave, clockOffset, openMatch, voice }: Props) {
  const { t, lang } = useI18n();
  const g = room.game as BuraView;
  const me = room.you ?? 0;
  const myTeam = me % 2;
  const rel = (seat: number) => (seat - me + 4) % 4;
  const name = (i: number) => room.seats[i]?.name ?? `#${i + 1}`;
  const teamName = (tm: number) => `${name(tm)} + ${name(tm + 2)}`;
  const raiseName = (n: number) => RAISE_NAMES[lang]?.[n] ?? "";
  const playing = g.phase === "playing";
  const myTurn = room.you !== null && playing && g.turn === room.you;

  const [selected, setSelected] = useState<string[]>([]);
  const [showRounds, setShowRounds] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Chat: unread count and a short bubble for new messages (same as the Joker table).
  const myName = room.people.find((p) => p.peer === room.peer)?.name;
  const [seenAt, setSeenAt] = useState(() => room.chat.at(-1)?.at ?? 0);
  const lastMsg = room.chat.at(-1);
  useEffect(() => {
    if (showChat && lastMsg) setSeenAt(lastMsg.at);
  }, [showChat, lastMsg?.at]);
  const unread = showChat ? 0 : room.chat.filter((m) => m.at > seenAt && (m.sys || m.name !== myName)).length;
  const [bubble, setBubble] = useState<{ name: string; text: string; sys?: string } | null>(null);
  useEffect(() => {
    if (!lastMsg || showChat || lastMsg.at <= seenAt || (!lastMsg.sys && lastMsg.name === myName)) return;
    setBubble(lastMsg.sys ? { name: "", text: sysText(t, lastMsg), sys: lastMsg.sys.kind } : { name: lastMsg.name, text: lastMsg.text });
    const id = setTimeout(() => setBubble(null), 4500);
    return () => clearTimeout(id);
  }, [lastMsg?.at]);

  // Keep the finished trick on the table for a moment so everyone sees who took it.
  const [held, setHeld] = useState<{ plays: BuraPlay[]; winner: number } | null>(null);
  const lastKey = g.lastTrick ? `${g.round}:${g.lastTrick.plays.map((p) => p.cards.map((c) => c?.id ?? "x").join("")).join("|")}` : "";
  const prevKey = useRef(lastKey);
  useEffect(() => {
    if (lastKey && lastKey !== prevKey.current) {
      prevKey.current = lastKey;
      setHeld(g.lastTrick);
      const id = setTimeout(() => setHeld(null), 1600);
      return () => clearTimeout(id);
    }
    prevKey.current = lastKey;
  }, [lastKey]);

  // Selection resets whenever it stops being my move.
  const moveKey = `${g.round}:${g.turn}:${g.need}:${g.cardsNeeded}:${g.trick?.plays.length ?? 0}`;
  useEffect(() => setSelected([]), [moveKey]);

  const isSpeaking = (seat: number) => {
    const p = room.people.find((x) => x.seat === seat);
    return !!p && voice.speaking.has(p.peer);
  };

  const showing = g.trick ? { plays: g.trick.plays, best: g.trick.best, done: false } : held ? { plays: held.plays, best: held.winner, done: true } : null;

  const cardMode = myTurn && (g.need === "lead" || g.need === "answer" || g.need === "topUp");
  const max = g.need === "lead" ? Math.min(5, g.hand.length) : g.cardsNeeded;
  const selCards = selected.map((id) => g.hand.find((c) => c.id === id)!).filter(Boolean);
  const leadSuit = g.need === "lead" && selCards.length ? selCards[0].suit : null;
  const canPick = (c: Card) => cardMode && (g.need !== "lead" || !leadSuit || c.suit === leadSuit || selected.length === 0);
  const valid =
    cardMode &&
    (g.need === "lead" ? selCards.length >= 1 && selCards.length <= max && selCards.every((c) => c.suit === selCards[0].suit) : selCards.length === max);

  const tap = (c: Card) => {
    if (!cardMode) return;
    if (selected.includes(c.id)) {
      setSelected(selected.filter((x) => x !== c.id));
      return;
    }
    if (g.need === "lead" && leadSuit && c.suit !== leadSuit) {
      setSelected([c.id]);
      return;
    }
    // Full: the newest pick replaces the oldest.
    setSelected(selected.length >= max ? [...selected.slice(1), c.id] : [...selected, c.id]);
  };
  const act = (action: object) => {
    send({ t: "bura", action });
    setSelected([]);
  };
  const playSelected = () => {
    if (!valid) return;
    act({ t: g.need, cards: selected });
  };

  const now = useNow(room.deadline !== null || room.seats.some((s) => s?.afkKickAt));
  const serverNow = now + clockOffset;
  const timeLeft = room.deadline ? Math.max(0, room.deadline - serverNow) : null;
  const turnSeat = room.seats[g.turn];
  const warn = room.turnStage === "warn";
  const timerMax = warn ? 60_000 : 30_000;
  const showTimer = playing && timeLeft !== null && !!turnSeat && !turnSeat.bot && !turnSeat.afkKickAt;
  const myKickAt = room.you !== null ? room.seats[room.you]?.afkKickAt ?? null : null;
  const kickLeft = myKickAt ? Math.max(0, Math.ceil((myKickAt - serverNow) / 1000)) : 0;

  const r = g.raise;
  const status = (() => {
    if (!playing) return "";
    const who = name(g.turn);
    if (r) {
      if (r.stage === "partner") return myTurn ? "" : t("bWaitPartner", { name: who, raise: raiseName(r.to), n: r.to });
      if (r.stage === "answer") return myTurn ? t("bTheyRaise", { name: name(r.by), raise: raiseName(r.to), n: r.to }) : t("bWaitAnswer", { name: who, raise: raiseName(r.to), n: r.to });
      return myTurn ? "" : t("bWaitAnswerPartner", { name: name(r.answerer ?? g.turn) });
    }
    if (showing?.done) return t("wonTrick", { name: name(showing.best) });
    if (!myTurn) return t("bWait", { name: who });
    if (g.need === "lead") return t("bLead");
    if (g.need === "topUp") return t("bTopUp", { n: g.cardsNeeded });
    return t("bAnswer", { n: g.cardsNeeded });
  })();

  const last = g.rounds.at(-1);

  return (
    <main className="table-screen bura">
      <header className="topbar">
        <button className="icon-btn" onClick={leave} aria-label={t("leave")}>✕</button>
        <div className="deal-info">
          <span>{t("bRound", { n: g.round + 1 })}</span>
          {g.stake > 1 && (
            <>
              <span className="dot">·</span>
              <span className="stake-chip">{raiseName(g.stake)} ×{g.stake}</span>
            </>
          )}
        </div>
        <div className="trump-info" title={t("bTrump")}>
          <span className="trump-label">{t("bTrump")}</span>
          <SuitBadge suit={g.trump} />
          {g.trumpCard && <CardView card={g.trumpCard} size="sm" />}
          <span className="stock-count" title={t("bStock", { n: g.stockCount })}>🂠{g.stockCount}</span>
        </div>
        <div className="topbar-voice">
          <VoiceControl voice={voice} compact />
        </div>
        <button className="icon-btn chat-btn" onClick={() => setShowChat(true)} aria-label={t("chat")}>
          💬{unread > 0 && <span className="unread">{unread > 9 ? "9+" : unread}</span>}
        </button>
        <button className="icon-btn" onClick={() => setShowRules(true)} aria-label={t("rules")}>?</button>
      </header>

      <button className="score-strip pairs" onClick={() => setShowRounds(true)} aria-label={t("tapScores")}>
        {[myTeam, 1 - myTeam].map((tm) => (
          <span key={tm} className={`ss-team team-${tm} ${g.match[tm] > g.match[1 - tm] ? "lead" : ""}`}>
            <span className="ss-names">{room.you !== null ? (tm === myTeam ? t("us") : t("them")) : teamName(tm)}</span>
            <span className="ss-sub">{t("bTo", { n: g.target })}</span>
            <strong>{g.match[tm]}</strong>
          </span>
        ))}
        <span className="ss-more" aria-hidden>▤</span>
      </button>

      <div className="felt">
        {bubble && (
          <button className={`chat-bubble ${bubble.sys ? `sys sys-${bubble.sys}` : ""}`} onClick={() => setShowChat(true)}>
            <span className="bubble-text">{bubble.sys ? bubble.text : <><strong>{bubble.name}:</strong> {bubble.text}</>}</span>
          </button>
        )}
        {g.round === 0 && g.cut && !g.trick && !held && g.lastTrick === null && (
          <div className="premium-note cut-note" role="status">
            {t("bCut", { card: cardName(g.cut), name: name(g.dealer) })}
          </div>
        )}
        {g.crawford && playing && <div className="premium-note crawford-note">{t("bCrawford")}</div>}
        <div className="felt-voice">
          <VoiceControl voice={voice} compact />
        </div>
        {[1, 2, 3].map((k) => {
          const seat = (me + k) % 4;
          return (
            <BuraBadge
              key={seat}
              pos={POS[k]}
              room={room}
              seat={seat}
              timer={showTimer && g.turn === seat ? timeLeft : null}
              timerMax={timerMax}
              warn={warn && g.turn === seat}
              speaking={isSpeaking(seat)}
            />
          );
        })}

        {showing && g.phase === "playing" && (
          <div className={`bura-trick ${showing.done ? "done" : ""}`} style={{ ["--n" as string]: Math.max(...showing.plays.map((p) => p.cards.length)) }}>
            {showing.plays.map((p) => (
              <div key={p.seat} className={`bt-group area-${POS[rel(p.seat)]} ${p.seat === showing.best ? "best" : "beaten"}`}>
                {p.cards.map((c, i) =>
                  c && p.up[i] ? (
                    <CardView key={c.id} card={c} size="md" />
                  ) : c ? (
                    <span key={c.id} className="own-down" title="↓">
                      <CardView card={c} size="md" />
                    </span>
                  ) : (
                    <CardBack key={`b${i}`} size="md" />
                  ),
                )}
              </div>
            ))}
          </div>
        )}

        {g.phase === "roundOver" && last && <RoundResult round={last} name={name} teamName={teamName} myTeam={room.you !== null ? myTeam : null} />}
      </div>

      <section className="me-area">
        {myKickAt ? (
          <div className="afk-panel" role="alert">
            <div className="afk-text">
              <strong>🤖 {t("afkTitle")}</strong>
              <span>{t("afkBody", { s: kickLeft })}</span>
            </div>
            <button className="btn btn-primary btn-big afk-back" onClick={() => send({ t: "back" })}>
              👋 {t("imBack")}
            </button>
          </div>
        ) : myTurn && warn && showTimer ? (
          <div className="status-line my-turn warn" role="alert">
            ⏰ {t("warnMe", { s: Math.ceil(timeLeft! / 1000) })}
          </div>
        ) : (
          status && (
            <div className={`status-line ${myTurn ? "my-turn" : ""} ${warn && showTimer ? "warn" : ""}`}>
              {status}
              {showTimer && (g.turn === room.you || warn) && <span className="timer-text"> · {Math.ceil(timeLeft! / 1000)}s</span>}
            </div>
          )
        )}

        {myTurn && !myKickAt && (
          <div className="action-panel bura-actions">
            {g.canBura && (
              <button className="btn btn-primary btn-big bura-btn" onClick={() => act({ t: "bura" })}>
                👑 {t("bShowBura")}
              </button>
            )}
            {r && g.need === "approve" && (
              <div className="raise-box">
                <p>
                  {r.stage === "partner"
                    ? t("bPartnerRaise", { name: name(r.by), raise: raiseName(r.to), n: r.to })
                    : r.answer === "fold"
                      ? t("bPartnerFold", { name: name(r.answerer!) })
                      : t("bPartnerReraise", { name: name(r.answerer!), raise: raiseName(r.to + 1), n: r.to + 1 })}
                </p>
                <div className="raise-row">
                  <button className="btn btn-primary" onClick={() => act({ t: "approve", yes: true })}>✓ {t("bAgree")}</button>
                  <button className="btn" onClick={() => act({ t: "approve", yes: false })}>✕ {t("bDisagree")}</button>
                </div>
              </div>
            )}
            {r && g.need === "respond" && (
              <div className="raise-row">
                <button className="btn btn-primary" onClick={() => act({ t: "respond", answer: "accept" })}>✓ {t("bAccept", { n: r.to })}</button>
                {g.canRaiseAgain && (
                  <button className="btn" onClick={() => act({ t: "respond", answer: "raise" })}>
                    ⬆ {t("bReraise", { raise: raiseName(r.to + 1), n: r.to + 1 })}
                  </button>
                )}
                <button className="btn btn-ghost" onClick={() => act({ t: "respond", answer: "fold" })}>{t("bFold", { n: g.stake })}</button>
              </div>
            )}
            {cardMode && (
              <div className="raise-row">
                {g.canRaise && (
                  <button className="btn raise-btn" onClick={() => act({ t: "raise" })}>
                    ⬆ {t("bRaise", { name: raiseName(g.stake + 1), n: g.stake + 1 })}
                  </button>
                )}
                {g.canMalyutka && (
                  <button className="btn malyutka-btn" onClick={() => act({ t: "answer", cards: g.hand.map((c) => c.id) })}>
                    ✋ {t("bMalyutka")}
                  </button>
                )}
                <button className="btn btn-primary play-btn" disabled={!valid} onClick={playSelected}>
                  {selected.length ? t("bPlayN", { n: selected.length }) : t("bPlay")}
                </button>
              </div>
            )}
          </div>
        )}

        {room.you !== null && (
          <div className="me-badge-row">
            <BuraBadge pos="bottom" room={room} seat={room.you} timer={null} compact speaking={isSpeaking(room.you)} />
          </div>
        )}

        {room.you !== null ? (
          <BuraHand cards={g.hand} selected={selected} pickable={canPick} dim={cardMode} onTap={tap} />
        ) : (
          <p className="hint">{t("spectating")}</p>
        )}
      </section>

      {showRounds && <RoundsSheet room={room} onClose={() => setShowRounds(false)} />}
      {showRules && <Rules game="bura" onClose={() => setShowRules(false)} />}
      {showChat && <ChatSheet room={room} send={send} voice={voice} onClose={() => setShowChat(false)} />}
      {room.status === "finished" && !showRounds && (
        <BuraGameOver room={room} send={send} leave={leave} openRounds={() => setShowRounds(true)} openMatch={openMatch} />
      )}
    </main>
  );
}

function RoundResult({ round, name, teamName, myTeam }: { round: BuraRound; name: (i: number) => string; teamName: (tm: number) => string; myTeam: number | null }) {
  const { t } = useI18n();
  const won = round.winner;
  // Your team first, like the score strip.
  const first = myTeam ?? 0;
  return (
    <div className={`round-result ${won === null ? "tie" : won === myTeam ? "us" : myTeam === null ? "" : "them"}`} role="status">
      {round.how === "bura" && round.seat !== null && <p className="rr-how">👑 {t("bByBura", { name: name(round.seat) })}</p>}
      {round.how === "fold" && round.seat !== null && <p className="rr-how">{t("bByFold", { name: name(round.seat) })}</p>}
      {round.bura && (
        <div className="rr-cards">
          {round.bura.map((c) => (
            <CardView key={c.id} card={c} size="sm" />
          ))}
        </div>
      )}
      <strong className="rr-main">{won === null ? t("bRoundTie") : t("bRoundWon", { names: teamName(won), n: round.value })}</strong>
      {round.points && won !== null && <span className="rr-points">{t("bPoints", { a: round.points[first], b: round.points[1 - first] })}</span>}
      <span className="rr-match">
        <small className={`team-${first}`}>{myTeam !== null ? t("us") : "A"}</small>
        {round.match[first]} : {round.match[1 - first]}
        <small className={`team-${1 - first}`}>{myTeam !== null ? t("them") : "B"}</small>
      </span>
      <span className="muted small">{t("bNext")}</span>
    </div>
  );
}

function BuraBadge({ pos, room, seat, timer, timerMax = 30_000, warn, compact, speaking }: { pos: string; room: RoomView; seat: number; timer: number | null; timerMax?: number; warn?: boolean; compact?: boolean; speaking?: boolean }) {
  const { t } = useI18n();
  const g = room.game as BuraView;
  const s = room.seats[seat];
  const active = g.turn === seat && g.phase === "playing";
  const count = g.handCounts[seat];
  const partner = room.you !== null && seat === (room.you + 2) % 4;
  return (
    <div className={`badge badge-${pos} team-${seat % 2} ${active ? "active" : ""} ${compact ? "compact" : ""} ${s && !s.connected ? "offline" : ""} ${speaking ? "speaking" : ""} ${warn ? "warn" : ""} ${s?.afkKickAt ? "afk" : ""} ${s?.left ? "left" : ""}`}>
      {!compact && (
        <div className="badge-cards" aria-label={`${count} ${t("cards")}`}>
          {Array.from({ length: Math.min(count, 5) }, (_, i) => (
            <CardBack key={i} />
          ))}
        </div>
      )}
      <div className="badge-main">
        <div className="badge-name">
          {!compact && <Avatar url={s?.avatarUrl} name={s?.name ?? "?"} bot={s?.bot} size={22} />}
          {g.dealer === seat && <span className="dealer-chip" title={t("dealer")}>D</span>}
          <span className="name-text">{s?.name ?? "—"}</span>
          {speaking && <span className="speaking-icon" aria-label="🔊">🔊</span>}
        </div>
        {partner && <div className="partner-tag">{t("partner")}</div>}
        {s?.afkKickAt ? (
          <div className="afk-tag">🤖 {t("botPlaying")}</div>
        ) : s?.left ? (
          <div className="afk-tag">🚪 {t("leftTag")}</div>
        ) : (
          s && !s.connected && <div className="offline-tag">{t("offline")}</div>
        )}
      </div>
      {timer !== null && <div className={`timer-bar ${warn ? "warn" : ""}`} style={{ width: `${Math.min(100, (timer / timerMax) * 100)}%` }} />}
    </div>
  );
}

function BuraHand({ cards, selected, pickable, dim, onTap }: { cards: Card[]; selected: string[]; pickable: (c: Card) => boolean; dim: boolean; onTap: (c: Card) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 700);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setWidth(el.clientWidth);
      setVh(window.innerHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const n = cards.length;
  const layout = useMemo(() => {
    const avail = Math.max(200, width - 8);
    const desktop = typeof window !== "undefined" && window.innerWidth >= 900 && vh >= 640;
    const maxCw = desktop ? 150 : 96;
    const maxByHeight = vh * (vh < 500 ? 0.22 : desktop ? 0.15 : 0.16);
    const cw = Math.max(48, Math.min(maxCw, maxByHeight, n > 0 ? avail / (n * 0.8 + 0.2) : maxCw));
    const step = n > 1 ? Math.min(cw + 8, (avail - cw) / (n - 1)) : 0;
    return { cw, step, total: n > 0 ? cw + step * (n - 1) : 0 };
  }, [width, vh, n]);
  return (
    <div className="hand" ref={ref} style={{ height: layout.cw * 1.45 + 26 }}>
      <div className="hand-inner" style={{ width: layout.total, ["--cw" as string]: `${layout.cw}px` }}>
        {cards.map((c, i) => (
          <CardView
            key={c.id}
            card={c}
            size="lg"
            onClick={() => onTap(c)}
            disabled={dim && !pickable(c) && !selected.includes(c.id)}
            selected={selected.includes(c.id)}
            style={{ left: i * layout.step, zIndex: i + 1 }}
          />
        ))}
      </div>
    </div>
  );
}

function RoundsSheet({ room, onClose }: { room: RoomView; onClose: () => void }) {
  const { t } = useI18n();
  const g = room.game as BuraView;
  const name = (i: number) => room.seats[i]?.name ?? `#${i + 1}`;
  return (
    <Modal title={t("bRounds")} onClose={onClose}>
      <BuraRoundsTable rounds={g.rounds} names={[0, 1, 2, 3].map(name)} />
    </Modal>
  );
}

/** Every finished round: trump, card points, how it ended and the match score after it. */
export function BuraRoundsTable({ rounds, names }: { rounds: BuraRound[]; names: string[] }) {
  const { t } = useI18n();
  if (!rounds.length) return <p className="hint">{t("bNoRounds")}</p>;
  return (
    <div className="table-scroll">
      <table className="score-table bura-rounds">
        <thead>
          <tr>
            <th>#</th>
            <th>{t("bTrump")}</th>
            <th className="team-0">{names[0]} + {names[2]}</th>
            <th className="team-1">{names[1]} + {names[3]}</th>
            <th>{t("bResult")}</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                <SuitBadge suit={r.trump} />
              </td>
              {[0, 1].map((tm) => (
                <td key={tm} className={r.winner === tm ? "won" : ""}>
                  {r.points ? r.points[tm] : "–"}
                  <small className="muted"> · {r.match[tm]}</small>
                </td>
              ))}
              <td>
                {r.how === "tie" ? "60:60" : r.how === "bura" ? "👑" : r.how === "fold" ? "🏳" : ""} {r.value > 0 ? `+${r.value}` : ""}
                {r.stake > 1 && <small className="muted"> ×{r.stake}</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BuraGameOver({ room, send, leave, openRounds, openMatch }: { room: RoomView; send: (m: object) => void; leave: () => void; openRounds: () => void; openMatch: (id: string) => void }) {
  const { t } = useI18n();
  const g = room.game as BuraView;
  const name = (i: number) => room.seats[i]?.name ?? "";
  const winner = g.match[0] > g.match[1] ? 0 : 1;
  const order = [winner, winner + 2, 1 - winner, 3 - winner];
  return (
    <Modal title={t("gameOver")}>
      <p className="winner-line">🏆 {t("teamWins", { names: `${name(winner)} + ${name(winner + 2)}` })}</p>
      <div className="team-result">
        {[0, 1].map((tm) => (
          <div key={tm} className={`team-box team-${tm} ${tm === winner ? "won" : ""}`}>
            <span className="team-names">{name(tm)} + {name(tm + 2)}</span>
            <strong>{g.match[tm]}</strong>
          </div>
        ))}
      </div>
      <ol className="final-list rich">
        {order.map((s) => {
          const c = room.ratingChanges?.[s];
          return (
            <li key={s} className={s === room.you ? "me" : ""}>
              <Avatar url={room.seats[s]?.avatarUrl} name={name(s)} bot={room.seats[s]?.bot} size={32} />
              <span className="name-link">{name(s)}</span>
              <strong>{g.match[s % 2]}</strong>
              <span className="rating-cell">
                {c && (
                  <>
                    <span className="muted small">{c.after}</span>
                    <span className={`delta ${c.delta > 0 ? "pos" : c.delta < 0 ? "neg" : ""}`}>{c.delta > 0 ? `+${c.delta}` : c.delta}</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="stack">
        {room.isHost && <button className="btn btn-primary btn-big" onClick={() => send({ t: "rematch" })}>{t("playAgain")}</button>}
        {room.matchId ? (
          <button className="btn btn-big" onClick={() => openMatch(room.matchId!)}>{t("matchSummary")}</button>
        ) : (
          <button className="btn btn-big" onClick={openRounds}>{t("bRounds")}</button>
        )}
        <button className="btn btn-ghost" onClick={leave}>{t("backHome")}</button>
      </div>
    </Modal>
  );
}
