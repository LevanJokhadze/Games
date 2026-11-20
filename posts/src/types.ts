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

export interface Settings {
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
