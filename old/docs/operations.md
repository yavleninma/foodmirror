# Операции

## Часовой пояс

Сервер должен работать в **UTC**. Границы дней (`toDayKey`) и напоминания (`REMINDER_HOUR`) используют UTC.
Если время показывается пользователю — используйте данные из Telegram (message.date и т.п.).

## Запуск через Docker

1. Заполнить `.env` (см. `.env.example`).
2. Запустить Postgres:
   `docker compose up -d postgres`
3. Применить миграции и сиды:
   `docker compose run --rm bot npx prisma migrate deploy`
   `docker compose run --rm bot npx prisma db seed`
4. Импорт USDA (обязательно):
   `docker compose run --rm usda-import`
5. Запустить бота:
   `docker compose up -d --build bot`

**Параллельный запуск:** бот и импорт USDA можно запускать одновременно (оба пишут/читают в одну БД):
   `docker compose up -d bot usda-import`
   Бот стартует сразу; импорт работает в фоне. При первом деплое лучше выполнить `usda-import` до подъёма бота.

## Локальный запуск без Docker

1. Заполнить `.env` и поднять Postgres отдельно.
2. `npm install`
3. `npm run prisma:generate`
4. `npm run prisma:migrate`
5. `npm run prisma:seed`
6. `npm run dev`

## Деплой

Скрипт `deploy.sh`:

- обновляет репозиторий до `origin/main`
- останавливает и удаляет контейнер Postgres (данные в volume сохраняются)
- поднимает Postgres заново
- применяет миграции и сиды
- **импортирует USDA** (для корректного отображения «источник: USDA FoodData Central» вместо «внутренний источник»)
- пересобирает и запускает контейнер бота

**Важно:** для импорта USDA нужен `FDC_API_KEY` в `.env` на сервере. Без него импорт не выполнится — все продукты будут показывать «источник: внутренний источник».

Переменные окружения бота в Docker задаются в `docker-compose.yml`. Для переопределения `DRAFT_MAX_MESSAGES`, `ERROR_LOG_PATH` и др. — добавить их в секцию `environment` сервиса `bot`.

## Логи

- Ошибки: `logs/error.log` (путь задается `ERROR_LOG_PATH`)
- Стандартные логи Docker доступны через `docker compose logs`

## Напоминания

Планировщик (`src/reminder/scheduler.ts`) проверяет пользователей каждые 5 минут.
Если сегодня нет приемов пищи и напоминание еще не отправлено, бот пишет сообщение.
