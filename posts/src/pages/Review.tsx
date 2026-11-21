import { useState } from "react";
import { patch, post, useApi } from "../api";
import { ago, num } from "../format";
import type { Clip } from "../types";
import { RemoveButton, RerenderButton } from "../ui";

const TABS = [
  { id: "review", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "scheduled", label: "Scheduled" },
  { id: "posted", label: "Posted" },
  { id: "rejected", label: "Rejected" },
];

export default function Review() {
  const [tab, setTab] = useState("review");
  const { data, error, reload } = useApi<Clip[]>(`/clips?status=${tab}`, 30000);
  return (
    <>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "review" && (
        <p className="muted">
          Approve a clip and it is scheduled on TikTok, Reels and Shorts at the next US-Eastern slot. Check the title is
          true to the clip: misleading titles get submissions rejected.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {data && data.length === 0 && <p className="muted">No clips here.</p>}
      <div className="clips">
        {data?.map((c) => (
          <ClipCard key={c.id} clip={c} onChange={reload} />
        ))}
      </div>
    </>
  );
}

function ClipCard({ clip, onChange }: { clip: Clip; onChange: () => void }) {
  const [caption, setCaption] = useState(clip.caption || "");
  const [title, setTitle] = useState(clip.title || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = caption !== (clip.caption || "") || title !== (clip.title || "");
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const editable = clip.status === "review" || clip.status === "approved";
  return (
    <article className="card clip">
      {clip.video_url ? (
        <video src={clip.video_url} poster={clip.thumb_url || undefined} controls preload="none" playsInline />
      ) : (
        <div className="novideo">no video</div>
      )}
      <div className="clip-body">
        <div className="muted small">
          #{clip.id} · {clip.campaign} · {ago(clip.created_at)}
          {clip.twitch_views != null && <> · {num(clip.twitch_views)} views on Twitch</>}
          {clip.source_url && (
            <>
              {" "}
              ·{" "}
              <a href={clip.source_url} target="_blank" rel="noreferrer">
                source
              </a>
            </>
          )}
        </div>
        {clip.source_title && <div className="small">Viewer's clip title: “{clip.source_title}”</div>}
        {clip.hook_text && <div className="small">Text hook on the video: “{clip.hook_text}”</div>}
        <label>
          Post title (YouTube and TikTok)
          <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} />
        </label>
        <label>
          Caption
          <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} disabled={!editable} />
        </label>
        {clip.posts.length > 0 && (
          <ul className="postlist">
            {clip.posts.map((p) => (
              <li key={p.id}>
                {p.service}: <span className={`pill ${p.status === "sent" ? "ok" : p.status === "error" ? "bad" : ""}`}>{p.status}</span>
                {p.external_link && (
                  <a href={p.external_link} target="_blank" rel="noreferrer">
                    open
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        {err && <p className="error">{err}</p>}
        <div className="row">
          {dirty && (
            <button disabled={busy} onClick={() => act(() => patch(`/clips/${clip.id}`, { caption, title }))}>
              Save text
            </button>
          )}
          {clip.status === "review" && (
            <>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    if (dirty) await patch(`/clips/${clip.id}`, { caption, title });
                    await post(`/clips/${clip.id}/approve`);
                  })
                }
              >
                Approve & schedule
              </button>
              <button className="danger" disabled={busy} onClick={() => act(() => post(`/clips/${clip.id}/reject`))}>
                Reject
              </button>
            </>
          )}
          {clip.status === "rejected" && (
            <button disabled={busy} onClick={() => act(() => post(`/clips/${clip.id}/approve`))}>
              Approve after all
            </button>
          )}
          {clip.video_url && <RerenderButton clipId={clip.id} onDone={onChange} />}
          <RemoveButton path={`/clips/${clip.id}`} what="this clip and all its posts" onDone={onChange} />
        </div>
      </div>
    </article>
  );
}
