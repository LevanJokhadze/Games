// Score sheet for Joker played in person with real cards. One player writes each deal's bids
// and tricks; the server scores it with the online rules, and once all four players confirm
// it from their own accounts the game counts for rating and match history.

import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, createSheet, deleteSheet, fetchSheet, fetchUser, saveSheetDeals, searchPlayers, sheetAction } from "../api";
import { useI18n } from "../i18n";
import { bidBalance, bidText, pts } from "../points";
import type { GameConfig, Profile, Sheet, SheetDeal } from "../types";
import { Avatar } from "./Avatar";
import { ScoreTable } from "./Scoreboard";

type PlayerPick = Pick<Profile, "id" | "nickname" | "firstName" | "lastName" | "avatarUrl" | "rating">;

function useErr() {
  const { t } = useI18n();
  const [err, setErr] = useState<string | null>(null);
  const show = (e: unknown) => setErr(e instanceof ApiError ? e.message : t("errorCreate"));
  return [err, setErr, show] as const;
}

// ---------- New sheet ----------

export function NewSheetPage({ me, back, open }: { me: Profile; back: () => void; open: (id: string) => void }) {
  const { t } = useI18n();
  const [seats, setSeats] = useState<(PlayerPick | null)[]>([me, null, null, null]);
  const [picking, setPicking] = useState<number | null>(1);
  const [firstDealer, setFirstDealer] = useState(0);
  const [config, setConfig] = useState<GameConfig>({ mode: "standard", khishti: -200, pairs: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr, showErr] = useErr();
  const [recent, setRecent] = useState<PlayerPick[]>([]);

  // People you played with recently, for one-tap picking.
  useEffect(() => {
    fetchUser(me.id).then(
      async (d) => {
        const ids: string[] = [];
        for (const g of d.games) for (const p of g.players) if (p.userId && p.userId !== me.id && !ids.includes(p.userId)) ids.push(p.userId);
        const users = await Promise.all(ids.slice(0, 8).map((id) => fetchUser(id).then((x) => x.user, () => null)));
        setRecent(users.filter((u): u is Profile => !!u));
      },
      () => undefined,
    );
  }, [me.id]);

  const put = (seat: number, p: PlayerPick | null) => {
    const next = seats.map((s, i) => (i === seat ? p : s && p && s.id === p.id ? null : s));
    setSeats(next);
    setErr(null);
    const empty = next.findIndex((s) => !s);
    setPicking(p ? (empty >= 0 ? empty : null) : seat);
  };

  const full = seats.every(Boolean);
  const start = async () => {
    if (!full) return setErr(t("sheetNeed4"));
    setBusy(true);
    setErr(null);
    try {
      const s = await createSheet({ players: seats.map((p) => p!.id), firstDealer, config });
      open(s.id);
    } catch (e) {
      showErr(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <header className="page-head">
        <button className="btn btn-ghost" onClick={back}>← {t("back")}</button>
        <h1>{t("sheetNew")}</h1>
      </header>
      <section className="panel">
        <p className="hint left">{t("sheetIntro")}</p>
      </section>
      <section className="panel">
        <h3>{t("sheetPlayers")}</h3>
        <ul className="seat-list">
          {seats.map((p, i) => (
            <li key={i} className={`seat-row ${config.pairs ? `team-${i % 2}` : ""} ${picking === i ? "picking" : ""}`}>
              <span className="seat-num">{i + 1}</span>
              {p ? (
                <>
                  <Avatar url={p.avatarUrl} name={p.nickname} size={32} />
                  <span className="seat-name">
                    {p.nickname}
                    <small className="muted"> {p.rating}</small>
                  </span>
                  {p.id !== me.id && (
                    <button className="btn btn-small btn-ghost" onClick={() => put(i, null)} aria-label={t("remove")}>✕</button>
                  )}
                </>
              ) : (
                <button className="btn btn-small btn-ghost seat-pick" onClick={() => setPicking(i)}>
                  + {t("sheetPick")}
                </button>
              )}
              {picking === i && !p && (
                <PlayerSearch exclude={seats.filter(Boolean).map((s) => s!.id)} recent={recent} onPick={(u) => put(i, u)} />
              )}
            </li>
          ))}
        </ul>
        {config.pairs && <p className="hint left">{t("sheetPairsSeats")}</p>}
      </section>
      <section className="panel">
        <div className="field">
          <span>{t("pairs")}</span>
          <div className="segmented" role="radiogroup" aria-label={t("pairs")}>
            {[false, true].map((v) => (
              <button key={String(v)} role="radio" aria-checked={config.pairs === v} className={config.pairs === v ? "on" : ""} onClick={() => setConfig({ ...config, pairs: v })}>
                {v ? `👥 ${t("pairs")}` : t("solo")}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>{t("mode")}</span>
          <select value={config.mode} onChange={(e) => setConfig({ ...config, mode: e.target.value as GameConfig["mode"] })}>
            <option value="standard">{t("modeStandard")}</option>
            <option value="nines">{t("modeNines")}</option>
          </select>
        </label>
        <label className="field">
          <span>{t("khishti")}</span>
          <select value={config.khishti} onChange={(e) => setConfig({ ...config, khishti: Number(e.target.value) })}>
            {[-200, -500, -900].map((v) => (
              <option key={v} value={v}>{pts(v)}</option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>{t("sheetFirstDealer")}</span>
          <div className="dealer-pick" role="radiogroup" aria-label={t("sheetFirstDealer")}>
            {seats.map((p, i) => (
              <button key={i} role="radio" aria-checked={firstDealer === i} className={firstDealer === i ? "on" : ""} onClick={() => setFirstDealer(i)}>
                {p?.nickname ?? `${i + 1}`}
              </button>
            ))}
            <button className="dice" onClick={() => setFirstDealer(Math.floor(Math.random() * 4))}>{t("sheetRandom")}</button>
          </div>
        </div>
        {err && <p className="error-text">{err}</p>}
        <button className="btn btn-primary btn-big" disabled={busy || !full} onClick={start}>
          {t("sheetCreate")}
        </button>
        {!full && <p className="hint">{t("sheetNeed4")}</p>}
      </section>
    </main>
  );
}

function PlayerSearch({ exclude, recent, onPick }: { exclude: string[]; recent: PlayerPick[]; onPick: (p: PlayerPick) => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PlayerPick[] | null>(null);
  useEffect(() => {
    const c = q.trim();
    if (!c) return setRows(null);
    let stop = false;
    const id = setTimeout(() => {
      searchPlayers(c).then((r) => !stop && setRows(r), () => !stop && setRows([]));
    }, 250);
    return () => {
      stop = true;
      clearTimeout(id);
    };
  }, [q]);
  const list = (rows ?? recent).filter((p) => !exclude.includes(p.id));
  return (
    <div className="player-search">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("sheetSearch")}
        aria-label={t("sheetSearch")}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        className="code-input"
      />
      {!rows && list.length > 0 && <p className="hint left">{t("sheetRecent")}</p>}
      {rows && list.length === 0 && <p className="hint left">{t("sheetNoResults")}</p>}
      <ul className="pick-list">
        {list.map((p) => (
          <li key={p.id}>
            <button className="lb-row" onClick={() => onPick(p)}>
              <Avatar url={p.avatarUrl} name={p.nickname} size={34} />
              <span className="lb-name">
                <strong>{p.nickname}</strong>
                <small>{p.firstName} {p.lastName}</small>
              </span>
              <span className="lb-rating">{p.rating}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- The sheet ----------

/** Pulka and deal number of the k-th deal. */
function locate(schedule: number[][], k: number): { pulka: number; deal: number; size: number } {
  let i = k;
  for (let p = 0; p < schedule.length; p++) {
    if (i < schedule[p].length) return { pulka: p, deal: i, size: schedule[p][i] };
    i -= schedule[p].length;
  }
  return { pulka: schedule.length - 1, deal: 0, size: 0 };
}

interface Draft {
  index: number;
  stage: "bids" | "took";
  bids: (number | null)[];
  took: (number | null)[];
}

/** The deal to write next: the one with bids but no tricks yet, or a new one. */
function freshDraft(s: Sheet): Draft | null {
  if (s.score.complete) return null;
  const last = s.deals[s.deals.length - 1];
  if (last && !last.took) return { index: s.deals.length - 1, stage: "took", bids: last.bids.slice(), took: [null, null, null, null] };
  return { index: s.deals.length, stage: "bids", bids: [null, null, null, null], took: [null, null, null, null] };
}

export function SheetPage({ id, me, back, openMatch }: { id: string; me: Profile; back: () => void; openMatch: (id: string) => void }) {
  const { t } = useI18n();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [gone, setGone] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr, showErr] = useErr();
  const [sureDelete, setSureDelete] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const take = (s: Sheet, resetDraft: boolean) => {
    setSheet(s);
    if (resetDraft || !draftRef.current) setDraft(s.canEdit && s.status === "recording" ? freshDraft(s) : null);
  };

  useEffect(() => {
    fetchSheet(id).then((s) => take(s, true), (e) => (e instanceof ApiError && e.status === 404 ? setGone(true) : showErr(e)));
  }, [id]);

  // Everyone else at the table follows along live.
  useEffect(() => {
    if (!sheet || sheet.status === "rated" || sheet.status === "cancelled") return;
    const tick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchSheet(id).then(
        (s) => {
          setSheet((cur) => (cur && cur.version === s.version ? cur : s));
          if (!s.canEdit) setDraft(null);
        },
        (e) => e instanceof ApiError && e.status === 404 && setGone(true),
      );
    }, 4000);
    return () => clearInterval(tick);
  }, [id, sheet?.status]);

  const run = async (fn: () => Promise<Sheet>, resetDraft = true) => {
    setBusy(true);
    setErr(null);
    try {
      take(await fn(), resetDraft);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setErr(t("sheetConflict"));
        fetchSheet(id).then((s) => take(s, true), () => undefined);
      } else showErr(e);
    } finally {
      setBusy(false);
    }
  };

  if (gone) {
    return (
      <main className="page">
        <header className="page-head">
          <button className="btn btn-ghost" onClick={back}>← {t("back")}</button>
          <h1>{t("sheetTitle")}</h1>
        </header>
        <p className="error-text">{t("sheetMissing")}</p>
      </main>
    );
  }
  if (!sheet) {
    return (
      <main className="page">
        <header className="page-head">
          <button className="btn btn-ghost" onClick={back}>← {t("back")}</button>
          <h1>{t("sheetTitle")}</h1>
        </header>
        {err ? <p className="error-text">{err}</p> : <div className="spinner" />}
      </main>
    );
  }

  const s = sheet;
  const names = s.players.map((p) => p.nickname);
  const keeper = s.players.find((p) => p.id === s.createdBy)?.nickname ?? "";
  const partial = s.deals.length && !s.deals[s.deals.length - 1].took ? s.deals.length - 1 : -1;
  const partialAt = partial >= 0 ? locate(s.score.schedule, partial) : null;
  const editing = draft && draft.index < (partial >= 0 ? partial : s.deals.length) ? locate(s.score.schedule, draft.index) : null;

  const writeDeal = (d: Draft, took: boolean) => {
    const deals: SheetDeal[] = s.deals.map((x) => ({ bids: x.bids.slice(), took: x.took ? x.took.slice() : null }));
    deals[d.index] = { bids: d.bids as number[], took: took ? (d.took as number[]) : null };
    return run(() => saveSheetDeals(s, deals));
  };

  return (
    <main className="page sheet-page">
      <header className="page-head">
        <button className="btn btn-ghost" onClick={back}>← {t("back")}</button>
        <h1>{t("sheetTitle")}</h1>
      </header>

      <Totals sheet={s} />

      {s.status === "recording" && s.rejected && (
        <p className="sheet-note warn">↩ {t("rejectedBy", { name: s.players.find((p) => p.id === s.rejected!.userId)?.nickname ?? "?" })}</p>
      )}

      {s.status === "recording" && !s.canEdit && <p className="hint">{t("viewerHint", { name: keeper })}</p>}

      {draft && s.canEdit && s.status === "recording" && (
        <DealEntry
          key={`${draft.index}-${draft.stage}`}
          sheet={s}
          draft={draft}
          editing={!!editing}
          busy={busy}
          setDraft={setDraft}
          onSaveBids={(d) => writeDeal(d, false)}
          onSaveDeal={(d) => writeDeal(d, true)}
          onCancel={() => setDraft(freshDraft(s))}
        />
      )}
      {err && <p className="error-text">{err}</p>}

      {s.status === "recording" && s.canEdit && s.score.complete && !editing && (
        <section className="panel">
          <p className="hint left">{t("allWritten")}</p>
          <button className="btn btn-primary btn-big" disabled={busy} onClick={() => run(() => sheetAction(s, "submit"))}>
            ✓ {t("finishSheet")}
          </button>
        </section>
      )}

      {s.status === "pending" && (
        <section className="panel">
          <h3>⏳ {t("waitingConfirm")}</h3>
          <ul className="confirm-list">
            {s.players.map((p) => (
              <li key={p.id} className={s.confirmed.includes(p.id) ? "ok" : ""}>
                <Avatar url={p.avatarUrl} name={p.nickname} size={28} />
                <span>{p.nickname}</span>
                <span className="muted small">{s.confirmed.includes(p.id) ? `✓ ${t("confirmed")}` : t("notYet")}</span>
              </li>
            ))}
          </ul>
          {s.mustConfirm && (
            <>
              <p className="hint left">{t("confirmHint")}</p>
              <button className="btn btn-primary btn-big" disabled={busy} onClick={() => run(() => sheetAction(s, "confirm"))}>
                ✓ {t("confirmBtn")}
              </button>
              <button className="btn btn-big" disabled={busy} onClick={() => run(() => sheetAction(s, "reject"))}>
                ✕ {t("rejectBtn")}
              </button>
            </>
          )}
        </section>
      )}

      {s.status === "rated" && (
        <section className="panel">
          <p className="sheet-note ok">✓ {t("ratedDone")}</p>
          {s.matchId && (
            <button className="btn btn-primary btn-big" onClick={() => openMatch(s.matchId!)}>
              {t("openMatch")}
            </button>
          )}
        </section>
      )}
      {s.status === "cancelled" && <p className="error-text">{t("sheetDeleted")}</p>}

      <section className="panel">
        <h3>{t("scores")}</h3>
        <ScoreTable
          names={names}
          schedule={s.score.schedule}
          pulkas={s.score.pulkas}
          totals={s.score.totals}
          pairs={s.config.pairs}
          you={s.you}
          current={partialAt ? { pulka: partialAt.pulka, deal: partialAt.deal, bids: s.deals[partial].bids, took: [0, 0, 0, 0] } : null}
          editing={editing}
          onDealClick={
            s.canEdit && s.status !== "rated"
              ? (p, d) => {
                  const k = s.score.schedule.slice(0, p).reduce((a, x) => a + x.length, 0) + d;
                  const deal = s.deals[k];
                  if (deal?.took) {
                    setDraft({ index: k, stage: "bids", bids: deal.bids.slice(), took: deal.took.slice() });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }
              : undefined
          }
        />
        {s.canEdit && s.score.done > 0 && s.status !== "rated" && <p className="hint left">{t("tapToFix")}</p>}
        <p className="hint left">
          {t("scorekeeper", { name: keeper })} · {s.config.mode === "nines" ? t("modeNines") : t("modeStandard")} · {s.config.pairs ? t("pairs") : t("solo")} · {t("khishti")} {pts(s.config.khishti)}
        </p>
      </section>

      {s.canEdit && (
        <button
          className="btn btn-ghost logout-btn"
          disabled={busy}
          onClick={async () => {
            if (!sureDelete) return setSureDelete(true);
            try {
              await deleteSheet(s);
              back();
            } catch (e) {
              showErr(e);
            }
          }}
        >
          {sureDelete ? t("deleteSure") : t("deleteSheet")}
        </button>
      )}
    </main>
  );
}

function Totals({ sheet: s }: { sheet: Sheet }) {
  const { t } = useI18n();
  const team = s.config.pairs ? [s.score.totals[0] + s.score.totals[2], s.score.totals[1] + s.score.totals[3]] : null;
  return (
    <section className="sheet-totals" aria-label={t("total")}>
      {s.players.map((p, i) => {
        const ch = s.ratingChanges?.[i];
        return (
          <div key={p.id} className={`st-player ${i === s.you ? "me" : ""} ${s.config.pairs ? `team-${i % 2}` : ""}`}>
            <Avatar url={p.avatarUrl} name={p.nickname} size={30} />
            <span className="st-name">
              {i === s.dealer && <span className="dealer-dot" title={t("dealer")}>D</span>}
              {p.nickname}
            </span>
            <strong>{pts(s.score.totals[i])}</strong>
            {ch && <span className={`delta ${ch.delta > 0 ? "pos" : ch.delta < 0 ? "neg" : ""}`}>{ch.delta > 0 ? `+${ch.delta}` : ch.delta}</span>}
          </div>
        );
      })}
      {team && (
        <div className="st-team">
          <span className="team-0">{s.players[0].nickname} + {s.players[2].nickname}: <strong>{pts(team[0])}</strong></span>
          <span className="team-1">{s.players[1].nickname} + {s.players[3].nickname}: <strong>{pts(team[1])}</strong></span>
        </div>
      )}
    </section>
  );
}

function Chips({ max, value, onChange, forbidden, label }: { max: number; value: number | null; onChange: (v: number) => void; forbidden?: number | null; label: string }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {Array.from({ length: max + 1 }, (_, v) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          className={`chip ${value === v ? "on" : ""}`}
          disabled={forbidden === v}
          onClick={() => onChange(v)}
        >
          {bidText(v)}
        </button>
      ))}
    </div>
  );
}

function DealEntry({
  sheet: s,
  draft,
  editing,
  busy,
  setDraft,
  onSaveBids,
  onSaveDeal,
  onCancel,
}: {
  sheet: Sheet;
  draft: Draft;
  editing: boolean;
  busy: boolean;
  setDraft: (d: Draft) => void;
  onSaveBids: (d: Draft) => void;
  onSaveDeal: (d: Draft) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const at = locate(s.score.schedule, draft.index);
  const n = at.size;
  const dealer = (s.firstDealer + draft.index) % 4;
  // Bidding order: from the dealer's left; the dealer last.
  const order = [1, 2, 3, 4].map((k) => (dealer + k) % 4);
  const others = (seat: number) => draft.bids.reduce<number>((a, b, i) => (i === seat ? a : a + (b ?? 0)), 0);
  const dealerForbidden = draft.bids.every((b, i) => i === dealer || b !== null) ? n - others(dealer) : null;
  const balance = bidBalance(draft.bids, n);
  const tookSum = draft.took.reduce<number>((a, b) => a + (b ?? 0), 0);
  const tookSet = draft.took.filter((x) => x !== null).length;

  const setBid = (seat: number, v: number) => {
    const bids = draft.bids.slice();
    bids[seat] = v;
    // A dealer bid that the others' bids have just made illegal is cleared.
    if (seat !== dealer && bids[dealer] !== null && bids.reduce<number>((a, b) => a + (b ?? 0), 0) === n) bids[dealer] = null;
    setDraft({ ...draft, bids });
  };
  const setTook = (seat: number, v: number) => {
    const took = draft.took.slice();
    took[seat] = v;
    // Three written: the fourth player took the rest.
    const missing = took.map((x, i) => (x === null ? i : -1)).filter((i) => i >= 0);
    if (missing.length === 1) {
      const rest = n - took.reduce<number>((a, b) => a + (b ?? 0), 0);
      if (rest >= 0) took[missing[0]] = rest;
    }
    setDraft({ ...draft, took });
  };

  const bidsReady = draft.bids.every((b) => b !== null) && balance !== null;
  const tookReady = draft.took.every((x) => x !== null) && tookSum === n;

  return (
    <section className={`panel deal-entry ${editing ? "is-editing" : ""}`}>
      <div className="deal-head">
        <strong>{editing ? t("editingDeal", { k: draft.index + 1 }) : t("dealOf", { k: draft.index + 1, n: s.score.count })}</strong>
        <span className="muted">
          {t("pulka")} {at.pulka + 1} · {t("cardsN", { n })} · {t("dealer")}: {s.players[dealer].nickname}
        </span>
      </div>
      <h3>{draft.stage === "bids" ? t("bidsStep") : t("tookStep")}</h3>
      <ul className="entry-list">
        {order.map((seat) => (
          <li key={seat} className={`entry-row ${s.config.pairs ? `team-${seat % 2}` : ""}`}>
            <span className="entry-name">
              {seat === dealer && <span className="dealer-dot">D</span>}
              {s.players[seat].nickname}
              {draft.stage === "took" && <small className="muted"> · {t("bid")}: {bidText(draft.bids[seat])}</small>}
            </span>
            {draft.stage === "bids" ? (
              <>
                <Chips max={n} value={draft.bids[seat]} onChange={(v) => setBid(seat, v)} forbidden={seat === dealer ? dealerForbidden : null} label={s.players[seat].nickname} />
                {seat === dealer && dealerForbidden !== null && dealerForbidden >= 0 && dealerForbidden <= n && (
                  <small className="muted">{t("dealerCant", { n: dealerForbidden })}</small>
                )}
              </>
            ) : (
              <Chips max={n} value={draft.took[seat]} onChange={(v) => setTook(seat, v)} label={s.players[seat].nickname} />
            )}
          </li>
        ))}
      </ul>
      {draft.stage === "bids" && balance && (
        <p className={`bal-line bal ${balance.kind}`}>{t(balance.kind === "under" ? "underBid" : "overBid", { n: balance.n })}</p>
      )}
      {draft.stage === "took" && tookSet > 0 && tookSum !== n && (
        <p className={`bal-line ${tookSum > n ? "bad" : ""}`}>{tookSum > n ? t("tricksOver", { n: tookSum - n }) : t("tricksLeft", { n: n - tookSum })}</p>
      )}
      {draft.stage === "bids" ? (
        <button
          className="btn btn-primary btn-big"
          disabled={!bidsReady || busy}
          onClick={() => (editing ? setDraft({ ...draft, stage: "took" }) : onSaveBids({ ...draft }))}
        >
          {editing ? `${t("tookStep")} →` : t("saveBids")}
        </button>
      ) : (
        <>
          <button className="btn btn-primary btn-big" disabled={!tookReady || busy} onClick={() => onSaveDeal(draft)}>
            ✓ {t("saveDeal")}
          </button>
          <button className="btn" disabled={busy} onClick={() => setDraft({ ...draft, stage: "bids" })}>
            ← {t("editBids")}
          </button>
        </>
      )}
      {editing && (
        <button className="btn btn-ghost" onClick={onCancel}>
          {t("cancel")}
        </button>
      )}
    </section>
  );
}

/** Open sheets on the home screen: ones waiting for you first. */
export function SheetBanners({ sheets, open }: { sheets: Sheet[]; open: (id: string) => void }) {
  const { t } = useI18n();
  const sorted = useMemo(() => [...sheets].sort((a, b) => Number(b.mustConfirm) - Number(a.mustConfirm)), [sheets]);
  if (!sorted.length) return null;
  return (
    <>
      {sorted.map((s) => {
        const names = s.players.map((p) => p.nickname).join(", ");
        const text = s.mustConfirm ? `✍️ ${t("confirmSheet", { names })}` : s.status === "pending" ? `⏳ ${t("waitSheet", { names })}` : `📝 ${t("continueSheet", { names })}`;
        return (
          <button key={s.id} className={`pw-banner sheet-banner ${s.mustConfirm ? "" : "quiet"}`} onClick={() => open(s.id)}>
            {text}
          </button>
        );
      })}
    </>
  );
}
