/**
 * Аудит источников КБЖУ в БД.
 * Считает FoodReference и компоненты подтверждённых приёмов по источникам,
 * собирает «проблемы» (компоненты на LLM-generated / Internal fallback).
 *
 * Локально:  npx tsx scripts/count-sources.ts
 * На проде:  ssh на droplet, затем:
 *   cd /opt/foodmirror && docker compose run --rm bot npx tsx scripts/count-sources.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const PROBLEM_SOURCE_NAMES = ["LLM-generated", "Internal fallback"];
const OPEN_SOURCE_NAMES = ["USDA FoodData Central", "Open Food Facts", "Calorizator.ru"];

async function main() {
  const sources = await db.foodSource.findMany({
    select: { id: true, name: true },
  });
  const sourceIdToName = new Map(sources.map((s) => [s.id, s.name]));

  // --- 1. FoodReference по источникам ---
  const refBySource = await db.foodReference.groupBy({
    by: ["sourceId"],
    _count: true,
  });
  const totalRef = await db.foodReference.count();

  console.log("=== FoodReference по источникам ===\n");
  for (const row of refBySource) {
    const name = sourceIdToName.get(row.sourceId) ?? "?";
    console.log(`  ${name}: ${row._count}`);
  }
  console.log(`  Всего записей в справочнике: ${totalRef}\n`);

  // --- 2. Компоненты подтверждённых приёмов по источникам ---
  const confirmedMealIds = await db.meal
    .findMany({
      where: { deletedAt: null },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  if (confirmedMealIds.length === 0) {
    console.log("=== Компоненты приёмов (подтверждённые, не удалённые) ===\n  Нет приёмов.\n");
  } else {
    const components = await db.mealComponent.findMany({
      where: { mealId: { in: confirmedMealIds } },
      include: {
        meal: { select: { id: true, dayKey: true, createdAt: true } },
        foodReference: { include: { source: { select: { name: true } } } },
      },
    });

    const withRef = components.filter((c) => c.foodReference != null);
    const withoutRef = components.filter((c) => c.foodReferenceId == null);

    const bySourceName = new Map<string, number>();
    for (const c of withRef) {
      const name = c.foodReference!.source.name;
      bySourceName.set(name, (bySourceName.get(name) ?? 0) + 1);
    }

    const totalComp = components.length;
    const problemCount = withRef.filter((c) =>
      PROBLEM_SOURCE_NAMES.includes(c.foodReference!.source.name),
    ).length;
    const openCount = withRef.filter((c) =>
      OPEN_SOURCE_NAMES.includes(c.foodReference!.source.name),
    ).length;

    console.log("=== Компоненты приёмов (подтверждённые, не удалённые) ===\n");
    for (const [name, count] of [...bySourceName.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${name}: ${count}`);
    }
    if (withoutRef.length > 0) {
      console.log(`  без привязки к справочнику: ${withoutRef.length}`);
    }
    console.log(`  Всего компонентов: ${totalComp}\n`);

    console.log("--- Сводка по открытым vs проблемным источникам ---");
    console.log(`  Открытые источники (USDA, OFF): ${openCount} компонентов`);
    console.log(`  LLM / Internal fallback:        ${problemCount} компонентов`);
    if (totalComp > 0) {
      const pct = ((problemCount / totalComp) * 100).toFixed(1);
      console.log(`  Доля «проблемных» компонентов:   ${pct}%\n`);
    }

    // --- 3. Сбор проблем ---
    const problemComponents = withRef.filter((c) =>
      PROBLEM_SOURCE_NAMES.includes(c.foodReference!.source.name),
    );

    console.log("=== ПРОБЛЕМЫ (компоненты на LLM-generated или Internal fallback) ===\n");

    if (problemComponents.length === 0) {
      console.log("  Нет компонентов с непроверенными источниками.\n");
    } else {
      const byCanonical = new Map<string, { count: number; source: string }>();
      for (const c of problemComponents) {
        const name = c.foodReference!.source.name;
        const key = c.canonicalName;
        const prev = byCanonical.get(key);
        if (prev) {
          prev.count += 1;
        } else {
          byCanonical.set(key, { count: 1, source: name });
        }
      }

      const topProblems = [...byCanonical.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 30);

      console.log("  Топ продуктов по числу использований в приёмах (источник: LLM или fallback):\n");
      for (const [canonical, { count, source }] of topProblems) {
        console.log(`    ${count}\t${source}\t${canonical}`);
      }

      console.log(`\n  Всего уникальных «проблемных» продуктов: ${byCanonical.size}`);
      console.log(`  Всего вхождений в приёмы: ${problemComponents.length}\n`);

      console.log("  Примеры последних приёмов с проблемными компонентами:\n");
      const recent = [...problemComponents]
        .sort(
          (a, b) =>
            new Date(b.meal!.createdAt).getTime() - new Date(a.meal!.createdAt).getTime(),
        )
        .slice(0, 15);
      for (const c of recent) {
        const ref = c.foodReference!;
        const day = c.meal!.dayKey;
        console.log(`    ${day}  ${c.displayLabel}  (${ref.source.name})  БЖУ: ${ref.proteinPer100g}/${ref.fatPer100g}/${ref.carbsPer100g}`);
      }
    }
  }

  console.log("\n--- Конец отчёта ---");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
