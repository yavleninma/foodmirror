import "dotenv/config";

/**
 * Импорт продуктов из USDA FoodData Central в FoodReference.
 *
 * Требует FDC_API_KEY в .env (получить: https://fdc.nal.usda.gov/api-key-signup)
 *
 * Использует foods/list API — Foundation Foods и SR Legacy (значения на 100 г).
 *
 * Запуск: npx tsx scripts/import-usda.ts [--clear-usda]
 *   --clear-usda — удалить все продукты с источником USDA перед импортом
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const USDA_API_BASE = "https://api.nal.usda.gov/fdc/v1";

// Nutrient IDs в USDA FDC (для per 100g в Foundation/SR Legacy)
const NUTRIENT_IDS = {
  protein: 203,
  fat: 204,
  carbs: 205,
  energy: 1008, // Energy (kcal)
} as const;

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .replace(/_+/g, "_");
}

function kcalFromBju(p: number, f: number, c: number): number {
  return Math.round(p * 4 + f * 9 + c * 4);
}

type UsdaFood = {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients?: Array<{
    number?: number;
    nutrientNumber?: number;
    nutrient?: { id?: number; number?: string | number };
    amount?: number;
  }>;
};

function getNutrientId(
  n: {
    number?: number;
    nutrientNumber?: number;
    nutrient?: { id?: number; number?: string | number };
  } | undefined
): number | null {
  const num = n?.nutrient?.number ?? n?.nutrientNumber ?? n?.number;
  if (num != null) return typeof num === "string" ? parseInt(num, 10) : num;
  const id = n?.nutrient?.id;
  return id != null ? id : null;
}

function extractNutrients(food: UsdaFood): {
  protein: number;
  fat: number;
  carbs: number;
  kcal: number;
} {
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let energy = 0;
  const nutrients = food.foodNutrients ?? [];
  for (const n of nutrients) {
    const id = getNutrientId(n);
    if (id == null) continue;
    const amount = n?.amount ?? 0;
    if (id === NUTRIENT_IDS.protein) protein = amount;
    else if (id === NUTRIENT_IDS.fat) fat = amount;
    else if (id === NUTRIENT_IDS.carbs) carbs = amount;
    else if (id === NUTRIENT_IDS.energy) energy = amount;
  }
  const kcal =
    protein || fat || carbs ? kcalFromBju(protein, fat, carbs) : energy;
  return { protein, fat, carbs, kcal: Math.round(kcal) };
}

async function fetchUsdaPage(
  apiKey: string,
  pageNumber: number,
  pageSize: number
): Promise<UsdaFood[]> {
  const url = `${USDA_API_BASE}/foods/list?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataType: ["Foundation", "SR Legacy"],
      pageSize,
      pageNumber,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `USDA API error ${res.status}: ${res.statusText} - ${await res.text()}`
    );
  }
  const data = (await res.json()) as UsdaFood[];
  return Array.isArray(data) ? data : [];
}

async function main() {
  const apiKey = process.env.FDC_API_KEY ?? process.env.USDA_API_KEY;
  if (!apiKey) {
    console.error(
      "Требуется FDC_API_KEY или USDA_API_KEY в .env. Получить: https://fdc.nal.usda.gov/api-key-signup"
    );
    process.exit(1);
  }

  const clearUsda = process.argv.includes("--clear-usda");

  const usdaSource = await db.foodSource.upsert({
    where: { name: "USDA FoodData Central" },
    update: {},
    create: {
      name: "USDA FoodData Central",
      url: "https://fdc.nal.usda.gov/",
      notes: "Foundation Foods + SR Legacy, CC0",
    },
  });

  if (clearUsda) {
    const deleted = await db.foodReference.deleteMany({
      where: { sourceId: usdaSource.id },
    });
    console.log(`Удалено записей USDA: ${deleted.count}`);
  }

  let totalImported = 0;
  let pageNumber = 1;
  const pageSize = 200;

  while (true) {
    const foods = await fetchUsdaPage(apiKey, pageNumber, pageSize);
    if (foods.length === 0) break;

    for (const food of foods) {
      const { protein, fat, carbs, kcal } = extractNutrients(food);
      const canonicalName = slug(food.description);
      if (!canonicalName) continue;

      try {
        await db.foodReference.upsert({
          where: { canonicalName },
          update: {
            displayLabel: food.description,
            kcalPer100g: kcal,
            proteinPer100g: protein,
            fatPer100g: fat,
            carbsPer100g: carbs,
            fdcId: food.fdcId,
            sourceId: usdaSource.id,
            updatedAt: new Date(),
          },
          create: {
            canonicalName,
            displayLabel: food.description,
            kcalPer100g: kcal,
            proteinPer100g: protein,
            fatPer100g: fat,
            carbsPer100g: carbs,
            fdcId: food.fdcId,
            sourceId: usdaSource.id,
          },
        });
        totalImported++;
      } catch (e) {
        // Конфликт unique — возможно другой источник уже имеет это имя
        console.warn(`Skip ${canonicalName}:`, (e as Error).message);
      }
    }

    console.log(`Страница ${pageNumber}: +${foods.length} (всего импорт: ${totalImported})`);
    if (foods.length < pageSize) break;
    pageNumber++;
    await new Promise((r) => setTimeout(r, 500)); // rate limit
  }

  console.log(`Готово. Импортировано: ${totalImported}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
