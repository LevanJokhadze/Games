import { useState } from "react";
import { post, put, upload, useApi } from "../api";
import type { Campaign, TrendVideo } from "../types";
import { RemoveButton } from "../ui";

const EMPTY: Partial<Campaign> = {
  name: "",
  url: "",
  cpm: 1,
  min_payout: 0,
  max_payout: null,
  channels: [],
  game: "Grand Theft Auto VI",
  caption_template: "{hook}",
  captions: "word",
  title_secs: 5,
  target_secs: 18,
  teaser: true,
  punch_zoom: true,
  layout: "react",
  language: "en",
  geo: "",
  title_template: "{title}",
  daily_quota: 2,
  min_clip_views: 100,
  lookback_hours: 48,
  overlay_width: 600,
  overlay_y: 895,
  submit_window_minutes: 30,
  banner_url: null,
  banner_width: 1000,
  banner_key: "",
  bottom_urls: [],
  active: true,
};

export default function Campaigns() {
  const { data, error, reload } = useApi<Campaign[]>("/campaigns");
  const [adding, setAdding] = useState(false);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      {data.map((c) => (
        <CampaignForm key={c.id} initial={c} onSaved={reload} />
      ))}
      {adding ? (
        <CampaignForm
          initial={EMPTY}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
        />
      ) : (
        <button onClick={() => setAdding(true)}>+ Add campaign</button>
      )}
    </>
  );
}

