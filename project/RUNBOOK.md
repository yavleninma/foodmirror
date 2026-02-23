# RUNBOOK

## Инфраструктура
- **Сервер:** DigitalOcean droplet (157.230.246.177)
- **ОС:** Linux (Ubuntu)
- **Путь:** `/opt/foodmirror`
- **Пользователь:** root
- **Docker Compose:** postgres + bot + usda-import; metabase — по необходимости (не стартует при деплое)

### Доступ агента (Cursor)
Агент может подключаться к droplet по SSH: `ssh root@157.230.246.177`. **Все действия на droplet требуют подтверждения владельца** — deploy, рестарты, изменения в БД, импорты и т.п. Подробнее: `DROPLET_ACCESS.md`.

## Деплой (автоматический)

### CI/CD: GitHub Actions
Push в `main` → GitHub Actions → SSH на droplet → `deploy.sh`

### Что делает deploy.sh
1. `git fetch --all && git reset --hard origin/main`
2. Restart postgres
3. `prisma migrate deploy`
4. `prisma db seed`
5. Build & start bot  
   (Metabase при деплое не запускается — см. раздел «Metabase» ниже)

### Ручной деплой (если нужно)
```bash
ssh root@157.230.246.177
cd /opt/foodmirror
bash deploy.sh
```

### Версионность и релизы (строгое правило)
- **Каждый push в main** должен содержать повышенную версию в `package.json` и запись в `CHANGELOG.md` для этой версии. Иначе CI падает, деплой не выполняется.
- Перед пушем проверка локально: `npm run release:check`.
- Версия приложения: `package.json` → поле `version` (semver).
- История изменений: `CHANGELOG.md`, секция вида `## [X.Y.Z]` или `## [X.Y.Z] — YYYY-MM-DD`.
- После мержа в main — создать тег и отправить: `git tag vX.Y.Z && git push --tags` (иначе следующий коммит не пройдёт проверку: «предыдущая» версия берётся из последнего тега).
- На проде версию проверить: `cat package.json | grep version`.

## Первый деплой (с нуля)

```bash
# 1. Клонировать репо
git clone <repo_url> /opt/foodmirror
cd /opt/foodmirror

# 2. Создать .env
cp .env.example .env
# Заполнить: TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, FDC_API_KEY, DATABASE_URL, POSTGRES_PASSWORD

# 3. Поднять postgres
docker compose up -d postgres
# Подождать ~10 сек для healthcheck

# 4. Миграции + seed
docker compose run --rm bot npx prisma migrate deploy
docker compose run --rm bot npx prisma db seed

# 5. Импорт USDA (ОБЯЗАТЕЛЬНО при первом деплое)
docker compose run --rm usda-import

# 6. Seed алиасов и (опционально) импорт Open Food Facts
docker compose run --rm bot npx tsx scripts/seed-aliases.ts
# docker compose run --rm bot npx tsx scripts/import-off.ts --pages=20

# 7. Запуск бота
docker compose up -d bot

# 7. Metabase (опционально)
docker compose up -d metabase
```

## Локальная разработка

```bash
npm install
# Создать .env (из .env.example)
docker compose up -d postgres
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run usda:import       # обязательно
npm run seed:aliases      # русские алиасы продуктов
# npm run off:import      # (опционально) импорт Open Food Facts
npm run dev               # запуск бота
```

## Проверка состояния

### Бот работает?
```bash
ssh root@157.230.246.177
docker compose ps
docker compose logs bot --tail 50
```

### Ошибки
```bash
# На сервере
cat /opt/foodmirror/logs/error.log | tail -50
cat /opt/foodmirror/logs/llm.log | tail -50

# Или через Docker
docker compose logs bot --tail 100 | grep -i error
```

### БД
```bash
docker compose exec postgres psql -U fm -d foodmirror

# Полезные запросы:
SELECT count(*) FROM "User";
SELECT count(*) FROM "Meal";
SELECT count(*) FROM "FoodReference";
SELECT count(*) FROM "MessageEvent" WHERE "createdAt" > now() - interval '1 day';
```

### Metabase (подключение с локальной машины)

Metabase на дроплете **не запускается автоматически** при деплое (экономия RAM). Чтобы открыть дашборд у себя в браузере на `http://localhost:3040`:

**1. Подключиться к дроплету и поднять Metabase**
```bash
ssh root@157.230.246.177
cd /opt/foodmirror
docker compose up -d metabase
```
Подождать 30–60 сек, пока контейнер запустится. Выйти с сервера: `exit`.

**2. На своей машине поднять SSH-туннель**
```bash
ssh -L 3040:localhost:3000 root@157.230.246.177
```
(На дроплете Metabase по умолчанию слушает порт 3000; если в `.env` задан `METABASE_PORT=3040`, подставить его: `-L 3040:localhost:3040`.)  
Оставить этот терминал открытым — туннель активен, пока сессия жива.

**3. Открыть в браузере**
Перейти на **http://localhost:3040** — откроется Metabase с дроплета.

Когда аналитика не нужна, Metabase на сервере можно остановить:
```bash
ssh root@157.230.246.177 "cd /opt/foodmirror && docker compose stop metabase"
```

