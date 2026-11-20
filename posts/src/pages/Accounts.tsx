import { useEffect, useMemo, useState } from "react";
import { del, post, put, useApi } from "../api";
import { ago, num, SERVICE_COLOR } from "../format";
import type { Account, AccountsData, AccountStatus, BufferChannel, Geo, Platform } from "../types";

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
];

const STATUSES: { id: AccountStatus; label: string; pill: string }[] = [
  { id: "warming", label: "Warming up", pill: "warn" },
  { id: "active", label: "Active", pill: "ok" },
  { id: "paused", label: "Paused", pill: "" },
  { id: "banned", label: "Banned", pill: "bad" },
  { id: "retired", label: "Retired", pill: "" },
];

const GEO_KEY = "posts.accounts.geo";

function savedGeo(): number | null {
  try {
    return Number(localStorage.getItem(GEO_KEY)) || null;
  } catch {
    return null;
  }
}

/** Views, posts and likes come from the pipeline when the account is linked to a Buffer channel; followers are typed in. */
function stats(a: Account) {
  const p = a.pipeline;
  const posts = p ? p.posts : a.total_posts;
  const views = p ? p.views : a.total_views;
  return {
    followers: a.followers,
    views,
    posts,
    likes: p ? p.likes : a.total_likes,
    avg: posts && views != null ? Math.round(views / posts) : null,
  };
}

const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((t, x) => t + (x || 0), 0);

