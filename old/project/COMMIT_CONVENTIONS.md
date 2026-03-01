# Commit Conventions (Conventional Commits)

Сообщения коммитов — на **английском**. Формат совместим с [Conventional Commits](https://www.conventionalcommits.org/) и с автоматической генерацией CHANGELOG / версий (semver).

---

## Где хранится версия

**Единственный источник версии приложения:** поле `"version"` в **`package.json`** (в корне репозитория).

Пример: `"version": "0.1.4"`. При релизе версию меняют там (вручную или через инструмент вроде `npm version`). В CI job `validate-version` (.github/workflows/deploy.yml) при необходимости проверяют, что версия и CHANGELOG согласованы.

---

## Версия в коммите

**В каждом коммите указывать текущую версию** из `package.json` — в **footer** одной строкой:

```
Version: 0.1.4
```

Так в истории (`git log`) сразу видно, к какой версии относится коммит. Берётся актуальное значение из `package.json` на момент коммита. Если в этом коммите версию поднимаешь — указываешь уже новую версию.

---

## Формат

```
<type>(<scope>): <description>

[optional body]

Version: x.y.z
[other footer lines: BREAKING CHANGE, Refs: #123]
```

- **Subject:** одна строка, до ~72 символов. Императив, без точки в конце, lowercase после двоеточия.
- **Body (опционально):** зачем и что изменилось, перенос строки 72 символа.
- **Footer:** обязательно строка **`Version: x.y.z`** (из package.json); при необходимости ещё `BREAKING CHANGE:`, `Refs: #123`.

---

## Типы (type)

| Type     | Назначение                         | Влияние на версию (semver) |
|----------|------------------------------------|----------------------------|
| **feat** | Новая функциональность             | MINOR (1.x.0)              |
| **fix**  | Исправление бага                   | PATCH (1.0.x)              |
| **docs** | Только документация                | —                          |
| **style**| Форматирование, пробелы, без логики| —                          |
| **refactor** | Рефакторинг без изменения поведения | —                      |
| **test** | Тесты                              | —                          |
| **chore**| Сборка, CI, зависимости, скрипты   | —                          |
| **config** | Конфигурация (env, config.ts и т.д.) | —                       |
| **perf** | Улучшение производительности       | PATCH                      |

**feat** и **fix** — основные для пользовательского/продуктового изменения. Остальные — для истории и категоризации.

---

## Scope (опционально)

Кратко указывает область: `handlers`, `estimation`, `llm`, `prisma`, `telegram`, `config`, `ci` и т.д.

Примеры:
- `feat(telegram): add 7-day comparison in daily summary`
- `fix(estimation): protect unmentioned weights in corrections`

Scope можно опускать для мелких коммитов.

---

## Примеры

**Минимальный (чаще всего):**
```
feat: add daily stats comparison

Version: 0.1.4
```
```
fix: protect unmentioned weights in corrections

Version: 0.1.4
```
```
refactor: extract override parsing from handlers

Version: 0.1.5
```

**С scope:**
```
feat(telegram): add evening reminder

Version: 0.1.5
```

**С телом:**
```
fix(handlers): correct FSM transition on photo while in ESTIMATED

User could send a new photo before confirming; draft was not reset.
Now entering DRAFT_MEAL and clearing previous draft.

Version: 0.1.4
```

**Breaking change (для мажорной версии):**
```
feat(api): remove legacy /v1/meals endpoint

BREAKING CHANGE: /v1/meals removed. Use /v2/meals.
Version: 1.0.0
```

---

## Правила

1. **Язык:** только английский (кириллица в GitHub/CI даёт mojibake).
2. **Императив:** "add feature", "fix bug", не "added feature" / "fixes bug".
3. **Без точки** в конце subject.
4. **Lowercase** в description после двоеточия (кроме имён, аббревиатур).
5. **Один логический шаг** на коммит; при необходимости — разбить на несколько.
6. **Версия в footer:** в каждом коммите строка `Version: x.y.z` из текущего `package.json`.

---

## Связь с версией

- При автоматическом релизе (e.g. semantic-release): `feat` → MINOR, `fix`/`perf` → PATCH, `BREAKING CHANGE` → MAJOR.
- В проекте правило зафиксировано в DECISION_LOG (commit messages на английском) и в AGENT_RULEBOOK (стиль коммитов, чеклист).
