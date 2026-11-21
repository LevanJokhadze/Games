import { post, useApi } from "../api";
import { ago, num } from "../format";
import type { Moment } from "../types";

export default function Moments() {
  const { data, error, reload } = useApi<Moment[]>("/moments", 60000);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      <p className="muted">
        Clips viewers made on the streamer's Twitch, ranked by views. The render worker cuts the most-viewed new ones, up to each
        campaign's daily limit.
      </p>
      <section className="card scroll">
        <table>
          <thead>
            <tr>
              <th>Twitch clip</th>
              <th>Channel</th>
              <th>Views</th>
              <th>Length</th>
              <th>Made</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr key={m.id}>
                <td className="titlecell">
                  <a href={m.url} target="_blank" rel="noreferrer">
                    {m.title || m.external_id}
                  </a>
                  {m.reason && <div className="muted small">{m.reason}</div>}
                </td>
                <td>{m.channel}</td>
                <td>{num(m.views)}</td>
                <td>{Math.round(m.duration)}s</td>
                <td className="nowrap">{ago(m.clip_created_at)}</td>
                <td>
                  <span className={`pill ${m.status === "rendered" ? "ok" : m.status === "failed" ? "bad" : ""}`}>{m.status}</span>
                </td>
                <td>
                  {(m.status === "failed" || m.status === "skipped") && (
                    <button
                      className="link small"
                      onClick={async () => {
                        await post(`/moments/${m.id}/retry`);
                        reload();
                      }}
                    >
                      retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
