# Coding Context Pack

> Прочитай `AGENT_RULEBOOK.md` и `CODE_GUIDELINES.md` перед работой.

## Текущее состояние кода

### Известный техдолг
1. **handlers.ts (~2943 строки)** — монолит. FSM + NLP-парсинг + override система + draft lifecycle. Приоритетный кандидат на рефакторинг.
2. **Нет тестов** — ни unit, ни integration. Регрессии не ловятся.
3. **Override-парсинг** — мини-язык на regex для русского текста. Хрупкий, плохо документирован.
4. **Reference matching** — эвристическое, без confidence score на матч.

### Что можно рефакторить в handlers.ts
Предлагаемая разбивка (не обязательно всё сразу):
```
src/fsm/
├── handlers.ts          ← оставить как router/coordinator
├── draftLifecycle.ts    ← createDraft, clearDraft, getDraft, updateDraft
├── overrideParsing.ts   ← extractWeightOverrides, applyNegations, applyCount, etc.
├── corrections.ts       ← deterministic corrections (set_weight, adjust, remove)
├── mergeParse.ts        ← mergeParse, protectUnmentionedWeights, combineWeights
├── riskScoring.ts       ← riskScoreForItem, sortParseByRisk, prioritizeMissing
├── keyboards.ts         ← mainKeyboardMarkup, confirmKeyboardMarkup, etc.
└── reminderUI.ts        ← reminder settings inline keyboards
```

### Тесты (приоритет)
1. `domain/estimation.ts` — calcKcal, resolveWeight, estimateFromParseWithOverrides
2. `llm/validators.ts` — isParseResult, isDraftChatResult, etc.
3. Override-парсинг: extractWeightOverridesFromText, extractNegationTargets, applyCountOverridesFromText
4. `domain/daySummary.ts` — getDayTotals, getAverageStats
5. E2E: FSM переходы через handleMessage

### Критические пути (не ломай)
- `estimateDraft()` в handlers.ts — основной flow от ввода до оценки
- `confirmDraft()` — сохранение Meal
- `estimateFromParseWithOverrides()` — вся арифметика
- `processDraftConversation()` в adapter.ts — LLM диалог
- `protectUnmentionedWeights()` — защита весов при уточнениях

## Как запустить локально
```bash
npm install
# Создать .env (см. .env.example)
docker compose up -d postgres
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run usda:import    # обязательно для нормальной работы
npm run dev
```

## Как проверить изменения
```bash
npm run build          # TypeScript компиляция
# TODO: npm test       # когда будут тесты
```

## ENV переменные (полный список)
| Переменная | Обязательна | Default | Описание |
|-----------|------------|---------|----------|
| TELEGRAM_BOT_TOKEN | ✅ | — | Токен бота |
| DATABASE_URL | ✅ | — | PostgreSQL connection string |
| OPENAI_API_KEY | ✅ | — | Ключ OpenAI |
| FDC_API_KEY | ✅ (для USDA) | — | Ключ USDA FoodData Central |
| — | — | — | Модель LLM в `config.llm.model` (gpt-5-mini по умолчанию) |
| LLM_TIMEOUT_MS | ❌ | 45000 | Таймаут LLM запроса |
| LLM_MAX_COMPLETION_TOKENS | ❌ | 1500 | Лимит токенов |
| REMINDER_HOUR | ❌ | 20 | Час напоминания (UTC) |
| DRAFT_MAX_MESSAGES | ❌ | 20 | Лимит сообщений в диалоге |
| DRAFT_MAX_IMAGES | ❌ | 5 | Лимит фото в приёме |
| ADMIN_CHAT_ID | ❌ | 239700085 | Chat ID админа |
| ERROR_LOG_PATH | ❌ | logs/error.log | Путь логов ошибок |
| LLM_LOG_PATH | ❌ | logs/llm.log | Путь логов LLM |
