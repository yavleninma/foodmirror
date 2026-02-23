# Модель данных

Схема описана в `prisma/schema.prisma`.

## Основные сущности

- `User` — один пользователь = один чат Telegram.
- `DraftMeal` — черновик приема пищи (до подтверждения).
- `Meal` — подтвержденный прием пищи.
- `MealComponent` — компонент приема пищи (ингредиент).
- `FoodReference` — справочник базовых продуктов (`kcalPer100g`, `proteinPer100g`, `fatPer100g`, `carbsPer100g` на 100 г).
- `FoodSource` — источник данных для справочника.
- `MessageEvent` — журнал всех входящих/исходящих сообщений.

## Ключевые связи

- `User` → `DraftMeal`, `Meal`, `MessageEvent` (1:N)
- `Meal` → `MealComponent` (1:N)
- `MealComponent` → `FoodReference` (N:1, опционально)
- `FoodReference` → `FoodSource` (N:1)
- `MessageEvent` может ссылаться на `DraftMeal` и/или `Meal`

## Принципы хранения

- Входящие и исходящие сообщения сохраняются как события и не мутируются.
- Черновики хранятся отдельно от подтвержденных приемов пищи.
- После подтверждения создается новый `Meal`, не изменяющий историю.
- Поля `kcal/protein/fat/carbs` хранятся как среднее + диапазон.

## Миграции и сиды

- Миграции: `prisma/migrations`
- Сид справочника: `prisma/seed.ts`
- Команды: `npm run prisma:migrate`, `npm run prisma:seed`

## USDA FoodData Central

Справочник: USDA (основной) + LLM (продукты не найденные в USDA). Seed создаёт только `unknown_generic`.

**Импорт USDA:**
1. Получить API-ключ: https://fdc.nal.usda.gov/api-key-signup
2. Добавить в `.env`: `FDC_API_KEY=...`
3. `npm run usda:import` — импорт Foundation + SR Legacy (~8k продуктов)
4. `npm run usda:enrich` — обогащение: portions, fiber, min/max, foodCategory (для LLM)

Опции: `--clear-usda` перед импортом, `--limit=N` для enrich (тест).

**Поля FoodReference:** `fiberPer100g`, `portionsJson`, `nutrientRanges`, `foodCategory` — используются в расчётах и контексте LLM.
