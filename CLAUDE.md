# FoodMirror — Agent Context

## Project Summary

FoodMirror is a meal-photo logging app with AI calorie/macro estimation, daily history, body-weight tracking, and Telegram bot integration. Users authenticate exclusively through Telegram in production (bot sends a one-time auth link; web opens already logged in). The web interface has no frontend build step. Production runs on Vercel with Redis for persistence.

## Tech Stack

- Frontend: Vanilla JS + CSS, no framework, no build step — single files `assets/app.js` and `assets/styles.css`
- Backend: Vercel Serverless Functions (Node.js, CommonJS) in `api/`
- Storage: Redis in production (`REDIS_URL`), `data/dev-store.json` locally as fallback
- AI: OpenAI Vision API, default model `gpt-4.1-mini` (override via `OPENAI_MODEL`)
- Auth: Telegram one-time tokens + HMAC-signed cookie sessions
- Telegram: webhook at `/api/telegram/webhook`

## Repository Layout

```
index.html                  app shell loaded by the browser
assets/app.js               all frontend SPA logic (single file)
assets/styles.css           all UI styles (single file)
api/auth.js                 auth endpoint (session check, login, logout)
api/app.js                  main data endpoint (meals, weight, drafts)
api/health.js               health check
api/telegram/webhook.js     Telegram bot webhook handler
api/_lib/auth.js            session signing/verification, Telegram WebApp auth helpers
api/_lib/storage.js         persistence layer (Redis or file fallback) — shared by all routes
api/_lib/food.js            OpenAI Vision meal analysis
api/_lib/telegram.js        Telegram API helpers
docs/launch-checklist-ru.md step-by-step deployment guide (Russian)
docs/collaborator-access-checklist.md  access setup for collaborators
.env.example                canonical list of all environment variables
```

`api/_lib/` is shared code imported by multiple API routes. Changes there affect all handlers.

## Local Development

1. `cp .env.example .env` — fill in the four required values (see below)
2. `npm install`
3. `npm start` — runs `vercel dev`, opens a local URL
4. Without `REDIS_URL` in `.env`, data is saved to `data/dev-store.json` (gitignored, never commit)
5. `ALLOW_WEB_SIGNIN` auto-enables locally, so a web sign-in form appears without needing Telegram

## Environment Variables

See `.env.example` for the full list. Four are required for a real deployment:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Meal photo analysis via GPT-4.1 Vision |
| `REDIS_URL` | Production persistence (Vercel Marketplace Redis) |
| `TELEGRAM_BOT_TOKEN` | Bot authentication and webhook |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook request validation |

Optional overrides worth knowing:

| Variable | Default | Effect |
|---|---|---|
| `OPENAI_MODEL` | `gpt-4.1-mini` | Override AI model |
| `APP_TIMEZONE` | `Asia/Bangkok` | Timezone for "today" date boundary |
| `APP_BASE_URL` | auto-detected | Override base URL for auth links |
| `ALLOW_WEB_SIGNIN` | `true` locally, `false` in prod | Enable web-only sign-in |
| `AUTH_SECRET` | value of `TELEGRAM_BOT_TOKEN` | Session signing key |

## How Authentication Works

This is the most architecturally unusual part:

1. User sends `/start` to the Telegram bot
2. Server creates a one-time auth token (15-min TTL, stored in Redis)
3. Bot sends a URL like `https://app.vercel.app/?auth=TOKEN`
4. Frontend calls `POST /api/auth` with `action: exchange_token`
5. Server validates the token and sets a signed session cookie (`foodmirror_session`, 30-day TTL)

When a food photo is sent to the bot, the same flow runs but also includes a `draftId`, so the web app opens directly on that draft.

Telegram WebApp sign-in (`action: telegram_webapp_signin`) verifies `initData` HMAC using the bot token.

Sessions are HMAC-signed cookies. The browser never decides identity — the server session does.

## API Endpoints

| Method | Path + action | Purpose |
|---|---|---|
| GET | `/api/auth?action=session` | Check current session, get bot login URL |
| POST | `/api/auth` `action: logout` | Log out |
| POST | `/api/auth` `action: web_signin` | Direct web sign-in (dev only) |
| POST | `/api/auth` `action: exchange_token` | Exchange one-time token for session |
| POST | `/api/auth` `action: telegram_webapp_signin` | Sign in from Telegram WebApp initData |
| GET | `/api/app?action=bootstrap` | Load all user data (entries, weights, drafts, calendar) |
| POST | `/api/app` `action: analyze_food` | Analyze meal photo with OpenAI |
| POST | `/api/app` `action: save_food` | Save a food entry |
| POST | `/api/app` `action: reuse_food` | Repeat a previous food entry |
| POST | `/api/app` `action: delete_food` | Delete a food entry |
| POST | `/api/app` `action: save_weight` | Save a weight entry |
| POST | `/api/app` `action: delete_weight` | Delete a weight entry |
| POST | `/api/telegram/webhook` | Telegram bot updates |
| GET | `/api/health` | Health check |

## Deployment Workflow

Pushes to `main` auto-deploy to Vercel production once GitHub integration is connected (see `docs/collaborator-access-checklist.md` for setup). Every other branch gets a Vercel preview URL.

For manual deploy: `npx vercel --prod`

If new environment variables were added, set them in Vercel dashboard > Settings > Environment Variables before deploying.

After first deploy or if the bot domain changes: re-register the Telegram webhook (see `docs/launch-checklist-ru.md`).

## Data Model

All user data lives in a single Redis key `foodmirror-store-v2` as a JSON blob:

```json
{
  "profiles": { "<userId>": {} },
  "foodEntries": { "<userId>": [] },
  "weightEntries": { "<userId>": [] },
  "drafts": { "<draftId>": {} },
  "authTokens": { "<token>": {} }
}
```

User IDs: Telegram users are `tg-<telegramId>` (e.g. `tg-123456789`). Web-only users get a generated `web_` prefix.

## Common Tasks

**Add a new API action:** Add `if (body.action === '...') { ... }` in `api/app.js`. Add storage helpers to `api/_lib/storage.js` if needed.

**Add a new bot command:** Handle it in `api/telegram/webhook.js` by matching `update.message?.text`.

**Change AI behavior:** Edit the prompt in `api/_lib/food.js` — `analyzeMealFromImage` is the only entry point.

**Change UI:** Edit `assets/app.js` or `assets/styles.css` directly. No build step needed.

**Test health:** `GET /api/health` returns `{ ok: true }`.

**Run webhook locally:** Use a tunnel tool (e.g. `ngrok`) to expose local port, then set the Telegram webhook to the tunnel URL.

## Watch-outs

- No `vercel.json` exists and none is needed — Vercel auto-detects `api/` functions and serves `index.html` as root
- Default timezone is `Asia/Bangkok` — "today" means today in Bangkok time; dates may appear off-by-one when testing from other timezones
- `AUTH_SECRET` defaults to `TELEGRAM_BOT_TOKEN` — if you set it to something different in production, all existing sessions immediately invalidate
- `data/dev-store.json` is gitignored — never commit it
- Auth tokens expire in 15 minutes — stale tokens return `401 { error: "Token is invalid or expired" }`
- If OpenAI is not configured, the app still creates fallback drafts so the flow can be tested end-to-end
