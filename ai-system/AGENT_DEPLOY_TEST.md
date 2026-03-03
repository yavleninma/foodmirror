# AGENT_DEPLOY_TEST

Canonical guide for agents to deploy `test` branch to Railway test environment.

## Scope

- Branch: `test`
- Target environment: Railway `test`
- App service: `vivacious-achievement`
- Database service: `Postgres-6hUf`

## Required Railway setup

1. Project is linked to GitHub repo `yavleninma/foodmirror`.
2. Test environment exists (`test`).
3. App service source is set to:
- repo: `yavleninma/foodmirror`
- branch: `test`
- `Wait for CI` enabled (`checkSuites=true`).
4. Postgres service in `test` is `SUCCESS`.

## Required app variables (test env)

- `DATABASE_URL=${{Postgres-6hUf.DATABASE_URL}}`
- `TELEGRAM_BOT_TOKEN=<test bot token>`
- `OPENAI_API_KEY=<key>`
- `OPENAI_MODEL=<model>`
- `NODE_ENV=production`
- `PORT=8080`

## Runtime contract from `railway.toml`

- `preDeployCommand = "npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma"`
- `startCommand = "node apps/api/dist/index.js"`
- `healthcheckPath = "/api/health"`
- `healthcheckTimeout = 120`

Agents must not override these in Railway UI unless fixing a production incident.

## Verification after deploy

1. Railway deployment status is `SUCCESS`.
2. `GET https://vivacious-achievement-test.up.railway.app/api/health` returns:
- `{"status":"ok","version":"2.0.0"}`
3. Root URL returns HTTP `200`.
4. GitHub check for deployed commit is green: `CI / ci`.

## Fast failure triage

- Healthcheck `service unavailable`:
  - verify `PORT=8080` in app variables.
  - verify app service uses Dockerfile from repo root.
- App crash with `TELEGRAM_BOT_TOKEN is required`:
  - set `TELEGRAM_BOT_TOKEN` in app variables for `test`.
- DB connect errors:
  - verify Postgres service is up in same environment.
  - verify `DATABASE_URL` points to `${{Postgres-6hUf.DATABASE_URL}}`.
- Telegram opens old `trycloudflare` URL:
  - this is BotFather menu config, not repo code.
  - update bot menu URL in BotFather to Railway domain.

## Non-goals

- No separate bot polling/webhook process is required for Mini App opening.
- API + Postgres are enough for Mini App flow.
