import type { GameView } from "./types";

/**
 * Still "on premium": made every bid of the current pulka so far and can still make this one.
 * Shown once at least one deal of the pulka is finished.
 */
export function onPremium(g: GameView, seat: number): boolean {
  if (g.phase === "gameOver") return false;
  const res = g.pulkas[g.pulka];
  if (!res || res.deals.length === 0) return false;
  if (!res.deals.every((d) => d.bids[seat] === d.took[seat])) return false;
  const bid = g.bids[seat];
  if (bid === null || g.phase !== "playing") return true;
  const left = g.handSize - g.took.reduce((a, b) => a + b, 0);
  return g.took[seat] <= bid && bid - g.took[seat] <= left;
}
