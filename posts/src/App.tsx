import { useEffect, useState } from "react";
import { getToken, post, setToken } from "./api";
import Overview from "./pages/Overview";
import Review from "./pages/Review";
import Posts from "./pages/Posts";
import AnalyticsPage from "./pages/Analytics";
import Moments from "./pages/Moments";
import Campaigns from "./pages/Campaigns";
import Accounts from "./pages/Accounts";
import SettingsPage from "./pages/Settings";

const PAGES = [
  { id: "overview", label: "Overview", el: <Overview /> },
  { id: "review", label: "Review", el: <Review /> },
  { id: "posts", label: "Posts", el: <Posts /> },
  { id: "accounts", label: "Accounts", el: <Accounts /> },
  { id: "analytics", label: "Analytics", el: <AnalyticsPage /> },
  { id: "moments", label: "Moments", el: <Moments /> },
  { id: "campaigns", label: "Campaigns", el: <Campaigns /> },
  { id: "settings", label: "Workers & settings", el: <SettingsPage /> },
];

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
  const current = PAGES.find((p) => p.id === page)!;
  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand">
          <span className="logo">▶</span> posts
        </div>
        {PAGES.map((p) => (
          <a key={p.id} href={`#${p.id}`} className={p.id === page ? "active" : ""}>
            {p.label}
          </a>
        ))}
        <button
          className="link logout"
          onClick={() => {
            setToken(null);
            setAuthed(false);
          }}
        >
          Log out
        </button>
      </nav>
      <main className="main" key={page}>
        <h1>{current.label}</h1>
        {current.el}
      </main>
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
        <div className="brand big">
          <span className="logo">▶</span> posts
        </div>
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
