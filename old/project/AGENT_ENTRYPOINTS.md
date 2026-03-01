# AGENT_ENTRYPOINTS

## Для любого агента — начни здесь

### Быстрый старт (2 мин)
1. Прочитай `project/PROJECT_INTENT.md` — что это за продукт
2. Прочитай `project/AGENT_RULEBOOK.md` — что можно, что нельзя
3. Переходи к своему контекстному пакету ↓

### Полный контекст (10 мин)
1. `project/PROJECT_INTENT.md`
2. `project/AGENT_RULEBOOK.md`
3. `project/ARCHITECTURE_MAP.md`
4. `project/DOMAIN_BIBLE.md`
5. `project/CODE_GUIDELINES.md`
6. `project/DECISION_LOG.md`
7. `project/MEMORY.md`
8. Свой контекстный пакет

---

## Точки входа по роли

### 🔧 Coding Agent
**Контекст:** `project/CONTEXT_PACKS/coding.context.md`
**Ключевые файлы:**
- `src/fsm/handlers.ts` — основная логика (⚠️ монолит, 2900+ строк)
- `src/domain/estimation.ts` — расчёт БЖУ/ккал
- `src/llm/adapter.ts` — LLM вызовы
- `prisma/schema.prisma` — схема БД
- `src/config.ts` — все конфиги

**Частые задачи:**
- Баг в расчётах → `estimation.ts`
- Баг в парсинге → `handlers.ts` (override-логика)
- LLM не парсит → `llm/adapter.ts` + `llm/validators.ts`
- Новая фича → начни с `DOMAIN_BIBLE.md`, потом код
- Рефакторинг handlers → `CODE_GUIDELINES.md`

### 📣 Marketing Agent
**Контекст:** `project/CONTEXT_PACKS/marketing.context.md`
**Что тебе нужно знать:**
- Стадия: pre-launch, 0 пользователей
- Tone: техничный, минималистичный, нейтральный
- Позиционирование: "зеркало питания без давления"
- Конкуренты: все фуд-трекеры (MyFitnessPal, FatSecret, Yazio) — но они про цели

### 📈 Growth Agent
**Контекст:** `project/CONTEXT_PACKS/growth.context.md`
**Что тебе нужно знать:**
- Нет лендинга, нет соцсетей, нет каналов
- Монетизация тестовая (399 Stars)
- Триал 14 дней
- Нужны гипотезы привлечения

### 🔧 Ops / DevOps Agent
**Контекст:** `project/RUNBOOK.md`
**Ключевое:**
- Docker Compose на DigitalOcean droplet
- GitHub Actions CI/CD
- USDA import обязателен при каждом деплое
- Логи: `logs/error.log`, `logs/llm.log`

---

## Карта "я хочу..."

| Хочу... | Куда идти |
|---------|----------|
| Понять продукт | `PROJECT_INTENT.md` |
| Понять архитектуру | `ARCHITECTURE_MAP.md` |
| Понять бизнес-правила | `DOMAIN_BIBLE.md` |
| Понять что можно/нельзя | `AGENT_RULEBOOK.md` |
| Написать код | `CODE_GUIDELINES.md` → код |
| Задеплоить | `RUNBOOK.md` |
| Посмотреть прошлые решения | `DECISION_LOG.md` |
| Узнать последние инсайты | `MEMORY.md` |
| Сделать маркетинг | `CONTEXT_PACKS/marketing.context.md` |
| Придумать рост | `CONTEXT_PACKS/growth.context.md` |
