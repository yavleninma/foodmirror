import "dotenv/config";

/**
 * Обогащение USDA-продуктов: portions, fiber, min/max нутриентов, foodCategory.
 * Вызывает API /foods batch (до 20 id за запрос).
 *
 * Запуск: npx tsx scripts/enrich-usda.ts [--limit N]
 *   --limit N — обработать только первые N записей (для теста)
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const USDA_API_BASE = "https://api.nal.usda.gov/fdc/v1";
// USDA FDC nutrient.id (full API), не NDB number
const NUTRIENT_IDS = { protein: 1003, fat: 1004, carbs: 1005, fiber: 1079 } as const;

type FoodPortion = { modifier: string; gramWeight: number };
type NutrientRanges = {
  protein?: { min: number; max: number };
  fat?: { min: number; max: number };
  carbs?: { min: number; max: number };
};

type UsdaFullFood = {
  fdcId: number;
  description?: string;
  foodCategory?: { description?: string };
  foodNutrients?: Array<{
    nutrient?: { id?: number };
    amount?: number;
    min?: number;
    max?: number;
  }>;
  foodPortions?: Array<{
    portionDescription?: string;
    gramWeight?: number;
    modifier?: string;
  }>;
};

function extractEnrichment(food: UsdaFullFood): {
  fiber: number;
  portions: FoodPortion[];
  nutrientRanges: NutrientRanges;
  foodCategory: string | null;
} {
  let fiber = 0;
  const nutrientRanges: NutrientRanges = {};
  const nutrients = food.foodNutrients ?? [];
  for (const n of nutrients) {
    const id = n.nutrient?.id;
    if (id == null) continue;
    if (id === NUTRIENT_IDS.fiber) {
      fiber = n.amount ?? 0;
      continue;
    }
    if (id === NUTRIENT_IDS.protein && (n.min != null || n.max != null))
      nutrientRanges.protein = { min: n.min ?? n.amount ?? 0, max: n.max ?? n.amount ?? 0 };
    if (id === NUTRIENT_IDS.fat && (n.min != null || n.max != null))
      nutrientRanges.fat = { min: n.min ?? n.amount ?? 0, max: n.max ?? n.amount ?? 0 };
    if (id === NUTRIENT_IDS.carbs && (n.min != null || n.max != null))
      nutrientRanges.carbs = { min: n.min ?? n.amount ?? 0, max: n.max ?? n.amount ?? 0 };
  }
  const portions: FoodPortion[] = (food.foodPortions ?? [])
    .filter((p) => p.gramWeight != null && p.gramWeight > 0)
    .map((p) => ({
      modifier: p.modifier ?? p.portionDescription ?? "portion",
      gramWeight: Math.round((p.gramWeight ?? 0) * 10) / 10,
    }))
    .slice(0, 10); // максимум 10 порций
  const foodCategory = food.foodCategory?.description ?? null;
  return { fiber, portions, nutrientRanges, foodCategory };
}

async function fetchUsdaFoods(apiKey: string, fdcIds: number[]): Promise<UsdaFullFood[]> {
  const url = `${USDA_API_BASE}/foods?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fdcIds }),
  });
  if (!res.ok)
    throw new Error(`USDA API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as UsdaFullFood[];
  return Array.isArray(data) ? data : [];
}

async function main() {
  const apiKey = process.env.FDC_API_KEY ?? process.env.USDA_API_KEY;
  if (!apiKey) {
    console.error("Требуется FDC_API_KEY в .env");
    process.exit(1);
  }

  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

  const usdaSource = await db.foodSource.findFirst({
    where: { name: "USDA FoodData Central" },
  });
  if (!usdaSource) {
    console.error("Сначала выполните npm run usda:import");
    process.exit(1);
  }

  const refs = await db.foodReference.findMany({
    where: { sourceId: usdaSource.id, fdcId: { not: null } },
    select: { id: true, fdcId: true },
    orderBy: { id: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  const BATCH = 20;
  let enriched = 0;
  for (let i = 0; i < refs.length; i += BATCH) {
    const batch = refs.slice(i, i + BATCH).filter((r) => r.fdcId != null);
    if (batch.length === 0) continue;

    const fdcIds = batch.map((r) => r.fdcId!);
    const foods = await fetchUsdaFoods(apiKey, fdcIds);
    const byFdcId = new Map(foods.map((f) => [f.fdcId, f]));

    for (const ref of batch) {
      const food = byFdcId.get(ref.fdcId!);
      if (!food) continue;

      const { fiber, portions, nutrientRanges, foodCategory } = extractEnrichment(food);
      const hasData = fiber > 0 || portions.length > 0 || Object.keys(nutrientRanges).length > 0 || foodCategory;

      if (!hasData) continue;

      await db.foodReference.update({
        where: { id: ref.id },
        data: {
          ...(fiber > 0 ? { fiberPer100g: fiber } : {}),
          ...(portions.length > 0 ? { portionsJson: portions as unknown as object } : {}),
          ...(Object.keys(nutrientRanges).length > 0 ? { nutrientRanges: nutrientRanges as unknown as object } : {}),
          ...(foodCategory ? { foodCategory } : {}),
          updatedAt: new Date(),
        },
      });
      enriched++;
    }

    console.log(`Batch ${Math.floor(i / BATCH) + 1}: +${enriched} enriched`);
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`Готово. Обогащено: ${enriched}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
