import { useRef, useState } from "react";
import { ApiError, ProfileInput, absUrl } from "../api";
import { useI18n } from "../i18n";
import type { Profile } from "../types";

/** Center-crops an image file to a 256×256 JPEG data URL. */
async function toAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const size = 256;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const NICK_RE = /^[A-Za-z0-9_.ა-ჿ]{3,20}$/;

interface Props {
  initial?: Profile | null;
  /** "required" when creating a player; "optional" (change it) in the profile. */
  password: "required" | "optional";
  submitLabel: string;
  onSubmit: (p: ProfileInput) => Promise<void>;
}

export function ProfileForm({ initial, password: pwMode, submitLabel, onSubmit }: Props) {
  const { t } = useI18n();
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = avatar ?? absUrl(initial?.avatarUrl);
  const nickOk = NICK_RE.test(nickname.trim());
  const ok = nickOk && firstName.trim() && lastName.trim() && preview;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      setAvatar(await toAvatar(f));
      setErr(null);
    } catch {
      setErr("Could not read that image");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) {
      setErr(t("allRequired"));
      return;
    }
    if ((pwMode === "required" || password) && password.length < 6) {
      setErr(t("passwordShort"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        nickname: nickname.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(avatar ? { avatar } : {}),
        ...(password ? { password } : {}),
      });
      setPassword("");
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : t("errorCreate"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="profile-form" onSubmit={submit} noValidate>
      <button type="button" className={`avatar-pick ${preview ? "has" : ""}`} onClick={() => fileRef.current?.click()} aria-label={t("choosePhoto")}>
        {preview ? <img src={preview} alt="" /> : <span className="avatar-plus">📷</span>}
        <span className="avatar-pick-label">{preview ? t("changePhoto") : t("choosePhoto")}</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />

      <label className="field">
        <span>{t("nickname")} *</span>
        <input value={nickname} onChange={(e) => setNickname(e.target.value.replace(/\s/g, ""))} maxLength={20} autoComplete="username" autoCapitalize="off" spellCheck={false} aria-invalid={nickname !== "" && !nickOk} />
        <small className={nickname !== "" && !nickOk ? "error-text left" : "muted"}>{t("nicknameHint")}</small>
      </label>
      <div className="field-row">
        <label className="field">
          <span>{t("firstName")} *</span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={30} autoComplete="given-name" />
        </label>
        <label className="field">
          <span>{t("lastName")} *</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={30} autoComplete="family-name" />
        </label>
      </div>
      <PasswordField
        label={pwMode === "required" ? `${t("password")} *` : initial?.hasPassword ? t("newPassword") : t("password")}
        hint={pwMode === "required" ? t("passwordHint") : initial?.hasPassword ? t("newPasswordHint") : t("setPasswordHint")}
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        highlight={pwMode === "optional" && !initial?.hasPassword}
      />
      {err && <p className="error-text">{err}</p>}
      <button className="btn btn-primary btn-big" type="submit" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  );
}

export function PasswordField({ label, hint, value, onChange, autoComplete, highlight }: { label: string; hint?: string; value: string; onChange: (v: string) => void; autoComplete: string; highlight?: boolean }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <label className={`field ${highlight ? "field-highlight" : ""}`}>
      <span>{label}</span>
      <span className="pw-wrap">
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} maxLength={100} autoComplete={autoComplete} autoCapitalize="off" spellCheck={false} />
        <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label={t("showPassword")} aria-pressed={show}>
          {show ? "🙈" : "👁"}
        </button>
      </span>
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}
