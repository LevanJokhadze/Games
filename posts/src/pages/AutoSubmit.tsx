import { useState } from "react";
import { api, del, post, put, useApi } from "../api";
import { ago } from "../format";
import type { SubmitStatus, WhopBounty } from "../types";

const METHOD_LABEL: Record<string, string> = {
  api: "Whop API (official)",
  browser: "Browser on the server (Content Rewards page)",
  agent: "Outside helper (laptop or server with Claude)",
};

/** Auto-submit live post links to Content Rewards: switch, methods and the sign-ins each method needs. */
export default function AutoSubmit() {
  const { data: s, error, reload } = useApi<SubmitStatus>("/submit/status", 30000);
  const [msg, setMsg] = useState<string | null>(null);
  const [cookies, setCookies] = useState("");
  const [storage, setStorage] = useState("");
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; error?: string; screenshot?: string | null } | null>(null);
  const [bounties, setBounties] = useState<WhopBounty[] | null>(null);
  const [query, setQuery] = useState("KreekCraft");

  if (error) return <section className="card"><p className="error">{error}</p></section>;
  if (!s) return <section className="card"><p className="muted">Loading…</p></section>;

  const save = async (patch: { auto_submit?: boolean; methods?: string[] }) => {
    try {
      await put("/submit/settings", patch);
      setMsg("Saved");
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const toggleMethod = (m: string, on: boolean) => {
    const order = ["api", "browser", "agent"];
    const next = order.filter((x) => (x === m ? on : s.methods.includes(x)));
    save({ methods: next });
  };
  const ready = (m: string) =>
    m === "api" ? s.whop.connected : m === "browser" ? s.browser.installed && s.browser.session : s.agent.configured;
  const anyReady = s.methods.some(ready);

  return (
    <section className="card form">
      <h2>Auto-submit to Content Rewards</h2>
      <p className="muted small">
        Each live post link is submitted to its campaign within 30 minutes, day and night. Methods are tried in this order
        until one works. If all fail you get an email right away with the link and the deadline.
      </p>
      <label className="inline">
        <input type="checkbox" checked={s.auto_submit} onChange={(e) => save({ auto_submit: e.target.checked })} /> Auto-submit
        posts that go live from now on
      </label>
      {s.auto_submit && !anyReady && (
        <p className="error small">No method is ready yet, so every post will email you to submit by hand. Set one up below.</p>
      )}
      {!s.vault && <p className="error small">Add ACCOUNTS_KEY on the server first: it encrypts the sign-ins below.</p>}
      <ul className="postlist">
        {["api", "browser", "agent"].map((m) => (
          <li key={m}>
            <label className="inline">
              <input type="checkbox" checked={s.methods.includes(m)} onChange={(e) => toggleMethod(m, e.target.checked)} />{" "}
              {METHOD_LABEL[m]}{" "}
              <span className={`pill ${ready(m) ? "ok" : ""}`}>{ready(m) ? "ready" : "not set up"}</span>
            </label>
          </li>
        ))}
      </ul>

      <h3>Browser on the server</h3>
      {!s.browser.installed ? (
        <p className="muted small">The headless browser isn't in this build (WITH_BROWSER=0).</p>
      ) : (
        <>
          <p className="muted small">
            {s.browser.session
              ? `Session saved ${s.browser.saved_at ? ago(s.browser.saved_at) : ""}.`
              : "No session yet."}{" "}
            {s.browser.check &&
              (s.browser.check.ok ? (
                <span className="pill ok">last check ok {ago(new Date(s.browser.check.at * 1000).toISOString())}</span>
              ) : (
                <span className="error">
                  Last check failed: {s.browser.check.error}{" "}
                  {s.browser.check.screenshot && (
                    <a href={s.browser.check.screenshot} target="_blank" rel="noreferrer">
                      screenshot
                    </a>
                  )}
                </span>
              ))}
          </p>
          <details>
            <summary>{s.browser.session ? "Replace the session" : "Add the session"} (2 minutes, on your laptop)</summary>
            <ol className="small">
              <li>In Chrome, sign in at contentrewards.com (the same account you submit with).</li>
              <li>
                Install the “Cookie-Editor” extension, open it on contentrewards.com, press Export → JSON, and paste below.
              </li>
              <li>
                Optional, if the test says you are signed out: on contentrewards.com press F12 → Console, run{" "}
                <code>copy(JSON.stringify(localStorage))</code> and paste into the second box.
              </li>
            </ol>
            <label>
              Cookies (JSON)
              <textarea rows={4} value={cookies} onChange={(e) => setCookies(e.target.value)} placeholder='[{"name": "...", ...}]' />
            </label>
            <label>
              localStorage (optional JSON)
              <textarea rows={2} value={storage} onChange={(e) => setStorage(e.target.value)} placeholder="{}" />
            </label>
            <button
              onClick={async () => {
                try {
                  const c = JSON.parse(cookies);
                  const ls = storage.trim() ? JSON.parse(storage) : undefined;
                  const r = await post<{ cookies: number }>("/submit/browser-session", {
                    cookies: c,
                    local_storage: ls,
                    origin: "https://contentrewards.com",
                  });
                  setCookies("");
                  setStorage("");
                  setMsg(`Session saved (${r.cookies} cookies). Press “Test” to check it.`);
                  reload();
                } catch (e) {
                  setMsg(e instanceof SyntaxError ? "That isn't valid JSON" : (e as Error).message);
                }
              }}
            >
              Save session
            </button>
          </details>
          <div className="row">
            <button
              disabled={!s.browser.session || testing}
              onClick={async () => {
                setTesting(true);
                setTest(null);
                try {
                  setTest(await post("/submit/browser-test"));
                } catch (e) {
                  setTest({ ok: false, error: (e as Error).message });
                }
                setTesting(false);
                reload();
              }}
            >
              {testing ? "Testing… (up to a minute)" : "Test: open the submit form without submitting"}
            </button>
            {s.browser.session && (
              <button
                className="link small"
                onClick={async () => {
                  await del("/submit/browser-session");
                  reload();
                }}
              >
                remove session
              </button>
            )}
          </div>
          {test && (
            <p className={test.ok ? "small" : "error small"}>
              {test.ok ? "Works: signed in and the submit form opened." : test.error}{" "}
              {test.screenshot && (
                <a href={test.screenshot} target="_blank" rel="noreferrer">
                  screenshot
                </a>
              )}
            </p>
          )}
        </>
      )}

      <h3>Whop API</h3>
      {!s.whop.configured ? (
        <p className="muted small">
          Needs a Whop app: WHOP_CLIENT_ID and WHOP_CLIENT_SECRET on the server
          {s.whop.redirect_uri ? <>, with redirect URI <code>{s.whop.redirect_uri}</code></> : ", and PUBLIC_API_URL"}.
        </p>
      ) : s.whop.connected ? (
        <>
          <p className="small">
            Connected {s.whop.connected_at ? ago(s.whop.connected_at) : ""}.{" "}
            <button
              className="link small"
              onClick={async () => {
                await post("/whop/disconnect");
                reload();
              }}
            >
              disconnect
            </button>
          </p>
          <div className="row">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search campaigns" />
            <button
              onClick={async () => {
                try {
                  const r = await api<{ bounties: WhopBounty[] }>(`/whop/bounties?query=${encodeURIComponent(query)}`);
                  setBounties(r.bounties);
                } catch (e) {
                  setMsg((e as Error).message);
                }
              }}
            >
              Find the campaign on Whop
            </button>
          </div>
          {bounties && (
            <ul className="postlist small">
              {bounties.length === 0 && <li className="muted">Nothing found: this campaign isn't on Whop's API, use the browser.</li>}
              {bounties.map((b) => (
                <li key={b.id}>
                  <code>{b.id}</code> {b.title} <span className="muted">{[b.host, b.goal, b.status].filter(Boolean).join(" · ")}</span>{" "}
                  <button className="link small" onClick={() => navigator.clipboard?.writeText(b.id)}>
                    copy id
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">Paste the id into the campaign's “Whop bounty id” on the Campaigns page.</p>
        </>
      ) : (
        <button
          onClick={async () => {
            try {
              const r = await api<{ url: string }>("/whop/connect");
              location.href = r.url;
            } catch (e) {
              setMsg((e as Error).message);
            }
          }}
        >
          Connect Whop
        </button>
      )}

      <h3>Outside helper</h3>
      <p className="muted small">
        {s.agent.configured
          ? "Ready: a laptop or server running Claude with a browser can take jobs from /api/agent/submissions (see the README)."
          : "Add SUBMIT_AGENT_TOKEN on the server to let a laptop or server running Claude with a browser take jobs."}
      </p>
      {msg && <p className="muted">{msg}</p>}
    </section>
  );
}
