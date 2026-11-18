import { useEffect, useState } from "react";
import { fetchLeaderboard } from "../api";
import { useI18n } from "../i18n";
import type { Profile } from "../types";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";

export function Leaderboard({ me, onClose, openPlayer }: { me: Profile | null; onClose: () => void; openPlayer: (id: string) => void }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<(Profile & { rank: number })[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetchLeaderboard().then(setRows, () => setErr(true));
  }, []);

  return (
    <Modal title={`🏆 ${t("leaderboard")}`} onClose={onClose} wide>
      <p className="hint left">{t("ratingNote")}</p>
      {err && <p className="error-text">{t("errorCreate")}</p>}
      {!rows && !err && <p className="hint">{t("loading")}</p>}
      {rows && rows.length === 0 && <p className="hint">{t("noPlayers")}</p>}
      {rows && rows.length > 0 && (
        <ol className="lb-list">
          {rows.map((u) => (
            <li key={u.id}>
              <button className={`lb-row ${u.id === me?.id ? "me" : ""}`} onClick={() => openPlayer(u.id)}>
                <span className={`lb-rank r${u.rank}`}>{u.rank}</span>
                <Avatar url={u.avatarUrl} name={u.nickname} size={40} />
                <span className="lb-name">
                  <strong>{u.nickname}</strong>
                  <small>{u.firstName} {u.lastName}</small>
                </span>
                <span className="lb-games">{u.games} {t("games")}</span>
                <span className="lb-rating">{u.rating}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
