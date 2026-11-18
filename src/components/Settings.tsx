import { useI18n } from "../i18n";
import { BACKS, BOARDS, DECKS, Theme } from "../theme";
import { CardView } from "./CardView";
import { Modal } from "./Modal";
import { SoundToggle } from "./SoundToggle";

const BOARD_LABEL: Record<string, [string, string]> = {
  felt: ["Green felt", "მწვანე მაუდი"],
  ocean: ["Ocean", "ოკეანე"],
  wine: ["Burgundy", "ბორდო"],
  night: ["Night", "ღამე"],
  wood: ["Wood", "ხე"],
};
const BACK_LABEL: Record<string, [string, string]> = {
  red: ["Red", "წითელი"],
  navy: ["Navy", "ლურჯი"],
  emerald: ["Emerald", "ზურმუხტი"],
  gold: ["Black & gold", "შავი და ოქრო"],
};

export function Settings({ theme, setTheme, onClose }: { theme: Theme; setTheme: (t: Partial<Theme>) => void; onClose: () => void }) {
  const { t, lang } = useI18n();
  const L = (m: Record<string, [string, string]>, k: string) => m[k][lang === "ka" ? 1 : 0];
  return (
    <Modal title={`🎨 ${t("settings")}`} onClose={onClose}>
      <section className="setting">
        <SoundToggle />
      </section>
      <section className="setting">
        <h4>{t("board")}</h4>
        <div className="swatches">
          {BOARDS.map((b) => (
            <button key={b} className={`swatch board-swatch board-${b} ${theme.board === b ? "on" : ""}`} onClick={() => setTheme({ board: b })} aria-pressed={theme.board === b}>
              <span>{L(BOARD_LABEL, b)}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="setting">
        <h4>{t("cardBack")}</h4>
        <div className="swatches">
          {BACKS.map((b) => (
            <button key={b} className={`swatch back-swatch ${theme.back === b ? "on" : ""}`} onClick={() => setTheme({ back: b })} aria-pressed={theme.back === b}>
              <span className={`card card-sm card-back back-${b}`} />
              <span>{L(BACK_LABEL, b)}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="setting">
        <h4>{t("deck")}</h4>
        <div className="swatches">
          {DECKS.map((d) => (
            <button key={d} className={`swatch deck-swatch deck-${d} ${theme.deck === d ? "on" : ""}`} onClick={() => setTheme({ deck: d })} aria-pressed={theme.deck === d}>
              <span className="mini-cards">
                {["14S", "14H", "14D", "14C"].map((id) => (
                  <CardView key={id} card={{ id, suit: id.slice(-1) as "S", rank: 14, joker: false }} size="sm" />
                ))}
              </span>
              <span>{d === "classic" ? t("deckClassic") : t("deckFour")}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="setting">
        <h4>JOKER</h4>
        <div className="joker-preview">
          <CardView card={{ id: "J1", suit: null, rank: 0, joker: true }} size="md" />
          <CardView card={{ id: "J2", suit: null, rank: 0, joker: true }} size="md" />
        </div>
      </section>
    </Modal>
  );
}