## Частые проблемы

### "User.locale does not exist"
Схема не актуальна. Полный сброс:
```bash
docker compose down -v
docker compose up -d postgres
# Подождать ~10 сек
docker compose run --rm bot npx prisma migrate deploy
docker compose run --rm bot npx prisma db seed
docker compose up -d bot
```

### "OpenAI request timed out"
Увеличить таймаут в `.env`:
```
LLM_TIMEOUT_MS=120000
```

### USDA не импортирован (все продукты = "внутренний источник")
```bash
docker compose run --rm usda-import
```
Нужен `FDC_API_KEY` в `.env`.

### Бот не отвечает
```bash
docker compose restart bot
docker compose logs bot --tail 20
```

### Сменили POSTGRES_PASSWORD
Пароль задаётся только при первой инициализации volume. Сброс:
```bash
docker compose down -v
docker compose up -d postgres
# Затем миграции заново
```

## Бэкапы

- Данные PostgreSQL хранятся в Docker volume `postgres_data`. Бэкапы сохраняются **на этом же сервере** в каталог `backups/` рядом с проектом: `/opt/foodmirror/backups/`.
- При каждом деплое в cron автоматически добавляется задача: ежедневно в 03:00 запуск `scripts/backup-db.sh` → файлы `backups/pg-foodmirror-YYYYMMDD-HHMMSS.sql.gz`. Старые бэкапы (старше 14 дней) скрипт удаляет сам.

### Ручной бэкап
```bash
cd /opt/foodmirror
./scripts/backup-db.sh
# или явно: ./scripts/backup-db.sh /opt/foodmirror/backups
# Файлы: backups/pg-foodmirror-YYYYMMDD-HHMMSS.sql.gz
```

### Восстановление из бэкапа (на этом же сервере)
```bash
cd /opt/foodmirror
docker compose stop bot
docker compose up -d postgres
# Подождать ~10 сек

# Подставить нужную дату в имя файла
gunzip -c backups/pg-foodmirror-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose exec -T postgres psql -U fm -d foodmirror

docker compose up -d bot
```

Копирование бэкапов на другой сервер или в облако можно настроить отдельно позже.

## Секреты и пароли (что важно хранить и не светить)

| Переменная | Критичность | Зачем |
|------------|-------------|--------|
| **TELEGRAM_BOT_TOKEN** | Критично | Доступ к боту; утечка = полный контроль над ботом. Хранить в .env, не коммитить. |
| **OPENAI_API_KEY** | Критично | Платные запросы; утечка = списание средств. |
| **DATABASE_URL** / **POSTGRES_PASSWORD** | Критично | Доступ к БД = все пользователи и приёмы пищи. На сервере .env только на хосте, права 600. |
| **FDC_API_KEY** | Важно | USDA FoodData Central; при утечке — лимиты/блокировка. |
| **ADMIN_CHAT_ID** | Средне | Кто может вызывать /admin; не пароль, но лучше не светить. |

Рекомендации: .env в .gitignore; на сервере один .env с продакшен-значениями; пароли БД сложные и уникальные; при смене бота (новое название) — новый TELEGRAM_BOT_TOKEN, старый отозвать в @BotFather.

## Проверка нагрузки и стабильности

### Быстрый smoke-тест (токен + БД)
Проверяет, что токен валиден и (при наличии DATABASE_URL) БД доступна. Запускать локально или на сервере (без запущенного бота в этом же процессе):
```bash
npx tsx scripts/smoke-test-bot.ts
```
Ожидание: `Telegram: OK (@botname)`, `PostgreSQL: OK`, `Smoke test OK`.

### Минимальная нагрузка (параллельные запросы к Telegram)
Проверка, что Telegram API и сеть выдерживают несколько одновременных обращений (getMe):
```bash
for i in 1 2 3 4 5 6 7 8 9 10; do npx tsx scripts/smoke-test-bot.ts & done; wait
```
Все 10 должны завершиться без ошибок. Если падают по таймауту — смотреть сеть/фаервол.

### Проверка «бот отвечает под нагрузкой»
Реальная нагрузка — это обработка сообщений (LLM + БД). Автоматизировать без отдельного тестового бота сложно. Рекомендуемый ручной сценарий перед тем как раздавать ссылку:
1. Открыть бота с 2–3 аккаунтов (или попросить друзей).
2. Почти одновременно отправить с каждого по фото еды или текстовое описание.
3. Убедиться, что все получили ответ в разумное время (целевой порядок: до 30–60 с при нормальной задержке LLM). Смотреть логи: `docker compose logs bot --tail 100`.
4. Проверить, что после подтверждения приёма пищи дневной контекст считается и отображается.

Узкие места при росте: один процесс бота (одна нить), очередь по пользователю (сообщения одного пользователя обрабатываются по порядку), таймауты OpenAI. При необходимости позже можно добавить мониторинг (health endpoint, алерты).

## Мониторинг
- **TODO:** Настроить health check endpoint (опционально)
- **TODO:** Алерты при падении бота
- Metabase: DAU/WAU/MAU views доступны
