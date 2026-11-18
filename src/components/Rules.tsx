import { dicts, useI18n } from "../i18n";
import { Modal } from "./Modal";

export function Rules({ onClose }: { onClose: () => void }) {
  const { lang, t } = useI18n();
  return (
    <Modal title={t("rules")} onClose={onClose}>
      <ol className="rules-list">
        {dicts[lang].rulesText.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ol>
    </Modal>
  );
}
