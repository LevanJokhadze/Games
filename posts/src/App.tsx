import { useEffect, useState } from "react";
import { getToken, post, setToken } from "./api";
import Overview from "./pages/Overview";
import Review from "./pages/Review";
import Posts from "./pages/Posts";
import AnalyticsPage from "./pages/Analytics";
import Moments from "./pages/Moments";
import Campaigns from "./pages/Campaigns";
import Accounts from "./pages/Accounts";
import Calendar from "./pages/Calendar";
import SettingsPage from "./pages/Settings";
import { JarvisCards, JarvisDock, JarvisModalView, Orb } from "./jarvis/Jarvis";
import { jarvis, useJarvis } from "./jarvis/live";

// icon paths (24px stroke icons, drawn inline)
const ICON: Record<string, string> = {
  overview: "M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z",
  calendar: "M4 6.5h16v13H4zM4 10.5h16M8.5 4v4M15.5 4v4",
  review: "M5 12.5l4.5 4.5L19 7.5",
  posts: "M3.5 5h17v14h-17zM10.4 9.4l4.6 2.6-4.6 2.6z",
  accounts: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
  analytics: "M5 19V11M10 19V5M15 19v-6M20 19V9",
  moments: "M12 3c1 3 4.5 4.6 4.5 8.8a4.5 4.5 0 0 1-9 0c0-1.6.6-2.8 1.5-3.6.2 1.3.8 2 1.6 2.3C10.4 8.2 11 5.6 12 3z",
  campaigns: "M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
};

const PAGES = [
  { id: "overview", label: "Overview", group: "Today", el: <Overview /> },
  { id: "calendar", label: "Calendar", group: "Today", el: <Calendar /> },
  { id: "review", label: "Review", group: "Today", el: <Review /> },
  { id: "posts", label: "Posts", group: "Content", el: <Posts /> },
  { id: "moments", label: "Moments", group: "Content", el: <Moments /> },
  { id: "accounts", label: "Accounts", group: "Growth", el: <Accounts /> },
  { id: "analytics", label: "Analytics", group: "Growth", el: <AnalyticsPage /> },
  { id: "campaigns", label: "Campaigns", group: "Growth", el: <Campaigns /> },
  { id: "settings", label: "Workers & settings", group: "System", el: <SettingsPage /> },
];
const GROUPS = ["Today", "Content", "Growth", "System"];

function Icon({ id }: { id: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON[id]} />
    </svg>
  );
}

/** The lime "rising V" mark from the design, with the product name. */
function Brand({ big }: { big?: boolean }) {
  return (
    <span className={`brand${big ? " big" : ""}`}>
      <svg viewBox="0 0 48 48" width={big ? 40 : 34} height={big ? 40 : 34} aria-hidden="true">
        <rect width="48" height="48" rx="13" fill="#C8FF4D" />
        <path d="M10.5 19.5l9 14.5L37 13" fill="none" stroke="#0A0A0B" strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M27.5 12.2h10.3v10.3" fill="none" stroke="#0A0A0B" strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      posts
    </span>
  );
}

function pageFromHash() {
  const h = location.hash.replace("#", "");
  return PAGES.some((p) => p.id === h) ? h : "overview";
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [page, setPage] = useState(pageFromHash);

  useEffect(() => {
    const out = () => setAuthed(false);
    const hash = () => setPage(pageFromHash());
    window.addEventListener("posts:logout", out);
    window.addEventListener("hashchange", hash);
    return () => {
      window.removeEventListener("posts:logout", out);
      window.removeEventListener("hashchange", hash);
    };
  }, []);

  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return <Shell page={page} />;
}

function Shell({ page }: { page: string }) {
  const j = useJarvis();
  const [bump, setBump] = useState(0);
  useEffect(() => {
    // Jarvis changed something (marked submitted, approved a clip): show it
    const changed = () => setBump((b) => b + 1);
    window.addEventListener("posts:changed", changed);
    return () => window.removeEventListener("posts:changed", changed);
  }, []);
  const current = PAGES.find((p) => p.id === page)!;
  return (
    <div className="shell">
      <aside className="nav">
        <a href="#overview" className="brandlink" aria-label="posts, overview">
          <Brand />
        </a>
        <nav aria-label="Main">
          {GROUPS.map((g) => (
            <div key={g} className="navgroup">
              <span className="navlabel">{g}</span>
              {PAGES.filter((p) => p.group === g).map((p) => (
                <a key={p.id} href={`#${p.id}`} className={p.id === page ? "active" : ""} aria-current={p.id === page ? "page" : undefined}>
                  <Icon id={p.id} />
                  {p.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="nav-promo">
          <Orb state={j.state} size={40} />
          <b>Jarvis knows every account, video and slot.</b>
          <span>Ask what to post next, what's stuck at 0 views, or to open an upload page.</span>
          <button className="link" onClick={() => (j.on ? j.setPanel(true) : void j.start())}>
            {j.on ? "Open Jarvis" : "Start a session"} →
          </button>
        </div>
        <button
          className="link logout"
          onClick={() => {
            jarvis.stop();
            setToken(null);
            window.dispatchEvent(new Event("posts:logout"));
          }}
        >
          Log out
        </button>
      </aside>
      <div className="content">
        <header className="topbar">
          <h1>{current.label}</h1>
          <div className="spacer" />
          <button className={`jarvis-pill ${j.state}`} onClick={() => (j.on ? j.setPanel(!j.panelOpen) : void j.start())}>
            <Orb state={j.state} size={30} />
            {j.on ? (j.state === "speaking" ? "Jarvis is talking" : "Jarvis is listening") : "Ask Jarvis"}
          </button>
        </header>
        <main className="main" key={`${page}-${bump}`}>
          <JarvisCards />
          {current.el}
        </main>
      </div>
      <JarvisDock />
      <JarvisModalView />
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            const r = await post<{ token: string }>("/login", { password: pw });
            setToken(r.token);
            onDone();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Brand big />
        <p className="muted">Clip pipeline dashboard</p>
        <label>
          Password
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="primary" disabled={busy || !pw}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
