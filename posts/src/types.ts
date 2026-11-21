export type Service = "tiktok" | "instagram" | "youtube" | string;

export interface Post {
  id: number;
  clip_id: number;
  service: Service;
  channel_name: string | null;
  buffer_post_id: string;
  due_at: string | null;
  sent_at: string | null;
  status: string;
  external_link: string | null;
  error: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  submitted: boolean;
  submit_status: "pending" | "submitted" | "failed" | "agent" | "manual" | null;
  submit_method: string | null;
  submit_error: string | null;
  submit_attempts: number | null;
  submit_deadline: string | null;
  submitted_at: string | null;
  title?: string;
  thumb_url?: string | null;
  campaign?: string;
  campaign_url?: string | null;
  est_pay?: number;
  views_needed?: number;
}

export interface Clip {
  id: number;
  title: string | null;
  caption: string | null;
  video_url: string | null;
  thumb_url: string | null;
  duration: number | null;
  status: string;
  created_at: string;
  twitch_views: number | null;
  source_url: string | null;
  source_title: string | null;
  campaign: string | null;
  /** the on-screen hook burned into the first seconds */
  hook_text?: string | null;
  posts: Post[];
}

export interface Heartbeat {
  worker: string;
  last_start: string | null;
  last_ok: string | null;
  last_error_at: string | null;
  last_error: string | null;
  runs: number;
}

export interface BufferWindow {
  quota: number;
  remaining: number;
  reset_at: number;
}

export interface Settings {
  buffer_limits?: Record<string, BufferWindow>;
  buffer_paused_until?: number;
  auto_approve: boolean;
  workers_paused: boolean;
  slots_et: string[];
  max_posts_per_day: number;
  /** per-platform daily caps, e.g. { youtube: 1 } */
  max_per_day_by_service?: Record<string, number>;
  /** minimum minutes between two posts on the same account */
  min_gap_minutes?: number;
  stagger_minutes: number;
  services: string[];
  /** per-geo posting slots in the geo's own timezone, e.g. { RU: { tz: "Europe/Moscow", slots: ["15:00","20:00"] } } */
  geo_slots?: Record<string, { tz: string; slots: string[] }>;
}

export interface Overview {
  clips: Record<string, number>;
  posts: Record<string, number>;
  moments: Record<string, number>;
  totals: { views: number; likes: number; comments: number; shares: number };
  est_earnings: number;
  paying_posts: number;
  by_service: { service: string; sent: number; views: number }[];
  upcoming: { id: number; service: string; channel_name: string; due_at: string; title: string; thumb_url: string | null }[];
  to_submit: number;
  submit_failed: number;
  workers: Heartbeat[];
  settings: Settings;
  campaigns?: Pick<Campaign, "id" | "name" | "url" | "cpm" | "min_payout" | "max_payout" | "active" | "ended_at" | "end_reason">[];
}

export interface Analytics {
  daily: { day: string; service: string; views: number }[];
  top: (Post & { title: string })[];
  per_campaign: { name: string; cpm: number; posts: number; views: number }[];
  funnel: { moments: number; clips: number; approved: number; posted: number };
}

export interface Moment {
  id: number;
  channel: string;
  external_id: string;
  title: string;
  views: number;
  duration: number;
  url: string;
  status: string;
  reason: string | null;
  clip_created_at: string | null;
  discovered_at: string;
}

export interface Campaign {
  id: number;
  name: string;
  url: string | null;
  cpm: number;
  min_payout: number;
  max_payout: number | null;
  channels: string[];
  game: string | null;
  caption_template: string;
  overlay_url: string | null;
  overlay_width: number;
  overlay_y: number;
  captions: string;
  cam_box: string | null;
  title_secs: number;
  daily_quota: number;
  min_clip_views: number;
  lookback_hours: number;
  rules: string | null;
  active: boolean;
  whop_bounty_id: string | null;
  submit_url: string | null;
  submit_window_minutes: number | null;
  streamer_name: string | null;
  ended_at: string | null;
  end_reason: string | null;
  /** clip length around the payoff (seconds) */
  target_secs: number | null;
  /** open with a 2 s teaser of the payoff */
  teaser: boolean | null;
  /** punch-in zooms on the payoff */
  punch_zoom: boolean | null;
  layout: string | null;
  /** language of the AI title, hook and caption line: "en" or "ru" */
  language: string | null;
  /** geo code whose accounts get this campaign's clips (e.g. "RU"); empty = the default (US) accounts */
  geo: string | null;
  /** post title wrapper, "{title}" = the AI title */
  title_template: string | null;
  /** sponsor banner video (BigBalls): inserted at the payoff with the clip paused; null = no banner */
  banner_url: string | null;
  /** banner width in px of 1080 (may be wider: the frame crops it); 0 = fit the banner's artwork to the clip width */
  banner_width: number | null;
  /** key colour like 0x00FF00; empty = automatic (alpha channel or the corner colour), "none" = no keying */
  banner_key: string | null;
  /** split layout: bottom videos to use instead of the built-in satisfying loops */
  bottom_urls: string[];
  /** split layout bottom when bottom_urls is empty: race (drawn per clip), mix, bounce, plinko, pendulum */
  bottom_kind: string;
  /** hashtags whose most-viewed Shorts/Reels nobody split-screened yet get re-cut into Review */
  trend_tags: string[];
  trend_min_views: number;
}

