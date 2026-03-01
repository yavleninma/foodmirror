#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/foodmirror"

cd "$APP_DIR"

echo "[deploy] dir: $(pwd)"

if [ ! -f "docker-compose.yml" ]; then
  echo "[deploy] ERROR: docker-compose.yml not found in $APP_DIR" >&2
  exit 1
fi

if [ -d ".git" ]; then
  echo "[deploy] updating repo"
  git fetch --all --prune
  git reset --hard origin/main
else
  echo "[deploy] WARN: .git not found; skipping git update"
fi

echo "[deploy] ensuring postgres container is clean"
docker compose rm -f -s postgres || true

echo "[deploy] starting postgres"
docker compose up -d postgres

echo "[deploy] applying prisma migrations (if any)"
docker compose run --rm bot npx prisma migrate deploy

echo "[deploy] seeding reference data (if any)"
docker compose run --rm bot npx prisma db seed

# USDA import — один раз, данные в postgres. Запуск вручную: docker compose run --rm usda-import

echo "[deploy] building & starting bot"
docker compose up -d --build --remove-orphans bot

# Metabase не поднимаем при деплое — см. RUNBOOK «Metabase (подключение с локальной машины)»

# Ежедневный бэкап БД в $APP_DIR/backups (cron ставится при деплое)
[ -f "$APP_DIR/scripts/backup-db.sh" ] && chmod +x "$APP_DIR/scripts/backup-db.sh"
BACKUP_CRON="0 3 * * * $APP_DIR/scripts/backup-db.sh $APP_DIR/backups"
if crontab -l 2>/dev/null | grep -q "backup-db.sh"; then
  echo "[deploy] backup cron already present"
else
  (crontab -l 2>/dev/null || true; echo "$BACKUP_CRON") | crontab -
  echo "[deploy] installed backup cron (daily 03:00 -> $APP_DIR/backups)"
fi

echo "[deploy] status"
docker compose ps
