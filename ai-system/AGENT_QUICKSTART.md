# AGENT_QUICKSTART

Минимум, который нужно знать перед изменениями в проекте.

## Что это за проект

FoodMirror — Telegram Mini App: фото еды → короткий поведенческий инсайт → микро-коррекция.

## Монорепо

- `apps/api/` — Express + TypeScript + Prisma
- `apps/web/` — React + Vite + Tailwind
- `packages/shared/` — типы и константы API
- `ai-system/` — документация и решения

## Auth режимы

- `telegram`: валидный `X-Init-Data`
- `guest`: валидный `X-Guest-Token` (веб вне Telegram)
- `anonymous`: fallback по IP+UA

Личные функции (`/api/history`, `/api/stats`, `/api/user/*`) доступны только в `telegram` режиме.

## Важные команды

```bash
npm install
npm run db:push
npm run dev:api
npm run dev:web
npm run lint
npm run test
npm run build
```

## Что проверять после изменений

1. Типы (`npm run lint`)
2. Тесты (`npm run test`)
3. Сборка (`npm run build`)
4. Совпадает ли `ai-system/*` с фактическим кодом

## E2E: как использовать (для агентов)

Базовый e2e-набор уже есть в `apps/web/tests/smoke/guest-mode.spec.ts`.

Что покрыто:
1. `GET /api/health` отвечает `ok`.
2. Guest-режим рендерится, персональные вкладки скрыты.
3. Флоу `открытие -> загрузка фото -> получение анализа`.
4. Ошибка анализа + `Retry`.
5. Telegram-режим (моки `telegram-web-app.js`) + вкладки `history/stats`.

Как запускать:
```bash
# 1) один раз (если браузер не установлен)
npx playwright install chromium

# 2) smoke e2e
npm run test:smoke --workspace=apps/web
```

Важно про e2e:
- Эти тесты специально мокают `/api/insight`, `/api/history`, `/api/stats`, чтобы не зависеть от OpenAI/БД и быть стабильными в CI.
- Если меняется UI-текст/селекторы/контракты ответов, обновляй моки и ожидания в этом spec-файле в том же PR.

## Ошибка анализа: как воспроизводить и проверять фикс

1. Проверить unit-тесты API:
```bash
npm run test --workspace=apps/api
```

2. Проверить конкретно OpenAI-слой:
```bash
npx tsx --test apps/api/src/services/openai.test.ts
```

3. После изменений в анализе прогнать:
```bash
npm run build --workspace=apps/api
npm run test:smoke --workspace=apps/web
```

Что считается done для PR с анализом фото:
1. Unit-тест закрывает баг (красный до фикса, зеленый после фикса).
2. `apps/api` тесты зеленые.
3. `test:smoke` зеленый.
4. Если менялся пользовательский флоу, обновлен этот quickstart и/или `LOCAL_SETUP.md`.