export interface TrendVideo {
  id: number;
  platform: string;
  video_id: string;
  url: string;
  title: string;
  channel: string;
  tag: string;
  views: number;
  verdict: "new" | "split" | "taken" | "unchecked";
  reason: string | null;
  checked_at: string;
  moment_id: number | null;
  moment_status: string | null;
  clip_id: number | null;
}

export interface EventRow {
  id: number;
  ts: string;
  level: string;
  worker: string;
  message: string;
}

export type Platform = "instagram" | "tiktok" | "youtube";
export type AccountStatus = "warming" | "active" | "paused" | "banned" | "retired";

export interface Geo {
  id: number;
  code: string;
  name: string;
  sort: number;
}

/** Stats the pipeline measured for the account's Buffer channel. */
export interface AccountPipeline {
  posts: number;
  scheduled: number;
  failed: number;
  views: number;
  likes: number;
  comments: number;
  best_views: number;
  views_7d: number;
  paying: number;
  last_post_at: string | null;
  metrics_at: string | null;
}

export interface Account {
  id: number;
  geo_id: number;
  platform: Platform;
  handle: string;
  login: string | null;
  has_password: boolean;
  profile_url: string | null;
  status: AccountStatus;
  streamers: string[];
  buffer_channel_id: string | null;
  followers: number | null;
  total_views: number | null;
  total_posts: number | null;
  total_likes: number | null;
  stats_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  pipeline: AccountPipeline | null;
  /** manual = the pipeline emails a reminder to upload by hand at each slot; automatic = posted through Buffer. */
  upload_mode: UploadMode;
  manual_since: string | null;
  week_hint_at: string | null;
  manual: ManualInfo | null;
  /** takes clips of sponsor banner campaigns (BigBalls) */
  banners: boolean;
}

export type UploadMode = "manual" | "automatic";

/** A clip emailed to a manual account to upload by hand. */
export interface ManualUpload {
  id: number;
  account_id: number;
  clip_id: number;
  slot_at: string;
  emailed_at: string | null;
  done_at: string | null;
  link: string | null;
  title: string | null;
  thumb_url: string | null;
  video_url: string | null;
}

export interface ManualInfo {
  /** day of manual uploads, 1 on the first day */
  day: number;
  next_at: string | null;
  /** timezone this account's slots are planned in (its geo's, default America/New_York) */
  slot_tz?: string | null;
  uploads: ManualUpload[];
}

export interface BufferChannel {
  id: string;
  name: string | null;
  service: string | null;
  connected: boolean;
}

export interface AccountsData {
  geos: Geo[];
  accounts: Account[];
  buffer_channels: BufferChannel[];
  streamers: string[];
  encryption_ready: boolean;
  email_ready: boolean;
  services: string[];
}

export interface SubmitStatus {
  auto_submit: boolean;
  methods: string[];
  whop: { configured: boolean; connected: boolean; redirect_uri: string | null; connected_at: string | null };
  browser: {
    installed: boolean;
    session: boolean;
    saved_at: string | null;
    check: { ok: boolean; at: number; error?: string; screenshot?: string | null } | null;
  };
  agent: { configured: boolean };
  vault: boolean;
  counts: Record<string, number>;
}

export interface WhopBounty {
  id: string;
  title: string | null;
  status: string | null;
  goal: string | null;
  host: string | null;
}

/** One item on the posting calendar. Times are given in Tbilisi (day, time) and US Eastern (time_et). */
export interface CalendarEvent {
  /** manual = you upload it by hand; automatic = Buffer posts it */
  kind: "manual" | "automatic";
  /** manual: planned (forecast), to_upload (emailed), done, posted. automatic: the Buffer post status */
  status: string;
  at: string;
  day: string;
  time: string;
  time_et: string;
  /** the same time where the account's audience is, and that zone's name ("US Eastern", "Moscow") */
  slot_time?: string;
  slot_zone?: string;
  platform: string;
  handle: string | null;
  account_id: number | null;
  profile_url: string | null;
  upload_page: string | null;
  upload_id?: number | null;
  post_id?: number;
  link: string | null;
  error?: string | null;
  clip_id: number | null;
  title: string | null;
  caption: string | null;
  thumb_url: string | null;
  video_url: string | null;
  download_url: string | null;
}

export interface CalendarData {
  timezone: string;
  today: string;
  start: string;
  days: number;
  now: string;
  slots_et: string[];
  slots_local: string[];
  email_ready: boolean;
  manual_accounts: number;
  /** the posting plan the workers follow */
  plan?: {
    slots_local: string[];
    per_day: Record<string, number>;
    min_gap_minutes: number;
    stagger_minutes: number;
    /** other geos' own slots: their zone, the slots there and the same slots in Tbilisi time */
    geo_slots?: Record<string, { zone: string; slots: string[]; local: string[] }>;
  };
  events: CalendarEvent[];
}
