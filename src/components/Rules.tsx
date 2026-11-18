import { dicts, useI18n } from "../i18n";
import { Modal } from "./Modal";

export function Rules({ onClose, game = "joker" }: { onClose: () => void; game?: "joker" | "bura" }) {
  const { lang, t } = useI18n();
  const items = game === "bura" ? dicts[lang].buraRules : dicts[lang].rulesText;
  return (
    <Modal title={game === "bura" ? t("buraRulesTitle") : t("rules")} onClose={onClose}>
      <ol className="rules-list">
        {items.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ol>
    </Modal>
  );
}
