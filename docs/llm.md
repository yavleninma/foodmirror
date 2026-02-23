# LLM

LLM используется только для интерпретации еды и генерации нейтральных названий блюд.
Финальная арифметика выполняется в доменной логике.

## Где находится

- Адаптер: `src/llm/adapter.ts`
- Контракты: `src/llm/contracts.ts`
- Клиент OpenAI: `src/llm/openai.ts`

## Контракты

Vision/Parsing:
```
{
  "items": [
    {
      "canonical_name": "string",
      "display_label": "string",
      "weight_g_mean": null,
      "weight_g_min": null,
      "weight_g_max": null,
      "confidence": "LOW",
      "confidence_reasons": null,
      "barcode": null,
      "user_kcal_per_100g": null,
      "user_protein_per_100g": null,
      "user_fat_per_100g": null,
      "user_carbs_per_100g": null
    }
  ],
  "overall_confidence": 0.0,
  "notes": null
}
```

`barcode` — EAN-13/EAN-8/UPC, распознанный на фото или введённый пользователем как число. null если штрих-кода нет.

DraftChat (диалоговый разбор черновика):
```
{
  "reply": "string | null",
  "items": [ ... ],
  "overall_confidence": 0.0,
  "notes": null
}
```
reply — уточняющий вопрос пользователю или null. items — текущий разбор продуктов.

MealTitle:
```
{ "title": "string | null" }
```

## Формат ответа (надёжность)

По умолчанию запросы к OpenAI используют `response_format`:

- `json_schema` (строгая JSON Schema) — основной режим
- автоматический фоллбек на `json_object`, если выбранная модель не поддерживает `json_schema`

## Ограничения промптов

- Только русский язык.
- Никаких советов, мотивации, оценок.
- Всегда JSON.
- Указывать неопределенность.

## Таймауты и ошибки

- Таймаут запроса к OpenAI: дефолт в коде 45000 мс (45 сек), в `.env.example` и Docker — 90000 мс (90 сек).
- Ошибки логируются через `logError` и превращаются в нейтральные ответы.
- Логи LLM: `logs/llm.log` (путь задаётся `LLM_LOG_PATH`).

## Конфигурация через ENV

Основные параметры LLM берутся из `src/config.ts` и могут быть переопределены через ENV:

- `OPENAI_API_KEY` — ключ доступа.
- `OPENAI_MODEL` — модель (по умолчанию `gpt-4o-mini`).
- `LLM_TIMEOUT_MS` — таймаут запроса в мс (дефолт в коде `45000`, в `.env.example` — `90000`).
- `LLM_MAX_COMPLETION_TOKENS` — лимит токенов ответа (по умолчанию `1500`).
- `LLM_SYSTEM_PROMPT` — системный промпт.
- `LLM_CONTRACT_PARSE_MEAL`
- `LLM_CONTRACT_DRAFT_CHAT`
- `LLM_CONTRACT_MEAL_TITLE`
- `LLM_CONTRACT_FOOD_REFERENCE`
- `LLM_PROMPT_PARSE_MEAL`
- `LLM_PROMPT_DRAFT_CHAT` — промпт диалогового разбора (настраиваемый)
- `LLM_PROMPT_MEAL_TITLE`
- `LLM_PROMPT_FOOD_REFERENCE`

Промпты поддерживают подстановки:

- `{{contract}}` — JSON контракт.
- `{{items_json}}` — список продуктов для FoodReference в JSON.
