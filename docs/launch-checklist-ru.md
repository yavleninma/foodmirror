# FoodMirror: тупой чеклист запуска

## Что понадобится

Нужно всего 4 обязательных значения:

1. `OPENAI_API_KEY`
2. `REDIS_URL`
3. `TELEGRAM_BOT_TOKEN`
4. `TELEGRAM_WEBHOOK_SECRET`

Все остальное уже зашито в коде или считается автоматически.

## Шаг 1. Открой Vercel

1. Зайди на [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Открой проект `foodmirror`

Если проекта еще нет:

1. Нажми `Add New...`
2. Нажми `Project`
3. Подключи репозиторий
4. Нажми `Deploy`

## Шаг 2. Сделай Redis-хранилище

1. Внутри проекта открой `Storage`
2. Нажми `Browse Marketplace`
3. Найди `Redis`
4. Выбери Redis / Upstash integration
5. Нажми `Add Integration` или `Create`
6. Привяжи storage к проекту `foodmirror`

После этого ищи основную переменную подключения:

- `REDIS_URL`

Если видишь еще локальную переменную или local-URL, ее для продакшена не бери.
Нужен именно основной `REDIS_URL` для облачной базы.

## Шаг 3. Сделай OpenAI API key

1. Зайди на [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Нажми `Create new secret key`
3. Скопируй ключ сразу после создания
4. Это значение для `OPENAI_API_KEY`

## Шаг 4. Сделай Telegram-бота

1. Открой Telegram
2. Найди `@BotFather`
3. Отправь `/newbot`
4. Введи имя бота, например `FoodMirror`
5. Введи username бота, например `foodmirror_yourname_bot`
6. BotFather пришлет токен
7. Скопируй его
8. Это значение для `TELEGRAM_BOT_TOKEN`

## Шаг 5. Придумай webhook secret

Это просто твоя секретная строка.

Пример:

`foodmirror_2026_super_secret_4815162342`

Сохрани ее. Это значение для `TELEGRAM_WEBHOOK_SECRET`.

## Шаг 6. Добавь env в Vercel

1. Вернись в проект `foodmirror` в Vercel
2. Открой `Settings`
3. Открой `Environment Variables`
4. Добавь по одной переменной:

- Name: `OPENAI_API_KEY`
- Value: твой ключ из OpenAI

- Name: `REDIS_URL`
- Value: основной URL из Redis integration

- Name: `TELEGRAM_BOT_TOKEN`
- Value: токен от BotFather

- Name: `TELEGRAM_WEBHOOK_SECRET`
- Value: твоя секретная строка

5. После добавления env нажми `Save`

## Шаг 7. Перезапусти deploy

1. Открой `Deployments`
2. Открой последний deployment
3. Нажми `Redeploy`

После этого у тебя появится рабочий домен, обычно вида:

`https://foodmirror.vercel.app`

Если домен другой, бери именно тот, который покажет Vercel.

## Шаг 8. Поставь webhook Telegram

Подставь свои значения в эту ссылку и просто открой ее в браузере:

`https://api.telegram.org/botTELEGRAM_BOT_TOKEN/setWebhook?url=https://YOUR_DOMAIN/api/telegram/webhook&secret_token=YOUR_SECRET`

Пример:

`https://api.telegram.org/bot123456:ABCDEF/setWebhook?url=https://foodmirror.vercel.app/api/telegram/webhook&secret_token=foodmirror_2026_super_secret_4815162342`

Если все ок, Telegram вернет `"ok": true`.

## Шаг 9. Проверь вход

1. Открой своего бота
2. Отправь `/start`
3. Нажми кнопку `Открыть FoodMirror`
4. Должен открыться сайт уже в твоем аккаунте

## Шаг 10. Проверь фото еды

1. Отправь боту фото еды
2. Бот пришлет кнопку открытия
3. Открой FoodMirror
4. Проверь черновик калорий и БЖУ
5. Сохрани запись

## Что уже не нужно отдельно настраивать

Не нужно обязательно задавать:

- `OPENAI_MODEL`
- `APP_BASE_URL`
- `TELEGRAM_BOT_NAME`
- `AUTH_SECRET`
- `ALLOW_WEB_SIGNIN`

Они уже имеют дефолты или вычисляются автоматически.
