import { useEffect, useRef, useState } from "react";
import { post } from "../api";
import { money, num, SERVICE_LABEL, when } from "../format";
import { CopyButton, Modal } from "../ui";
import { jarvis, useJarvis, type CardAction, type JarvisCard, type JarvisModal } from "./live";

const STATE_LABEL: Record<string, string> = {
  off: "Off",
  connecting: "Connecting…",
  listening: "Listening",
  speaking: "Speaking",
  reconnecting: "Reconnecting…",
  cards: "Cards only",
  error: "Stopped",
};

/** The round Jarvis mark: a lime disc that pulses while he listens and spins while he talks. */
export function Orb({ state, size = 44 }: { state: string; size?: number }) {
  return (
    <span className={`orb ${state}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.46} height={size * 0.46} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M4 12h2M8 8v8M12 5v14M16 8v8M20 12h-2" />
      </svg>
    </span>
  );
}

/** Floating button and panel: start/stop, transcript, typing. */
export function JarvisDock() {
  const j = useJarvis();
  const [text, setText] = useState("");
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [j.lines]);
  const live = j.on;
  if (!j.panelOpen)
    return (
      <button className={`jarvis-fab ${j.state}`} onClick={() => (live ? j.setPanel(true) : void j.start())} aria-label="Open Jarvis">
        <Orb state={j.state} size={40} />
        <span>{live ? STATE_LABEL[j.state] : "Ask Jarvis"}</span>
      </button>
    );
  return (
    <aside className="jarvis-panel" aria-label="Jarvis">
      <header>
        <Orb state={j.state} />
        <div className="jarvis-title">
          <b>Jarvis</b>
          <span>{STATE_LABEL[j.state]}{j.voice?.backend ? ` · ${j.voice.backend}` : ""}</span>
        </div>
        <button className="icon" onClick={() => j.setPanel(false)} aria-label="Minimise Jarvis">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 12h12" /></svg>
        </button>
      </header>
      {j.error && <p className="error small">{j.error}</p>}
      <div className="jarvis-log" ref={log}>
        {j.lines.length === 0 && (
          <p className="muted small">
            {live ? "Say hello, or ask: “Which videos are stuck at 0 views?”, “What do I upload next?”, “Open the TikTok upload page.”" : "Start a session: Jarvis puts what needs you on screen and talks you through it."}
          </p>
        )}
        {j.lines.map((l) => (
          <p key={l.id} className={`jl ${l.who}`}>
            {l.text}
          </p>
        ))}
      </div>
      <form
        className="jarvis-input"
        onSubmit={(e) => {
          e.preventDefault();
          j.sendText(text);
          setText("");
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={live ? "Type to Jarvis…" : "Start Jarvis to talk"} disabled={!live} aria-label="Message to Jarvis" />
        <button className="primary round" disabled={!live || !text.trim()} aria-label="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
      <footer>
        {live ? (
          <>
            <button onClick={() => j.setMuted(!j.muted)} aria-pressed={j.muted}>
              {j.muted ? "Unmute mic" : "Mute mic"}
            </button>
            <button onClick={() => void j.loadCards(false)}>Refresh cards</button>
            <button className="danger" onClick={() => j.stop()}>
              End session
            </button>
          </>
        ) : (
          <>
            <button className="primary" onClick={() => void j.start()}>
              Start session
            </button>
            <button onClick={() => void j.loadCards()}>Show cards</button>
          </>
        )}
      </footer>
    </aside>
  );
}

/** The cards Jarvis put on screen: a strip above the page, on every page. */
export function JarvisCards() {
  const j = useJarvis();
  if (!j.cards.length) return null;
  return (
    <section className="jcards" aria-label="Jarvis cards">
      <div className="row between nomargin">
        <span className="jcards-head">
          <Orb state={j.state} size={22} /> Jarvis · {j.cards.length} thing{j.cards.length > 1 ? "s" : ""} for you
        </span>
        <button className="link small" onClick={() => j.clearCards()}>
          Clear all
        </button>
      </div>
      <div className="jcards-row">
        {j.cards.map((c) => (
          <Card key={c.id} card={c} />
        ))}
      </div>
    </section>
  );
}

function Card({ card }: { card: JarvisCard }) {
  return (
    <article className={`jcard ${card.tone}`}>
      <div className="row between nomargin">
        <span className={`tone ${card.tone}`}>{{ urgent: "Now", warn: "Fix", info: "FYI", good: "Good" }[card.tone]}</span>
        <button className="icon small" onClick={() => jarvis.dismissCard(card.id)} aria-label={`Dismiss ${card.title}`}>
          ✕
        </button>
      </div>
      <h3>{card.title}</h3>
      {card.body && <p>{card.body}</p>}
      {card.done ? (
        <p className="jdone">{card.done}</p>
      ) : (
        card.actions.length > 0 && (
          <div className="jactions">
            {card.actions.map((a, i) => (
              <ActionButton key={i} a={a} card={card} first={i === 0} />
            ))}
          </div>
        )
      )}
    </article>
  );
}

function ActionButton({ a, card, first }: { a: CardAction; card?: JarvisCard; first?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={first ? "primary" : ""}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await jarvis.run(a, card);
        setBusy(false);
      }}
    >
      {a.label}
      {a.url ? " ↗" : ""}
    </button>
  );
}

const PF: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };

/** The window Jarvis opened (or a card button did). */
export function JarvisModalView() {
  const j = useJarvis();
  const m = j.modal;
  if (!m) return null;
  const close = () => j.closeModal();
  return (
    <Modal title={title(m)} onClose={close}>
      <ModalBody m={m} />
    </Modal>
  );
}

function title(m: JarvisModal) {
  const d = m.data || {};
  if (m.kind === "clip") return m.platform ? `Upload to ${PF[m.platform] || m.platform}` : d.title || `Clip #${d.id}`;
  if (m.kind === "account") return `@${d.handle} · ${PF[d.platform] || d.platform}`;
  if (m.kind === "post") return d.clip_title || `Post #${d.id}`;
  if (m.kind === "upload") return `Add the link: @${d.handle}`;
  return d.title || "Jarvis";
}

function ModalBody({ m }: { m: JarvisModal }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = m.data || {};
  if (m.kind === "custom")
    return (
      <div className="form">
        {d.text && <p className="pre">{d.text}</p>}
        {d.items?.length > 0 && (
          <ul className="jlist">
            {d.items.map((x: string, i: number) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        )}
        {d.copy_text && (
          <div className="copybox">
            <p className="pre">{d.copy_text}</p>
            <CopyButton text={d.copy_text} />
          </div>
        )}
        {d.actions?.length > 0 && (
          <div className="jactions">
            {d.actions.map((a: CardAction, i: number) => (
              <ActionButton key={i} a={a} first={i === 0} />
            ))}
          </div>
        )}
      </div>
    );
  if (m.kind === "clip")
    return (
      <div className="jclip">
        {d.video_url ? <video src={d.video_url} poster={d.thumb_url || undefined} controls playsInline /> : <div className="novideo">No video</div>}
        <div className="form">
          {m.platform && <p className="muted small">The {PF[m.platform]} upload page opened in a new tab. Download the clip, then paste the caption.</p>}
          <dl className="facts">
            <dt>Campaign</dt>
            <dd>{d.campaign || "–"}</dd>
            <dt>Status</dt>
            <dd>{d.status}</dd>
            {d.duration && (
              <>
                <dt>Length</dt>
                <dd>{Math.round(d.duration)} s</dd>
              </>
            )}
          </dl>
          {d.title && (
            <div className="copybox">
              <b className="small">Title</b>
              <p>{d.title}</p>
              <CopyButton text={d.title} />
            </div>
          )}
          {d.caption && (
            <div className="copybox">
              <b className="small">Caption</b>
              <p className="pre">{d.caption}</p>
              <CopyButton text={d.caption} />
            </div>
          )}
          <div className="jactions">
            {d.download_url && (
              <a className="button primary" href={d.download_url}>
                Download clip
              </a>
            )}
            {d.source_url && (
              <a className="button" href={d.source_url} target="_blank" rel="noreferrer">
                Twitch source ↗
              </a>
            )}
          </div>
          {d.posts?.length > 0 && (
            <ul className="jlist">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {d.posts.map((p: any) => (
                <li key={p.id}>
                  {SERVICE_LABEL[p.service] || p.service} {p.channel_name} · {p.status} · {num(p.views)} views
                  {p.external_link && (
                    <>
                      {" "}
                      <a href={p.external_link} target="_blank" rel="noreferrer">
                        open ↗
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  if (m.kind === "account")
    return (
      <div className="form">
        <div className="mini-kpis">
          <div><span>Videos</span><b>{d.videos}</b></div>
          <div><span>Views</span><b>{num(d.views)}</b></div>
          <div><span>Best</span><b>{num(d.best_views)}</b></div>
          <div><span>At 0 views</span><b>{d.zero_view_videos}</b></div>
        </div>
        <dl className="facts">
          <dt>Geo</dt>
          <dd>{d.geo_name}</dd>
          <dt>Status</dt>
          <dd>{d.status} · {d.upload_mode}</dd>
          <dt>Streamers</dt>
          <dd>{(d.streamers || []).join(", ") || "any"}{!d.targets_active_campaign && " (not in an active campaign)"}</dd>
          {d.next_upload_at && (
            <>
              <dt>Next upload</dt>
              <dd>{d.next_upload_at} Tbilisi</dd>
            </>
          )}
        </dl>
        <div className="jactions">
          {d.profile_url && <ActionButton a={{ label: "Profile", url: d.profile_url }} first />}
          {d.upload_page && <ActionButton a={{ label: "Upload page", url: d.upload_page }} />}
          <ActionButton a={{ label: "Accounts page", page: "accounts" }} />
        </div>
        {d.recent?.length > 0 && (
          <table>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {d.recent.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <button className="link" onClick={() => void jarvis.openModal("clip", p.clip_id)}>
                      {p.clip_title || `clip #${p.clip_id}`}
                    </button>
                    {p.zero && <div className="muted small">{p.zero.why}</div>}
                  </td>
                  <td className="nowrap">{p.status}</td>
                  <td className="nowrap">{num(p.views)} views</td>
                  <td>{p.external_link && <a href={p.external_link} target="_blank" rel="noreferrer">↗</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  if (m.kind === "post")
    return (
      <div className="form">
        <div className="mini-kpis">
          <div><span>Views</span><b>{num(d.views)}</b></div>
          <div><span>Needed</span><b>{num(d.views_needed)}</b></div>
          <div><span>Est. pay</span><b>{money(d.est_pay)}</b></div>
          <div><span>Submitted</span><b>{d.submitted ? "Yes" : "No"}</b></div>
        </div>
        <p className="muted small">
          {SERVICE_LABEL[d.service] || d.service} {d.channel_name} · {d.status} · {when(d.sent_at || d.due_at)}
        </p>
        {d.zero && (
          <div className="banner warn">
            <b>{d.zero.why}</b> {d.zero.fix}
          </div>
        )}
        <div className="jactions">
          {d.external_link && <ActionButton a={{ label: "Open post", url: d.external_link }} first />}
          <ActionButton a={{ label: "Preview clip", modal: { kind: "clip", id: d.clip_id } }} />
          {d.status === "sent" && !d.submitted && <ActionButton a={{ label: "Mark submitted", api: `/posts/${d.id}/submitted`, body: { submitted: true } }} />}
        </div>
      </div>
    );
  if (m.kind === "upload") return <UploadLink d={d} />;
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function UploadLink({ d }: { d: any }) {
  const [link, setLink] = useState(d.link || "");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await post(`/manual-uploads/${d.id}/done`, { link });
          setMsg("Saved: it counts now and goes to Content Rewards.");
          window.dispatchEvent(new Event("posts:changed"));
        } catch (err) {
          setMsg((err as Error).message);
        }
      }}
    >
      <p className="muted small">{d.title} on {PF[d.platform]} @{d.handle}. Paste the post's link after uploading it.</p>
      <div className="jactions">
        {d.download_url && <a className="button" href={d.download_url}>Download clip</a>}
        {d.upload_page && <ActionButton a={{ label: "Upload page", url: d.upload_page }} />}
        {d.caption && <CopyButton text={d.caption} />}
      </div>
      <label>
        Post link
        <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.tiktok.com/@…/video/…" />
      </label>
      <button className="primary" disabled={!/^https:\/\//.test(link)}>
        Save link
      </button>
      {msg && <p className="small">{msg}</p>}
    </form>
  );
}