function CampaignForm({ initial, onSaved }: { initial: Partial<Campaign>; onSaved: () => void }) {
  const [c, setC] = useState<Partial<Campaign>>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setC((x) => ({ ...x, [k]: v }));
  const text = (k: keyof Campaign, label: string, hint?: string) => (
    <label>
      {label}
      <input value={(c[k] as string) ?? ""} onChange={(e) => set(k, e.target.value as never)} />
      {hint && <span className="muted small">{hint}</span>}
    </label>
  );
  const number = (k: keyof Campaign, label: string) => (
    <label>
      {label}
      <input type="number" step="any" value={(c[k] as number) ?? ""} onChange={(e) => set(k, (e.target.value === "" ? null : Number(e.target.value)) as never)} />
    </label>
  );
  return (
    <form
      className="card form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          if (c.id) await put(`/campaigns/${c.id}`, c);
          else await post("/campaigns", c);
          setMsg("Saved");
          onSaved();
        } catch (err) {
          setMsg((err as Error).message);
        }
      }}
    >
      <div className="row between">
        <h2>
          {c.name || "New campaign"}{" "}
          {c.ended_at ? <span className="pill bad">Ended</span> : c.id && !c.active ? <span className="pill warn">Paused</span> : null}
        </h2>
        <label className="inline">
          <input
            type="checkbox"
            checked={!!c.active}
            onChange={(e) => setC((x) => ({ ...x, active: e.target.checked, ...(e.target.checked ? { ended_at: null, end_reason: null } : {}) }))}
          />{" "}
          Active
        </label>
      </div>
      {c.ended_at && (
        <p className="muted small">
          Ended {new Date(c.ended_at).toLocaleDateString()}
          {c.end_reason ? `: ${c.end_reason}` : ""} Its clips and posts are kept, and live posts are still counted at its current rate.
        </p>
      )}
      <div className="formgrid">
        {text("name", "Name", "Start with the streamer's name as written, e.g. “KreekCraft GTA 6 Clipping”")}
        {text("streamer_name", "Streamer name", "As written in titles, e.g. “Bobby VanRiper”")}
        {text("url", "Campaign page")}
        <label>
          Twitch channels
          <input value={(c.channels || []).join(", ")} onChange={(e) => set("channels", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
          <span className="muted small">Comma-separated logins, e.g. kreekcraft</span>
        </label>
        {text("game", "Game on Twitch", "Clips from other games are skipped; empty = any game")}
        <label>
          Language
          <select value={c.language || "en"} onChange={(e) => set("language", e.target.value)}>
            <option value="en">English</option>
            <option value="ru">Russian (titles, hooks and captions in Russian)</option>
          </select>
        </label>
        {text("geo", "Accounts geo", "Geo code from the Accounts page, e.g. RU: only that geo's accounts get these clips. Empty = the US accounts")}
        {number("cpm", "$ per 1K views")}
        {number("min_payout", "Minimum payout per clip ($)")}
        {number("max_payout", "Maximum payout per clip ($)")}
        {number("daily_quota", "Clips to cut per day")}
        {number("min_clip_views", "Min Twitch clip views")}
        {number("lookback_hours", "Only clips newer than (hours)")}
        {text("title_template", "Title template", "{title} is replaced by the AI title, e.g. “twitch: evelone2004 {title} #evelone”")}
        {text("caption_template", "Caption template", "{hook} is replaced by the clip's hook line")}
        <label>
          Captions on video
          <select value={c.captions || "word"} onChange={(e) => set("captions", e.target.value)}>
            <option value="word">Word by word</option>
            <option value="bubble">Bubble</option>
            <option value="none">None (stream already has captions)</option>
          </select>
        </label>
        <label>
          Layout
          <select value={c.layout || "react"} onChange={(e) => set("layout", e.target.value)}>
            <option value="react">Zoomed: webcam on top, gameplay below (softer)</option>
            <option value="blur">Whole stream frame on a blurred background (sharp)</option>
            <option value="split">Split screen: streamer on top, satisfying loop below</option>
          </select>
        </label>
        {text("overlay_url", "Logo overlay (PNG URL)", "Required by many campaigns; shown for the whole clip")}
        {number("overlay_width", "Overlay width (px of 1080)")}
        {number("overlay_y", "Overlay top (px of 1920)")}
        {text("cam_box", "Webcam box x:y:w:h (fractions)", "Empty = find the webcam automatically")}
        {number("title_secs", "Text hook shown for (seconds from 0:00)")}
        {number("target_secs", "Clip length around the payoff (seconds, 15-20 works best)")}
        <label className="inline">
          <input type="checkbox" checked={c.teaser !== false} onChange={(e) => set("teaser", e.target.checked)} /> Open with a 2 s teaser of the
          payoff, then play from the setup
        </label>
        <label className="inline">
          <input type="checkbox" checked={c.punch_zoom !== false} onChange={(e) => set("punch_zoom", e.target.checked)} /> Punch-in zoom on the
          payoff
        </label>
        {text("submit_url", "Submit page (auto-submit)", "Content Rewards page with the Submit button; empty = Campaign page")}
        {number("submit_window_minutes", "Submit within (minutes of going live)")}
        {text("whop_bounty_id", "Whop bounty id (optional)", "bnty_… if this campaign is on Whop's API; pick it under Auto-submit")}
      </div>
      <SplitAndBanner
        c={c}
        set={set}
        onUploaded={(k, url) => (k === "banner" ? set("banner_url", url) : set("bottom_urls", [...(c.bottom_urls || []), url]))}
      />
      <label>
        Campaign rules (notes)
        <textarea rows={6} value={c.rules || ""} onChange={(e) => set("rules", e.target.value)} />
      </label>
      <div className="row">
        <button className="primary">Save</button>
        {msg && <span className="muted">{msg}</span>}
        {c.id && (
          <RemoveButton path={`/campaigns/${c.id}`} what={`${c.name} with all its clips and posts`} onDone={onSaved} />
        )}
      </div>
    </form>
  );
}

