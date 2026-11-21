import { useEffect, useState } from "react";
import { post, put, useApi } from "../api";
import { ago } from "../format";
import type { EventRow, Overview, Settings as S } from "../types";
import AutoSubmit from "./AutoSubmit";
import { Workers } from "./Overview";

export default function Settings() {
  const ov = useApi<Overview>("/overview", 20000);
  const ev = useApi<EventRow[]>("/events?limit=150", 20000);
  const [s, setS] = useState<S | null>(null);
  const [slots, setSlots] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (ov.data && !s) {
      setS(ov.data.settings);
      setSlots(ov.data.settings.slots_et.join(", "));
    }
  }, [ov.data, s]);

  const save = async (patch: Partial<S>) => {
    try {
      const r = await put<S>("/settings", patch);
      setS(r);
      setSlots(r.slots_et.join(", "));
      setMsg("Saved");
      ov.reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <>
      <div className="grid2">
        <section className="card">
          <h2>Workers</h2>
          {ov.data && <Workers beats={ov.data.workers} />}
          {ov.data && <BufferQuota s={ov.data.settings} />}
          <div className="row wrap">
            {["discover", "render", "publish", "monitor", "submit"].map((w) => (
              <button
                key={w}
                onClick={async () => {
                  await post(`/workers/${w}/run`);
                  setMsg(`${w} started`);
                  setTimeout(() => {
                    ov.reload();
                    ev.reload();
                  }, 3000);
                }}
              >
                Run {w} now
              </button>
            ))}
          </div>
        </section>
        {s && (
          <section className="card form">
            <h2>Settings</h2>
            <label className="inline">
              <input type="checkbox" checked={s.workers_paused} onChange={(e) => save({ workers_paused: e.target.checked })} /> Pause
              all workers
            </label>
            <label className="inline">
              <input type="checkbox" checked={s.auto_approve} onChange={(e) => save({ auto_approve: e.target.checked })} /> Auto-approve
              clips that got a written title (needs ANTHROPIC_API_KEY on the server)
            </label>
            <label>
              Posting times, US Eastern (HH:MM, comma-separated)
              <input value={slots} onChange={(e) => setSlots(e.target.value)} />
            </label>
            <label>
              Max posts per channel per day
              <input type="number" value={s.max_posts_per_day} onChange={(e) => setS({ ...s, max_posts_per_day: Number(e.target.value) })} />
            </label>
            <label>
              Max YouTube posts per day
              <input
                type="number"
                value={s.max_per_day_by_service?.youtube ?? s.max_posts_per_day}
                onChange={(e) => setS({ ...s, max_per_day_by_service: { ...(s.max_per_day_by_service || {}), youtube: Number(e.target.value) } })}
              />
              <span className="muted small">More same-streamer Shorts in a day get fewer impressions each</span>
            </label>
            <label>
              Min minutes between posts on one account
              <input type="number" value={s.min_gap_minutes ?? 60} onChange={(e) => setS({ ...s, min_gap_minutes: Number(e.target.value) })} />
            </label>
            <label>
              Minutes between platforms
              <input type="number" value={s.stagger_minutes} onChange={(e) => setS({ ...s, stagger_minutes: Number(e.target.value) })} />
            </label>
            <label>
              Platforms (tiktok, instagram, youtube)
              <input
                value={s.services.join(", ")}
                onChange={(e) => setS({ ...s, services: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
              />
            </label>
            <div className="row">
              <button
                className="primary"
                onClick={() =>
                  save({
                    slots_et: slots.split(",").map((x) => x.trim()).filter((x) => /^\d{1,2}:\d{2}$/.test(x)),
                    max_posts_per_day: s.max_posts_per_day,
                    max_per_day_by_service: s.max_per_day_by_service,
                    min_gap_minutes: s.min_gap_minutes,
                    stagger_minutes: s.stagger_minutes,
                    services: s.services,
                  })
                }
              >
                Save
              </button>
              {msg && <span className="muted">{msg}</span>}
            </div>
          </section>
        )}
      </div>
      <AutoSubmit />
      <section className="card scroll">
        <h2>Log</h2>
        <table>
          <tbody>
            {ev.data?.map((e) => (
              <tr key={e.id} className={`lvl-${e.level}`}>
                <td className="nowrap small">{ago(e.ts)}</td>
                <td>{e.worker}</td>
                <td>
                  <span className={`pill ${e.level === "error" ? "bad" : e.level === "warn" ? "warn" : ""}`}>{e.level}</span>
                </td>
                <td className="logmsg">{e.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function BufferQuota({ s }: { s: S }) {
  const w = s.buffer_limits || {};
  const paused = (s.buffer_paused_until || 0) * 1000 > Date.now();
  const row = (key: string, label: string) =>
    w[key] ? (
      <li key={key}>
        {label}: <b>{w[key].remaining}</b> of {w[key].quota} left
      </li>
    ) : null;
  return (
    <div className="small" style={{ marginTop: 12 }}>
      <b>Buffer API allowance</b> (free plan, shared by every key)
      <ul className="postlist">
        {row("900", "15 minutes")}
        {row("86400", "Today")}
        {row("2592000", "30 days")}
      </ul>
      {paused && (
        <p className="error">
          Buffer calls paused until {new Date((s.buffer_paused_until || 0) * 1000).toLocaleString()} to stay under the limit.
          Posts already scheduled still go out.
        </p>
      )}
    </div>
  );
}
