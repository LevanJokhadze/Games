import { useEffect, useState } from "react";
import { HISTORY_PAGE, fetchMatch, fetchUser, fetchUserGames } from "../api";
import { useI18n } from "../i18n";
import type { GameRecord, Match, Profile } from "../types";
import { Avatar } from "./Avatar";
import { ScoreTable, scheduleFromPulkas, teamTotals } from "./Scoreboard";
import { pts } from "../points";

function fmtDate(iso: string, lang: string): string {
  const d = new Date(iso);
  return d.toLocaleString(lang === "ka" ? "ka-GE" : "en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Delta({ before, after }: { before: number | null; after: number | null }) {
  if (before === null || after === null) return null;
  const d = after - before;
  return <span className={`delta ${d > 0 ? "pos" : d < 0 ? "neg" : ""}`}>{d > 0 ? `+${d}` : d}</span>;
}

function PlaceChip({ place, pairs }: { place: number; pairs?: boolean }) {
  const { t } = useI18n();
  if (pairs) return <span className={`place p${place}`}>{place === 1 ? "🏆" : "—"}</span>;
  return <span className={`place p${place}`} title={t("place")}>{place === 1 ? "🏆" : `#${place}`}</span>;
}

/** One row per game; tapping opens its summary. */
export function GameList({ games, userId, open }: { games: GameRecord[]; userId: string; open: (id: string) => void }) {
  const { t, lang } = useI18n();
  return (
    <ul className="game-list">
      {games.map((g) => {
        const mine = g.players.findIndex((p) => p.userId === userId);
        const others = g.players.filter((_, i) => i !== mine);
        const partner = g.pairs && mine >= 0 ? g.players[(mine + 2) % 4] : null;
        return (
          <li key={g.id}>
            <button className="game-row" onClick={() => open(g.id)}>
              <PlaceChip place={g.place} pairs={g.pairs} />
              <span className="game-main">
                <span className="game-top">
                  <strong>{pts(g.score)}</strong>
                  {g.pairs && <span className="tag">2×2</span>}
                  {g.mode === "nines" && <span className="tag">9×</span>}
                  <span className="muted small">{fmtDate(g.finishedAt, lang)}</span>
                </span>
                <span className="game-opps muted small">
                  {partner ? `${t("partner")}: ${partner.name} · ` : ""}
                  {(partner ? others.filter((p) => p !== partner) : others).map((p) => p.name).join(", ")}
                </span>
              </span>
              <Delta before={g.ratingBefore} after={g.ratingAfter} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** A player's page: stats and their full match history with paging. */
export function PlayerPage({ id, me, back, openMatch }: { id: string; me: Profile; back: () => void; openMatch: (id: string) => void }) {
  const { t } = useI18n();
  const [user, setUser] = useState<Profile | null>(null);
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setErr(false);
    fetchUser(id).then(
      (d) => {
        setUser(d.user);
        setGames(d.games);
        setMore(d.games.length >= HISTORY_PAGE);
      },
      () => setErr(true),
    );
  }, [id]);

  const loadMore = async () => {
    if (!games?.length) return;
    setBusy(true);
    try {
      const next = await fetchUserGames(id, games[games.length - 1].finishedAt);
      setGames([...games, ...next]);
      setMore(next.length >= HISTORY_PAGE);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <header className="page-head">
        <button className="btn btn-ghost" onClick={back}>← {t("back")}</button>
        <h1>{id === me.id ? t("matchHistory") : t("profile")}</h1>
      </header>
      {err && <p className="error-text">{t("errorCreate")}</p>}
      {!user && !err && <div className="spinner" />}
      {user && (
        <section className="panel">
          <div className="player-head">
            <Avatar url={user.avatarUrl} name={user.nickname} size={84} />
            <div>
              <h2>{user.nickname}</h2>
              <p className="muted">{user.firstName} {user.lastName}</p>
              <div className="player-stats">
                <span><strong>{user.rating}</strong> {t("rating")}</span>
                <span><strong>{user.peak}</strong> {t("peak")}</span>
                <span><strong>{user.games}</strong> {t("games")}</span>
                <span><strong>{user.wins}</strong> {t("wins")}</span>
              </div>
            </div>
          </div>
        </section>
      )}
      {games && (
        <section className="panel">
          <h3>{t("matchHistory")}</h3>
          {games.length === 0 ? <p className="hint">{t("noMatches")}</p> : <GameList games={games} userId={id} open={openMatch} />}
          {more && (
            <button className="btn" disabled={busy} onClick={loadMore}>
              {busy ? t("loading") : t("loadMore")}
            </button>
          )}
        </section>
      )}
    </main>
  );
}

/** Summary of one finished match: result, rating changes and the full score sheet. */
export function MatchPage({ id, me, back, openPlayer }: { id: string; me: Profile; back: () => void; openPlayer: (id: string) => void }) {
  const { t, lang } = useI18n();
  const [m, setM] = useState<Match | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setErr(false);
    fetchMatch(id).then(setM, () => setErr(true));
  }, [id]);

  const order = m ? [...m.players].sort((a, b) => a.place - b.place || b.score - a.score) : [];
  const team = m?.pairs ? teamTotals(m.players.map((p) => p.score)) : null;
  const you = m ? m.players.findIndex((p) => p.userId === me.id) : -1;

  return (
    <main className="page">
      <header className="page-head">
        <button className="btn btn-ghost" onClick={back}>← {t("back")}</button>
        <h1>{t("matchSummary")}</h1>
      </header>
      {err && <p className="error-text">{t("notFound")}</p>}
      {!m && !err && <div className="spinner" />}
      {m && (
        <>
          <section className="panel">
            <p className="muted center">
              {fmtDate(m.finishedAt, lang)} · {m.mode === "nines" ? t("modeNines") : t("modeStandard")} · {m.pairs ? t("pairs") : t("solo")} · {t("khishti")} {pts(m.khishti)}
            </p>
            {team && (
              <div className="team-result">
                {[0, 1].map((tm) => (
                  <div key={tm} className={`team-box team-${tm} ${team[tm] > team[1 - tm] ? "won" : ""}`}>
                    <span className="team-names">{m.players[tm].name} + {m.players[tm + 2].name}</span>
                    <strong>{pts(team[tm])}</strong>
                    {team[tm] > team[1 - tm] && <span>🏆</span>}
                  </div>
                ))}
                {team[0] === team[1] && <p className="hint">{t("draw")}</p>}
              </div>
            )}
            <ol className="final-list rich">
              {order.map((p) => (
                <li key={p.seat} className={p.userId === me.id ? "me" : ""}>
                  <PlaceChip place={p.place} pairs={m.pairs} />
                  <Avatar url={p.avatarUrl} name={p.name} bot={p.bot} size={36} />
                  {p.userId ? (
                    <button className="link-btn name-link" onClick={() => openPlayer(p.userId!)}>{p.name}</button>
                  ) : (
                    <span className="name-link">{p.name}</span>
                  )}
                  <strong>{pts(p.score)}</strong>
                  <span className="rating-cell">
                    {p.ratingAfter !== null && <span className="muted small">{p.ratingAfter}</span>}
                    <Delta before={p.ratingBefore} after={p.ratingAfter} />
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section className="panel">
            <h3>{t("scores")}</h3>
            <ScoreTable
              names={m.players.map((p) => p.name)}
              schedule={scheduleFromPulkas(m.pulkas)}
              pulkas={m.pulkas}
              totals={m.players.map((p) => p.score)}
              pairs={m.pairs}
              you={you >= 0 ? you : null}
            />
          </section>
        </>
      )}
    </main>
  );
}
