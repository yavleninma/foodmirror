# FoodMirror

Персональный инструмент фиксации фактического питания. Продукт не ставит
целей, не мотивирует и не оценивает пользователя — только отражает данные
и неопределенность.

## Основной сценарий

1. Пользователь отправляет фото и/или текст.
2. LLM выделяет компоненты еды и диапазоны веса.
3. Доменная логика считает диапазоны БЖУ и ккал.
4. Пользователь подтверждает оценку.
5. Сохраненный прием пищи обновляет контекст дня.

## Быстрый старт (локально)

1. Установить зависимости:
   `npm install`
2. Создать `.env` на основе `.env.example`.
3. Поднять Postgres:
   `docker compose up -d postgres`
4. Применить миграции и сиды:
   `npm run prisma:generate`
   `npm run prisma:migrate`
   `npm run prisma:seed`
5. Импорт USDA (обязательно):
   `npm run usda:import`
6. Запуск бота:
   `npm run dev`

## Запуск в Docker

```bash
cp .env.example .env
# Заполнить в .env: TELEGRAM_BOT_TOKEN, DATABASE_URL (или POSTGRES_PASSWORD), OPENAI_API_KEY, FDC_API_KEY

docker compose up -d postgres
docker compose run --rm bot npx prisma migrate deploy
docker compose run --rm bot npx prisma db seed
docker compose run --rm usda-import   # обязательно
docker compose up -d bot
```

Если видите `User.locale does not exist` — полный сброс БД:

```bash
docker compose down -v
docker compose up -d postgres
# Подождать ~10 сек
docker compose run --rm bot npx prisma migrate deploy
docker compose run --rm bot npx prisma db seed
docker compose up -d bot
```

Если `OpenAI request timed out` — в `src/config.ts` увеличить `llm.timeoutMs` (сейчас 45 с).

## Основные команды

- `npm run dev` — запуск в режиме разработки
- `npm run build` — компиляция TypeScript
- `npm run start` — запуск собранной версии
- `npm run prisma:migrate` — миграции Prisma
- `npm run prisma:seed` — сиды справочника еды
- `npm run usda:import` — импорт USDA (обязательно)
- `npm run start:with-usda` — запуск бота и импорта USDA параллельно

## Metabase (аналитика)

Дашборд с графиками DAU, WAU, MAU доступен в Metabase. Подробности — [docs/metabase.md](docs/metabase.md).

1. `docker compose up -d` — поднимает postgres, bot, metabase
2. Открыть http://localhost:3040
3. При первом запуске — создать аккаунт админа
4. Add database → PostgreSQL (важно: Host — это имя сервиса Docker):
   - **Host:** `postgres` (именно так, не localhost — Metabase в контейнере)
   - **Port:** 5432
   - **Database name:** `foodmirror`
   - **Username:** `fm`
   - **Password:** из `.env` (POSTGRES_PASSWORD)
   - SSL: выключить
5. В Data Model появятся представления: `dau_daily`, `wau_daily`, `mau_daily`, `new_users_daily`, `meals_daily`

**Доступ к Metabase на droplet (продакшен БД):**

```bash
ssh -L 3040:localhost:3040 root@157.230.246.177
```

Держать SSH сессию открытой, открыть в браузере: http://localhost:3040

Metabase доступен на порту 3040 (зашито в docker-compose).

**Если сменили POSTGRES_PASSWORD в `.env`** — пароль в БД задаётся только при первой инициализации. Сброс с пересозданием БД: `docker compose down -v && docker compose up -d`.

## Переменные окружения

В `.env` нужны только:

- `TELEGRAM_BOT_TOKEN` — токен бота Telegram (обязательно)
- `DATABASE_URL` — строка подключения к Postgres (обязательно; в Docker собирается из POSTGRES_*)
- `OPENAI_API_KEY` — ключ OpenAI (обязательно для LLM)
- `FDC_API_KEY` — ключ USDA FoodData Central (обязательно для `npm run usda:import`)
- `ADMIN_CHAT_ID` — (опционально) chat_id админа для команд /admin
- `POSTGRES_PASSWORD` — для Docker-контейнера Postgres

Остальные настройки (модель LLM, таймауты, лимиты, пути логов) заданы в `src/config.ts`.

## Структура проекта

- `src/index.ts` — точка входа, обработка сообщений
- `src/fsm` — FSM диалога и черновиков
- `src/domain` — расчет БЖУ/ккал и дневные сводки
- `src/llm` — адаптер OpenAI и контракты
- `src/telegram` — форматирование ответов и логирование сообщений
- `prisma` — схема БД, миграции, сиды

## Документация

- `docs/README.md` — индекс
- `docs/architecture.md` — архитектура и FSM
- `docs/database.md` — модель данных
- `docs/llm.md` — контракты и логика LLM
- `docs/telegram.md` — команды и формат ответов
- `docs/operations.md` — деплой, запуск, логи
- `docs/metabase.md` — Metabase, доступ с droplet, дашборд DAU/WAU/MAU

## Принципы продукта (критично)

- Никаких целей, норм и советов.
- Всегда показывать неопределенность.
- Комментарий только про еду, не про пользователя.
