export const num = (n: number | null | undefined) =>
  n == null ? "–" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : n.toLocaleString("en-US");

export const money = (n: number | null | undefined) => `$${(Number(n) || 0).toFixed(2)}`;

/** Short name of a posting timezone: "ET" for US Eastern, else its city ("Moscow"). */
export const zoneName = (tz?: string | null) => (!tz || tz === "America/New_York" ? "ET" : tz.split("/").pop()!.replace(/_/g, " "));

/** Time in the viewer's zone plus the audience's zone the slot was planned in (US Eastern unless `tz` is given). */
export function when(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  const local = d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const zone = tz || "America/New_York";
  let there: string;
  try {
    there = d.toLocaleString(zone === "America/New_York" ? "en-US" : "en-GB", { timeZone: zone, hour: zone === "America/New_York" ? "numeric" : "2-digit", minute: "2-digit" });
  } catch {
    return local;
  }
  return `${local} (${there} ${zoneName(zone)})`;
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.max(0, Math.round(s))}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export const SERVICE_LABEL: Record<string, string> = { tiktok: "TikTok", instagram: "Reels", youtube: "Shorts" };
export const SERVICE_COLOR: Record<string, string> = { tiktok: "#25f4ee", instagram: "#e1306c", youtube: "#ff3b30" };
