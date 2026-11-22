import { dicts, useI18n } from "../i18n";
import { Modal } from "./Modal";

export function Rules({ onClose, game = "joker", top }: { onClose: () => void; game?: "joker" | "bura" | "poker"; top?: React.ReactNode }) {
  const { lang, t } = useI18n();
  const items = game === "bura" ? dicts[lang].buraRules : game === "poker" ? dicts[lang].pokerRules : dicts[lang].rulesText;
  return (
    <Modal title={game === "bura" ? t("buraRulesTitle") : game === "poker" ? t("pokerRulesTitle") : t("rules")} onClose={onClose}>
      {top && <div className="rules-top">{top}</div>}
      <ol className="rules-list">
        {items.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ol>
    </Modal>
  );
}
