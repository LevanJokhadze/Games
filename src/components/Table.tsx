import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { Card, JokerMode, Play, RoomView, Suit } from "../types";
import { CardBack, CardView, SUIT_SYMBOL, SuitBadge, isRed } from "./CardView";
import { Modal } from "./Modal";
import { Rules } from "./Rules";
import { Avatar } from "./Avatar";
import { Scoreboard, teamTotals } from "./Scoreboard";

interface Props {
  room: RoomView;
  send: (m: object) => void;
  leave: () => void;
  clockOffset: number;
  openMatch: (id: string) => void;
}

const POS = ["bottom", "left", "top", "right"] as const;
const SUITS: Suit[] = ["S", "H", "D", "C"];

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const canHover = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

export function Table({ room, send, leave, clockOffset, openMatch }: Props) {
  const { t } = useI18n();
  const g = room.game!;
  const me = room.you ?? 0;
  const rel = (seat: number) => (seat - me + 4) % 4;
  const names = room.seats.map((s, i) => s?.name ?? `#${i + 1}`);
  const myTurn = room.you !== null && g.turn === room.you && g.phase !== "gameOver";

  const [selected, setSelected] = useState<string | null>(null);
  const [jokerFor, setJokerFor] = useState<string | null>(null);
  const [showScores, setShowScores] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // Keep the finished trick on the table for a moment so everyone can see who took it.
  const [held, setHeld] = useState<{ plays: Play[]; winner: number } | null>(null);
  const lastKey = g.lastTrick ? g.lastTrick.plays.map((p) => p.card.id).join(",") : "";
  const prevKey = useRef(lastKey);
  useEffect(() => {
    if (lastKey && lastKey !== prevKey.current) {
      prevKey.current = lastKey;
      setHeld(g.lastTrick);
      const id = setTimeout(() => setHeld(null), 1500);
      return () => clearTimeout(id);
    }
    prevKey.current = lastKey;
  }, [lastKey]);

  useEffect(() => {
    if (!myTurn) {
      setSelected(null);
      setJokerFor(null);
    }
  }, [myTurn]);

  const showing: { plays: Play[]; winner: number | null } =
    g.trick.length > 0 || !held ? { plays: g.trick, winner: null } : { plays: held.plays, winner: held.winner };

  const playable = new Set(myTurn && g.phase === "playing" ? g.legalCards : []);

  const play = (card: Card) => {
    if (!playable.has(card.id)) return;
    if (card.joker) {
      setJokerFor(card.id);
      return;
    }
    if (selected === card.id || canHover) {
      send({ t: "play", cardId: card.id });
      setSelected(null);
    } else {
      setSelected(card.id);
    }
  };

  const sendJoker = (mode: JokerMode) => {
    if (!jokerFor) return;
    send({ t: "play", cardId: jokerFor, joker: mode });
    setJokerFor(null);
    setSelected(null);
  };

  const now = useNow(room.deadline !== null);
  const timeLeft = room.deadline ? Math.max(0, room.deadline - (now + clockOffset)) : null;
  const turnSeat = room.seats[g.turn];
  const showTimer = timeLeft !== null && turnSeat && !turnSeat.bot && timeLeft < 30_000;

  const status = (() => {
    if (g.phase === "gameOver") return t("gameOver");
    const who = names[g.turn];
    if (g.phase === "trump") return myTurn ? t("chooseTrump") : t("waitTrump", { name: who });
    if (g.phase === "bidding") return myTurn ? t("yourBid") : t("waitBid", { name: who });
    if (showing.winner !== null) return t("wonTrick", { name: names[showing.winner] });
    return myTurn ? (selected ? t("tapAgain") : t("yourTurn")) : t("waitPlay", { name: who });
  })();

  return (
    <main className="table-screen">
      <header className="topbar">
        <button className="icon-btn" onClick={leave} aria-label={t("leave")}>✕</button>
        <div className="deal-info">
          <span><span className="hide-narrow">{t("pulka")} </span>{g.pulka + 1}/{g.schedule.length}</span>
          <span className="dot">·</span>
          <span>{g.handSize}<span className="hide-narrow"> {t("cards")}</span><span className="show-narrow">🂠</span></span>
        </div>
        <div className="trump-info" title={t("trump")}>
          <span className="trump-label">{t("trump")}</span>
          {g.phase === "trump" ? <span className="suit-badge">?</span> : <SuitBadge suit={g.trump} />}
          {g.trumpCard && <CardView card={g.trumpCard} size="sm" />}
        </div>
        <button className="icon-btn" onClick={() => setShowRules(true)} aria-label={t("rules")}>?</button>
      </header>
      <ScoreStrip room={room} onOpen={() => setShowScores(true)} />

      <div className="felt">
        {[1, 2, 3].map((r) => {
          const seat = (me + r) % 4;
          return (
            <PlayerBadge
              key={seat}
              pos={POS[r]}
              room={room}
              seat={seat}
              timer={showTimer && g.turn === seat ? timeLeft : null}
            />
          );
        })}

        <div className="trick">
          {showing.plays.map((p) => (
            <div key={p.card.id} className={`trick-card pos-${POS[rel(p.seat)]} ${showing.winner === p.seat ? "winner" : ""} ${showing.winner !== null && showing.winner !== p.seat ? "loser" : ""}`}>
              <CardView card={p.card} size="md" />
              {p.card.joker && p.joker && <JokerCaption mode={p.joker} />}
            </div>
          ))}
        </div>
      </div>

      <section className="me-area">
        <div className={`status-line ${myTurn ? "my-turn" : ""}`}>
          {status}
          {showTimer && g.turn === room.you && <span className="timer-text"> · {Math.ceil(timeLeft! / 1000)}s</span>}
        </div>

        {myTurn && g.phase === "trump" && (
          <div className="action-panel trump-panel">
            {SUITS.map((s) => (
              <button key={s} className={`btn suit-btn ${isRed(s) ? "red" : ""}`} onClick={() => send({ t: "trump", suit: s })} aria-label={s}>
                {SUIT_SYMBOL[s]}
              </button>
            ))}
            <button className="btn suit-btn notrump" onClick={() => send({ t: "trump", suit: null })}>{t("noTrump")}</button>
          </div>
        )}

        {myTurn && g.phase === "bidding" && (
          <div className="action-panel bid-panel">
            {Array.from({ length: g.handSize + 1 }, (_, n) => {
              const ok = g.legalBids.includes(n);
              return (
                <button key={n} className={`btn bid-btn ${ok ? "" : "forbidden"}`} disabled={!ok} onClick={() => send({ t: "bid", bid: n })}>
                  {n}
                </button>
              );
            })}
            {g.forbiddenBid !== null && <p className="hint full">{t("dealerCant", { n: g.forbiddenBid })}</p>}
          </div>
        )}

        {room.you !== null && (
          <div className="me-badge-row">
            <PlayerBadge pos="bottom" room={room} seat={room.you} timer={null} compact />
          </div>
        )}

        {room.you !== null ? (
          <Hand
            cards={g.hand}
            hiddenExtra={g.phase === "trump" ? g.handCounts[room.you] - g.hand.length : 0}
            playable={playable}
            dim={myTurn && g.phase === "playing"}
            selected={selected}
            onTap={play}
          />
        ) : (
          <p className="hint">{t("spectating")}</p>
        )}
      </section>

      {jokerFor && <JokerDialog leading={g.trick.length === 0} onChoose={sendJoker} onCancel={() => setJokerFor(null)} />}
      {showScores && <Scoreboard room={room} onClose={() => setShowScores(false)} />}
      {showRules && <Rules onClose={() => setShowRules(false)} />}
      {room.status === "finished" && !showScores && (
        <GameOver room={room} send={send} leave={leave} openScores={() => setShowScores(true)} openMatch={openMatch} />
      )}
    </main>
  );
}

