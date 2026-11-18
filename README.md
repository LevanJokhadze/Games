# Games — Joker web app

Frontend for **Joker** (ჯოკერი), the Georgian four-player trick-taking card game.
Play online with friends in a private room or against bots. Built phone-first: portrait and
landscape, touch controls, safe-area insets, installable to the home screen. Georgian and English UI.

Backend (rules engine, rooms, bots): [LevanJokhadze/GamesBack](https://github.com/LevanJokhadze/GamesBack).

Stack: Vite + React + TypeScript, served as static assets on **Cloudflare Workers**. Card art is
drawn with CSS and inline SVG (the jokers are an original jester drawing, `src/components/JokerArt.tsx`).

## Features

- Registration: nickname, first name, last name and photo are all required (the photo is cropped
  to a square on the phone). "Sign in on another device" gives a private link for your other phones.
- Global leaderboard with chess Elo, your match history, and a summary of every match
  (places, rating changes and the full score sheet).
- Themes: table (green felt, ocean, burgundy, night, wood), card back (red, navy, emerald,
  black & gold) and card faces (classic or four colours). Saved on the device.
- Play in pairs: partners sit opposite, team totals decide the winner.
- Home: play with bots in one tap, create a room for friends, or join with a 5-letter code.
- Lobby: share link (uses the phone's share sheet), seats, add/remove bots, game type and khishti penalty.
- Table: opponents around the table, trick in the centre, your hand fanned to fit any width.
  Tap a card to pick it and tap again to play (single click on desktop). Unplayable cards are dimmed.
- Bidding pad (the dealer's forbidden number is crossed out), trump picker for 9-card deals,
  joker dialog (high/low, and the suit when leading), an always-visible score strip (names and points, or team totals in pairs) that opens the
  full scoreboard by pulka, rules sheet. Game over shows everyone's rating change.
- Reconnects automatically; if you drop out a bot plays your turn after a short wait.

## Development

```bash
npm install
npm run dev     # http://localhost:5173
```

Run the backend next to it (`npm run dev` in GamesBack, port 8787). When the site is opened on
`localhost` or a LAN IP, it talks to port 8787 on the same host, so you can test from a phone on
the same Wi-Fi with `http://<your-computer-ip>:5173`.

## Configuration

| Variable | Meaning |
| --- | --- |
| `VITE_API_URL` | URL of the GamesBack server (production default in `.env.production`: the Railway service), e.g. `https://joker-api.example.com`. Build-time. If empty, the site calls its own origin (use this when the API is routed under the same hostname at `/api/*`). |

Copy `.env.example` to `.env.local` to set it locally.

## Deploy to Cloudflare Workers

1. Deploy GamesBack first and note its URL.
2. `npm install` and `npx wrangler login` (or set `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
3. Build with the API URL and deploy:
   ```bash
   VITE_API_URL=https://joker-api.example.com npm run deploy
   ```
   This builds to `dist/` and uploads it as a static-assets Worker named `joker-frontend`
   (`wrangler.jsonc`), with single-page-app fallback.
4. Custom subdomain: `routes` in `wrangler.jsonc` is set to `joker.lane.ge`; change it for another domain, e.g.
   `{ "pattern": "joker.example.com", "custom_domain": true }`, and deploy again. Or add it in the
   dashboard under Workers & Pages → joker-frontend → Settings → Domains & Routes.
5. Add that origin to `ALLOWED_ORIGINS` in GamesBack and redeploy the backend.

Using Workers Builds (Git integration) instead: set the build command to `npm run build`, the deploy
command to `npx wrangler deploy`, and add `VITE_API_URL` as a build variable.
