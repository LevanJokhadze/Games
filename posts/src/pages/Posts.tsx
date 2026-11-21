import { useState } from "react";
import { post, useApi } from "../api";
import { money, num, SERVICE_LABEL, when } from "../format";
import type { Post } from "../types";
import { RemoveButton } from "../ui";

const TBILISI = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tbilisi" });

function SubmitCell({ p, reload }: { p: Post; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (p.status !== "sent" || !p.external_link) return <span className="muted">–</span>;
  const st = p.submitted ? (p.submit_status === "manual" ? "manual" : "submitted") : p.submit_status;
  const label: Record<string, string> = {
    submitted: "submitted",
    manual: "submitted by hand",
    pending: "submitting…",
    agent: "with helper",
    failed: "failed",
  };
  const cls = st === "submitted" || st === "manual" ? "ok" : st === "failed" ? "bad" : st ? "warn" : "";
  const open = !p.submitted && p.submit_deadline && new Date(p.submit_deadline).getTime() > Date.now();
  return (
    <div className="small">
      {st ? <span className={`pill ${cls}`}>{label[st] || st}</span> : <span className="muted">not submitted</span>}
      {p.submitted && p.submit_method && p.submit_status !== "manual" && <div className="muted">via {p.submit_method}</div>}
      {open && <div className="muted">deadline {TBILISI(p.submit_deadline!)} Tbilisi</div>}
      {!p.submitted && p.submit_error && <div className="error">{p.submit_error}</div>}
      <div className="row nomargin">
        {!p.submitted && st !== "pending" && (
          <button
            className="link small"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await post(`/posts/${p.id}/submit`);
                setMsg(null);
              } catch (e) {
                setMsg((e as Error).message);
              }
              setBusy(false);
              reload();
            }}
          >
            {busy ? "submitting…" : st === "failed" ? "retry" : "submit now"}
          </button>
        )}
        <label className="inline">
          <input
            type="checkbox"
            checked={p.submitted}
            onChange={async (e) => {
              await post(`/posts/${p.id}/submitted`, { submitted: e.target.checked });
              reload();
            }}
          />{" "}
          done
        </label>
      </div>
      {msg && <div className="error">{msg}</div>}
    </div>
  );
}

export default function Posts() {
  const { data, error, reload } = useApi<Post[]>("/posts", 60000);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      <p className="muted">
        Every live post is a separate Content Rewards submission, due within 30 minutes of going live. With auto-submit on
        (Workers & settings) the pipeline submits each one and emails you only if it fails; otherwise copy the link, press
        “Submit clip” on the campaign page and tick “done”. A post pays nothing until it reaches the campaign minimum.
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
              <th>Content Rewards</th>
              <th />
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
                    <SubmitCell p={p} reload={reload} />
                  </td>
                  <td>
                    <RemoveButton path={`/posts/${p.id}`} what="this post" onDone={reload} />
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
