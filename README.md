# FoodMirror

FoodMirror is a Vercel-first MVP for meal-photo logging, AI calorie/macros estimation, daily history, body-weight tracking, and unified Telegram/web auth.

## Storage decision

Production storage is Redis via Vercel Marketplace.

Why this choice for v0:

- persistent across deploys and restarts
- works on the Vercel + Marketplace flow without managing a database server
- very fast to wire
- good enough for a small real user group now
- simpler than introducing Postgres before we actually need relational queries

Local development still falls back to `data/dev-store.json`.

## Auth model

FoodMirror now uses one server-side session model for every entry point.

- Telegram bot creates a one-time auth token and opens the web app already in the correct user account
- Telegram WebApp can sign in from `initData`
- production can stay Telegram-only for one shared identity system across bot and web
- optional direct web sign-in exists only when `ALLOW_WEB_SIGNIN=true`
- the browser no longer decides identity by itself; the server session does

## Included now

- web / Mini App interface without a frontend build step
- serverless JSON API on Vercel
- unified auth API with cookie session
- meal photo upload from web
- AI draft generation with calories and P/F/C
- quick draft editing and saving
- day totals, history, and 21-day calendar view
- body-weight entries per day
- repeat previous meal entry
- Telegram webhook flow that converts incoming food photos into authenticated editable drafts
- RU / EN interface switching
- Redis support for production persistence

## Main files

- `index.html` - app shell
- `assets/app.js` - frontend logic
- `assets/styles.css` - UI styling
- `api/auth.js` - auth API
- `api/app.js` - main app API
- `api/telegram/webhook.js` - Telegram bot webhook
- `api/_lib/auth.js` - session and Telegram auth helpers
- `api/_lib/storage.js` - persistence layer
- `api/_lib/food.js` - AI meal analysis
- `api/_lib/telegram.js` - Telegram helpers
- `docs/foodmirror-v0-spec.md` - saved product spec
- `docs/launch-checklist-ru.md` - simple launch checklist in Russian

## Environment variables

Copy `.env.example` to `.env` locally or add the same variables in Vercel.

Minimum required values for the real launch:

- `OPENAI_API_KEY`
- `REDIS_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

Optional overrides:

- `APP_TIMEZONE`
- `APP_BASE_URL`
- `TELEGRAM_BOT_NAME`
- `AUTH_SECRET`
- `ALLOW_WEB_SIGNIN`

Compatibility fallback:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

## Local run

1. Install dependencies: `npm install`
2. Start local Vercel dev server: `npx vercel dev`
3. Open the local URL shown by Vercel

## Deploy to Vercel

1. Link the repo to Vercel.
2. In Vercel Marketplace / Storage, create Redis for this project.
3. Add all env variables from `.env.example`.
4. Deploy the app.
5. Set the Telegram webhook to `/api/telegram/webhook`.
6. Open the bot and use `/start` to get an authenticated open-app button.

Example webhook setup:

```powershell
$body = @{
  url = 'https://YOUR_DOMAIN/api/telegram/webhook'
  secret_token = 'YOUR_SECRET'
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "https://api.telegram.org/bot$env:TELEGRAM_BOT_TOKEN/setWebhook" `
  -ContentType 'application/json' `
  -Body $body
```

## Notes

- If OpenAI is not configured yet, FoodMirror still creates fallback drafts so the flow can be tested end-to-end.
- Vercel file storage is not the production persistence strategy; Redis is.
- Postgres can be added later if we want richer reporting and SQL analytics, but it is not necessary for the first live version.
