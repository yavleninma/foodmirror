# Changelog

Все заметные изменения в проекте фиксируются здесь.  
Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [Unreleased]

_Изменения, которые ещё не вошли в релиз._

---

## [0.1.4] — 2026-02-23

- Импорт Calorizator.ru: скрипт `scripts/import-calorizator.ts`, npm run calorizator:import
- Приоритет источников при резолве: Calorizator.ru → USDA → Open Food Facts → LLM

---

## [0.1.3] — 2026-02-23

- OFF API: ретраи при 502/503/504 и увеличенный таймаут в импорте и в рантайм-сервисе

---

## [0.1.2] — 2026-02-23

- Deploy: при пустом crontab скрипт не падал с exit 1 (`crontab -l || true` в блоке backup cron)

---

## [0.1.1] — 2026-02-23

- Проверка CI/CD: первый деплой на droplet после настройки версионности
- RUNBOOK: раздел «Остановка всех Docker-проектов на droplet»

---

## [0.1.0] — 2026-02-23

- MVP: Telegram-бот, один чат на пользователя
- Логирование фото/текста, оценка БЖУ/ккал с диапазоном
- Подтверждение перед сохранением, контекст дня, сравнение с 7 днями
- История (сегодня/вчера/7 дней), вечернее напоминание
- Справочники: USDA, Open Food Facts, LLM fallback

[Unreleased]: https://github.com/yavleninma/foodmirror/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/yavleninma/foodmirror/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/yavleninma/foodmirror/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/yavleninma/foodmirror/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/yavleninma/foodmirror/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/yavleninma/foodmirror/releases/tag/v0.1.0
