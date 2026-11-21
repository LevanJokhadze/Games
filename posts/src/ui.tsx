import { useEffect, useState } from "react";

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
