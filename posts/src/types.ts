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
  stagger_minutes: number;
  services: string[];
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
  workers: Heartbeat[];
  settings: Settings;
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
  events: CalendarEvent[];
}
