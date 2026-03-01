/**
 * Seed meals for a user by @username (e.g. iavlenin) for January and February
 * so that statistics (Средний день по месяцам, По дням) have data.
 *
 * Usage: npx tsx scripts/seed-user-meals.ts iavlenin
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Simple seeded random for reproducible variety
function seeded(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function randomInRange(seed: number, min: number, max: number): number {
  return Math.round(min + seeded(seed) * (max - min));
}

async function main() {
  const firstArg = process.argv[2]?.trim().replace(/^@/, "");
  const secondArg = process.argv[3]?.trim().replace(/^@/, "");

  if (firstArg === "list" || firstArg === "-l" || firstArg === "--list") {
    const users = await db.user.findMany({
      select: { id: true, chatId: true, username: true },
      orderBy: { id: "asc" },
    });
    console.log("Пользователи: id | chatId | username");
    for (const u of users) {
      console.log(`  ${u.id} | ${u.chatId} | ${u.username ?? "(нет)"}`);
    }
    return;
  }

  const lookup = firstArg || "iavlenin";

  let user: { id: number; username: string | null; chatId: string } | null = null;
  const byUsername = !/^\d+$/.test(lookup);

  if (byUsername) {
    user = await db.user.findFirst({
      where: { username: { equals: lookup, mode: "insensitive" } },
      select: { id: true, username: true, chatId: true },
    });
  } else {
    const chatId = lookup;
    user = await db.user.findUnique({
      where: { chatId },
      select: { id: true, username: true, chatId: true },
    });
    if (user && !user.username) {
      const newUsername = secondArg || "iavlenin";
      await db.user.update({
        where: { id: user.id },
        data: { username: newUsername },
      });
      user = { ...user, username: newUsername };
    }
  }

  if (!user) {
    console.error(
      byUsername
        ? `Пользователь @${lookup} не найден. Убедитесь, что он уже писал боту (чтобы сохранился username), или укажите chatId: npx tsx scripts/seed-user-meals.ts <chatId>\nСписок пользователей: npx tsx scripts/seed-user-meals.ts list`
        : `Пользователь с chatId=${lookup} не найден. Список: npx tsx scripts/seed-user-meals.ts list`,
    );
    process.exit(1);
  }

  const userId = user.id;
  console.log(`Найден пользователь id=${userId} @${user.username ?? lookup}. Добавляю приёмы за январь и февраль...`);

  const today = new Date();
  const janStart = new Date(Date.UTC(2026, 0, 1));
  const febEnd = new Date(Date.UTC(2026, 1, 19)); // до 19.02 включительно

  const mealsToCreate: Array<{
    dayKey: string;
    title: string;
    kcalMean: number;
    proteinMean: number;
    fatMean: number;
    carbsMean: number;
    uncertainty: number;
  }> = [];

  let cursor = new Date(janStart);
  while (cursor <= febEnd) {
    const d = cursor.getUTCDate();
    const m = cursor.getUTCMonth();
    const dayKey = toDayKey(cursor);
    const seed = userId * 10000 + cursor.getTime();
    const mealsPerDay = randomInRange(seed, 1, 3);
    const dayKcal = randomInRange(seed + 1, 1600, 2400);
    const dayProtein = randomInRange(seed + 2, 70, 120);
    const dayFat = randomInRange(seed + 3, 60, 100);
    const dayCarbs = randomInRange(seed + 4, 150, 220);

    for (let i = 0; i < mealsPerDay; i++) {
      const part = (i + 1) / mealsPerDay;
      const pct = part - (i === 0 ? 0 : (i / mealsPerDay));
      mealsToCreate.push({
        dayKey,
        title: `Приём ${i + 1}`,
        kcalMean: Math.round((dayKcal * pct) / 10) * 10,
        proteinMean: Math.round(dayProtein * pct),
        fatMean: Math.round(dayFat * pct),
        carbsMean: Math.round(dayCarbs * pct),
        uncertainty: 0.1 + seeded(seed + i) * 0.15,
      });
    }
    cursor = addDays(cursor, 1);
  }

  for (const m of mealsToCreate) {
    const u = m.uncertainty;
    await db.meal.create({
      data: {
        userId,
        dayKey: m.dayKey,
        title: m.title,
        kcalMean: m.kcalMean,
        kcalMin: m.kcalMean * (1 - u),
        kcalMax: m.kcalMean * (1 + u),
        proteinMean: m.proteinMean,
        proteinMin: m.proteinMean * (1 - u),
        proteinMax: m.proteinMean * (1 + u),
        fatMean: m.fatMean,
        fatMin: m.fatMean * (1 - u),
        fatMax: m.fatMean * (1 + u),
        carbsMean: m.carbsMean,
        carbsMin: m.carbsMean * (1 - u),
        carbsMax: m.carbsMean * (1 + u),
        uncertaintyBand: u,
      },
    });
  }

  console.log(`Создано приёмов: ${mealsToCreate.length}. Можно смотреть статистику в боте.`);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
