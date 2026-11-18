import { useI18n } from "../i18n";
import { useSoundOn } from "../sound";

/** Sound on/off, shown in the in-game help sheet and in Settings. */
export function SoundToggle() {
  const { t } = useI18n();
  const [on, setOn] = useSoundOn();
  return (
    <button className={`btn sound-toggle ${on ? "on" : ""}`} onClick={() => setOn(!on)} aria-pressed={on}>
      {on ? "🔊" : "🔇"} {t("sounds")}: {on ? t("soundOn") : t("soundOff")}
    </button>
  );
}
