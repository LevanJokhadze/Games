import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { BgFrom, BgGameResult, BgStep, BgTo, BgView, RoomView } from "../types";
import type { Voice } from "../voice";
import { Avatar } from "./Avatar";
import { ChatSheet, VoiceControl, sysText } from "./Chat";
import { Modal } from "./Modal";
import { Rules } from "./Rules";
import { play as playSound } from "../sound";

interface Props {
  room: RoomView;
  send: (m: object) => void;
  leave: () => void;
  clockOffset: number;
  openMatch: (id: string) => void;
  voice: Voice;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

// ---------- Board geometry (SVG units) ----------
const FR = 12; // frame
const PW = 40; // point width
const BAR = 40;
const TRAY = 46;
const CD = 36; // checker diameter
const W = FR * 2 + PW * 12 + BAR + TRAY;
const BAR_X = FR + PW * 6;
const TRAY_X = FR + PW * 12 + BAR + 4;
const TRAY_W = TRAY - FR / 2 - 4;

/** Size of an element (to fit the board to the space it has). */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

type Place = number | "bar" | "off";

const same = (a: BgFrom | BgTo, b: Place) => a === b;

export function BackgammonTable({ room, send, leave, clockOffset, openMatch, voice }: Props) {
  const { t } = useI18n();
  const g = room.game as BgView;
  const me = room.you ?? 0;
  const opp = 1 - me;
  const name = (i: number) => room.seats[i]?.name ?? `#${i + 1}`;
  const actor = g.phase === "doubled" ? 1 - g.turn : g.phase === "roll" || g.phase === "moving" ? g.turn : null;
  const myMove = room.you !== null && actor === room.you;

  const [sel, setSel] = useState<BgFrom | null>(null);
  const [wrapRef, space] = useSize<HTMLDivElement>();
  const [showRules, setShowRules] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showGames, setShowGames] = useState(false);

  // Chat: unread count and a short bubble for new messages (same as the card tables).
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

  // Selection resets whenever the position changes.
  const posKey = `${g.gameNo}:${g.turn}:${g.phase}:${g.moved.length}:${g.board.join(",")}`;
  useEffect(() => setSel(null), [posKey]);

  // Sounds: a checker moves, my turn starts, I win a game.
  const checkerKey = `${g.gameNo}:${g.board.join(",")}:${g.bar}:${g.off}`;
  const prevChecker = useRef(checkerKey);
  useEffect(() => {
    if (prevChecker.current !== checkerKey) playSound("play");
    prevChecker.current = checkerKey;
  }, [checkerKey]);
  const prevMine = useRef(myMove);
  useEffect(() => {
    if (myMove && !prevMine.current) playSound("turn");
    prevMine.current = myMove;
  }, [myMove]);
  const lastGameKey = g.games.length;
  const prevGames = useRef(lastGameKey);
  useEffect(() => {
    if (lastGameKey > prevGames.current && g.lastGame && g.lastGame.winner === room.you) playSound("win");
    prevGames.current = lastGameKey;
  }, [lastGameKey]);

  const act = (action: object) => {
    send({ t: "bg", action });
    setSel(null);
  };

