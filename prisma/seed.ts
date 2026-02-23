import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * Seed: только unknown_generic (fallback).
 * Основная база — USDA (npm run usda:import, npm run usda:enrich).
 * Неизвестные продукты → LLM (buildFoodReference).
 */

async function main() {
  const fallbackSource = await db.foodSource.upsert({
    where: { name: "Internal fallback" },
    update: {},
    create: {
      name: "Internal fallback",
      notes: "0-0-0-0 для неизвестных продуктов.",
    },
  });

  const kcalPer100g = 0; // 4*0 + 9*0 + 4*0
  await db.foodReference.upsert({
    where: { canonicalName: "unknown_generic" },
    update: {
      displayLabel: "неизвестный продукт",
      kcalPer100g,
      proteinPer100g: 0,
      fatPer100g: 0,
      carbsPer100g: 0,
      sourceId: fallbackSource.id,
    },
    create: {
      canonicalName: "unknown_generic",
      displayLabel: "неизвестный продукт",
      kcalPer100g,
      proteinPer100g: 0,
      fatPer100g: 0,
      carbsPer100g: 0,
      sourceId: fallbackSource.id,
    },
  });

  await db.foodSource.upsert({
    where: { name: "LLM-generated" },
    update: {},
    create: {
      name: "LLM-generated",
      notes: "Сгенерировано LLM, не верифицировано.",
    },
  });

  await db.foodSource.upsert({
    where: { name: "Open Food Facts" },
    update: {},
    create: {
      name: "Open Food Facts",
      url: "https://world.openfoodfacts.org/",
      notes: "Краудсорсинговая база упакованных продуктов, ODbL.",
    },
  });

  await db.foodSource.upsert({
    where: { name: "Calorizator.ru" },
    update: {},
    create: {
      name: "Calorizator.ru",
      url: "https://calorizator.ru/",
      notes: "Таблица калорийности продуктов. Приоритет для РФ по геопозиции.",
    },
  });

  const oldSource = await db.foodSource.findFirst({
    where: { name: "Internal reference (approx)" },
  });
  if (oldSource) {
    await db.foodReference.deleteMany({ where: { sourceId: oldSource.id } });
    await db.foodSource.delete({ where: { id: oldSource.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
