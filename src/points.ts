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
