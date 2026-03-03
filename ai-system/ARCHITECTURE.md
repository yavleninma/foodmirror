# ARCHITECTURE — Архитектура системы

## Обзор

FoodMirror — Telegram Mini App с веб-фоллбэком:

- основной путь: Telegram → фото → инсайт;
- вне Telegram доступен guest-mode (без личных функций).

## Компоненты

```text
Telegram WebApp / Browser
          |
          v
      apps/web (React + Vite)
          |
          v
      apps/api (Express)
        |           |
        v           v
    PostgreSQL     OpenAI API
      (Prisma)      (Vision)
```

## Поток: фото → инсайт

1. Пользователь выбирает фото на фронтенде.
2. `POST /api/insight` отправляет `multipart/form-data`.
3. Auth middleware выставляет `authMode`:
   - `telegram` по `X-Init-Data`,
   - `guest` по `X-Guest-Token`,
   - `anonymous` fallback.
4. Сервис отправляет фото в OpenAI и получает `{ verdict, correction }`.
5. Результат сохраняется в `insights` и возвращается клиенту.

## Личные функции

Эндпоинты:

- `/api/history`
- `/api/stats`
- `/api/user/*`

доступны только в `telegram` режиме (`requireTelegramUser`).

## Деплой

- Платформа: Railway
- API и статический фронтенд поднимаются одним сервисом (`apps/api` + `apps/web/dist`)
- Миграции выполняются через `prisma migrate deploy` при старте

## Безопасность

- `X-Init-Data` верифицируется по HMAC-SHA256 с `TELEGRAM_BOT_TOKEN`
- OpenAI ключ хранится только на сервере
- Фото обрабатываются в памяти
- Rate limit: 10 запросов в минуту на user-id
