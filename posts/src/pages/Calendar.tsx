import { useEffect, useState } from "react";
import { post, useApi } from "../api";
import { SERVICE_COLOR } from "../format";
import { CopyButton, Modal, RemoveButton, RerenderButton } from "../ui";
import type { CalendarData, CalendarEvent } from "../types";

/** Everything on this page is in Tbilisi time (UTC+4, no daylight saving), whatever the device's zone. */
const TZ = "Asia/Tbilisi";
const VIEW_KEY = "posts.calendar.view";
const PLATFORM: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };
const STATUS: Record<string, { label: string; pill: string }> = {
  planned: { label: "Upcoming", pill: "warn" },
  to_upload: { label: "Emailed: upload it", pill: "warn" },
  done: { label: "Uploaded", pill: "ok" },
  posted: { label: "Posted", pill: "ok" },
  scheduled: { label: "Scheduled", pill: "" },
  sending: { label: "Sending", pill: "" },
  sent: { label: "Live", pill: "ok" },
  error: { label: "Failed", pill: "bad" },
};

type View = "week" | "day";

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "day" ? "day" : "week";
  } catch {
    return "week";
  }
}

// Calendar dates are plain YYYY-MM-DD strings; arithmetic is done at UTC noon so no zone can shift the day.
const toDate = (d: string) => new Date(`${d}T12:00:00Z`);
const fromDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => fromDate(new Date(toDate(d).getTime() + n * 86400000));
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => toDate(d).toLocaleDateString("en-GB", { timeZone: "UTC", ...o });
const todayTbilisi = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

function inMinutes(iso: string): string {
  const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (m < -1) return `${Math.abs(m) < 60 ? `${-m} min` : `${Math.round(-m / 60)} h`} ago`;
  if (m <= 1) return "now";
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `in ${h} h ${m % 60} min` : `in ${Math.round(h / 24)} d`;
}

const label = (e: CalendarEvent) => `${PLATFORM[e.platform] || e.platform}${e.handle ? ` @${e.handle}` : ""}`;
const isOpen = (e: CalendarEvent) => e.kind === "manual" && (e.status === "planned" || e.status === "to_upload");

