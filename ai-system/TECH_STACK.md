# TECH_STACK

## Текущий стек (v2.0)

### Монорепо

- **Инструмент:** npm workspaces
- **Пакеты:**
  - `apps/api/` — Express 5 + TypeScript + Prisma
  - `apps/web/` — React 19 + TypeScript + Vite 6 + Tailwind 4
  - `packages/shared/` — общие типы и константы

### Фронтенд (`apps/web/`)

- React 19, TypeScript 5.7, Vite 6, Tailwind CSS 4
- Telegram SDK через `hooks/useTelegram.ts`
- HTTP-клиент: `src/lib/api.ts`
- Команды:
  - `npm run dev:web`
  - `npm run build:web`

### Бэкенд (`apps/api/`)

- Express 5, TypeScript 5.7
- Prisma 6 + PostgreSQL 16
- Валидация: Zod
- Загрузка фото: multer (memory storage)
- Команды:
  - `npm run dev:api`
  - `npm run build:api`
  - `npm start`
  - `npm run db:migrate`
  - `npm run db:push`
  - `npm run db:studio`

### Общие пакеты (`packages/shared/`)

- Типы API: `InsightResponse`, `HistoryResponse`, `StatsResponse`, `UserGoalResponse`, `HealthResponse`, `ApiError`
- Константы: `DEFAULT_GOAL`, `HISTORY_PAGE_SIZE`, `MAX_PHOTO_SIZE_MB`, `KNOWN_VERDICTS`

### AI

- OpenAI `gpt-4o-mini` (vision)
- Переменные: `OPENAI_API_KEY`, `OPENAI_MODEL`

### Авторизация и режимы доступа

- `telegram`: по `X-Init-Data` (HMAC-SHA256 валидация)
- `guest`: по `X-Guest-Token` (веб-режим вне Telegram)
- `anonymous`: fallback по IP+User-Agent

Личные эндпоинты (`/api/history`, `/api/stats`, `/api/user/*`) доступны только в Telegram режиме.

### Деплой

- Railway (web service + PostgreSQL)
- В продакшене `apps/web/dist` сервится через `express.static` из API
- Переменные окружения: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, `NODE_ENV`

## Правила обновления

1. При изменении стека обновить этот файл.
2. Если изменился контракт API или БД, обновить `API_SPEC.md` и/или `DATA_MODEL.md`.
