import { useEffect, useMemo, useRef, useState } from "react";
import { useRoom } from "./api";
import { Home } from "./components/Home";
import { Lobby } from "./components/Lobby";
import { Table } from "./components/Table";
import { Lang, LangContext, makeT, useI18n } from "./i18n";

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

function parseHash(): string | null {
  const m = location.hash.match(/^#\/room\/([A-Za-z0-9]{5})$/);
  return m ? m[1].toUpperCase() : null;
}

export function App() {
  const [lang, setLangState] = useState<Lang>(() => (load("joker.lang", "ka") === "en" ? "en" : "ka"));
  const [name, setNameState] = useState(() => load("joker.name", ""));
  const [code, setCode] = useState<string | null>(parseHash);
  const autostart = useRef(false);

  const setLang = (l: Lang) => {
    setLangState(l);
    store("joker.lang", l);
    document.documentElement.lang = l;
  };
  const setName = (n: string) => {
    setNameState(n);
    store("joker.name", n);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    const onHash = () => setCode(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (c: string, start = false) => {
    autostart.current = start;
    location.hash = `#/room/${c}`;
    setCode(c);
  };
  const leave = () => {
    history.pushState(null, "", location.pathname);
    setCode(null);
  };

  const ctx = useMemo(() => ({ lang, t: makeT(lang), setLang }), [lang]);

  return (
    <LangContext.Provider value={ctx}>
      <div className="app">
        <LangToggle />
        {code ? (
          <RoomScreen key={code} code={code} name={name.trim() || (lang === "ka" ? "მოთამაშე" : "Player")} leave={leave} autostart={autostart} />
        ) : (
          <Home name={name} setName={setName} go={go} />
        )}
      </div>
    </LangContext.Provider>
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

function RoomScreen({ code, name, leave, autostart }: { code: string; name: string; leave: () => void; autostart: React.MutableRefObject<boolean> }) {
  const { t } = useI18n();
  const { room, status, error, clearError, send, clockOffset } = useRoom(code, name);

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
        <Lobby room={room} send={send} leave={leave} />
      ) : (
        <Table room={room} send={send} leave={leave} clockOffset={clockOffset.current} />
      )}
    </>
  );
}