export default function Calendar() {
  const [view, setView] = useState<View>(savedView);
  const [anchor, setAnchor] = useState(todayTbilisi);
  const [picked, setPicked] = useState<CalendarEvent | null>(null);
  // the week view is the 7 days from the chosen day, so "Today" always shows what's coming up
  const start = anchor;
  const days = view === "week" ? 7 : 1;
  const { data, error, reload } = useApi<CalendarData>(`/calendar?start=${start}&days=${days}`, 60000);
  const next = useApi<CalendarData>(`/calendar?days=3`, 60000).data;

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* storage unavailable */
    }
  }, [view]);

  const today = data?.today || todayTbilisi();
  const upcoming = next?.events.filter((e) => isOpen(e) && new Date(e.at).getTime() > Date.now() - 50 * 60000) || [];
  const range =
    view === "week"
      ? `${fmt(start, { day: "numeric", month: "short" })} – ${fmt(addDays(start, 6), { day: "numeric", month: "short", year: "numeric" })}`
      : fmt(start, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <p className="muted">
        When to post, in Tbilisi time. Each dot's colour is the platform. <b>Orange</b> items are yours to upload by hand (you also get an email 10 minutes before);
        grey items are posted by Buffer on their own. Click an item for the video and caption.
        {data && data.slots_local.length > 0 && <> Today's slots: {data.slots_local.join(", ")} Tbilisi.</>}
      </p>
      {data?.plan && <PlanLine plan={data.plan} />}

      {data && !data.email_ready && data.manual_accounts > 0 && (
        <div className="banner warn">Email isn't set up on the server, so no reminder emails go out. Follow this calendar instead.</div>
      )}

      {upcoming[0] && (
        <button className="card cal-next" onClick={() => setPicked(upcoming[0])}>
          <span className="kpi-label">Next upload by hand</span>
          <span>
            <b>
              {fmt(upcoming[0].day, { weekday: "short", day: "numeric", month: "short" })}, {upcoming[0].time}
            </b>{" "}
            <span className="muted">({inMinutes(upcoming[0].at)})</span> · {label(upcoming[0])}
            {upcoming[0].title && <span className="muted"> · {upcoming[0].title}</span>}
          </span>
        </button>
      )}

      <div className="row between cal-bar">
        <div className="row nomargin">
          <button onClick={() => setAnchor(addDays(anchor, view === "week" ? -7 : -1))} aria-label="Previous">
            ‹
          </button>
          <button onClick={() => setAnchor(todayTbilisi())}>Today</button>
          <button onClick={() => setAnchor(addDays(anchor, view === "week" ? 7 : 1))} aria-label="Next">
            ›
          </button>
          <b className="cal-range">{range}</b>
        </div>
        <div className="seg" role="group" aria-label="View">
          {(["day", "week"] as View[]).map((v) => (
            <button key={v} className={view === v ? "active" : ""} aria-pressed={view === v} onClick={() => setView(v)}>
              {v === "day" ? "Day" : "Week"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && view === "week" && (
        <div className="cal-week">
          {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
            const items = data.events.filter((e) => e.day === d);
            return (
              <section key={d} className={`cal-day${d === today ? " today" : ""}${d < today ? " past" : ""}`}>
                <button className="link cal-dayhead" onClick={() => (setAnchor(d), setView("day"))}>
                  <span>{fmt(d, { weekday: "short" })}</span> <b>{fmt(d, { day: "numeric" })}</b>
                  {d === today && <span className="pill ok">Today</span>}
                </button>
                {items.length === 0 && <span className="muted small">Nothing</span>}
                {items.map((e, i) => (
                  <button key={i} className={`cal-item ${e.kind}`} onClick={() => setPicked(e)} aria-label={`${e.time} ${label(e)}`}>
                    <span className="cal-time">{e.time}</span>
                    <span className="ellipsis" title={label(e)}>
                      <i style={{ background: SERVICE_COLOR[e.platform] || "#888" }} />
                      {e.handle ? `@${e.handle}` : PLATFORM[e.platform] || e.platform}
                    </span>
                    {e.kind === "manual" && e.status !== "planned" && <span className={`cal-dot ${STATUS[e.status]?.pill}`} />}
                  </button>
                ))}
              </section>
            );
          })}
        </div>
      )}
      {data && view === "day" && (
        <section className={`card cal-list${start === today ? " today" : ""}`}>
          {data.events.length === 0 && <p className="muted">Nothing to post on this day.</p>}
          {data.events.map((e, i) => (
            <button key={i} className={`cal-row ${e.kind}`} onClick={() => setPicked(e)}>
              <span className="cal-bigtime">
                {e.time}
                <span className="muted small">{e.time_et} ET</span>
              </span>
              {e.thumb_url ? <img src={e.thumb_url} alt="" /> : <span className="cal-nothumb" />}
              <span className="cal-rowbody">
                <span>
                  <i style={{ background: SERVICE_COLOR[e.platform] || "#888" }} />
                  <b>{label(e)}</b> <Status e={e} />
                </span>
                <span className="ellipsis muted">{e.title || (e.kind === "manual" ? "Clip picked 10 min before the slot" : "")}</span>
              </span>
            </button>
          ))}
        </section>
      )}

      {picked && <Details e={picked} onClose={() => setPicked(null)} onChanged={() => (setPicked(null), reload())} />}
    </>
  );
}

function Status({ e }: { e: CalendarEvent }) {
  const s = STATUS[e.status] || { label: e.status, pill: "" };
  return (
    <>
      <span className={`pill ${s.pill}`}>{s.label}</span> <span className="muted small">{e.kind === "manual" ? "by hand" : "Buffer"}</span>
    </>
  );
}

function Details({ e, onClose, onChanged }: { e: CalendarEvent; onClose: () => void; onChanged: () => void }) {
  const [link, setLink] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const showTitle = e.title && (e.platform === "tiktok" || e.platform === "youtube");
  const done = async () => {
    setErr(null);
    try {
      await post(`/manual-uploads/${e.upload_id}/done`, { link: link.trim() || null });
      onChanged();
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <Modal title={label(e)} onClose={onClose}>
      <div className="row nomargin wrap">
        <Status e={e} />
      </div>
      <dl className="creds">
        <dt>When</dt>
        <dd>
          <b>
            {fmt(e.day, { weekday: "long", day: "numeric", month: "long" })}, {e.time}
          </b>{" "}
          Tbilisi <span className="muted">({e.time_et} US Eastern, {inMinutes(e.at)})</span>
        </dd>
        <dt>Account</dt>
        <dd>
          {e.profile_url ? (
            <a href={e.profile_url} target="_blank" rel="noreferrer">
              {label(e)}
            </a>
          ) : (
            label(e)
          )}
        </dd>
      </dl>

      {e.clip_id ? (
        <>
          <div className="cal-clip">
            {e.video_url ? <video src={e.video_url} poster={e.thumb_url || undefined} controls preload="none" /> : e.thumb_url && <img src={e.thumb_url} alt="" />}
            <div className="cal-clipside">
              {e.download_url && (
                <a className="button primary" href={e.download_url}>
                  Download video
                </a>
              )}
              <RerenderButton clipId={e.clip_id} onDone={onChanged} />
              {e.kind === "manual" && e.upload_page && (
                <a className="button" href={e.upload_page} target="_blank" rel="noreferrer">
                  Open {PLATFORM[e.platform] || e.platform} upload
                </a>
              )}
              {e.link && (
                <a href={e.link} target="_blank" rel="noreferrer">
                  Open the post
                </a>
              )}
            </div>
          </div>
          {e.status === "planned" && (
            <p className="hint">
              Likely clip. The reminder email 10 minutes before the slot picks the freshest clip, so a newer one can take its place.
            </p>
          )}
          {showTitle && (
            <div>
              <div className="row between">
                <b>Title</b>
                <CopyButton text={e.title!} />
              </div>
              <pre className="cal-text">{e.title}</pre>
            </div>
          )}
          <div>
            <div className="row between">
              <b>Caption</b>
              <span className="row nomargin">
                <span className="muted small">text and hashtags, paste as is</span>
                <CopyButton text={e.caption || ""} />
              </span>
            </div>
            <pre className="cal-text">{e.caption || "–"}</pre>
          </div>
        </>
      ) : (
        <p className="muted">The clip for this slot is picked 10 minutes before it, from the freshest clips, and emailed to you with its caption.</p>
      )}

      {e.error && <p className="error small">{e.error}</p>}
      {e.post_id && e.kind !== "manual" && (
        <div className="row">
          <RemoveButton path={`/posts/${e.post_id}`} what="this post (cancelled in Buffer if still queued)" onDone={onChanged} />
        </div>
      )}
      {e.kind === "manual" && e.upload_id && e.status === "to_upload" && (
        <div>
          <b>After posting</b>
          <div className="inputrow">
            <input value={link} placeholder="https:// link to the post" onChange={(x) => setLink(x.target.value)} onKeyDown={(x) => x.key === "Enter" && done()} />
            <button className="small" onClick={done}>
              {link.trim() ? "Save link" : "Mark uploaded"}
            </button>
          </div>
          <p className="muted small">The link records it as a live post, so it shows on Posts and counts for Content Rewards.</p>
          {err && <span className="error small">{err}</span>}
        </div>
      )}
    </Modal>
  );
}

/** The posting plan the workers follow, read from the server so it changes when Settings change. */
function PlanLine({ plan }: { plan: NonNullable<CalendarData["plan"]> }) {
  const per = Object.entries(plan.per_day)
    .map(([pf, n]) => `${PLATFORM[pf] || pf} ${n}`)
    .join(", ");
  const gap = plan.min_gap_minutes >= 60 ? `${Math.round((plan.min_gap_minutes / 60) * 10) / 10} h` : `${plan.min_gap_minutes} min`;
  return (
    <p className="muted small">
      Plan: posts a day per account: {per}. At least {gap} between posts on one account, platforms {plan.stagger_minutes} min apart.
    </p>
  );
}
