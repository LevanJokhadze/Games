import { useEffect, useState } from "react";
import { createRoom, fetchSheets, getToken, logout, updateMe } from "../api";
import { T, useI18n } from "../i18n";
import type { Theme } from "../theme";
import type { GameKind, Profile, Sheet } from "../types";
import { SheetBanners } from "./Sheet";
import { Avatar } from "./Avatar";
import { Leaderboard } from "./Leaderboard";
import { Modal } from "./Modal";
import { ProfileForm } from "./ProfileForm";
import { Rules } from "./Rules";
import { Settings } from "./Settings";

interface Props {
  me: Profile;
  setMe: (p: Profile) => void;
  onLogout: () => void;
  go: (code: string, autostart?: boolean) => void;
  nav: (hash: string) => void;
  theme: Theme;
  setTheme: (t: Partial<Theme>) => void;
}

type SheetName = null | "rules" | "leaderboard" | "settings" | "profile";

export function Home({ me, setMe, onLogout, go, nav, theme, setTheme }: Props) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [game, setGameState] = useState<GameKind>(() => {
    try {
      const g = localStorage.getItem("joker.game");
      return g === "bura" || g === "poker" || g === "backgammon" ? g : "joker";
    } catch {
      return "joker";
    }
  });
  const setGame = (g: GameKind) => {
    setGameState(g);
    try {
      localStorage.setItem("joker.game", g);
    } catch {
      /* ignore */
    }
  };
  const [sheets, setSheets] = useState<Sheet[]>([]);
  useEffect(() => {
    fetchSheets().then(setSheets, () => undefined);
  }, []);

  const create = async (autostart: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      go(await createRoom(game), autostart);
    } catch {
      setErr(t("errorCreate"));
    } finally {
      setBusy(false);
    }
  };

  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);

  return (
    <main className="home">
      <button className="me-chip" onClick={() => setSheet("profile")} aria-label={t("profile")}>
        <Avatar url={me.avatarUrl} name={me.nickname} size={36} />
        <span className="me-chip-text">
          <strong>{me.nickname}</strong>
          <small>{me.rating} · {t("rating")}</small>
        </span>
      </button>

      <div className="home-hero">
        <div className="logo-cards" aria-hidden>
          <span className="lc lc1">A♠</span>
          <span className="lc lc2">★</span>
          <span className="lc lc3">K♥</span>
        </div>
        <h1>{t("title")}</h1>
        <p className="tagline">{t("tagline")}</p>
      </div>

      {me.hasPassword === false && (
        <button className="pw-banner" onClick={() => setSheet("profile")}>
          🔑 {t("setPasswordBanner")}
        </button>
      )}

      <SheetBanners sheets={sheets} open={(id) => nav(`#/sheet/${id}`)} />

      <section className="panel home-panel">
        <div className="segmented game-switch four" role="radiogroup" aria-label={t("chooseGame")}>
          {GAMES.map((g) => (
            <button key={g} role="radio" aria-checked={game === g} className={game === g ? "on" : ""} onClick={() => setGame(g)}>
              {gameLabel(t, g)}
            </button>
          ))}
        </div>
        {game === "bura" && <p className="hint left">{t("buraHint")}</p>}
        {game === "poker" && <p className="hint left">{t("pokerHint")}</p>}
        {game === "backgammon" && <p className="hint left">{t("bgHint")}</p>}
        <button className="btn btn-primary btn-big" disabled={busy} onClick={() => create(true)}>
          {game === "bura" ? t("playBura") : game === "poker" ? t("playPoker") : game === "backgammon" ? t("playBackgammon") : t("playBots")}
        </button>
        <button className="btn btn-big" disabled={busy} onClick={() => create(false)}>
          {game === "bura" ? t("buraRoom") : game === "poker" ? t("pokerRoom") : game === "backgammon" ? t("bgRoom") : t("createRoom")}
        </button>
        <form
          className="join-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (cleanCode.length === 5) go(cleanCode);
          }}
        >
          <input
            value={cleanCode}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("roomCode")}
            aria-label={t("roomCode")}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            className="code-input"
          />
          <button className="btn" type="submit" disabled={cleanCode.length !== 5}>
            {t("joinRoom")}
          </button>
        </form>
        {err && <p className="error-text">{err}</p>}
      </section>

      <nav className="home-tiles">
        <button className="tile tile-wide" onClick={() => nav("#/sheet/new")}>
          <span aria-hidden>📝</span>
          {t("sheetTile")}
          <small className="muted">{t("inPerson")}</small>
        </button>
        <button className="tile" onClick={() => setSheet("leaderboard")}>
          <span aria-hidden>🏆</span>
          {t("leaderboard")}
        </button>
        <button className="tile" onClick={() => nav(`#/player/${me.id}`)}>
          <span aria-hidden>📜</span>
          {t("matchHistory")}
        </button>
        <button className="tile" onClick={() => setSheet("settings")}>
          <span aria-hidden>🎨</span>
          {t("settings")}
        </button>
        <button className="tile" onClick={() => setSheet("rules")}>
          <span aria-hidden>📖</span>
          {t("rules")}
        </button>
      </nav>

      {sheet === "rules" && <Rules game={game} onClose={() => setSheet(null)} />}
      {sheet === "leaderboard" && <Leaderboard me={me} onClose={() => setSheet(null)} openPlayer={(id) => nav(`#/player/${id}`)} />}
      {sheet === "settings" && <Settings theme={theme} setTheme={setTheme} onClose={() => setSheet(null)} />}
      {sheet === "profile" && <ProfileSheet me={me} setMe={setMe} onLogout={onLogout} onClose={() => setSheet(null)} />}
    </main>
  );
}

function ProfileSheet({ me, setMe, onLogout, onClose }: { me: Profile; setMe: (p: Profile) => void; onLogout: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}#/key/${getToken() ?? ""}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt(t("deviceLink"), link);
    }
  };
  return (
    <Modal title={t("editProfile")} onClose={onClose}>
      <div className="player-stats center">
        <span><strong>{me.rating}</strong> {t("rating")}</span>
        <span><strong>{me.peak}</strong> {t("peak")}</span>
        <span><strong>{me.games}</strong> {t("games")}</span>
        <span><strong>{me.wins}</strong> {t("wins")}</span>
      </div>
      <ProfileForm
        initial={me}
        password="optional"
        submitLabel={t("save")}
        onSubmit={async (p) => {
          setMe(await updateMe(p));
          onClose();
        }}
      />
      <section className="device-link">
        <h4>{t("deviceLink")}</h4>
        <p className="hint left">{t("deviceLinkHint")}</p>
        <button className="btn" onClick={copy}>{copied ? `✓ ${t("copied")}` : `🔑 ${t("copyLink")}`}</button>
      </section>
      {me.hasPassword && <button
        className="btn btn-ghost logout-btn"
        onClick={async () => {
          await logout();
          onLogout();
        }}
      >
        {t("logout")}
      </button>}
    </Modal>
  );
}

export const GAMES: GameKind[] = ["joker", "bura", "poker", "backgammon"];

export function gameLabel(t: T, g: GameKind): string {
  return g === "joker" ? `★ ${t("gameJoker")}` : g === "bura" ? `🂡 ${t("gameBura")}` : g === "poker" ? `♠ ${t("gamePoker")}` : `⚀ ${t("gameBackgammon")}`;
}
