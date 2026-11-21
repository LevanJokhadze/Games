/** Joker points are written in hundreds, the way players say them: 920 → "9.2", -200 → "-2.0". */
export function pts(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return (n / 100).toFixed(1);
}

/** A bid as players write it: 0 is a dash ("-"), not yet bid is "…". */
export function bidText(n: number | null | undefined): string {
  if (n === null || n === undefined) return "…";
  return n === 0 ? "-" : String(n);
}

/**
 * Once everyone has bid: "under" (შეტენვა) = tricks nobody asked for, which someone will be
 * forced to take; "over" (წაგლეჯვა) = more tricks asked for than there are cards.
 */
export function bidBalance(bids: (number | null)[], handSize: number): { kind: "under" | "over"; n: number } | null {
  if (bids.some((b) => b === null)) return null;
  const sum = bids.reduce<number>((a, b) => a + (b ?? 0), 0);
  if (sum === handSize) return null;
  return sum < handSize ? { kind: "under", n: handSize - sum } : { kind: "over", n: sum - handSize };
}

/**
 * While the player just before the dealer bids: what they must say so the bids add up to the
 * number of cards, which forces the dealer to go over (შევსება). null when it can't be done.
 */
export function fillNeeded(g: { phase: string; turn: number; dealer: number; handSize: number; bids: (number | null)[] }): number | null {
  if (g.phase !== "bidding" || g.turn !== (g.dealer + 3) % 4) return null;
  const x = g.handSize - g.bids.reduce<number>((a, b) => a + (b ?? 0), 0);
  return x >= 0 && x <= g.handSize ? x : null;
}
