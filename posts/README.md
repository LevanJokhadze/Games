# posts — clip pipeline dashboard (posts.lane.ge)

Separate app from the Joker frontend in this repo: its own folder, `package.json` and deploy.
API and 24/7 workers: [LevanJokhadze/GamesBack](https://github.com/LevanJokhadze/GamesBack) `posts/`.

Pages:
- **Overview**: today's to-do (clips to review, live posts to submit on Content Rewards), views, estimated earnings
  (per post, $0 below the campaign minimum), live/scheduled/failed posts, worker health, next posts.
- **Review**: each new clip with its video, the viewer's Twitch title, editable post title and caption;
  Approve & schedule or Reject.
- **Posts**: every Buffer post with status, public link (copy), views, likes, estimated pay, views still
  needed for the minimum, and a "submitted" tick for Content Rewards.
- **Accounts**: geos (US, Russia, add more) → Instagram / TikTok / YouTube → each account with its login, password
  (hidden until you press show; stored encrypted on the server), status, target streamers and stats. Accounts linked
  to a Buffer channel show the pipeline's views and posts; others take stats typed in by hand.
- **Analytics**: views per day by platform, pipeline funnel, campaigns, top posts with engagement rate
  (campaign needs 0.8%+).
- **Moments**: Twitch clips found, their status and why one was skipped; retry.
- **Campaigns**: channels, game, payout, daily quota, caption template, overlay, webcam box, rules.
- **Workers & settings**: heartbeats, run a worker now, pause, auto-approve, US-Eastern posting slots, log.

## Development

```bash
cd posts
npm install
npm run dev        # http://localhost:5173, talks to the API on http://localhost:8099
```

`VITE_API_URL` (build-time) is the API base URL. Login uses the API's `ADMIN_PASSWORD`.

## Deploy (Railway)

Service with root directory `posts`; it builds the `Dockerfile` and serves `dist/` with `serve` on `$PORT`.
Set `VITE_API_URL` on the service, then add the custom domain `posts.lane.ge`
(a CNAME record in the lane.ge Cloudflare zone pointing to the target Railway shows).

Railway: project "Posts" (auto-deploys from `main`), service `posts-web-src` (root `/posts`, branch `posts`).
