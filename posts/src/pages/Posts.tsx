import { post, useApi } from "../api";
import { money, num, SERVICE_LABEL, when } from "../format";
import type { Post } from "../types";

export default function Posts() {
  const { data, error, reload } = useApi<Post[]>("/posts", 60000);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      <p className="muted">
        Every live post is a separate Content Rewards submission. Copy its link, press “Submit clip” on the campaign page, then
        tick it here. A post pays nothing until it reaches the campaign minimum.
      </p>
      <section className="card scroll">
        <table>
          <thead>
            <tr>
              <th />
              <th>Clip</th>
              <th>Platform</th>
              <th>When</th>
              <th>Status</th>
              <th>Views</th>
              <th>Likes</th>
              <th>Est. pay</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => {
              const need = Number(p.views_needed || 0);
              return (
                <tr key={p.id}>
                  <td className="thumbcell">{p.thumb_url && <img src={p.thumb_url} alt="" />}</td>
                  <td className="titlecell">
                    {p.title}
                    {p.error && <div className="error small">{p.error}</div>}
                  </td>
                  <td>
                    {SERVICE_LABEL[p.service] || p.service}
                    <div className="muted small">{p.channel_name}</div>
                  </td>
                  <td className="nowrap small">{when(p.sent_at || p.due_at)}</td>
                  <td>
                    <span className={`pill ${p.status === "sent" ? "ok" : p.status === "error" ? "bad" : ""}`}>{p.status}</span>
                    {p.external_link && (
                      <div className="small">
                        <a href={p.external_link} target="_blank" rel="noreferrer">
                          open
                        </a>{" "}
                        ·{" "}
                        <button className="link small" onClick={() => navigator.clipboard?.writeText(p.external_link!)}>
                          copy link
                        </button>
                      </div>
                    )}
                  </td>
                  <td>
                    {num(p.views)}
                    {p.status === "sent" && need > 0 && p.views < need && (
                      <div className="muted small">{num(need - p.views)} to minimum</div>
                    )}
                  </td>
                  <td>{num(p.likes)}</td>
                  <td>{money(p.est_pay)}</td>
                  <td>
                    {p.status === "sent" && p.external_link ? (
                      <input
                        type="checkbox"
                        checked={p.submitted}
                        onChange={async (e) => {
                          await post(`/posts/${p.id}/submitted`, { submitted: e.target.checked });
                          reload();
                        }}
                      />
                    ) : (
                      <span className="muted">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
