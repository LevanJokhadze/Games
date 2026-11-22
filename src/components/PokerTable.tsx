import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { PokerView, RoomView } from "../types";
import type { Voice } from "../voice";
import { Avatar } from "./Avatar";
import { CardBack, CardView } from "./CardView";
import { ChatSheet, VoiceControl, sysText } from "./Chat";
import { Modal } from "./Modal";
import { Rules } from "./Rules";
import { play as playSound } from "../sound";

interface Props {
  room: RoomView;
  send: (m: object) => void;
  leave: () => void;
  clockOffset: number;
  voice: Voice;
}

export const chips = (n: number) => Math.round(n).toLocaleString("en-US");
const signed = (n: number) => (n > 0 ? `+${chips(n)}` : n < 0 ? `−${chips(-n)}` : "0");

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/**
 * Where seat `k` places from you sits, in percent of the table (you are at the bottom,
 * seats go round clockwise). On a wide table the seats sit on an ellipse; on a tall
 * (portrait) table they keep out of the middle band where the board is.
 */
const ANCHORS = {
  B: { x: 50, y: 93 },
  BL: { x: 23, y: 87 },
  LL: { x: 10, y: 71 },
  LH: { x: 10, y: 29 },
  TL: { x: 26, y: 9 },
  T: { x: 50, y: 6 },
  TR: { x: 74, y: 9 },
  RH: { x: 90, y: 29 },
  RL: { x: 90, y: 71 },
  BR: { x: 77, y: 87 },
};
type Anchor = keyof typeof ANCHORS;
const TALL: Record<number, Anchor[]> = {
  2: ["T"],
  3: ["TL", "TR"],
  4: ["LH", "T", "RH"],
  5: ["LL", "TL", "TR", "RL"],
  6: ["LL", "LH", "T", "RH", "RL"],
  7: ["LL", "LH", "TL", "TR", "RH", "RL"],
  8: ["BL", "LL", "LH", "T", "RH", "RL", "BR"],
  9: ["BL", "LL", "LH", "TL", "TR", "RH", "RL", "BR"],
};
function seatPos(k: number, n: number, tall: boolean): { x: number; y: number } {
  if (tall) return ANCHORS[k === 0 ? "B" : TALL[n]?.[k - 1] ?? "T"];
  const a = Math.PI / 2 + (k * 2 * Math.PI) / n;
  return { x: 50 + 43 * Math.cos(a), y: 50 + 41 * Math.sin(a) };
}

