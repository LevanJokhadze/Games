import { useI18n } from "../i18n";
import type { RoomView } from "../types";
import { Modal } from "./Modal";

export function Scoreboard({ room, onClose }: { room: RoomView; onClose: () => void }) {
  const { t } = useI18n();
  const g = room.game!;
  const names = room.seats.map((s, i) => s?.name ?? `#${i + 1}`);
  return (
    <Modal title={t("scores")} onClose={onClose} wide>
      <div className="score-scroll">
        <table className="score-table">
          <thead>
            <tr>
              <th>{t("cards")}</th>
              {names.map((n, i) => (
                <th key={i} className={i === room.you ? "me" : ""}>{n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {g.schedule.map((sizes, p) => {
              const res = g.pulkas[p];
              return [
                <tr key={`h${p}`} className="pulka-row">
                  <td colSpan={5}>{t("pulka")} {p + 1}</td>
                </tr>,
                ...sizes.map((size, d) => {
                  const deal = res?.deals[d];
                  const current = p === g.pulka && d === g.dealInPulka && g.phase !== "gameOver";
                  return (
                    <tr key={`${p}-${d}`} className={current ? "current" : ""}>
                      <td className="size">{size}</td>
                      {[0, 1, 2, 3].map((i) => {
                        if (deal) {
                          const made = deal.bids[i] === deal.took[i];
                          return (
                            <td key={i} className={made ? "made" : deal.points[i] < 0 ? "khishti" : "missed"}>
                              <span className="pts">{deal.points[i]}</span>
                              <span className="bt">{deal.bids[i]}/{deal.took[i]}</span>
                            </td>
                          );
                        }
                        if (current && g.bids[i] !== null) {
                          return (
                            <td key={i} className="pending">
                              <span className="bt">{g.bids[i]}/{g.took[i]}</span>
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
                      <td key={i}>
                        {res.total[i]}
                        {res.premium.includes(i) && <span className="premium" title={t("premium")}> ★+{res.bonus[i]}</span>}
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
              {g.totals.map((v, i) => (
                <td key={i}>{v}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  );
}
