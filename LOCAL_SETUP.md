# Запуск локально

## 1. PostgreSQL

### Вариант A: Docker (проще всего)

```bash
docker run -d -p 5432:5432 ^
  -e POSTGRES_USER=postgres ^
  -e POSTGRES_PASSWORD=postgres ^
  -e POSTGRES_DB=foodmirror ^
  --name foodmirror-db ^
  postgres:16-alpine
```

На Linux/Mac замени `^` на `\` в конце строк.

**DATABASE_URL:** `postgresql://postgres:postgres@localhost:5432/foodmirror`

### Вариант B: Установленный PostgreSQL

Если PostgreSQL уже установлен, создай базу:

```sql
CREATE DATABASE foodmirror;
CREATE USER foodmirror WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE foodmirror TO foodmirror;
```

**DATABASE_URL:** `postgresql://foodmirror:your_password@localhost:5432/foodmirror`

### Вариант C: PostgreSQL с Railway

Можно использовать ту же БД, что и в проде:
- Railway Dashboard → твой проект → PostgreSQL сервис → Variables → скопируй `DATABASE_URL`

---

## 2. Настройка .env

```bash
cp .env.example .env
```

Отредактируй `.env`:

```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...     # от @BotFather
OPENAI_API_KEY=sk-...                     # от platform.openai.com
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/foodmirror   # см. выше
PORT=3000
NODE_ENV=development
```

---

## 3. Установка и запуск

```bash
# Установить зависимости
npm install

# Создать таблицы в БД
npm run db:push

# Терминал 1 — бэкенд (порт 3000)
npm run dev:api

# Терминал 2 — фронтенд (порт 5173)
npm run dev:web
```

Открой **http://localhost:5173** — фронтенд с прокси на API.

В браузере вне Telegram включается guest-режим:
- доступен флоу `фото → инсайт`,
- личные функции (история, статистика, профиль) доступны только внутри Telegram.

---

## 4. Проверка

- **API health:** http://localhost:3000/api/health → `{"status":"ok","version":"2.0.0"}`
- **Фронт:** http://localhost:5173 — должен открыться (initData будет пустым вне Telegram)

---

## 5. Mini App в Telegram

Для полного теста нужен Telegram: Mini App берёт `initData` только внутри бота.

1. Создай бота через @BotFather
2. Через ngrok или аналог пробрось localhost:3000
3. В @BotFather: `/setmenubutton` → URL `https://твой-ngrok-адрес/`

Или дождись деплоя на Railway и укажи там URL.

---

## 6. Solo CI and tests (new/test/main)

Branch/deploy flow:
- `new` -> CI only (no auto deploy)
- `test` -> CI + Railway staging deploy
- `main` -> CI + Railway production deploy

Run local CI pipeline:

```bash
npm run ci
```

Useful test commands:

```bash
npm run test:api
npm run test:web
npm run test:smoke
```

Notes:
- `test:smoke` checks browser guest mode (no Telegram login required).
- For first local Playwright run, install browser once:

```bash
npx playwright install chromium
```

---

## 7. Local Telegram login stub in browser

Use this when you want browser flow with Telegram-only screens (`history/stats/profile`) without real Telegram login.

1. Enable API dev mock in `.env` (root):

```env
DEV_TELEGRAM_MOCK_ENABLED=1
DEV_TELEGRAM_MOCK_USER_ID=900001
DEV_TELEGRAM_MOCK_FIRST_NAME=Local
DEV_TELEGRAM_MOCK_USERNAME=local_dev
```

2. Start backend and frontend as usual:

```bash
npm run dev:api
npm run dev:web
```

3. Open frontend with mock flag in URL:

```text
http://localhost:5173/?tgMock=1
```

Optional frontend env alternative (`apps/web/.env.local`):

```env
VITE_DEV_TELEGRAM_MOCK=1
VITE_DEV_TELEGRAM_USER_ID=900001
VITE_DEV_TELEGRAM_FIRST_NAME=Local
VITE_DEV_TELEGRAM_USERNAME=local_dev
```

Safety:
- Mock works only when API `NODE_ENV=development` and `DEV_TELEGRAM_MOCK_ENABLED=1`.
- In production this dev initData format is ignored.