function JokerCaption({ mode }: { mode: JokerMode }) {
  const { t } = useI18n();
  return (
    <span className="joker-caption">
      {mode.type === "high" ? t("highJ") : t("lowJ")}
      {mode.suit && <span className={isRed(mode.suit) ? "red" : ""}> {SUIT_SYMBOL[mode.suit]}</span>}
    </span>
  );
}

function PlayerBadge({ pos, room, seat, timer, compact }: { pos: string; room: RoomView; seat: number; timer: number | null; compact?: boolean }) {
  const { t } = useI18n();
  const g = room.game!;
  const s = room.seats[seat];
  const bid = g.bids[seat];
  const active = g.turn === seat && g.phase !== "gameOver";
  const count = g.handCounts[seat];
  const pairs = room.config.pairs;
  const partner = pairs && room.you !== null && seat === (room.you + 2) % 4;
  return (
    <div className={`badge badge-${pos} ${active ? "active" : ""} ${compact ? "compact" : ""} ${s && !s.connected ? "offline" : ""} ${pairs ? `team-${seat % 2}` : ""}`}>
      {!compact && (
        <div className="badge-cards" aria-label={`${count} ${t("cards")}`}>
          {Array.from({ length: Math.min(count, 9) }, (_, i) => (
            <CardBack key={i} style={{ marginLeft: i === 0 ? 0 : undefined }} />
          ))}
        </div>
      )}
      <div className="badge-main">
        <div className="badge-name">
          {!compact && <Avatar url={s?.avatarUrl} name={s?.name ?? "?"} bot={s?.bot} size={22} />}
          {g.dealer === seat && <span className="dealer-chip" title={t("dealer")}>D</span>}
          <span className="name-text">{s?.name ?? "—"}</span>
        </div>
        {partner && <div className="partner-tag">{t("partner")}</div>}
        <div className="badge-stats">
          <span className={`bid-took ${bid !== null && g.took[seat] === bid ? "ok" : ""} ${bid !== null && g.took[seat] > bid ? "over" : ""}`}>
            {bid === null ? "–" : bid} / {g.took[seat]}
          </span>
          <span className="score">{g.totals[seat]}</span>
        </div>
        {s && !s.connected && <div className="offline-tag">{t("offline")}</div>}
      </div>
      {timer !== null && <div className="timer-bar" style={{ width: `${Math.min(100, (timer / 30_000) * 100)}%` }} />}
    </div>
  );
}

