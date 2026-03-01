# CODE_GUIDELINES

## TypeScript

### Общее
- strict mode включён
- Target: ES2020, Module: CommonJS
- Никаких `any` без объяснения
- Prefer `const` over `let`, no `var`
- Используй type imports: `import type { X } from "./y"`

### Именование
- Файлы: camelCase (`daySummary.ts`)
- Типы/интерфейсы: PascalCase (`ParseResult`, `UserOverride`)
- Функции/переменные: camelCase (`formatEstimate`, `toDayKey`)
- Enum values: UPPER_SNAKE_CASE (`DRAFT_MEAL`, `LOW`)
- Canonical names (еда): lower_snake_case (`chicken_breast_cooked`)

### Структура файлов
```
src/
├── index.ts           # entry point only — routing, no logic
├── config.ts          # all config from env
├── db.ts              # Prisma client singleton
├── fsm/               # FSM state management
├── domain/            # business logic (БЖУ, дневные итоги)
├── llm/               # LLM adapter (OpenAI)
├── telegram/          # message formatting, event logging
├── subscription/      # trial, premium, payments
├── reminder/          # scheduled reminders
├── admin/             # admin commands
├── support/           # user support flow
├── utils/             # logger, time, template, validation
└── types/             # shared type declarations
```

### Импорты
- Relative imports внутри src (`../domain/estimation`)
- Сначала внешние зависимости, потом внутренние
- Не используй path aliases (@/)

## Prisma

### Миграции
- `npm run prisma:migrate` для dev
- `npx prisma migrate deploy` для prod
- Seed: `prisma/seed.ts` — только fallback reference
- USDA: отдельные скрипты `scripts/import-usda.ts`, `scripts/enrich-usda.ts`

### Правила
- Новые поля: всегда с default value или nullable
- Не удаляй поля без миграции
- `@@index` на все FK и часто используемые WHERE

## LLM

### Контракты
- Определены в `src/llm/contracts.ts`
- Валидация в `src/llm/validators.ts`
- JSON Schema в `src/llm/schemas.ts`
- **Все три должны быть в синхронизации**

### Промпты
- Дефолтные значения в `config.ts`
- Переопределяемы через ENV
- Шаблоны поддерживают `{{variable}}` (см. `utils/template.ts`)
- **Не меняй промпты без одобрения**

### Response format
- Primary: `json_schema` (structured outputs)
- Fallback: `json_object` (если модель не поддерживает json_schema)
- Автоматический fallback в `openai.ts`

## Telegram

### Формат сообщений
- После confirm: максимум 8 строк
- Никаких эмодзи кроме 🟡 (статус) и 🔔 (напоминание)
- Числа: `≈ 2 150 ккал`, `Б: 105 г · Ж: 90 г · У: 180 г`
- Неопределённость: `±15%`

### Клавиатуры
- Main: [Сегодня | Вчера | Статистика] [Помощь | Условия | Поддержка] [Premium/Статус | 🔔 Напоминание]
- Confirm: [Подтвердить | Отмена] [Почему так? | Найдено | Уточнения]
- Pending: [⏳ Подождите]

## Логирование
- Ошибки: `logError()` → `logs/error.log`
- LLM: `logLLM()` → `logs/llm.log`
- Console: `console.error()` для критических ошибок
- Не логируй чувствительные данные (API ключи)

## Тесты (TODO)
- Фреймворк: TODO (предлагается vitest)
- Приоритет покрытия:
  1. `domain/estimation.ts` — расчёты БЖУ
  2. `llm/validators.ts` — валидация контрактов
  3. Override-парсинг в handlers
  4. `domain/daySummary.ts` — агрегация
  5. E2E: FSM переходы