  // ---------- Moving checkers ----------
  const legal = g.legal;
  const sources = useMemo(() => {
    const m = new Map<string, BgStep[]>();
    for (const s of legal) {
      const k = String(s.from);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return m;
  }, [legal]);
  const destsOf = (from: BgFrom | null) => (from === null ? [] : sources.get(String(from)) ?? []);
  const selDests = destsOf(sel);

  const tap = (p: Place) => {
    if (!legal.length) return;
    // A highlighted destination of the selected checker: move there.
    const hit = selDests.find((s) => same(s.to, p));
    if (sel !== null && hit) {
      act({ t: "move", from: hit.from, die: hit.die });
      return;
    }
    if (p !== "off" && sources.has(String(p))) {
      const moves = sources.get(String(p))!;
      const targets = new Set(moves.map((m) => String(m.to)));
      // Only one place to go: move at once (undo is there for a mistake).
      if (targets.size === 1) {
        act({ t: "move", from: moves[0].from, die: Math.max(...moves.map((m) => m.die)) });
        return;
      }
      setSel(sel === p ? null : p);
      return;
    }
    // A destination only one checker can reach: move it there.
    const reach = legal.filter((s) => same(s.to, p));
    const from = new Set(reach.map((s) => String(s.from)));
    if (reach.length && from.size === 1) {
      act({ t: "move", from: reach[0].from, die: reach[0].die });
      return;
    }
    setSel(null);
  };

  // ---------- Clock ----------
  const now = useNow(room.deadline !== null || room.seats.some((s) => s?.afkKickAt));
  const serverNow = now + clockOffset;
  const timeLeft = room.deadline ? Math.max(0, room.deadline - serverNow) : null;
  const actorSeat = actor !== null ? room.seats[actor] : null;
  const warn = room.turnStage === "warn";
  const timerMax = warn ? 60_000 : 30_000;
  const showTimer = actor !== null && timeLeft !== null && !!actorSeat && !actorSeat.bot && !actorSeat.afkKickAt;
  const myKickAt = room.you !== null ? room.seats[room.you]?.afkKickAt ?? null : null;
  const kickLeft = myKickAt ? Math.max(0, Math.ceil((myKickAt - serverNow) / 1000)) : 0;

  const dice = g.dice ?? [];
  const status = (() => {
    if (g.phase === "opening" && g.opening) {
      return g.turn === room.you ? t("bgOpeningYou", { a: g.opening[me], b: g.opening[opp] }) : t("bgOpening", { a: g.opening[me], b: g.opening[opp], name: name(g.turn) });
    }
    if (g.phase === "roll") return myMove ? t("bgYourRoll") : t("bgWaitRoll", { name: name(g.turn) });
    if (g.phase === "doubled") return myMove ? t("bgTheyDouble", { name: name(g.turn), n: g.cube * 2 }) : t("bgWaitAnswer", { name: name(1 - g.turn) });
    if (g.phase === "moving") {
      if (!legal.length && !g.moved.length) return t("bgNoMoves", { a: dice[0] ?? "", b: dice[1] ?? "" }) + (myMove ? "" : ` · ${name(g.turn)}`);
      if (!myMove) return t("bgWait", { name: name(g.turn) });
      return legal.length ? t("bgMove") : t("bgPressDone");
    }
    return "";
  })();

  const info = [t("bgMatchInfo", { n: g.matchTo }), t("bgGameN", { n: g.gameNo })];

  return (
    <main className="table-screen backgammon">
      <header className="topbar">
        <button className="icon-btn" onClick={leave} aria-label={t("leave")}>✕</button>
        <div className="deal-info">
          <span>{info[0]}</span>
          <span className="dot">·</span>
          <span>{info[1]}</span>
          {g.crawford && (
            <>
              <span className="dot">·</span>
              <span className="stake-chip">C</span>
            </>
          )}
        </div>
        <button className="bg-score-btn" onClick={() => setShowGames(true)} aria-label={t("bgGames")}>
          <strong>{g.score[me]}</strong>
          <span>:</span>
          <strong>{g.score[opp]}</strong>
        </button>
        <div className="topbar-voice">
          <VoiceControl voice={voice} compact />
        </div>
        <button className="icon-btn chat-btn" onClick={() => setShowChat(true)} aria-label={t("chat")}>
          💬{unread > 0 && <span className="unread">{unread > 9 ? "9+" : unread}</span>}
        </button>
        <button className="icon-btn" onClick={() => setShowRules(true)} aria-label={t("rules")}>?</button>
      </header>

      <div className="bg-main">
        <BgBadge
          area="opp"
          room={room}
          seat={opp}
          active={actor === opp}
          timer={showTimer && actor === opp ? timeLeft : null}
          timerMax={timerMax}
          warn={warn && actor === opp}
          speaking={isSpeaking(room, voice, opp)}
        />

        <div className="bg-board-wrap" ref={wrapRef}>
          {bubble && (
            <button className={`chat-bubble ${bubble.sys ? `sys sys-${bubble.sys}` : ""}`} onClick={() => setShowChat(true)}>
              <span className="bubble-text">{bubble.sys ? bubble.text : <><strong>{bubble.name}:</strong> {bubble.text}</>}</span>
            </button>
          )}
          <Board space={space} g={g} me={me} sel={sel} dests={selDests} sources={myMove || g.phase === "opening" ? [...sources.keys()] : []} onTap={tap} />
          {g.phase === "gameOver" && g.lastGame && <GameResult r={g.lastGame} me={room.you} name={name} />}
        </div>

        <section className="me-area bg-me">
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
          ) : myMove && warn && showTimer ? (
            <div className="status-line my-turn warn" role="alert">
              ⏰ {t("warnMe", { s: Math.ceil(timeLeft! / 1000) })}
            </div>
          ) : (
            <div className={`status-line ${myMove || (g.phase === "opening" && g.turn === room.you) ? "my-turn" : ""} ${warn && showTimer ? "warn" : ""}`}>
              {status || " "}
              {showTimer && (myMove || warn) && <span className="timer-text"> · {Math.ceil(timeLeft! / 1000)}s</span>}
            </div>
          )}