function Hand({ cards, hiddenExtra, playable, dim, selected, onTap }: { cards: Card[]; hiddenExtra: number; playable: Set<string>; dim: boolean; selected: string | null; onTap: (c: Card) => void }) {
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
  const n = cards.length + hiddenExtra;
  const layout = useMemo(() => {
    const avail = Math.max(200, width - 8);
    const maxByHeight = vh * (vh < 500 ? 0.2 : 0.15);
    const cw = Math.max(44, Math.min(92, maxByHeight, n > 0 ? avail / (n * 0.62 + 0.38) : 92));
    const step = n > 1 ? Math.min(cw + 6, (avail - cw) / (n - 1)) : 0;
    return { cw, step, total: n > 0 ? cw + step * (n - 1) : 0 };
  }, [width, vh, n]);

  return (
    <div className="hand" ref={ref} style={{ height: layout.cw * 1.45 + 22 }}>
      <div className="hand-inner" style={{ width: layout.total, ["--cw" as string]: `${layout.cw}px` }}>
        {cards.map((c, i) => (
          <CardView
            key={c.id}
            card={c}
            size="lg"
            onClick={() => onTap(c)}
            disabled={dim && !playable.has(c.id)}
            selected={selected === c.id}
            style={{ left: i * layout.step, zIndex: i + 1 }}
          />
        ))}
        {Array.from({ length: hiddenExtra }, (_, i) => (
          <div key={`h${i}`} className="card card-lg card-back" style={{ left: (cards.length + i) * layout.step, zIndex: cards.length + i + 1 }} />
        ))}
      </div>
    </div>
  );
}