export default function Accounts() {
  const { data, error, reload } = useApi<AccountsData>("/accounts", 60000);
  const [geoId, setGeoId] = useState<number | null>(savedGeo);
  const [streamer, setStreamer] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Account> | null>(null);
  const [geoForm, setGeoForm] = useState<Partial<Geo> | null>(null);

  const geo = data?.geos.find((g) => g.id === geoId) || data?.geos[0] || null;
  useEffect(() => {
    if (!geo) return;
    try {
      localStorage.setItem(GEO_KEY, String(geo.id));
    } catch {
      /* storage unavailable */
    }
  }, [geo]);

  const inGeo = useMemo(() => (data && geo ? data.accounts.filter((a) => a.geo_id === geo.id) : []), [data, geo]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^@/, "");
    return inGeo.filter(
      (a) =>
        (!streamer || a.streamers.some((s) => s.toLowerCase() === streamer.toLowerCase())) &&
        (!q || a.handle.toLowerCase().includes(q) || (a.login || "").toLowerCase().includes(q) || (a.notes || "").toLowerCase().includes(q)),
    );
  }, [inGeo, streamer, search]);
  const geoStreamers = useMemo(() => {
    const seen = new Map<string, string>();
    inGeo.forEach((a) => a.streamers.forEach((s) => seen.set(s.toLowerCase(), seen.get(s.toLowerCase()) || s)));
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [inGeo]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const count = (g: Geo) => data.accounts.filter((a) => a.geo_id === g.id).length;
  const totals = inGeo.map(stats);
  const linkedIds = new Set(data.accounts.map((a) => a.buffer_channel_id).filter(Boolean));

  return (
    <>
      {!data.encryption_ready && (
        <div className="banner warn">
          Passwords can't be saved yet. Add the <code>ACCOUNTS_KEY</code> variable to the posts API service in Railway (a long random
          string, never changed afterwards). Everything else works without it.
        </div>
      )}

      <div className="tabs geotabs">
        {data.geos.map((g) => (
          <button
            key={g.id}
            className={g.id === geo?.id ? "active" : ""}
            onClick={() => {
              setGeoId(g.id);
              setStreamer("");
            }}
          >
            <b>{g.code}</b> {g.name} <span className="count">{count(g)}</span>
          </button>
        ))}
        <button onClick={() => setGeoForm({ code: "", name: "" })}>+ Add geo</button>
      </div>

      {geoForm && (
        <GeoForm
          initial={geoForm}
          onClose={() => setGeoForm(null)}
          onSaved={(g) => {
            setGeoForm(null);
            if (g) setGeoId(g.id);
            reload();
          }}
        />
      )}

      {!geo ? (
        <p className="muted">Add a geo to start, for example US.</p>
      ) : (
        <>
          <div className="row between geohead">
            <div>
              <h2 className="geotitle">
                {geo.name} <span className="muted">· {geo.code}</span>
              </h2>
            </div>
            <div className="row nomargin">
              <button onClick={() => setGeoForm(geo)}>Edit geo</button>
            </div>
          </div>

          <div className="kpis">
            <Kpi label="Accounts" value={num(inGeo.length)} hint={`${inGeo.filter((a) => a.status === "active").length} active · ${inGeo.filter((a) => a.status === "warming").length} warming up`} />
            <Kpi label="Followers" value={num(sum(totals.map((t) => t.followers)))} />
            <Kpi label="Views" value={num(sum(totals.map((t) => t.views)))} hint={`${num(sum(inGeo.map((a) => a.pipeline?.views_7d)))} in the last 7 days`} />
            <Kpi label="Posts" value={num(sum(totals.map((t) => t.posts)))} hint={`${sum(inGeo.map((a) => a.pipeline?.paying))} over the campaign minimum`} />
          </div>

          {inGeo.length > 0 && (
            <div className="row wrap filters">
              <input className="search" placeholder="Search handle, login or notes" value={search} onChange={(e) => setSearch(e.target.value)} />
              {geoStreamers.length > 0 && (
                <div className="chips">
                  <button className={`chip ${streamer ? "" : "active"}`} onClick={() => setStreamer("")}>
                    All streamers
                  </button>
                  {geoStreamers.map((s) => (
                    <button key={s} className={`chip ${streamer === s ? "active" : ""}`} onClick={() => setStreamer(streamer === s ? "" : s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {PLATFORMS.map((p) => {
            const list = shown.filter((a) => a.platform === p.id);
            const all = inGeo.filter((a) => a.platform === p.id).length;
            return (
              <section key={p.id} className="card platform">
                <div className="row between">
                  <h2 className="platform-title">
                    <i style={{ background: SERVICE_COLOR[p.id] }} />
                    {p.label}
                    <span className="count">{all}</span>
                  </h2>
                  <button onClick={() => setEditing({ geo_id: geo.id, platform: p.id, status: "warming", streamers: [] })}>
                    + Add account
                  </button>
                </div>
                {list.length === 0 ? (
                  <p className="muted small empty">
                    {all ? "No account matches the filter." : `No ${p.label} accounts in ${geo.name} yet.`}
                  </p>
                ) : (
                  <div className="accounts">
                    {list.map((a) => (
                      <AccountCard
                        key={a.id}
                        a={a}
                        channel={data.buffer_channels.find((c) => c.id === a.buffer_channel_id)}
                        onEdit={() => setEditing(a)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}

      {editing && (
        <AccountForm
          initial={editing}
          geos={data.geos}
          channels={data.buffer_channels.filter((c) => !linkedIds.has(c.id) || c.id === editing.buffer_channel_id)}
          streamers={data.streamers}
          canSavePassword={data.encryption_ready}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

function copy(text: string) {
  return navigator.clipboard?.writeText(text);
}

function AccountCard({ a, channel, onEdit }: { a: Account; channel?: BufferChannel; onEdit: () => void }) {
  const s = stats(a);
  const status = STATUSES.find((x) => x.id === a.status) || STATUSES[0];
  return (
    <article className="account">
      <div className="row between">
        <div className="handle">
          {a.profile_url ? (
            <a href={a.profile_url} target="_blank" rel="noreferrer">
              @{a.handle}
            </a>
          ) : (
            <span>@{a.handle}</span>
          )}
        </div>
        <div className="row nomargin">
          <span className={`pill ${status.pill}`}>{status.label}</span>
          <button className="link small" onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>

      {a.streamers.length > 0 && (
        <div className="chips">
          {a.streamers.map((x) => (
            <span key={x} className="chip static">
              {x}
            </span>
          ))}
        </div>
      )}

      <dl className="creds">
        <dt>Login</dt>
        <dd>
          {a.login ? (
            <>
              <span className="mono ellipsis">{a.login}</span>
              <CopyButton text={a.login} />
            </>
          ) : (
            <span className="muted">–</span>
          )}
        </dd>
        <dt>Password</dt>
        <dd>{a.has_password ? <Password id={a.id} /> : <span className="muted">not saved</span>}</dd>
      </dl>

      <div className="astats">
        <Stat label="Followers" value={s.followers} />
        <Stat label="Views" value={s.views} />
        <Stat label="Posts" value={s.posts} />
        <Stat label="Avg / post" value={s.avg} />
      </div>

      <div className="muted small">
        {a.pipeline ? (
          <>
            Views and posts from the pipeline (Buffer: {channel?.name || "channel"})
            {a.pipeline.scheduled > 0 && ` · ${a.pipeline.scheduled} scheduled`}
            {a.pipeline.failed > 0 && ` · ${a.pipeline.failed} failed`}
            {a.pipeline.last_post_at && ` · last post ${ago(a.pipeline.last_post_at)}`}
            {a.stats_at && ` · followers updated ${ago(a.stats_at)}`}
          </>
        ) : a.stats_at ? (
          `Typed in, updated ${ago(a.stats_at)}`
        ) : (
          "Not linked to Buffer. Add stats by hand under Edit."
        )}
      </div>
      {a.notes && <p className="notes small">{a.notes}</p>}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div>
      <div className="kpi-label">{label}</div>
      <b>{num(value)}</b>
    </div>
  );
}

function CopyButton({ text, get }: { text?: string; get?: () => Promise<string> }) {
  const [done, setDone] = useState<string | null>(null);
  return (
    <button
      className="link small"
      onClick={async () => {
        try {
          await copy(text ?? (await get!()));
          setDone("copied");
        } catch (e) {
          setDone((e as Error).message || "failed");
        }
        setTimeout(() => setDone(null), 1500);
      }}
    >
      {done || "copy"}
    </button>
  );
}

/** Masked until "show"; the password is fetched on demand and hidden again after 20 seconds. */
function Password({ id }: { id: number }) {
  const [pw, setPw] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!pw) return;
    const t = setTimeout(() => setPw(null), 20000);
    return () => clearTimeout(t);
  }, [pw]);
  const fetchPw = async () => (await post<{ password: string }>(`/accounts/${id}/reveal`)).password;
  return (
    <>
      <span className="mono ellipsis">{pw ?? "••••••••••"}</span>
      <button
        className="link small"
        onClick={async () => {
          if (pw) return setPw(null);
          try {
            setErr(null);
            setPw(await fetchPw());
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        {pw ? "hide" : "show"}
      </button>
      <CopyButton get={fetchPw} />
      {err && <span className="error small">{err}</span>}
    </>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between">
          <h2>{title}</h2>
          <button className="link" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function GeoForm({ initial, onClose, onSaved }: { initial: Partial<Geo>; onClose: () => void; onSaved: (g: Geo | null) => void }) {
  const [g, setG] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<Geo | null>) => {
    setBusy(true);
    setErr(null);
    try {
      onSaved(await fn());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={g.id ? `Edit ${initial.name}` : "Add geo"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => (g.id ? put<Geo>(`/geos/${g.id}`, g) : post<Geo>("/geos", g)));
        }}
      >
        <div className="formgrid two">
          <label>
            Code
            <input value={g.code || ""} maxLength={8} placeholder="UK" onChange={(e) => setG({ ...g, code: e.target.value.toUpperCase() })} autoFocus />
          </label>
          <label>
            Name
            <input value={g.name || ""} placeholder="United Kingdom" onChange={(e) => setG({ ...g, name: e.target.value })} />
          </label>
        </div>
        {err && <p className="error">{err}</p>}
        <div className="row between">
          <button className="primary" disabled={busy || (g.code || "").length < 2 || !g.name}>
            Save
          </button>
          {g.id && (
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => confirm(`Delete geo ${initial.name}?`) && run(() => del(`/geos/${g.id}`).then(() => null))}
            >
              Delete geo
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function AccountForm({
  initial,
  geos,
  channels,
  streamers,
  canSavePassword,
  onClose,
  onSaved,
}: {
  initial: Partial<Account>;
  geos: Geo[];
  channels: BufferChannel[];
  streamers: string[];
  canSavePassword: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [a, setA] = useState<Partial<Account>>(initial);
  // undefined = keep the saved password; "" with clear = remove it
  const [password, setPassword] = useState("");
  const [clearPw, setClearPw] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [tag, setTag] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Account>(k: K, v: Account[K] | null) => setA((x) => ({ ...x, [k]: v }));
  const tags = a.streamers || [];
  const addTag = (t: string) => {
    const v = t.trim().replace(/,$/, "");
    if (v && !tags.some((x) => x.toLowerCase() === v.toLowerCase())) set("streamers", [...tags, v]);
    setTag("");
  };
  const platformChannels = channels.filter((c) => !c.service || c.service === a.platform);
  const number = (k: "followers" | "total_views" | "total_posts" | "total_likes", label: string, fromPipeline = false) => (
    <label>
      {label}
      <input
        type="number"
        min={0}
        value={a[k] ?? ""}
        disabled={fromPipeline}
        placeholder={fromPipeline ? "from the pipeline" : ""}
        onChange={(e) => set(k, e.target.value === "" ? null : Number(e.target.value))}
      />
    </label>
  );
  const linked = !!a.buffer_channel_id;
  const label = PLATFORMS.find((p) => p.id === a.platform)?.label;

  return (
    <Modal title={a.id ? `Edit @${initial.handle}` : `Add ${label} account`} onClose={onClose}>
      <form
        className="form"
        autoComplete="off"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          const pending = tag.trim() ? [...tags, tag.trim()] : tags;
          const body = { ...a, streamers: pending, password: clearPw ? "" : password ? password : a.id ? null : undefined };
          try {
            if (a.id) await put(`/accounts/${a.id}`, body);
            else await post("/accounts", body);
            onSaved();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="formgrid two">
          <label>
            Handle
            <input value={a.handle || ""} placeholder="@username" onChange={(e) => set("handle", e.target.value)} autoFocus />
          </label>
          <label>
            Status
            <select value={a.status} onChange={(e) => set("status", e.target.value as AccountStatus)}>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Geo
            <select value={a.geo_id} onChange={(e) => set("geo_id", Number(e.target.value))}>
              {geos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} · {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Platform
            <select value={a.platform} onChange={(e) => setA({ ...a, platform: e.target.value as Platform, buffer_channel_id: null })}>
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h3>Sign-in</h3>
        <div className="formgrid two">
          <label>
            Login (email, phone or username)
            <input value={a.login || ""} autoComplete="off" onChange={(e) => set("login", e.target.value)} />
          </label>
          <label>
            Password
            <div className="inputrow">
              <input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                disabled={!canSavePassword || clearPw}
                placeholder={!canSavePassword ? "needs ACCOUNTS_KEY on the server" : a.has_password ? "saved · type to replace" : ""}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} disabled={!password}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            {a.has_password && (
              <span className="checkline small">
                <input type="checkbox" checked={clearPw} onChange={(e) => setClearPw(e.target.checked)} /> Remove the saved password
              </span>
            )}
          </label>
          <label className="span2">
            Profile link
            <input value={a.profile_url || ""} placeholder="https://" onChange={(e) => set("profile_url", e.target.value)} />
          </label>
        </div>

        <h3>Streamers it targets</h3>
        <div className="tagbox">
          {tags.map((t) => (
            <span key={t} className="chip">
              {t}
              <button type="button" className="x" aria-label={`Remove ${t}`} onClick={() => set("streamers", tags.filter((x) => x !== t))}>
                ✕
              </button>
            </span>
          ))}
          <input
            list="streamer-options"
            value={tag}
            placeholder={tags.length ? "Add another" : "e.g. KreekCraft"}
            onChange={(e) => (e.target.value.endsWith(",") ? addTag(e.target.value) : setTag(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(tag);
              } else if (e.key === "Backspace" && !tag && tags.length) set("streamers", tags.slice(0, -1));
            }}
          />
          <datalist id="streamer-options">
            {streamers
              .filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()))
              .map((s) => (
                <option key={s} value={s} />
              ))}
          </datalist>
        </div>

        <h3>Stats</h3>
        <label>
          Buffer channel
          <select value={a.buffer_channel_id || ""} onChange={(e) => set("buffer_channel_id", e.target.value || null)}>
            <option value="">Not linked (type stats by hand)</option>
            {platformChannels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.id}
                {c.connected ? "" : " (no longer in Buffer)"}
              </option>
            ))}
          </select>
          <span className="muted small">Linked accounts get views, posts and likes from the clips the pipeline posted.</span>
        </label>
        <div className="formgrid four">
          {number("followers", "Followers")}
          {number("total_views", "Views", linked)}
          {number("total_posts", "Posts", linked)}
          {number("total_likes", "Likes", linked)}
        </div>

        <label>
          Notes
          <textarea rows={3} value={a.notes || ""} placeholder="VPN server, recovery email, warm-up progress…" onChange={(e) => set("notes", e.target.value)} />
        </label>

        {err && <p className="error">{err}</p>}
        <div className="row between">
          <button className="primary" disabled={busy || !a.handle?.trim()}>
            {busy ? "Saving…" : "Save"}
          </button>
          {a.id && (
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={async () => {
                if (!confirm(`Delete @${initial.handle}? Its saved login and password are removed too.`)) return;
                try {
                  await del(`/accounts/${a.id}`);
                  onSaved();
                } catch (e) {
                  setErr((e as Error).message);
                }
              }}
            >
              Delete account
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
