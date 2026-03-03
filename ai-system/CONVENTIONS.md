# CONVENTIONS — Правила кода

## Общие

- Язык кода: TypeScript (strict mode)
- Тексты UI и пользовательские ошибки: русский
- Форматирование: 2 пробела, одинарные кавычки, точка с запятой
- Импорты: node/npm → внутренние модули → relative

## Фронтенд (`apps/web/`)

### Компоненты

- Один компонент — один файл
- Нейминг: `PascalCase.tsx`
- UI-блоки в `components/ui/`
- Бизнес-компоненты в `components/`
- Экраны в `screens/`
- Props описываются через `interface`

### Стили

- Основной подход: Tailwind CSS
- Цвета и тема — через CSS-переменные в `globals.css`
- `inline style` не использовать, кроме технических случаев:
  - `env(safe-area-inset-*)`
- CSS-in-JS не использовать

### API-клиент

- Весь HTTP проходит через `src/lib/api.ts`
- Компоненты не вызывают `fetch` напрямую
- Ошибки отображаются пользователю на русском

## Бэкенд (`apps/api/`)

### Роуты

- Один файл на ресурс (`routes/insight.ts`, `routes/history.ts` и т.д.)
- Роуты тонкие: только валидация и orchestration
- Бизнес-логика в `services/`

### Middleware

- `auth.ts` определяет `authMode` и `telegramUser`
- Личные роуты дополнительно защищаются `requireTelegramUser`
- `rateLimit.ts` ограничивает запросы по user id
- `errorHandler.ts` централизует ответы об ошибках

### Валидация и ошибки

- Входящие данные валидируются через Zod
- Ошибки валидации: `400`
- Rate limit: `429` + `Retry-After`
- `500` в production: безопасное сообщение без стектрейса

## Общие пакеты (`packages/shared/`)

- Только типы/константы, без бизнес-логики
- Импорт через `@foodmirror/shared`

## Документация

Перед изменениями ориентироваться по:
1. `ai-system/AGENT_QUICKSTART.md`
2. `ai-system/API_SPEC.md` (если работа с API)
3. `ai-system/DATA_MODEL.md` (если работа с БД)
