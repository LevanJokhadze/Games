import { useState } from "react";
import { useApi } from "../api";
import { num, SERVICE_COLOR, SERVICE_LABEL } from "../format";
import type { Analytics as A } from "../types";

export default function Analytics() {
  const [days, setDays] = useState(30);
  const { data, error } = useApi<A>(`/analytics?days=${days}`, 120000);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const f = data.funnel;
  return (
    <>
      <div className="tabs">
        {[7, 30, 90].map((d) => (
          <button key={d} className={d === days ? "active" : ""} onClick={() => setDays(d)}>
            {d} days
          </button>
        ))}
      </div>
      <section className="card">
        <h2>Views per day</h2>
        <ViewsChart rows={data.daily} />
        <p className="muted small">Total views of all live posts on each day, from Buffer's post stats (updated every 2 hours).</p>
      </section>
      <div className="grid2">
        <section className="card">
          <h2>Pipeline</h2>
          <Funnel steps={[["Moments found", f.moments], ["Clips cut", f.clips], ["Approved", f.approved], ["Live posts", f.posted]]} />
        </section>
        <section className="card">
          <h2>Campaigns</h2>
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Live posts</th>
                <th>Views</th>
                <th>$/1K</th>
              </tr>
            </thead>
            <tbody>
              {data.per_campaign.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td>{c.posts}</td>
                  <td>{num(c.views)}</td>
                  <td>${Number(c.cpm).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <section className="card scroll">
        <h2>Top posts</h2>
        {data.top.length === 0 ? (
          <p className="muted">No live posts yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th />
                <th>Clip</th>
                <th>Platform</th>
                <th>Views</th>
                <th>Likes</th>
                <th>Comments</th>
                <th>Shares</th>
                <th>Engagement</th>
              </tr>
            </thead>
            <tbody>
              {data.top.map((p) => {
                const eng = p.views ? ((p.likes + p.comments + p.shares) / p.views) * 100 : 0;
                return (
                  <tr key={p.id}>
                    <td className="thumbcell">{p.thumb_url && <img src={p.thumb_url} alt="" />}</td>
                    <td className="titlecell">
                      {p.external_link ? (
                        <a href={p.external_link} target="_blank" rel="noreferrer">
                          {p.title}
                        </a>
                      ) : (
                        p.title
                      )}
                    </td>
                    <td>{SERVICE_LABEL[p.service] || p.service}</td>
                    <td>{num(p.views)}</td>
                    <td>{num(p.likes)}</td>
                    <td>{num(p.comments)}</td>
                    <td>{num(p.shares)}</td>
                    <td className={eng && eng < 0.8 ? "error" : ""} title="Campaign needs 0.8% or more">
                      {eng ? `${eng.toFixed(1)}%` : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function ViewsChart({ rows }: { rows: A["daily"] }) {
  if (!rows.length) return <p className="muted">No view data yet. It appears a few hours after the first post goes live.</p>;
  const days = [...new Set(rows.map((r) => r.day.slice(0, 10)))].sort();
  const services = [...new Set(rows.map((r) => r.service))];
  const val = (d: string, s: string) => rows.filter((r) => r.day.slice(0, 10) === d && r.service === s).reduce((a, r) => a + Number(r.views), 0);
  const totals = days.map((d) => services.reduce((a, s) => a + val(d, s), 0));
  const max = Math.max(1, ...totals);
  const W = 720, H = 220, pad = 30, bw = Math.max(4, (W - pad * 2) / days.length - 4);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H + 24}`} role="img" aria-label="Views per day">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad} x2={W - pad} y1={H - t * (H - 10)} y2={H - t * (H - 10)} className="gridline" />
            <text x={pad - 4} y={H - t * (H - 10) + 4} textAnchor="end" className="axis">
              {num(Math.round(max * t))}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          let y = H;
          const x = pad + i * ((W - pad * 2) / days.length) + 2;
          return (
            <g key={d}>
              {services.map((s) => {
                const h = (val(d, s) / max) * (H - 10);
                y -= h;
                return <rect key={s} x={x} y={y} width={bw} height={h} fill={SERVICE_COLOR[s] || "#888"} rx={2} />;
              })}
              {(days.length <= 14 || i % Math.ceil(days.length / 10) === 0) && (
                <text x={x + bw / 2} y={H + 16} textAnchor="middle" className="axis">
                  {d.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="legend">
        {services.map((s) => (
          <span key={s}>
            <i style={{ background: SERVICE_COLOR[s] || "#888" }} /> {SERVICE_LABEL[s] || s}
          </span>
        ))}
      </div>
    </div>
  );
}

function Funnel({ steps }: { steps: [string, number][] }) {
  const max = Math.max(1, ...steps.map((s) => s[1]));
  return (
    <div className="funnel">
      {steps.map(([label, v]) => (
        <div key={label} className="funnel-row">
          <span>{label}</span>
          <div className="bar">
            <div style={{ width: `${(v / max) * 100}%` }} />
          </div>
          <b>{num(v)}</b>
        </div>
      ))}
    </div>
  );
}