          {room.you !== null && !myKickAt && (
            <div className="action-panel bg-actions">
              {g.canRoll && (
                <button className="btn btn-primary btn-big" onClick={() => act({ t: "roll" })}>
                  🎲 {t("bgRoll")}
                </button>
              )}
              {g.canDouble && (
                <button className="btn btn-big bg-double" onClick={() => act({ t: "double" })}>
                  ⬆ {t("bgDouble", { n: g.cube * 2 })}
                </button>
              )}
              {g.mustAnswer && (
                <>
                  <button className="btn btn-primary btn-big" onClick={() => act({ t: "take" })}>
                    ✓ {t("bgTake", { n: g.cube * 2 })}
                  </button>
                  <button className="btn btn-big" onClick={() => act({ t: "drop" })}>
                    🏳 {t("bgDrop", { n: g.cube })}
                  </button>
                </>
              )}
              {myMove && g.phase === "moving" && (
                <>
                  <button className="btn btn-big" disabled={!g.canUndo} onClick={() => act({ t: "undo" })}>
                    ↶ {t("bgUndo")}
                  </button>
                  <button className="btn btn-primary btn-big" disabled={!g.canDone} onClick={() => act({ t: "done" })}>
                    ✓ {t("bgDone")}
                  </button>
                </>
              )}
            </div>
          )}

          {room.you !== null ? (
            <BgBadge area="me" room={room} seat={me} active={actor === me} timer={null} speaking={isSpeaking(room, voice, me)} />
          ) : (
            <p className="hint">{t("spectating")}</p>
          )}
        </section>
      </div>

      {showGames && (
        <Modal title={t("bgGames")} onClose={() => setShowGames(false)}>
          <BgGamesTable games={g.games} names={[name(0), name(1)]} />
        </Modal>
      )}
      {showRules && <Rules game="backgammon" onClose={() => setShowRules(false)} />}
      {showChat && <ChatSheet room={room} send={send} voice={voice} onClose={() => setShowChat(false)} />}
      {room.status === "finished" && !showGames && (
        <BgMatchOver room={room} send={send} leave={leave} openGames={() => setShowGames(true)} openMatch={openMatch} />
      )}
    </main>
  );
}

function isSpeaking(room: RoomView, voice: Voice, seat: number) {
  const p = room.people.find((x) => x.seat === seat);
  return !!p && voice.speaking.has(p.peer);
}

// ---------- The board ----------

/** Your point number (1-24) of a board index. */
const pointOf = (idx: number, me: number) => (me === 0 ? idx + 1 : 24 - idx);

/** Column (0-11, left to right) and row of a board index, seen by `me`. */
function colOf(idx: number, me: number): { col: number; top: boolean } {
  const p = pointOf(idx, me);
  return p >= 13 ? { col: p - 13, top: true } : { col: 12 - p, top: false };
}
const colX = (col: number) => FR + col * PW + (col >= 6 ? BAR : 0);

