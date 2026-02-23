# ARCHITECTURE_MAP

## Stack
| Слой | Технология |
|------|-----------|
| Runtime | Node.js 20 (Alpine) |
| Язык | TypeScript (strict, ES2020, CommonJS) |
| БД | PostgreSQL 16, Prisma ORM |
| LLM | OpenAI API (gpt-4o-mini default), json_schema response format |
| Telegram | node-telegram-bot-api (polling) |
| Аналитика | Metabase (Docker) |
| Инфра | Docker Compose, DigitalOcean droplet |
| CI/CD | GitHub Actions → deploy.sh |

## Слои приложения (сверху вниз)
```
Telegram API (polling)
    ↓
src/index.ts — event router, media group buffer
    ↓
src/fsm/handlers.ts — FSM + NLP + override parsing + draft lifecycle
    ↓
src/domain/estimation.ts — БЖУ/ккал расчёт
src/domain/daySummary.ts — дневные итоги, средние за период
    ↓
src/services/foodResolver.ts — мультисорсный поиск продуктов (кеш + алиасы + fuzzy)
src/services/openFoodFacts.ts — Open Food Facts API (barcode + text search)
src/llm/adapter.ts — parseMeal, processDraftConversation, buildMealTitle, buildFoodReference
src/llm/openai.ts — raw HTTP к OpenAI (retry, fallback json_schema→json_object)
    ↓
Prisma (src/db.ts) → PostgreSQL
```

## FSM состояния
```
IDLE → DRAFT_MEAL → CONFIRM → IDLE
         ↑___________↓ (уточнения через диалог, без отдельного состояния)
```
- `IDLE` — ожидание ввода
- `DRAFT_MEAL` — сбор описания/фото, LLM parsing
- `CONFIRM` — оценка показана, ждём подтверждения/отмены/правки

Правила: 1 активный draft на юзера, без confirm не сохраняем, новый ввод при IDLE → новый draft.

## Ключевые модели данных
- **User** — состояние, настройки, подписка
- **DraftMeal** — черновик (conversation JSON, parsedJson, estimateJson, overrides)
- **Meal** — подтверждённый приём (immutable; soft-delete через `deletedAt`)
- **MealComponent** — компонент приёма (привязан к FoodReference)
- **FoodReference** — справочник продуктов (USDA + Open Food Facts + LLM fallback)
- **FoodAlias** — алиасы продуктов (русские названия → FoodReference)
- **FoodSource** — источник данных (USDA, Open Food Facts, LLM-generated, Internal fallback)
- **MessageEvent** — лог всех входящих/исходящих сообщений
- **FreeUsage** — счётчик бесплатных использований в день
- **SubscriptionGrant** — выданные подписки (админ)

## Справочник продуктов (приоритет)
1. **USDA FoodData Central** (Foundation Foods, SR Legacy) — основная база, ~8000+ записей
2. **Open Food Facts** — упакованные продукты, штрих-коды, 4M+ записей глобально
3. **LLM (buildFoodReference)** — для продуктов не найденных в USDA/OFF, результаты сохраняются с `verified: false`
4. **unknown_generic** (0-0-0-0) — fallback если все источники не помогли

Поиск продуктов: `src/services/foodResolver.ts` (FoodReferenceResolver) — exact → alias (FoodAlias) → fuzzy (Jaro-Winkler) → barcode (OFF API) → fallback.
Алиасы: таблица `FoodAlias` (~229 русских алиасов), заменяет хардкод.
При estimation: если продукт не найден → пробуем OFF text search (макс. 2 продукта, ~7с/шт, результат персистируется) → затем LLM buildFoodReference.

## Ключевые файлы (карта навигации)
| Файл | Строк | Что делает |
|------|-------|-----------|
| `src/index.ts` | ~153 | Entry point, Telegram events |
| `src/config.ts` | ~212 | Все конфиги + дефолтные промпты LLM |
| `src/fsm/handlers.ts` | ~2943 | ⚠️ МОНОЛИТ: FSM + NLP + overrides |
| `src/domain/estimation.ts` | ~580 | Расчёт БЖУ (использует FoodReferenceResolver) |
| `src/services/foodResolver.ts` | ~335 | Мультисорсный поиск: exact/alias/fuzzy/barcode/OFF |
| `src/services/openFoodFacts.ts` | ~317 | Open Food Facts API: barcode + text search |
| `src/domain/daySummary.ts` | ~257 | Дневные итоги |
| `src/llm/adapter.ts` | ~316 | LLM вызовы |
| `src/llm/contracts.ts` | ~66 | Типы ответов LLM (incl. barcode) |
| `src/llm/openai.ts` | ~273 | OpenAI HTTP клиент |
| `src/telegram/format.ts` | ~337 | Форматирование сообщений |
| `src/subscription/index.ts` | ~165 | Триал, premium, лимиты |
| `prisma/schema.prisma` | ~231 | Схема БД |

## Docker-сервисы
- `postgres` — PostgreSQL 16
- `bot` — основной бот (Node.js)
- `usda-import` — одноразовый импорт USDA
- `metabase` — дашборд аналитики

## Внешние зависимости
- OpenAI API (ключ: OPENAI_API_KEY)
- Telegram Bot API (ключ: TELEGRAM_BOT_TOKEN)
- USDA FoodData Central API (ключ: FDC_API_KEY)
- Open Food Facts API (бесплатно, без ключа, rate limit: 100 req/min products, 10 req/min search)
