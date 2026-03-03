# API_SPEC — Контракт API

## Auth режимы

Бэкенд определяет режим пользователя в таком порядке:

1. `telegram` — валидный `X-Init-Data`
2. `guest` — валидный `X-Guest-Token` (UUID)
3. `anonymous` — fallback по IP + User-Agent

Личные функции доступны только в `telegram` режиме.

### Ошибка доступа к личным функциям

```json
HTTP 403
{ "error": "Эта функция доступна только в Telegram." }
```

## Эндпоинты

### POST /api/insight

Загрузка фото и получение инсайта.

- Доступ: `telegram`, `guest`, `anonymous`
- Request: `multipart/form-data`
  - `photo`: File (`jpeg/png/webp/gif`, до 10 MB)
- Response `200`:

```json
{
  "id": "clx1abc...",
  "verdict": "норма",
  "correction": "Попробуй добавить овощей в следующий раз.",
  "createdAt": "2026-03-02T12:00:00.000Z"
}
```

- Ошибки:
  - `400` — `{ "error": "Фото не прикреплено." }`
  - `429` — rate limit + `Retry-After`
  - `500` — внутренняя ошибка

### GET /api/history

История пользователя (курсорная пагинация).

- Доступ: только `telegram`
- Query:
  - `limit` (optional, default `20`, max `50`)
  - `cursor` (optional)
- Response `200`:

```json
{
  "entries": [
    {
      "id": "clx1abc...",
      "verdict": "риск",
      "correction": "Булка к кофе — привычка, не голод.",
      "createdAt": "2026-03-02T11:00:00.000Z"
    }
  ],
  "nextCursor": "clx1xyz..."
}
```

### GET /api/stats

Недельная статистика пользователя.

- Доступ: только `telegram`
- Response `200`:

```json
{
  "thisWeek": 7,
  "lastWeek": 4,
  "streak": 3
}
```

### PUT /api/user/goal

Обновление цели.

- Доступ: только `telegram`
- Request:

```json
{ "goal": "не расползтись" }
```

- Response `200`:

```json
{ "goal": "не расползтись" }
```

- Ошибка `400`:

```json
{ "error": "Укажи цель (1–200 символов)." }
```

### GET /api/user/me

Текущий пользователь.

- Доступ: только `telegram`
- Response `200`:

```json
{
  "id": "123456789",
  "firstName": "Иван",
  "goal": "не расползтись"
}
```

### GET /api/health

Проверка сервера.

- Доступ: публичный
- Response `200`:

```json
{ "status": "ok", "version": "2.0.0" }
```

## Общие правила

- Все ответы в JSON
- Тексты ошибок для пользователя на русском
- Стандартные коды: `400`, `403`, `429`, `500`
- Даты в ISO 8601 (UTC)
