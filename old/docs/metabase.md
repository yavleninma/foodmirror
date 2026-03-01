# Metabase — доступ и дашборд DAU/WAU/MAU

Metabase — дашборд аналитики. В проекте уже настроены views: `dau_daily`, `wau_daily`, `mau_daily`, `new_users_daily`, `meals_daily`.

## Запуск Metabase

```bash
docker compose up -d metabase
```

Порт на хосте зафиксирован в docker-compose: **3040**.

## Доступ с локальной машины к Metabase на droplet

### Вариант A: SSH-туннель (рекомендуется)

Не открывает порты наружу.

1. На вашем компьютере:
   ```bash
   ssh -L 3040:localhost:3040 USER@DROPLET_IP
   ```
   Замените `USER` и `DROPLET_IP` на ваши значения.

2. Оставьте SSH сессию открытой, откройте в браузере: **http://localhost:3040**

3. Или используйте скрипт (отредактируйте переменные):
   ```bash
   ./scripts/ssh-tunnel-metabase.sh
   ```

### Вариант B: Открыть порт в firewall

Для доступа по IP без SSH:

```bash
# на droplet
sudo ufw allow 3040/tcp
sudo ufw reload
```

Открыть **http://DROPLET_IP:3040**.

**Риск:** HTTP без шифрования; использовать во внутренней сети или временно.

### Вариант C: Nginx + HTTPS

Для постоянного публичного доступа по домену (например, `analytics.example.com`):

1. Установить nginx на droplet.
2. Использовать конфиг `deploy/nginx-metabase.conf` как пример.
3. Получить SSL (Let's Encrypt): `certbot --nginx -d analytics.example.com`
4. Открыть порт 443: `sudo ufw allow 443/tcp && sudo ufw reload`

## Первоначальная настройка Metabase

При первом запуске:

1. **Создать аккаунт админа** — email и пароль.

2. **Добавить базу данных** (Add data → Database):
   - Database type: **PostgreSQL**
   - **Host:** `postgres` (имя Docker-сервиса, не localhost)
   - Port: `5432`
   - Database name: `foodmirror`
   - Username: `fm`
   - Password: из `POSTGRES_PASSWORD` в `.env`
   - Use a secure connection (SSL): **выключить**

После подключения в Data Model будут доступны views: `dau_daily`, `wau_daily`, `mau_daily`, `new_users_daily`, `meals_daily`.

## Создание дашборда

1. **Новый дашборд:** Create → Dashboard.

2. **Вопросы (Questions):**
   - **DAU** — New → SQL or Simple question → Table `dau_daily` (date, dau) → Line chart
   - **WAU** — `wau_daily` (date, wau)
   - **MAU** — `mau_daily` (date, mau)
   - **Новые пользователи** — `new_users_daily` (date, count)
   - **Приёмы пищи** — `meals_daily` (date, count)

3. Добавить карточки на дашборд перетаскиванием.

## Проверка статуса

```bash
ssh USER@DROPLET_IP
cd /path/to/foodmirror
docker compose ps
```

Если metabase не running:
```bash
docker compose up -d metabase
```

Порт дашборда на хосте: **3040** (зашито в docker-compose).
