import { useState } from "react";
import { absUrl } from "../api";

export function Avatar({ url, name, size = 32, bot }: { url: string | null | undefined; name: string; size?: number; bot?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = absUrl(url);
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (bot) return <span className="avatar avatar-bot" style={style} aria-hidden>🤖</span>;
  if (!src || broken) {
    const initials = name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
    return <span className="avatar avatar-initials" style={style} aria-hidden>{initials || "?"}</span>;
  }
  return <img className="avatar" src={src} alt="" style={style} onError={() => setBroken(true)} loading="lazy" decoding="async" />;
}