function JokerDialog({ leading, onChoose, onCancel }: { leading: boolean; onChoose: (m: JokerMode) => void; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <Modal title={leading ? t("jokerLead") : "★ JOKER"} onClose={onCancel}>
      {leading ? (
        <div className="joker-options">
          {(["high", "low"] as const).map((type) => (
            <div key={type} className="joker-row">
              <div className="joker-row-head">
                <strong>{type === "high" ? t("jokerHigh") : t("jokerLow")}</strong>
                <p className="hint">{type === "high" ? t("jokerHighLead") : t("jokerLowLead")}</p>
              </div>
              <div className="suit-row">
                {SUITS.map((s) => (
                  <button key={s} className={`btn suit-btn ${isRed(s) ? "red" : ""}`} onClick={() => onChoose({ type, suit: s })} aria-label={`${type} ${s}`}>
                    {SUIT_SYMBOL[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="joker-follow">
          <button className="btn btn-primary btn-big" onClick={() => onChoose({ type: "high" })}>▲ {t("jokerHighFollow")}</button>
          <button className="btn btn-big" onClick={() => onChoose({ type: "low" })}>▼ {t("jokerLowFollow")}</button>
        </div>
      )}
      <button className="link-btn" onClick={onCancel}>{t("cancel")}</button>
    </Modal>
  );
}

/** Always-visible running score: every player (or both teams) and their points. Tap for the full sheet. */
function ScoreStrip({ room, onOpen }: { room: RoomView; onOpen: () => void }) {
  const { t } = useI18n();
  const g = room.game!;
  const me = room.you ?? 0;
  const order = [0, 1, 2, 3].map((r) => (me + r) % 4);
  const best = Math.max(...g.totals);
  const name = (i: number) => room.seats[i]?.name ?? `#${i + 1}`;
  if (room.config.pairs) {
    const team = teamTotals(g.totals);
    const mine = me % 2;
    return (
      <button className="score-strip pairs" onClick={onOpen} aria-label={t("tapScores")}>
        {[mine, 1 - mine].map((tm) => (
          <span key={tm} className={`ss-team team-${tm} ${team[tm] > team[1 - tm] ? "lead" : ""}`}>
            <span className="ss-names">{room.you !== null ? (tm === mine ? t("us") : t("them")) : `${name(tm)} + ${name(tm + 2)}`}</span>
            <span className="ss-sub">{g.totals[tm]} + {g.totals[tm + 2]}</span>
            <strong>{team[tm]}</strong>
          </span>
        ))}
        <span className="ss-more" aria-hidden>▤</span>
      </button>
    );
  }
  return (
    <button className="score-strip" onClick={onOpen} aria-label={t("tapScores")}>
      {order.map((i) => (
        <span key={i} className={`ss-item ${i === room.you ? "me" : ""} ${g.totals[i] === best && best !== 0 ? "lead" : ""}`}>
          <span className="ss-name">{name(i)}</span>
          <strong>{g.totals[i]}</strong>
        </span>
      ))}
      <span className="ss-more" aria-hidden>▤</span>
    </button>
  );
}

function GameOver({ room, send, leave, openScores, openMatch }: { room: RoomView; send: (m: object) => void; leave: () => void; openScores: () => void; openMatch: (id: string) => void }) {
  const { t } = useI18n();
  const g = room.game!;
  const pairs = room.config.pairs;
  const team = teamTotals(g.totals);
  const rankScore = (s: number) => (pairs ? team[s % 2] : g.totals[s]);
  const order = [0, 1, 2, 3].sort((a, b) => rankScore(b) - rankScore(a) || g.totals[b] - g.totals[a]);
  const name = (i: number) => room.seats[i]?.name ?? "";
  const headline = pairs
    ? team[0] === team[1]
      ? t("draw")
      : t("teamWins", { names: `${name(order[0])} + ${name((order[0] + 2) % 4)}` })
    : t("winner", { name: name(order[0]) });
  return (
    <Modal title={t("gameOver")}>
      <p className="winner-line">🏆 {headline}</p>
      {pairs && (
        <div className="team-result">
          {[0, 1].map((tm) => (
            <div key={tm} className={`team-box team-${tm} ${team[tm] > team[1 - tm] ? "won" : ""}`}>
              <span className="team-names">{name(tm)} + {name(tm + 2)}</span>
              <strong>{team[tm]}</strong>
            </div>
          ))}
        </div>
      )}
      <ol className="final-list rich">
        {order.map((s) => {
          const c = room.ratingChanges?.[s];
          return (
            <li key={s} className={s === room.you ? "me" : ""}>
              <Avatar url={room.seats[s]?.avatarUrl} name={name(s)} bot={room.seats[s]?.bot} size={32} />
              <span className="name-link">{name(s)}</span>
              <strong>{g.totals[s]}</strong>
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
          <button className="btn btn-big" onClick={openScores}>{t("scores")}</button>
        )}
        <button className="btn btn-ghost" onClick={leave}>{t("backHome")}</button>
      </div>
    </Modal>
  );
}
