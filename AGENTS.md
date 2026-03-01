# AGENTS.md

## Cursor Cloud specific instructions

### Overview

FoodMirror is a Telegram bot (Node.js 20 / TypeScript) for personal food tracking. It uses PostgreSQL 16 (via Docker Compose), Prisma ORM, and OpenAI API.

### Services

| Service | How to start | Port |
|---------|-------------|------|
| PostgreSQL | `sudo docker compose up -d postgres` | 5432 |
| Bot (dev) | `npm run dev` | — (Telegram polling) |
| Metabase (optional) | `sudo docker compose up -d metabase` | 3040 |

### Required environment variables

`TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, `FDC_API_KEY`, `DATABASE_URL`, `POSTGRES_PASSWORD` — see `.env.example`.

### Gotchas

- **DATABASE_URL hostname**: For local (non-Docker) commands (`npm run dev`, `prisma migrate`, seeds, scripts), `DATABASE_URL` must use `127.0.0.1` as the host, not `postgres`. The `.env.example` uses `postgres` (Docker service name) which only works inside Docker networking. Export `DATABASE_URL` with `127.0.0.1` before running any Prisma or bot commands outside Docker.
- **Prisma CLI and `.env` parsing**: Prisma's built-in dotenv sometimes misreads unquoted URLs with `?`. If `npx prisma` commands resolve the wrong host, export `DATABASE_URL` as a shell environment variable before running them.
- **Docker in nested container**: This cloud VM runs inside a Firecracker VM. Docker requires `fuse-overlayfs` storage driver and `iptables-legacy`. These are configured during initial setup.
- **USDA import**: After fresh DB setup, `npm run usda:import` is mandatory (needs `FDC_API_KEY`). Without it, the bot falls back to LLM-generated nutritional data. Also run `npm run seed:aliases` for Russian food name aliases.
- **Pre-commit hook**: `.husky/pre-commit` runs `npm run prisma:migrate:pre-commit` which does `docker compose run --rm bot npx prisma migrate deploy`. This requires Docker and a built bot image. In Cloud Agent, you may need to skip this hook with `git commit --no-verify` if the bot Docker image is not built.

### Standard commands

See `README.md` for full command list. Key dev commands: `npm run dev`, `npm run build`, `npx tsc --noEmit`, `npx tsx scripts/smoke-test-bot.ts`.
