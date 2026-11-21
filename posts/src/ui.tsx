import { useEffect, useState } from "react";
import { api } from "./api";

export function copy(text: string) {
  return navigator.clipboard?.writeText(text);
}

export function CopyButton({ text, get }: { text?: string; get?: () => Promise<string> }) {
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

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

type Removed = { removed: number; cancelled_in_buffer: number; still_live: { service: string; channel?: string; link?: string | null }[]; buffer_failed: { error: string }[] };

/** Two-step remove for a post, clip or campaign. Queued posts are cancelled in Buffer; posts already live on an app
 * leave the dashboard and their links are shown, to delete on the app (Buffer can't take them down). */
export function RemoveButton({ path, what, onDone, className = "link small danger" }: { path: string; what: string; onDone: () => void; className?: string }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Removed | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (res)
    return (
      <div className="small remove-result">
        {res.buffer_failed.length ? (
          <span className="error">Buffer refused: {res.buffer_failed[0].error}</span>
        ) : (
          <span>Removed{res.cancelled_in_buffer ? `, ${res.cancelled_in_buffer} cancelled in Buffer` : ""}.</span>
        )}
        {res.still_live.length > 0 && (
          <div>
            Still live, delete on the app:{" "}
            {res.still_live.map((l, i) =>
              l.link ? (
                <a key={i} href={l.link} target="_blank" rel="noreferrer">
                  {l.service}{" "}
                </a>
              ) : (
                <span key={i}>{l.service} ({l.channel}) </span>
              ),
            )}
          </div>
        )}
        <button className="link small" onClick={onDone}>
          ok
        </button>
      </div>
    );
  if (!ask)
    return (
      <button type="button" className={className} onClick={() => setAsk(true)}>
        Remove
      </button>
    );
  return (
    <span className="small remove-ask">
      Remove {what}?{" "}
      <button
        type="button"
        className="link small danger"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api<Removed>(path, { method: "DELETE" });
            if (!r.still_live.length && !r.buffer_failed.length) onDone();
            else setRes(r);
          } catch (e) {
            setErr((e as Error).message);
          }
          setBusy(false);
        }}
      >
        {busy ? "removing…" : "yes, remove"}
      </button>{" "}
      <button type="button" className="link small" onClick={() => setAsk(false)}>
        no
      </button>
      {err && <span className="error"> {err}</span>}
    </span>
  );
}
