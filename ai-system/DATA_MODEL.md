# DATA_MODEL — Модель данных

Схема БД PostgreSQL через Prisma ORM.

---

## Таблицы

### users

Пользователи приложения.

| Поле | Тип | Описание |
|------|-----|----------|
| id | String (PK) | Telegram user ID |
| first_name | String? | Имя из Telegram |
| last_name | String? | Фамилия из Telegram |
| username | String? | Username из Telegram |
| goal | String | Цель, default "не расползтись" |
| created_at | DateTime | Дата регистрации |
| last_active_at | DateTime | Последняя активность (auto-update) |

`id` может быть:
- Telegram ID (режим `telegram`)
- `guest_<hash>` (режим `guest`)
- `anon_<hash>` (режим `anonymous`)

### insights

Результаты анализа фото.

| Поле | Тип | Описание |
|------|-----|----------|
| id | String (PK) | CUID, автогенерация |
| user_id | String (FK → users.id) | Пользователь |
| verdict | String | Вердикт: «норма», «риск», «хорошо» и др. |
| correction | String | Одна поведенческая правка |
| created_at | DateTime | Дата создания |

**Индекс:** `(user_id, created_at DESC)` — быстрая выборка истории пользователя.

---

## Связи

```
users 1 ──── * insights
  (id)          (user_id)
```

---

## Prisma схема

Файл: `apps/api/prisma/schema.prisma`

```prisma
model User {
  id           String    @id
  firstName    String?   @map("first_name")
  lastName     String?   @map("last_name")
  username     String?
  goal         String    @default("не расползтись")
  createdAt    DateTime  @default(now()) @map("created_at")
  lastActiveAt DateTime  @default(now()) @updatedAt @map("last_active_at")
  insights     Insight[]
  @@map("users")
}

model Insight {
  id         String   @id @default(cuid())
  userId     String   @map("user_id")
  user       User     @relation(fields: [userId], references: [id])
  verdict    String
  correction String
  createdAt  DateTime @default(now()) @map("created_at")
  @@index([userId, createdAt(sort: Desc)])
  @@map("insights")
}
```

---

## Миграции

- `npm run db:migrate` — создать и применить миграцию (dev)
- `npm run db:push` — push схемы без миграции (быстрый dev)
- В продакшене: `prisma migrate deploy` при деплое

---

## Правила

- Схему меняем только осознанно, вместе с обновлением документации
- Новые таблицы/поля — сначала обновить этот файл, потом schema.prisma
- Имена таблиц: snake_case (`users`, `insights`)
- Имена полей в Prisma: camelCase; в БД: snake_case (через `@map`)
