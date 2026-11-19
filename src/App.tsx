import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, fetchMe, login, register, setToken, useRoom } from "./api";
import { MatchPage, PlayerPage } from "./components/History";
import { Home } from "./components/Home";
import { NewSheetPage, SheetPage } from "./components/Sheet";
import { PasswordField, ProfileForm } from "./components/ProfileForm";
import { Lobby } from "./components/Lobby";
import { Table } from "./components/Table";
import { Lang, LangContext, makeT, useI18n } from "./i18n";
import { useTheme } from "./theme";
import { useVoice } from "./voice";
import type { Profile } from "./types";

function load(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

type Route =
  | { page: "home" }
  | { page: "room"; code: string }
  | { page: "match"; id: string }
  | { page: "player"; id: string }
  | { page: "newSheet" }
  | { page: "sheet"; id: string };

function parseHash(): Route {
  const h = location.hash;
  let m = h.match(/^#\/room\/([A-Za-z0-9]{5})$/);
  if (m) return { page: "room", code: m[1].toUpperCase() };
  m = h.match(/^#\/match\/([0-9a-f-]{36})$/i);
  if (m) return { page: "match", id: m[1] };
  m = h.match(/^#\/player\/([0-9a-f-]{36})$/i);
  if (m) return { page: "player", id: m[1] };
  if (h === "#/sheet/new") return { page: "newSheet" };
  m = h.match(/^#\/sheet\/([0-9a-f-]{36})$/i);
  if (m) return { page: "sheet", id: m[1] };
  return { page: "home" };
}

/** "#/key/<token>" signs this device in to an existing account (link made on another device). */
function takeKeyFromHash() {
  const m = location.hash.match(/^#\/key\/([A-Za-z0-9_-]{20,100})$/);
  if (!m) return;
  setToken(m[1]);
  history.replaceState(null, "", location.pathname);
}

export function App() {
  const [lang, setLangState] = useState<Lang>(() => (load("joker.lang", "ka") === "en" ? "en" : "ka"));
  const [route, setRoute] = useState<Route>(() => {
    takeKeyFromHash();
    return parseHash();
  });
  const [me, setMe] = useState<Profile | null | undefined>(undefined);
  const [meError, setMeError] = useState(false);
  useEffect(() => {
    if (!me) return;
    try {
      localStorage.setItem("joker.hadAccount", "1");
    } catch {
      /* ignore */
    }
  }, [me]);
  const [theme, setTheme] = useTheme();

  const loadMe = () => {
    setMeError(false);
    fetchMe().then(setMe, () => setMeError(true));
  };
  useEffect(loadMe, []);
  const autostart = useRef(false);

  const setLang = (l: Lang) => {
    setLangState(l);
    store("joker.lang", l);
    document.documentElement.lang = l;
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    const onHash = () => {
      if (/^#\/key\//.test(location.hash)) {
        takeKeyFromHash();
        loadMe();
      }
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const nav = (hash: string) => {
    location.hash = hash;
    setRoute(parseHash());
  };
  const go = (c: string, start = false) => {
    autostart.current = start;
    nav(`#/room/${c}`);
  };
  const leave = () => {
    history.pushState(null, "", location.pathname);
    setRoute({ page: "home" });
  };
  const back = () => {
    if (history.length > 1) history.back();
    else leave();
  };

  const ctx = useMemo(() => ({ lang, t: makeT(lang), setLang }), [lang]);

  return (
    <LangContext.Provider value={ctx}>
      <div className="app">
        <LangToggle />
        {me === undefined ? (
          <main className="center-screen">
            {meError ? (
              <>
                <p>{ctx.t("errorCreate")}</p>
                <button className="btn btn-primary" onClick={loadMe}>↻</button>
              </>
            ) : (
              <div className="spinner" />
            )}
          </main>
        ) : me === null ? (
          <RegisterScreen
            onDone={(p) => {
              setMe(p);
            }}
          />
        ) : route.page === "room" ? (
          <RoomScreen
            key={route.code}
            code={route.code}
            name={me.nickname}
            leave={leave}
            autostart={autostart}
            openMatch={(id) => nav(`#/match/${id}`)}
            onAuthError={() => {
              setToken(null);
              setMe(null);
            }}
          />
        ) : route.page === "match" ? (
          <MatchPage key={route.id} id={route.id} me={me} back={back} openPlayer={(id) => nav(`#/player/${id}`)} />
        ) : route.page === "newSheet" ? (
          <NewSheetPage me={me} back={back} open={(id) => {
            history.replaceState(null, "", `#/sheet/${id}`);
            setRoute({ page: "sheet", id });
          }} />
        ) : route.page === "sheet" ? (
          <SheetPage key={route.id} id={route.id} me={me} back={back} openMatch={(id) => nav(`#/match/${id}`)} />
        ) : route.page === "player" ? (
          <PlayerPage key={route.id} id={route.id} me={me} back={back} openMatch={(id) => nav(`#/match/${id}`)} />
        ) : (
          <Home me={me} setMe={setMe} onLogout={() => setMe(null)} go={go} nav={nav} theme={theme} setTheme={setTheme} />
        )}
      </div>
    </LangContext.Provider>
  );
}

function RegisterScreen({ onDone }: { onDone: (p: Profile) => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"register" | "login">(() => {
    try {
      return localStorage.getItem("joker.hadAccount") ? "login" : "register";
    } catch {
      return "register";
    }
  });
  return (
    <main className="home register">
      <div className="home-hero small">
        <h1>{t("title")}</h1>
        <p className="tagline">{mode === "login" ? t("loginTitle") : t("registerTitle")}</p>
      </div>
      <section className="panel">
        {mode === "login" ? (
          <LoginForm onDone={onDone} />
        ) : (
          <>
            <p className="hint left">{t("registerHint")}</p>
            <ProfileForm password="required" submitLabel={t("register")} onSubmit={async (p) => onDone(await register(p))} />
          </>
        )}
        <button type="button" className="link-btn switch-auth" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? t("noAccount") : t("haveAccount")}
        </button>
      </section>
    </main>
  );
}

function LoginForm({ onDone }: { onDone: (p: Profile) => void }) {
  const { t } = useI18n();
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !password) {
      setErr(t("wrongLogin"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      onDone(await login(nickname.trim(), password));
    } catch (e2) {
      setErr(e2 instanceof ApiError ? (e2.status === 429 ? t("tooManyTries") : e2.status === 400 ? t("wrongLogin") : e2.message) : t("errorCreate"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="profile-form" onSubmit={submit} noValidate>
      <label className="field">
        <span>{t("nickname")}</span>
        <input value={nickname} onChange={(e) => setNickname(e.target.value.replace(/\s/g, ""))} maxLength={20} autoComplete="username" autoCapitalize="off" spellCheck={false} autoFocus />
      </label>
      <PasswordField label={t("password")} value={password} onChange={setPassword} autoComplete="current-password" />
      {err && <p className="error-text">{err}</p>}
      <button className="btn btn-primary btn-big" type="submit" disabled={busy}>
        {t("login")}
      </button>
    </form>
  );
}

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button className="lang-toggle" onClick={() => setLang(lang === "ka" ? "en" : "ka")} aria-label="Language">
      {lang === "ka" ? "EN" : "ქარ"}
    </button>
  );
}

function RoomScreen({ code, name, leave, autostart, openMatch, onAuthError }: { code: string; name: string; leave: () => void; autostart: React.MutableRefObject<boolean>; openMatch: (id: string) => void; onAuthError: () => void }) {
  const { t } = useI18n();
  const { room, status, error, clearError, send, clockOffset, subscribe } = useRoom(code, name, onAuthError);
  const voice = useVoice(room, send, subscribe);

  useEffect(() => {
    if (room && autostart.current && room.status === "lobby" && room.isHost) {
      autostart.current = false;
      send({ t: "start" });
    }
  }, [room, send, autostart]);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(clearError, 2500);
    return () => clearTimeout(id);
  }, [error]);

  if (status === "notfound") {
    return (
      <main className="center-screen">
        <p>{t("notFound")}</p>
        <button className="btn btn-primary" onClick={leave}>{t("backHome")}</button>
      </main>
    );
  }
  if (!room) return <main className="center-screen"><div className="spinner" />{t("connecting")}</main>;

  return (
    <>
      {status !== "open" && <div className="conn-banner">{t("reconnecting")}</div>}
      {error && <div className="toast" role="alert">{error}</div>}
      {room.status === "lobby" ? (
        <Lobby room={room} send={send} leave={leave} voice={voice} />
      ) : (
        <Table room={room} send={send} leave={leave} clockOffset={clockOffset.current} openMatch={openMatch} voice={voice} />
      )}
    </>
  );
}
