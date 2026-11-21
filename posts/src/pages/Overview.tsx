import { useApi } from "../api";
import { ago, money, num, SERVICE_LABEL, when } from "../format";
import type { Overview as O } from "../types";

export default function Overview() {
  const { data, error } = useApi<O>("/overview", 30000);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const review = data.clips.review || 0;
  return (
    <>
      {(review > 0 || data.to_submit > 0) && (
        <div className="todo">
          <b>Your 5 minutes today:</b>
          {review > 0 && (
            <a href="#review">
              Review {review} new clip{review > 1 ? "s" : ""}
            </a>
          )}
          {data.to_submit > 0 && (
            <a href="#posts">
              Submit {data.to_submit} live post{data.to_submit > 1 ? "s" : ""} on Content Rewards
            </a>
          )}
        </div>
      )}
      {data.submit_failed > 0 && (
        <div className="banner warn">
          Auto-submit failed for {data.submit_failed} live post{data.submit_failed > 1 ? "s" : ""}. <a href="#posts">Submit by hand</a>{" "}
          before the deadline (it's in the email too).
        </div>
      )}
      {data.settings.workers_paused && <div className="banner warn">Workers are paused. Turn them back on under Workers & settings.</div>}

      <div className="hero-row">
        <section className="hero-dark">
          <div>
            <span className="hero-label">Estimated earnings</span>
            <span className="hero-value">{money(data.est_earnings)}</span>
          </div>
          <div className="hero-rows">
            <div>
              <span>Posts over the campaign minimum</span>
              <b>{data.paying_posts}</b>
            </div>
            <div>
              <span>Views on all live posts</span>
              <b>{num(data.totals.views)}</b>
            </div>
          </div>
        </section>
        <section className="hero-soft">
          <div className="row between nomargin wrap">
            <div>
              <span className="muted">Clipping for</span>
              <div className="hero-campaign">
                {data.campaigns && data.campaigns.filter((c) => c.active).length === 0 ? (
                  <>
                    No active campaign. <a href="#campaigns">Turn one on</a>
                  </>
                ) : (
                  (data.campaigns || [])
                    .filter((c) => c.active)
                    .map((c) => (
                      <span key={c.id} className="campaign-chip">
                        {c.name}
                        <b>
                          {money(Number(c.cpm))}
                          <small> / 1K</small>
                        </b>
                      </span>
                    ))
                )}
              </div>
              {data.campaigns && data.campaigns.some((c) => c.active) && (
                <span className="muted small">
                  {data.campaigns
                    .filter((c) => c.active)
                    .map((c) => `min ${money(Number(c.min_payout))}${c.max_payout != null ? `, max ${money(Number(c.max_payout))}` : ""} per post`)
                    .join(" · ")}
                  . Earnings use each post's own campaign rate.
                </span>
              )}
            </div>
          </div>
          <div className="kpis">
            <Kpi label="Live posts" value={num(data.posts.sent || 0)} hint={`${data.posts.scheduled || 0} scheduled · ${data.posts.error || 0} failed`} />
            <Kpi label="Clips" value={num(Object.values(data.clips).reduce((a, b) => a + b, 0))} hint={`${review} waiting for review`} />
            <Kpi label="Moments found" value={num(Object.values(data.moments).reduce((a, b) => a + b, 0))} hint={`${data.moments.new || 0} not cut yet`} />
            <Kpi label="Likes · comments" value={`${num(data.totals.likes)} · ${num(data.totals.comments)}`} />
          </div>
        </section>
      </div>

      <div className="grid2">
        <section className="card">
          <h2>By platform</h2>
          <table>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Live posts</th>
                <th>Views</th>
              </tr>
            </thead>
            <tbody>
              {data.by_service.map((s) => (
                <tr key={s.service}>
                  <td>{SERVICE_LABEL[s.service] || s.service}</td>
                  <td>{s.sent}</td>
                  <td>{num(s.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2>Workers</h2>
          <Workers beats={data.workers} />
        </section>
      </div>

      <section className="card">
        <h2>Next scheduled posts</h2>
        {data.upcoming.length === 0 ? (
          <p className="muted">Nothing scheduled. Approve clips in Review.</p>
        ) : (
          <table>
            <tbody>
              {data.upcoming.map((u) => (
                <tr key={u.id}>
                  <td className="thumbcell">{u.thumb_url && <img src={u.thumb_url} alt="" />}</td>
                  <td>{u.title}</td>
                  <td>
                    {SERVICE_LABEL[u.service] || u.service} · {u.channel_name}
                  </td>
                  <td className="nowrap">{when(u.due_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
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

export function Workers({ beats }: { beats: O["workers"] }) {
  if (!beats.length) return <p className="muted">No worker has run yet.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Worker</th>
          <th>Last good run</th>
          <th>Runs</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {beats.map((b) => {
          const failing = b.last_error_at && (!b.last_ok || b.last_error_at > b.last_ok);
          return (
            <tr key={b.worker}>
              <td>{b.worker}</td>
              <td>{ago(b.last_ok)}</td>
              <td>{b.runs}</td>
              <td>
                {failing ? (
                  <span className="pill bad" title={b.last_error || ""}>
                    error
                  </span>
                ) : (
                  <span className="pill ok">ok</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
