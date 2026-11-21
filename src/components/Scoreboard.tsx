import { useI18n } from "../i18n";
import type { GameView, PulkaResult, RoomView } from "../types";
import { onPremium } from "../premium";
import { Modal } from "./Modal";
import { bidBalance, bidText, pts } from "../points";

/** Combined points of the two teams in pairs mode (seats 0 & 2, 1 & 3). */
export function teamTotals(totals: number[]): [number, number] {
  return [(totals[0] ?? 0) + (totals[2] ?? 0), (totals[1] ?? 0) + (totals[3] ?? 0)];
}

interface Current {
  pulka: number;
  deal: number;
  bids: (number | null)[];
  took: number[];
}

export interface ScoreTableProps {
  names: string[];
  schedule: number[][];
  pulkas: PulkaResult[];
  totals: number[];
  pairs?: boolean;
  /** Highlighted seat (you). */
  you?: number | null;
  /** The deal in progress, if the game is still running. */
  current?: Current | null;
  /** Players still on premium in the current pulka. */
  premiumNow?: boolean[];
}

/** The full Joker score sheet: every deal of every pulka, bids/tricks, pulka sums and totals. */
export function ScoreTable({ names, schedule, pulkas, totals, pairs, you, current, premiumNow }: ScoreTableProps) {
  const { t } = useI18n();
  const team = pairs ? teamTotals(totals) : null;
  return (
    <div className="score-scroll">
      <table className={`score-table ${pairs ? "pairs" : ""}`}>
        <thead>
          <tr>
            <th>{t("cards")}</th>
            {names.map((n, i) => (
              <th key={i} className={`${i === you ? "me" : ""} ${pairs ? `team-${i % 2}` : ""} ${premiumNow?.[i] ? "on-premium" : ""}`} title={premiumNow?.[i] ? t("onPremium") : undefined}>
                {premiumNow?.[i] && <span className="ss-star">★</span>}
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.map((sizes, p) => {
            const res = pulkas[p];
            return [
              <tr key={`h${p}`} className="pulka-row">
                <td colSpan={5}>
                  {t("pulka")} {p + 1}
                  {res && res.deals.length === sizes.length && res.premium.length > 0 && (
                    <span className="pulka-premium"> · ★ {t("premium")}: {res.premium.map((i) => names[i]).join(", ")}</span>
                  )}
                </td>
              </tr>,
              ...sizes.map((size, d) => {
                const deal = res?.deals[d];
                const isCurrent = !!current && p === current.pulka && d === current.deal;
                return (
                  <tr key={`${p}-${d}`} className={isCurrent ? "current" : ""}>
                    <td className="size">
                      {size}
                      {(() => {
                        const b = deal ? bidBalance(deal.bids, size) : isCurrent ? bidBalance(current!.bids, size) : null;
                        return b ? (
                          <small className={`bal ${b.kind}`} title={t(b.kind === "under" ? "underBidHint" : "overBidHint", { n: b.n })}>
                            {b.kind === "under" ? "−" : "+"}
                            {b.n}
                          </small>
                        ) : null;
                      })()}
                    </td>
                    {[0, 1, 2, 3].map((i) => {
                      if (deal) {
                        const made = deal.bids[i] === deal.took[i];
                        return (
                          <td key={i} className={made ? "made" : deal.points[i] < 0 ? "khishti" : "missed"}>
                            <span className="pts">{pts(deal.points[i])}</span>
                            <span className="bt">{bidText(deal.bids[i])}/{deal.took[i]}</span>
                          </td>
                        );
                      }
                      if (isCurrent && current!.bids[i] !== null) {
                        return (
                          <td key={i} className="pending">
                            <span className="bt">{bidText(current!.bids[i])}/{current!.took[i]}</span>
                          </td>
                        );
                      }
                      return <td key={i} />;
                    })}
                  </tr>
                );
              }),
              res && res.deals.length === sizes.length ? (
                <tr key={`t${p}`} className="pulka-total">
                  <td>Σ</td>
                  {[0, 1, 2, 3].map((i) => (
                    <td key={i} className={res.premium.includes(i) ? "premium-cell" : ""}>
                      {pts(res.total[i])}
                      {res.premium.includes(i) && <span className="premium" title={t("premium")}> ★+{pts(res.bonus[i])}</span>}
                    </td>
                  ))}
                </tr>
              ) : null,
            ];
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>{t("total")}</td>
            {totals.map((v, i) => (
              <td key={i}>{pts(v)}</td>
            ))}
          </tr>
          {team && (
            <tr className="team-total">
              <td>2×2</td>
              <td colSpan={4}>
                <span className="team-0">{names[0]} + {names[2]}: <strong>{pts(team[0])}</strong></span>
                <span className="team-1">{names[1]} + {names[3]}: <strong>{pts(team[1])}</strong></span>
              </td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}

/** Builds the deal schedule from finished results (for saved matches). */
export function scheduleFromPulkas(pulkas: PulkaResult[]): number[][] {
  return pulkas.map((p) => p.deals.map((d) => d.handSize));
}

export function Scoreboard({ room, onClose }: { room: RoomView; onClose: () => void }) {
  const { t } = useI18n();
  const g = room.game as GameView;
  const names = room.seats.map((s, i) => s?.name ?? `#${i + 1}`);
  return (
    <Modal title={t("scores")} onClose={onClose} wide>
      <ScoreTable
        names={names}
        schedule={g.schedule}
        pulkas={g.pulkas}
        totals={g.totals}
        pairs={room.config.pairs}
        you={room.you}
        current={g.phase === "gameOver" ? null : { pulka: g.pulka, deal: g.dealInPulka, bids: g.bids, took: g.took }}
        premiumNow={[0, 1, 2, 3].map((i) => onPremium(g, i))}
      />
      <p className="hint left bal-legend">
        <span className="bal under">−n</span> {t("underBid", { n: "" }).trim()} · <span className="bal over">+n</span> {t("overBid", { n: "" }).trim()}
      </p>
    </Modal>
  );
}