function SplitAndBanner({
  c,
  set,
  onUploaded,
}: {
  c: Partial<Campaign>;
  set: <K extends keyof Campaign>(k: K, v: Campaign[K]) => void;
  onUploaded: (kind: "banner" | "bottom", url: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const send = async (kind: "banner" | "bottom", f: File | undefined) => {
    if (!f || !c.id) return;
    setBusy(kind);
    setErr(null);
    try {
      const r = await upload<{ url: string }>(`/campaigns/${c.id}/upload?kind=${kind}&name=${encodeURIComponent(f.name)}`, f);
      onUploaded(kind, r.url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="formgrid">
      <label>
        Sponsor banner video
        {c.banner_url ? (
          <span className="small">
            <a href={c.banner_url} target="_blank" rel="noreferrer">
              Current banner
            </a>{" "}
            <button type="button" onClick={() => set("banner_url", null)}>
              Remove
            </button>
          </span>
        ) : (
          <span className="muted small">No banner: clips have no sponsor ad</span>
        )}
        {c.id ? (
          <input type="file" accept=".mp4,.mov,.webm,video/*" disabled={!!busy} onChange={(e) => send("banner", e.target.files?.[0])} />
        ) : (
          <span className="muted small">Save the campaign first, then upload its banner</span>
        )}
        <span className="muted small">
          {busy === "banner"
            ? "Uploading…"
            : "Green-screen MP4 or MOV with transparency. Inserted 1 s before the payoff (never before 0:10), the clip pauses while it plays. Only accounts marked “Banner clips” get these clips."}
        </span>
      </label>
      <label>
        Banner width (px of 1080)
        <input type="number" value={c.banner_width ?? 0} onChange={(e) => set("banner_width", e.target.value === "" ? null : Number(e.target.value))} />
        <span className="muted small">0 = fit the banner’s artwork to the clip’s width (30%+ of the screen)</span>
      </label>
      <label>
        Banner key colour
        <input value={c.banner_key ?? ""} placeholder="automatic" onChange={(e) => set("banner_key", e.target.value)} />
        <span className="muted small">Empty = automatic; e.g. 0x00FF00, or “none” to keep the background</span>
      </label>
      <label>
        Bottom videos (split screen)
        <textarea
          rows={3}
          key={(c.bottom_urls || []).join("|")}
          defaultValue={(c.bottom_urls || []).join("\n")}
          onBlur={(e) => set("bottom_urls", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
        />
        {c.id && <input type="file" accept=".mp4,.mov,.webm,video/*" disabled={!!busy} onChange={(e) => send("bottom", e.target.files?.[0])} />}
        <span className="muted small">
          {busy === "bottom" ? "Uploading…" : "One link per line. Empty = the bottom video below"}
        </span>
      </label>
      <label>
        Bottom video (split screen)
        <select value={c.bottom_kind || "race"} onChange={(e) => set("bottom_kind", e.target.value)}>
          <option value="race">Ball race (made for each clip, the winner crosses the line at the end)</option>
          <option value="mix">Satisfying loops in turn</option>
          <option value="bounce">Bouncing balls</option>
          <option value="plinko">Plinko</option>
          <option value="pendulum">Pendulum wave</option>
        </select>
      </label>
      <label>
        Trending Shorts to re-cut (hashtags)
        <input
          key={(c.trend_tags || []).join("|")}
          defaultValue={(c.trend_tags || []).join(", ")}
          placeholder="evelone, buster, strogo"
          onBlur={(e) => set("trend_tags", e.target.value.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean))}
        />
        <span className="muted small">
          Every 4 h: the most-viewed Shorts (and Reels, with an Apify token) for these tags that nobody turned into a split screen
          yet are re-cut as split-screen clips into Review. Needs YOUTUBE_API_KEY.
        </span>
      </label>
      <label>
        Trending: at least this many views
        <input type="number" value={c.trend_min_views ?? 50000} onChange={(e) => set("trend_min_views", Number(e.target.value || 0))} />
      </label>
      {err && <p className="error">{err}</p>}
      {c.id && (c.trend_tags || []).length > 0 && <TrendList id={c.id} />}
    </div>
  );
}

const VERDICT: Record<string, string> = {
  new: "re-cut",
  split: "already a split screen",
  taken: "someone split-screened it",
  unchecked: "re-cut (not compared)",
};

function TrendList({ id }: { id: number }) {
  const { data, error } = useApi<TrendVideo[]>(`/campaigns/${id}/trends`);
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;
  return (
    <div className="span2">
      <h4>Trending Shorts checked</h4>
      {data.length === 0 ? (
        <p className="muted small">None yet: the first check runs within 15 minutes of an active campaign getting hashtags.</p>
      ) : (
        <table className="small">
          <thead>
            <tr>
              <th>Video</th>
              <th>Views</th>
              <th>Verdict</th>
              <th>Clip</th>
            </tr>
          </thead>
          <tbody>
            {data.map((t) => (
              <tr key={t.id}>
                <td>
                  <a href={t.url} target="_blank" rel="noreferrer">
                    {t.title || t.video_id}
                  </a>{" "}
                  <span className="muted">
                    #{t.tag} · {t.channel}
                  </span>
                </td>
                <td>{t.views?.toLocaleString()}</td>
                <td title={t.reason || ""}>
                  {VERDICT[t.verdict] || t.verdict}
                  {t.reason ? <div className="muted">{t.reason}</div> : null}
                </td>
                <td>{t.clip_id ? `#${t.clip_id}` : t.moment_status || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
