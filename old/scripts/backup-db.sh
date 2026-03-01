#!/usr/bin/env bash
# Бэкап PostgreSQL из Docker. Запуск: на сервере из /opt/foodmirror или локально из корня проекта.
# Использование: ./scripts/backup-db.sh [директория_для_бэкапов]
# Cron (ежедневно в 03:00): 0 3 * * * /opt/foodmirror/scripts/backup-db.sh /opt/foodmirror/backups

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_ROOT="${1:-$PROJECT_ROOT/backups}"
CONTAINER="${POSTGRES_CONTAINER:-foodmirror-postgres-1}"

# Имя контейнера может отличаться (префикс от имени папки). Пробуем найти.
if ! docker ps --format '{{.Names}}' | grep -q postgres; then
  echo "Postgres container not running. Start with: docker compose up -d postgres" >&2
  exit 1
fi

PG_CONTAINER=$(docker ps --format '{{.Names}}' | grep postgres | head -1)
DB_NAME="${POSTGRES_DB:-foodmirror}"
DB_USER="${POSTGRES_USER:-fm}"

mkdir -p "$BACKUP_ROOT"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_ROOT/pg-$DB_NAME-$STAMP.sql.gz"

echo "Backing up $DB_NAME to $FILE"
docker exec "$PG_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl | gzip > "$FILE"
echo "Done: $FILE"

# Оставить последние N бэкапов (по умолчанию 14)
KEEP="${BACKUP_KEEP_DAYS:-14}"
find "$BACKUP_ROOT" -name "pg-$DB_NAME-*.sql.gz" -mtime +$KEEP -delete 2>/dev/null || true
