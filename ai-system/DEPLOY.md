# DEPLOY — Railway

## 1. PostgreSQL

1. Открой [Railway Dashboard](https://railway.app/dashboard).
2. Создай проект или выбери существующий.
3. Добавь сервис: **New → Database → PostgreSQL**.
4. Убедись, что доступна переменная `DATABASE_URL`.

## 2. Web Service

1. **New → GitHub Repo** и выбери `foodmirror`.
2. Railway использует `Dockerfile` из корня репозитория.
3. Для сервиса задай переменные:

| Переменная | Значение |
|------------|----------|
| `DATABASE_URL` | reference на PostgreSQL сервиса |
| `TELEGRAM_BOT_TOKEN` | токен от BotFather |
| `OPENAI_API_KEY` | ключ OpenAI |
| `NODE_ENV` | `production` |
| `PORT` | `3000` (опционально) |

## 3. Старт-команда

Используется из `railway.toml`:

```bash
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma && node apps/api/dist/index.js
```

## 4. Проверка после деплоя

1. `GET /api/health` возвращает `{"status":"ok","version":"2.0.0"}`
2. Открывается корневой URL фронтенда
3. В Telegram Mini App корректно передаётся `initData`

## 5. Telegram Mini App URL

В @BotFather:

1. `/setmenubutton`
2. выбрать бота
3. установить URL на домен Railway сервиса

Локальный запуск описан в [`LOCAL_SETUP.md`](../LOCAL_SETUP.md).

---

## 6. Branch mapping and CI gate

Solo branch model:
- `new`: CI only
- `test`: deploy to staging
- `main`: deploy to production

Railway setup requirements:
1. Create two Railway services (or two environments): `staging` and `production`.
2. Attach Git branch `test` to staging and `main` to production.
3. Enable `Wait for CI` in both services.
4. Keep healthcheck path `/api/health`.

Required env vars in both services (with different values by environment):
- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `NODE_ENV=production`
- `PORT=3000`

CI check name from GitHub Actions:
- Workflow: `CI`
- Job: `ci`
- Visible status check: `CI / ci`