function Board({ g, me, sel, dests, sources, onTap, space }: { g: BgView; me: number; sel: BgFrom | null; dests: BgStep[]; sources: string[]; onTap: (p: Place) => void; space: { w: number; h: number } }) {
  const { t } = useI18n();
  // A narrow, tall space (a phone held upright): longer points use the height.
  const ratio = space.w > 0 ? space.h / space.w : 0.74;
  const tall = ratio > 0.9;
  const GAP = tall ? 72 : 48; // middle band
  const PH = Math.round(Math.max(CD * 5, Math.min(CD * 9, (ratio * W - FR * 2 - GAP) / 2))); // point length
  const H = FR * 2 + PH * 2 + GAP;
  const MID = H / 2;
  const fit = Math.floor(PH / CD);
  const opp = 1 - me;
  const color = (seat: number) => (seat === 0 ? "w" : "b");
  const lastTo = new Set<string>();
  if (g.lastTurn && g.lastTurn.seat !== g.turn) for (const s of g.lastTurn.steps) lastTo.add(String(s.to));
  for (const s of g.moved) lastTo.add(String(s.to));
  const destSet = new Set(dests.map((d) => String(d.to)));
  const srcSet = new Set(sources);

  const points = [];
  for (let idx = 0; idx < 24; idx++) {
    const { col, top } = colOf(idx, me);
    const x = colX(col);
    const v = g.board[idx];
    const n = Math.abs(v);
    const owner = v > 0 ? 0 : 1;
    const tri = top
      ? `${x},${FR} ${x + PW},${FR} ${x + PW / 2},${FR + PH - 8}`
      : `${x},${H - FR} ${x + PW},${H - FR} ${x + PW / 2},${H - FR - PH + 8}`;
    const step = n > fit ? (PH - CD) / (n - 1) : CD;
    const cy = (k: number) => (top ? FR + CD / 2 + k * step : H - FR - CD / 2 - k * step);
    const isSrc = srcSet.has(String(idx));
    const isSel = sel === idx;
    const isDest = destSet.has(String(idx));
    points.push(
      <g key={idx} className="bg-point" onClick={() => onTap(idx)}>
        <rect x={x} y={top ? FR : MID} width={PW} height={H / 2 - FR} fill="transparent" />
        <polygon points={tri} className={`tri ${(col + (top ? 0 : 1)) % 2 ? "tri-a" : "tri-b"} ${lastTo.has(String(idx)) ? "last" : ""}`} />
        <text x={x + PW / 2} y={top ? FR - 3 : H - 3} className="pt-num">
          {pointOf(idx, me)}
        </text>
        {Array.from({ length: n }, (_, k) => (
          <circle
            key={k}
            cx={x + PW / 2}
            cy={cy(k)}
            r={CD / 2 - 1.5}
            className={`chk chk-${color(owner)} ${k === n - 1 && isSrc ? "movable" : ""} ${k === n - 1 && isSel ? "selected" : ""}`}
          />
        ))}
        {n > 5 && (
          <text x={x + PW / 2} y={cy(n - 1) + 5} className={`chk-count on-${color(owner)}`}>
            {n}
          </text>
        )}
        {isDest && <circle cx={x + PW / 2} cy={cy(Math.min(n, 4))} r={CD / 2 - 3} className="dest" />}
      </g>,
    );
  }

  // Bar: my checkers in the lower half, the opponent's in the upper half.
  const barChk = (seat: number) => {
    const n = g.bar[seat];
    const mine = seat === me;
    const isSrc = mine && srcSet.has("bar");
    return Array.from({ length: Math.min(n, 4) }, (_, k) => (
      <circle
        key={`${seat}-${k}`}
        cx={BAR_X + BAR / 2}
        cy={mine ? MID + GAP / 2 + CD / 2 + 4 + k * (CD - 6) : MID - GAP / 2 - CD / 2 - 4 - k * (CD - 6)}
        r={CD / 2 - 1.5}
        className={`chk chk-${color(seat)} ${k === Math.min(n, 4) - 1 && isSrc ? "movable" : ""} ${k === Math.min(n, 4) - 1 && mine && sel === "bar" ? "selected" : ""}`}
      />
    ));
  };

  // Borne-off checkers in the tray: mine at the bottom, the opponent's at the top.
  const offSlabs = (seat: number) => {
    const n = g.off[seat];
    const mine = seat === me;
    return Array.from({ length: n }, (_, k) => (
      <rect
        key={`${seat}-${k}`}
        x={TRAY_X + 4}
        y={mine ? H - FR - 9 - k * 9 : FR + 1 + k * 9}
        width={TRAY_W - 8}
        height={8}
        rx={2}
        className={`slab chk-${color(seat)}`}
      />
    ));
  };

  // Dice: in the half of the player to move.
  const diceRow = () => {
    if (!g.dice || !(g.phase === "moving" || g.phase === "opening")) return null;
    const mine = g.turn === me;
    const vals = g.phase === "opening" && g.opening ? [g.opening[me], g.opening[opp]] : g.dice[0] === g.dice[1] ? [g.dice[0], g.dice[0], g.dice[0], g.dice[0]] : g.dice;
    const used = g.phase === "opening" ? 0 : vals.length - g.left.length;
    const size = vals.length > 2 ? (tall ? 34 : 28) : tall ? 44 : 34;
    const half = (6 * PW) / 2;
    const cx = g.phase === "opening" ? BAR_X + BAR / 2 : mine ? BAR_X + BAR + half : FR + half;
    const gapX = size + 8;
    const x0 = cx - (vals.length * gapX - 8) / 2;
    // Used dice: the ones not in `left` (by value).
    const left = g.left.slice();
    const usedFlags = vals.map((v) => {
      const i = left.indexOf(v);
      if (i >= 0) {
        left.splice(i, 1);
        return false;
      }
      return true;
    });
    return vals.map((v, i) => {
      const x = g.phase === "opening" ? (i === 0 ? BAR_X + BAR + half - size / 2 : FR + half - size / 2) : x0 + i * gapX;
      const seatColor = g.phase === "opening" ? color(i === 0 ? me : opp) : color(g.turn);
      return <Die key={i} x={x} y={MID - size / 2} size={size} value={v} used={g.phase !== "opening" && used > 0 && usedFlags[i]} tone={seatColor} />;
    });
  };

  // Cube: in the middle of the bar when nobody owns it, otherwise at its owner's end of the bar.
  const cubeY = g.cubeOwner === -1 ? MID - 15 : g.cubeOwner === me ? H - FR - 34 : FR + 4;

  return (
    <svg className="bg-board" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={t("gameBackgammon")}>
      <rect x={0} y={0} width={W} height={H} rx={14} className="frame" />
      <rect x={FR} y={FR} width={PW * 6} height={H - FR * 2} className="field" />
      <rect x={BAR_X + BAR} y={FR} width={PW * 6} height={H - FR * 2} className="field" />
      <rect x={BAR_X} y={FR} width={BAR} height={H - FR * 2} className="bar" onClick={() => onTap("bar")} />
      <rect x={TRAY_X} y={FR} width={TRAY_W} height={H - FR * 2} rx={6} className={`tray ${destSet.has("off") ? "dest-tray" : ""}`} onClick={() => onTap("off")} />
      <line x1={TRAY_X} x2={TRAY_X + TRAY_W} y1={MID} y2={MID} className="tray-line" />
      {points}
      <g onClick={() => onTap("bar")}>
        {barChk(me)}
        {barChk(opp)}
        {g.bar[me] > 4 && <text x={BAR_X + BAR / 2} y={MID + GAP / 2 + CD / 2 + 9 + 3 * (CD - 6)} className={`chk-count on-${color(me)}`}>{g.bar[me]}</text>}
        {g.bar[opp] > 4 && <text x={BAR_X + BAR / 2} y={MID - GAP / 2 - CD / 2 + 1 - 3 * (CD - 6)} className={`chk-count on-${color(opp)}`}>{g.bar[opp]}</text>}
      </g>
      <g onClick={() => onTap("off")} className={destSet.has("off") ? "off-dest" : ""}>
        {offSlabs(me)}
        {offSlabs(opp)}
        {destSet.has("off") && <rect x={TRAY_X + 2} y={MID + 4} width={TRAY_W - 4} height={H / 2 - FR - 6} rx={5} className="dest-zone" />}
      </g>
      {g.off[me] > 0 && <text x={TRAY_X + TRAY_W / 2} y={H - FR - 14 - g.off[me] * 9} className="off-count">{g.off[me]}</text>}
      {g.off[opp] > 0 && <text x={TRAY_X + TRAY_W / 2} y={FR + 22 + g.off[opp] * 9} className="off-count">{g.off[opp]}</text>}
      <g className={`cube ${g.phase === "doubled" ? "offered" : ""}`}>
        <rect x={BAR_X + 5} y={cubeY} width={30} height={30} rx={6} />
        <text x={BAR_X + 20} y={cubeY + 21}>{g.phase === "doubled" ? g.cube * 2 : g.cube === 1 ? 64 : g.cube}</text>
      </g>
      {diceRow()}
    </svg>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

function Die({ x, y, size, value, used, tone }: { x: number; y: number; size: number; value: number; used: boolean; tone: string }) {
  return (
    <g className={`die die-${tone} ${used ? "used" : ""}`}>
      <rect x={x} y={y} width={size} height={size} rx={size * 0.2} />
      {(PIPS[value] ?? []).map(([px, py], i) => (
        <circle key={i} cx={x + px * size} cy={y + py * size} r={size * 0.09} />
      ))}
    </g>
  );
}

function GameResult({ r, me, name }: { r: BgGameResult; me: number | null; name: (i: number) => string }) {
  const { t } = useI18n();
  const kind = r.dropped ? t("bgDropped") : r.kind === 3 ? t("bgKind3") : r.kind === 2 ? t("bgKind2") : t("bgKind1");
  const first = me ?? 0;
  return (
    <div className={`round-result bg-result ${me === null ? "" : r.winner === me ? "us" : "them"}`} role="status">
      <strong className="rr-main">{t("bgWinsGame", { name: r.winner === me ? t("bgYou") : name(r.winner), n: r.points })}</strong>
      <span className="rr-points">
        {kind}
        {r.cube > 1 ? ` · ${t("bgCube")} ${r.cube}` : ""}
      </span>
      <span className="rr-match">
        {r.score[first]} : {r.score[1 - first]}
      </span>
      <span className="muted small">{t("bgNextGame")}</span>
    </div>
  );
}

function BgBadge({ area, room, seat, active, timer, timerMax = 30_000, warn, speaking }: { area: "me" | "opp"; room: RoomView; seat: number; active: boolean; timer: number | null; timerMax?: number; warn?: boolean; speaking?: boolean }) {
  const { t } = useI18n();
  const g = room.game as BgView;
  const s = room.seats[seat];
  return (
    <div className={`bg-badge bg-badge-${area} ${active ? "active" : ""} ${s && !s.connected ? "offline" : ""} ${speaking ? "speaking" : ""} ${warn ? "warn" : ""}`}>
      <span className={`bg-dot chk-${seat === 0 ? "w" : "b"}`} aria-hidden />
      <Avatar url={s?.avatarUrl} name={s?.name ?? "?"} bot={s?.bot} size={26} />
      <span className="bg-name">
        <span className="name-text">{s?.name ?? "—"}</span>
        {speaking && <span className="speaking-icon" aria-label="🔊">🔊</span>}
        {s?.afkKickAt ? <small className="afk-tag">🤖 {t("botPlaying")}</small> : s?.left ? <small className="afk-tag">🚪 {t("leftTag")}</small> : s && !s.connected ? <small className="offline-tag">{t("offline")}</small> : null}
      </span>
      <span className="bg-pips">{t("bgPips", { n: g.pips[seat] })}</span>
      <strong className="bg-score">{g.score[seat]}</strong>
      {timer !== null && <div className={`timer-bar ${warn ? "warn" : ""}`} style={{ width: `${Math.min(100, (timer / timerMax) * 100)}%` }} />}
    </div>
  );
}

/** Every finished game of a match: winner, how, cube and the score after it. */
export function BgGamesTable({ games, names }: { games: BgGameResult[]; names: string[] }) {
  const { t } = useI18n();
  if (!games.length) return <p className="hint">{t("bgNoGames")}</p>;
  return (
    <div className="table-scroll">
      <table className="score-table bg-games">
        <thead>
          <tr>
            <th>#</th>
            <th>{names[0]}</th>
            <th>{names[1]}</th>
            <th>{t("bResult")}</th>
          </tr>
        </thead>
        <tbody>
          {games.map((r, i) => (
            <tr key={i}>
              <td>{i + 1}{r.crawford && <small className="muted"> C</small>}</td>
              {[0, 1].map((s) => (
                <td key={s} className={r.winner === s ? "won" : ""}>
                  {r.winner === s ? `+${r.points}` : ""}
                  <small className="muted"> · {r.score[s]}</small>
                </td>
              ))}
              <td>
                {r.dropped ? "🏳" : r.kind === 3 ? t("bgKind3") : r.kind === 2 ? t("bgKind2") : t("bgKind1")}
                {r.cube > 1 && <small className="muted"> ×{r.cube}</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BgMatchOver({ room, send, leave, openGames, openMatch }: { room: RoomView; send: (m: object) => void; leave: () => void; openGames: () => void; openMatch: (id: string) => void }) {
  const { t } = useI18n();
  const g = room.game as BgView;
  const name = (i: number) => room.seats[i]?.name ?? "";
  const winner = g.score[0] >= g.score[1] ? 0 : 1;
  const order = [winner, 1 - winner];
  return (
    <Modal title={t("gameOver")}>
      <p className="winner-line">🏆 {t("bgWinsMatch", { name: name(winner) })}</p>
      <ol className="final-list rich">
        {order.map((s) => {
          const c = room.ratingChanges?.[s];
          return (
            <li key={s} className={s === room.you ? "me" : ""}>
              <Avatar url={room.seats[s]?.avatarUrl} name={name(s)} bot={room.seats[s]?.bot} size={32} />
              <span className="name-link">{name(s)}</span>
              <strong>{g.score[s]}</strong>
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
          <button className="btn btn-big" onClick={openGames}>{t("bgGames")}</button>
        )}
        <button className="btn btn-ghost" onClick={leave}>{t("backHome")}</button>
      </div>
    </Modal>
  );
}
