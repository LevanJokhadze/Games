import { useState } from "react";
import { createRoom } from "../api";
import { useI18n } from "../i18n";
import { Rules } from "./Rules";

interface Props {
  name: string;
  setName: (n: string) => void;
  go: (code: string, autostart?: boolean) => void;
}

export function Home({ name, setName, go }: Props) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rules, setRules] = useState(false);

  const create = async (autostart: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      go(await createRoom(), autostart);
    } catch {
      setErr(t("errorCreate"));
    } finally {
      setBusy(false);
    }
  };

  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);

  return (
    <main className="home">
      <div className="home-hero">
        <div className="logo-cards" aria-hidden>
          <span className="lc lc1">A♠</span>
          <span className="lc lc2">★</span>
          <span className="lc lc3">K♥</span>
        </div>
        <h1>{t("title")}</h1>
        <p className="tagline">{t("tagline")}</p>
      </div>

      <section className="panel home-panel">
        <label className="field">
          <span>{t("yourName")}</span>
          <input
            value={name}
            maxLength={18}
            placeholder={t("namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
            enterKeyHint="done"
          />
        </label>
        <button className="btn btn-primary btn-big" disabled={busy} onClick={() => create(true)}>
          {t("playBots")}
        </button>
        <button className="btn btn-big" disabled={busy} onClick={() => create(false)}>
          {t("createRoom")}
        </button>
        <form
          className="join-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (cleanCode.length === 5) go(cleanCode);
          }}
        >
          <input
            value={cleanCode}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("roomCode")}
            aria-label={t("roomCode")}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            className="code-input"
          />
          <button className="btn" type="submit" disabled={cleanCode.length !== 5}>
            {t("joinRoom")}
          </button>
        </form>
        {err && <p className="error-text">{err}</p>}
        <button className="link-btn" onClick={() => setRules(true)}>
          {t("rules")}
        </button>
      </section>
      {rules && <Rules onClose={() => setRules(false)} />}
    </main>
  );
}