function usePortrait(): boolean {
  const q = "(orientation: portrait)";
  const [on, setOn] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setOn(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return on;
}

export function PokerTable({ room, send, leave, clockOffset, voice }: Props) {
  const { t } = useI18n();
  const g = room.game as PokerView;
  const n = g.seats;
  const me = room.you;
  const base = me ?? 0;
  const name = (i: number) => room.seats[i]?.name ?? `#${i + 1}`;
  const myTurn = me !== null && g.phase === "betting" && g.turn === me;
  const tall = usePortrait();

  const [showRules, setShowRules] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [raising, setRaising] = useState(false);
  const [amount, setAmount] = useState(0);

  // Chat: unread count and a short bubble for new messages (same as the other tables).
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

  // The raise box closes whenever it stops being my move.
  const moveKey = `${g.handNo}:${g.street}:${g.turn}:${g.currentBet}`;
  useEffect(() => {
    setRaising(false);
    setAmount(g.minTo);
  }, [moveKey]);

  // Sounds: a card sound when cards come out, a chime when it becomes my move.
  const prevBoard = useRef(g.board.length);
  const prevTurn = useRef(myTurn);
  useEffect(() => {
    if (g.board.length > prevBoard.current) playSound("deal");
    prevBoard.current = g.board.length;
  }, [g.board.length]);
  useEffect(() => {
    if (myTurn && !prevTurn.current) playSound("turn");
    prevTurn.current = myTurn;
  }, [myTurn]);
  const prevResult = useRef(g.result?.handNo ?? 0);
  useEffect(() => {
    const h = g.result?.handNo ?? 0;
    if (h && h !== prevResult.current && me !== null && g.result!.pots.some((p) => p.winners.includes(me))) playSound("win");
    prevResult.current = h;
  }, [g.result?.handNo]);

  const isSpeaking = (seat: number) => {
    const p = room.people.find((x) => x.seat === seat);
    return !!p && voice.speaking.has(p.peer);
  };

  const now = useNow(room.deadline !== null || room.seats.some((s) => s?.afkKickAt));
  const serverNow = now + clockOffset;
  const timeLeft = room.deadline ? Math.max(0, room.deadline - serverNow) : null;
  const turnSeat = g.turn >= 0 ? room.seats[g.turn] : null;
  const warn = room.turnStage === "warn";
  const timerMax = warn ? 60_000 : 30_000;
  const showTimer = g.phase === "betting" && timeLeft !== null && !!turnSeat && !turnSeat.bot && !turnSeat.afkKickAt;
  const myKickAt = me !== null ? room.seats[me]?.afkKickAt ?? null : null;
  const kickLeft = myKickAt ? Math.max(0, Math.ceil((myKickAt - serverNow) / 1000)) : 0;

  const result = g.result;
  const winners = new Set(result?.pots.flatMap((p) => p.winners) ?? []);
  const shown = new Map(result?.shown.map((h) => [h.seat, h]) ?? []);
  const bestIds = new Set(result && !result.uncontested ? result.shown.filter((h) => winners.has(h.seat)).flatMap((h) => h.best.map((c) => c.id)) : []);
  const totalPot = g.pot + g.bets.reduce((a, b) => a + b, 0);

  const act = (action: object) => {
    send({ t: "poker", action });
    setRaising(false);
  };

  const myCards = me !== null ? g.hole[me] : null;
  const myStack = me !== null ? g.stacks[me] : 0;
  const broke = me !== null && g.seated[me] && myStack === 0 && !(g.phase === "betting" && g.inHand[me] && !g.folded[me]);
  const waitingNext = me !== null && g.seated[me] && myStack > 0 && !g.inHand[me] && g.phase === "betting";

  const status = (() => {
    if (g.phase === "waiting") return t("pWaiting");
    if (g.phase === "handOver" && result) {
      const p = result.pots[0];
      if (!p) return "";
      const lines = result.pots.map((pot) => {
        const who = pot.winners.map(name).join(" + ");
        const h = !result.uncontested ? result.shown.find((x) => x.seat === pot.winners[0]) : null;
        return h ? t("pWinsWith", { name: who, n: chips(pot.amount), hand: t(`pH${h.cat}` as "pH0") }) : t("pWins", { name: who, n: chips(pot.amount) });
      });
      return lines.join(" · ");
    }
    if (myTurn) return t("pYourTurn");
    if (g.turn >= 0) return t("pWait", { name: name(g.turn) });
    return "";
  })();

  // Raise presets.
  const potAfterCall = totalPot + g.toCall;
  const clampTo = (x: number) => Math.max(g.minTo, Math.min(g.maxTo, Math.round(x)));
  const presets = g.canRaise
    ? [
        { label: t("pMin"), to: g.minTo },
        { label: t("pHalfPot"), to: clampTo(g.currentBet + potAfterCall / 2) },
        { label: t("pPotBtn"), to: clampTo(g.currentBet + potAfterCall) },
        { label: t("pAllIn"), to: g.maxTo },
      ]
    : [];
  const step = Math.max(1, g.sb);
  const isBet = g.currentBet === 0;
  const amt = clampTo(amount || g.minTo);

  return (
    <main className="table-screen poker">
      <header className="topbar">
        <button className="icon-btn" onClick={leave} aria-label={t("leave")}>✕</button>
        <div className="deal-info">
          {g.handNo > 0 && <span>{t("pHand", { n: g.handNo })}</span>}
          {g.handNo > 0 && <span className="dot">·</span>}
          <span>
            {t("pBlinds")} {chips(g.sb)}/{chips(g.bb)}
          </span>
        </div>
        <div className="topbar-voice">
          <VoiceControl voice={voice} compact />
        </div>
        <button className="icon-btn chat-btn" onClick={() => setShowChat(true)} aria-label={t("chat")}>
          💬{unread > 0 && <span className="unread">{unread > 9 ? "9+" : unread}</span>}
        </button>
        <button className="icon-btn" onClick={() => setShowMenu(true)} aria-label={t("pMenu")}>☰</button>
        <button className="icon-btn" onClick={() => setShowRules(true)} aria-label={t("rules")}>?</button>
      </header>

      <div className="felt poker-felt">
        {bubble && (
          <button className={`chat-bubble ${bubble.sys ? `sys sys-${bubble.sys}` : ""}`} onClick={() => setShowChat(true)}>
            <span className="bubble-text">{bubble.sys ? bubble.text : <><strong>{bubble.name}:</strong> {bubble.text}</>}</span>
          </button>
        )}
        <div className="felt-voice">
          <VoiceControl voice={voice} compact />
        </div>
        <div className="poker-oval" style={{ ["--n" as string]: n }}>
          <div className="poker-center">
            <div className="poker-board">
              {Array.from({ length: 5 }, (_, i) => {
                const c = g.board[i];
                return c ? (
                  <span key={c.id} className={`board-card ${bestIds.size && !bestIds.has(c.id) ? "dim" : ""} ${bestIds.has(c.id) ? "best" : ""}`}>
                    <CardView card={c} size="md" />
                  </span>
                ) : (
                  <span key={`e${i}`} className="board-slot" />
                );
              })}
            </div>
            {totalPot > 0 && (
              <div className="poker-pot">
                {t("pPot")}: <strong>{chips(g.phase === "handOver" && result ? result.pots.reduce((a, p) => a + p.amount, 0) : totalPot)}</strong>
              </div>
            )}
          </div>

          {Array.from({ length: n }, (_, k) => {
            const seat = (base + k) % n;
            const pos = seatPos(k, n, tall);
            const s = room.seats[seat];
            const betPos = { x: 50 + (pos.x - 50) * 0.7, y: 50 + (pos.y - 50) * 0.7 };
            if (!s || !g.seated[seat]) {
              return (
                <div key={seat} className="p-seat empty" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                  {me === null && !s ? (
                    <button className="btn btn-small" onClick={() => send({ t: "seat", seat })}>{t("pSit")}</button>
                  ) : room.isHost && !s ? (
                    <button className="btn btn-small btn-ghost" onClick={() => send({ t: "addBot", seat })}>+ {t("addBot")}</button>
                  ) : (
                    <span className="p-empty-dot" aria-label={t("emptySeat")} />
                  )}
                </div>
              );
            }
            const cards = g.hole[seat];
            const inHand = g.inHand[seat] && !g.folded[seat];
            const active = g.phase === "betting" && g.turn === seat;
            const said = g.said[seat];
            const h = shown.get(seat);
            const won = winners.has(seat) && g.phase === "handOver";
            const mine = seat === me;
            return (
              <div key={seat}>
                <div
                  className={`p-seat ${active ? "active" : ""} ${g.folded[seat] && g.inHand[seat] ? "folded" : ""} ${won ? "won" : ""} ${mine ? "me" : ""} ${!s.connected ? "offline" : ""} ${isSpeaking(seat) ? "speaking" : ""} ${warn && active ? "warn" : ""} ${s.afkKickAt ? "afk" : ""}`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  {!mine && (cards || inHand) && (
                    <div className={`p-cards ${cards ? "open" : ""}`}>
                      {cards ? cards.map((c) => <span key={c.id} className={bestIds.size && !bestIds.has(c.id) ? "dim" : ""}><CardView card={c} size="sm" /></span>) : [0, 1].map((i) => <CardBack key={i} />)}
                    </div>
                  )}
                  <div className="p-badge">
                    <div className="p-name">
                      <Avatar url={s.avatarUrl} name={s.name} bot={s.bot} size={20} />
                      <span className="name-text">{s.name}</span>
                      {isSpeaking(seat) && <span className="speaking-icon" aria-label="🔊">🔊</span>}
                    </div>
                    <div className="p-stack">
                      {g.stacks[seat] === 0 && !inHand ? <span className="muted">0</span> : chips(g.stacks[seat])}
                    </div>
                    {h && g.phase === "handOver" ? (
                      <div className="p-said hand">{t(`pH${h.cat}` as "pH0")}</div>
                    ) : s.afkKickAt ? (
                      <div className="p-said">🤖 {t("botPlaying")}</div>
                    ) : said ? (
                      <div className={`p-said said-${said}`}>{t(`pSaid_${said}` as "pSaid_fold")}</div>
                    ) : !s.connected ? (
                      <div className="p-said">{t("offline")}</div>
                    ) : null}
                    {active && showTimer && timeLeft !== null && (
                      <div className={`timer-bar ${warn ? "warn" : ""}`} style={{ width: `${Math.min(100, (timeLeft / timerMax) * 100)}%` }} />
                    )}
                  </div>
                  {g.button === seat && g.handNo > 0 && <span className="p-button" title={t("dealer")}>D</span>}
                </div>
                {g.bets[seat] > 0 && g.phase === "betting" && (
                  <div className="p-bet" style={{ left: `${betPos.x}%`, top: `${betPos.y}%` }}>
                    <span className="chip-dot" aria-hidden />
                    {chips(g.bets[seat])}
                  </div>
                )}
                {won && result && (
                  <div className="p-bet win" style={{ left: `${betPos.x}%`, top: `${betPos.y}%` }}>
                    +{chips(result.pots.filter((p) => p.winners.includes(seat)).reduce((a, p) => a + Math.floor(p.amount / p.winners.length), 0))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <section className="me-area poker-me">
        {myKickAt ? (
          <div className="afk-panel" role="alert">
            <div className="afk-text">
              <strong>🤖 {t("pAfkTitle")}</strong>
              <span>{t("pAfkBody", { s: kickLeft })}</span>
            </div>
            <button className="btn btn-primary btn-big afk-back" onClick={() => send({ t: "back" })}>
              👋 {t("imBack")}
            </button>
          </div>
        ) : myTurn && warn && showTimer ? (
          <div className="status-line my-turn warn" role="alert">
            ⏰ {t("pWarnMe", { s: Math.ceil(timeLeft! / 1000) })}
          </div>
        ) : (
          status && (
            <div className={`status-line ${myTurn ? "my-turn" : ""} ${g.phase === "handOver" ? "p-result" : ""}`} role="status">
              {status}
              {showTimer && myTurn && <span className="timer-text"> · {Math.ceil(timeLeft! / 1000)}s</span>}
            </div>
          )
        )}

        {me === null ? (
          <p className="hint">{t("pWatching")}</p>
        ) : (
          <div className="p-me-row">
            <div className="p-hole">
              {myCards ? (
                myCards.map((c) => (
                  <span key={c.id} className={`${g.folded[me] ? "dim" : ""} ${bestIds.size && !bestIds.has(c.id) ? "dim" : ""}`}>
                    <CardView card={c} size="md" />
                  </span>
                ))
              ) : (
                <span className="muted small">{broke ? t("pBroke") : waitingNext ? t("pNextHand") : ""}</span>
              )}
            </div>
            <div className="p-me-info">
              <span className="p-me-stack">
                {t("pStack")}: <strong>{chips(myStack)}</strong>
              </span>
              {g.myHand !== null && myCards && !g.folded[me] && <span className="p-me-hand">{t(`pH${g.myHand}` as "pH0")}</span>}
              {!!g.net[me] && (
                <span className={`p-me-net ${g.net[me] > 0 ? "pos" : "neg"}`}>
                  {t("pNet")}: {signed(g.net[me])}
                </span>
              )}
            </div>
          </div>
        )}

        {me !== null && broke && (
          g.rebuy[me] ? (
            <p className="hint ok-text">{t("pRebuyAsked", { n: chips(g.buyIn) })}</p>
          ) : (
            <button className="btn btn-primary btn-big" onClick={() => act({ t: "rebuy" })}>💰 {t("pRebuy", { n: chips(g.buyIn) })}</button>
          )
        )}

        {myTurn && !myKickAt && !raising && (
          <div className="action-panel poker-actions">
            <button className="btn p-fold" onClick={() => act({ t: "fold" })}>{t("pFold")}</button>
            {g.canCheck ? (
              <button className="btn btn-primary" onClick={() => act({ t: "check" })}>{t("pCheck")}</button>
            ) : (
              <button className="btn btn-primary" onClick={() => act({ t: "call" })}>
                {g.toCall >= myStack ? t("pAllInN", { n: chips(g.toCall) }) : t("pCall", { n: chips(g.toCall) })}
              </button>
            )}
            {g.canRaise && (
              <button className="btn p-raise" onClick={() => { setAmount(g.minTo); setRaising(true); }}>
                {isBet ? t("pBet") : t("pRaise")} ▲
              </button>
            )}
          </div>
        )}

        {myTurn && !myKickAt && raising && g.canRaise && (
          <div className="action-panel raise-panel">
            <div className="raise-presets">
              {presets.map((p) => (
                <button key={p.label} className={`btn btn-small ${amt === p.to ? "on" : ""}`} onClick={() => setAmount(p.to)}>{p.label}</button>
              ))}
            </div>
            <div className="raise-slider">
              <button className="btn btn-small" aria-label="−" onClick={() => setAmount(clampTo(amt - step * 2))}>−</button>
              <input
                type="range"
                min={g.minTo}
                max={g.maxTo}
                step={step}
                value={amt}
                onChange={(e) => setAmount(Number(e.target.value))}
                aria-label={isBet ? t("pBet") : t("pRaise")}
              />
              <button className="btn btn-small" aria-label="+" onClick={() => setAmount(clampTo(amt + step * 2))}>+</button>
            </div>
            <div className="raise-row">
              <button className="btn btn-ghost" onClick={() => setRaising(false)}>{t("pBack")}</button>
              <button className="btn btn-primary" onClick={() => act({ t: "raise", to: amt })}>
                {amt >= g.maxTo ? t("pAllInN", { n: chips(amt) }) : isBet ? t("pBetTo", { n: chips(amt) }) : t("pRaiseTo", { n: chips(amt) })}
              </button>
            </div>
          </div>
        )}
      </section>

      {showRules && <Rules game="poker" onClose={() => setShowRules(false)} />}
      {showChat && <ChatSheet room={room} send={send} voice={voice} onClose={() => setShowChat(false)} />}
      {showMenu && <TableMenu room={room} send={send} onClose={() => setShowMenu(false)} />}
      {room.status === "finished" && <PokerGameOver room={room} send={send} leave={leave} />}
    </main>
  );
}

/** Everyone's chips and result this session: players at the table, then those who left. */
function Standings({ room }: { room: RoomView }) {
  const { t } = useI18n();
  const g = room.game as PokerView;
  const rows = [
    ...room.seats
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => s && g.seated[i])
      .map(({ s, i }) => ({ key: `s${i}`, name: s!.name, avatarUrl: s!.avatarUrl, bot: s!.bot, stack: g.stacks[i] as number | null, net: g.net[i], me: i === room.you, left: false })),
    ...(room.ledger ?? []).map((r, k) => ({ key: `l${k}`, name: r.name, avatarUrl: null, bot: false, stack: null, net: r.net, me: false, left: true })),
  ].sort((a, b) => b.net - a.net);
  return (
    <ol className="final-list rich poker-standings">
      {rows.map((r) => (
        <li key={r.key} className={r.me ? "me" : ""}>
          <Avatar url={r.avatarUrl} name={r.name} bot={r.bot} size={30} />
          <span className="name-link">
            {r.name}
            {r.left && <small className="muted"> · {t("pLeftTable")}</small>}
          </span>
          <span className="muted small">{r.stack !== null ? chips(r.stack) : ""}</span>
          <strong className={`delta ${r.net > 0 ? "pos" : r.net < 0 ? "neg" : ""}`}>{signed(r.net)}</strong>
        </li>
      ))}
    </ol>
  );
}

function TableMenu({ room, send, onClose }: { room: RoomView; send: (m: object) => void; onClose: () => void }) {
  const { t } = useI18n();
  const seated = room.you !== null;
  // A free seat, or else a bot's seat (the bot stands up for you).
  let freeSeat = room.seats.findIndex((s) => s === null);
  if (freeSeat < 0) freeSeat = room.seats.findIndex((s) => s?.bot);
  return (
    <Modal title={t("pResults")} onClose={onClose}>
      <p className="hint left">{t("pUnrated")}</p>
      <Standings room={room} />
      <div className="stack">
        {!seated && freeSeat >= 0 && (
          <button className="btn btn-primary btn-big" onClick={() => { send({ t: "seat", seat: freeSeat }); onClose(); }}>🪑 {t("pSit")}</button>
        )}
        {seated && (
          <button className="btn btn-big" onClick={() => { send({ t: "stand" }); onClose(); }}>🚶 {t("pStand")}</button>
        )}
        {room.isHost && (
          <>
            <button className="btn btn-big p-end" onClick={() => { send({ t: "end" }); onClose(); }}>🏁 {t("pEnd")}</button>
            <p className="hint">{t("pEndHint")}</p>
          </>
        )}
      </div>
    </Modal>
  );
}

function PokerGameOver({ room, send, leave }: { room: RoomView; send: (m: object) => void; leave: () => void }) {
  const { t } = useI18n();
  return (
    <Modal title={t("gameOver")}>
      <p className="hint">{t("pUnrated")}</p>
      <Standings room={room} />
      <div className="stack">
        {room.isHost && <button className="btn btn-primary btn-big" onClick={() => send({ t: "rematch" })}>{t("playAgain")}</button>}
        <button className="btn btn-ghost" onClick={leave}>{t("backHome")}</button>
      </div>
    </Modal>
  );
}

