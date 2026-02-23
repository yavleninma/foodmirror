import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Bulk import Russian products from Open Food Facts search API.
 *
 * Uses the search API to fetch products sold in Russia with complete nutrition data.
 * Imports them into FoodReference with source="Open Food Facts".
 *
 * Run: npx tsx scripts/import-off.ts [--pages=N] [--clear-off]
 */

const db = new PrismaClient();

const OFF_API_BASE = "https://world.openfoodfacts.org";
const USER_AGENT = "FoodMirror-Import/1.0";
const PAGE_SIZE = 100;
const RATE_LIMIT_MS = 7000;
const REQUEST_TIMEOUT_MS = 60000;
const RETRY_ATTEMPTS = 4;
const RETRY_BACKOFF_MS = 8000;

const RETRYABLE_STATUSES = [502, 503, 504];

async function fetchWithRetry(url: string): Promise<Response> {
  let lastRes: Response | null = null;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      lastRes = res;
      if (!RETRYABLE_STATUSES.includes(res.status)) return res;
      if (attempt < RETRY_ATTEMPTS) {
        const delay = RETRY_BACKOFF_MS * attempt;
        console.error(`OFF API ${res.status}, retry ${attempt}/${RETRY_ATTEMPTS} in ${delay / 1000}s`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        return res;
      }
    } catch (e) {
      clearTimeout(timeout);
      if (attempt < RETRY_ATTEMPTS) {
        const delay = RETRY_BACKOFF_MS * attempt;
        console.error(
          `OFF API error: ${e instanceof Error ? e.message : String(e)}, retry ${attempt}/${RETRY_ATTEMPTS} in ${delay / 1000}s`,
        );
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw e;
      }
    }
  }
  return lastRes!;
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[\s-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  generic_name?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    energy_100g?: number;
    proteins_100g?: number;
    fat_100g?: number;
    carbohydrates_100g?: number;
    fiber_100g?: number;
  };
  completeness?: number;
};

function extractKcal(n: OffProduct["nutriments"]): number | null {
  if (!n) return null;
  if (typeof n["energy-kcal_100g"] === "number") return n["energy-kcal_100g"];
  if (typeof n.energy_100g === "number") return Math.round(n.energy_100g / 4.184);
  return null;
}

function isComplete(product: OffProduct): boolean {
  const n = product.nutriments;
  if (!n) return false;
  const kcal = extractKcal(n);
  return (
    kcal != null &&
    kcal > 0 &&
    kcal <= 900 &&
    typeof n.proteins_100g === "number" &&
    typeof n.fat_100g === "number" &&
    typeof n.carbohydrates_100g === "number" &&
    n.proteins_100g >= 0 &&
    n.fat_100g >= 0 &&
    n.carbohydrates_100g >= 0 &&
    n.proteins_100g + n.fat_100g + n.carbohydrates_100g <= 110
  );
}

async function fetchPage(page: number, tag: string): Promise<OffProduct[]> {
  const params = new URLSearchParams({
    action: "process",
    tagtype_0: "countries",
    tag_contains_0: "contains",
    tag_0: tag,
    sort_by: "completeness",
    page_size: String(PAGE_SIZE),
    page: String(page),
    json: "1",
    fields: "code,product_name,brands,generic_name,nutriments,completeness",
  });

  const res = await fetchWithRetry(`${OFF_API_BASE}/cgi/search.pl?${params}`);

  if (!res.ok) {
    console.error(`OFF API error ${res.status}: ${res.statusText}`);
    return [];
  }

  const data = await res.json() as { products?: OffProduct[] };
  return data.products ?? [];
}

async function fetchPageByCategory(page: number, category: string): Promise<OffProduct[]> {
  const params = new URLSearchParams({
    action: "process",
    tagtype_0: "categories",
    tag_contains_0: "contains",
    tag_0: category,
    sort_by: "completeness",
    page_size: String(PAGE_SIZE),
    page: String(page),
    json: "1",
    fields: "code,product_name,brands,generic_name,nutriments,completeness",
  });

  const res = await fetchWithRetry(`${OFF_API_BASE}/cgi/search.pl?${params}`);

  if (!res.ok) {
    console.error(`OFF API error ${res.status}: ${res.statusText}`);
    return [];
  }

  const data = await res.json() as { products?: OffProduct[] };
  return data.products ?? [];
}

async function main() {
  const args = process.argv.slice(2);
  const maxPages = parseInt(
    args.find((a) => a.startsWith("--pages="))?.split("=")[1] ?? "200",
    10,
  );
  const clearOff = args.includes("--clear-off");

  const offSource = await db.foodSource.upsert({
    where: { name: "Open Food Facts" },
    update: {},
    create: {
      name: "Open Food Facts",
      url: "https://world.openfoodfacts.org/",
      notes: "Краудсорсинговая база упакованных продуктов, ODbL.",
    },
  });

  if (clearOff) {
    const deleted = await db.foodReference.deleteMany({
      where: { sourceId: offSource.id },
    });
    console.log(`Deleted OFF records: ${deleted.count}`);
  }

  // CIS country tags: fetch products sold in Russia/CIS region
  const countryTags = ["russia", "ukraine", "belarus", "kazakhstan"];

  // Generic food categories: these cover common foods not captured by country-specific search.
  // Category slugs from OFF taxonomy (en: prefixed = English canonical category names).
  const categoryTags = [
    "en:beverages",
    "en:coffees",
    "en:teas",
    "en:dairy",
    "en:cheeses",
    "en:yogurts",
    "en:breads",
    "en:cereals-and-their-products",
    "en:meats",
    "en:fish-and-seafood",
    "en:fruits-and-vegetables",
    "en:snacks",
    "en:chocolates",
    "en:sweet-snacks",
    "en:sauces",
    "en:soups",
    "en:ready-meals",
    "en:frozen-foods",
    "en:ice-creams",
    "en:juices-and-nectars",
  ];

  let totalImported = 0;
  let totalSkipped = 0;

  // Helper: upsert a single product into FoodReference
  async function upsertProduct(product: OffProduct): Promise<"imported" | "skipped"> {
    if (!isComplete(product)) return "skipped";

    const n = product.nutriments!;
    const kcal = extractKcal(n)!;
    const protein = n.proteins_100g ?? 0;
    const fat = n.fat_100g ?? 0;
    const carbs = n.carbohydrates_100g ?? 0;
    const fiber = typeof n.fiber_100g === "number" ? n.fiber_100g : null;

    const displayLabel = [product.product_name, product.brands]
      .filter(Boolean)
      .join(" — ")
      .trim();
    if (!displayLabel) return "skipped";

    const canonicalName = normalizeName(displayLabel);
    if (!canonicalName) return "skipped";

    const barcode = product.code?.trim() || null;
    const completeness = Math.min(1, product.completeness ?? 0.6);

    try {
      await db.foodReference.upsert({
        where: { canonicalName },
        update: {
          kcalPer100g: kcal,
          proteinPer100g: protein,
          fatPer100g: fat,
          carbsPer100g: carbs,
          fiberPer100g: fiber,
          barcode,
          offProductId: product.code ?? null,
          dataCompleteness: completeness,
          updatedAt: new Date(),
        },
        create: {
          canonicalName,
          displayLabel,
          kcalPer100g: kcal,
          proteinPer100g: protein,
          fatPer100g: fat,
          carbsPer100g: carbs,
          fiberPer100g: fiber,
          sourceId: offSource.id,
          verified: true,
          barcode,
          offProductId: product.code ?? null,
          locale: "ru",
          dataCompleteness: completeness,
        },
      });

      if (product.generic_name) {
        const aliasKey = normalizeName(product.generic_name);
        if (aliasKey && aliasKey !== canonicalName) {
          await db.foodAlias
            .upsert({
              where: { alias_locale: { alias: aliasKey, locale: "ru" } },
              update: {},
              create: {
                alias: aliasKey,
                locale: "ru",
                foodReferenceId: (
                  await db.foodReference.findUnique({ where: { canonicalName } })
                )!.id,
              },
            })
            .catch(() => {});
        }
      }

      return "imported";
    } catch {
      return "skipped";
    }
  }

  // ── Country-based import ────────────────────────────────────────────────
  for (const tag of countryTags) {
    console.log(`\n--- Importing from country: ${tag} ---`);

    for (let page = 1; page <= maxPages; page++) {
      const products = await fetchPage(page, tag);
      if (products.length === 0) {
        console.log(`  Page ${page}: empty, done with ${tag}`);
        break;
      }

      let pageImported = 0;
      for (const product of products) {
        const result = await upsertProduct(product);
        if (result === "imported") {
          pageImported++;
          totalImported++;
        } else {
          totalSkipped++;
        }
      }

      console.log(
        `  Page ${page}: +${pageImported} imported, ${products.length} fetched (total: ${totalImported})`,
      );

      if (products.length < PAGE_SIZE) break;
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }
  }

  // ── Category-based import (generic foods, beverages, etc.) ─────────────
  // Limit to fewer pages per category to avoid excessive runtime;
  // these are supplementary to the country-based import.
  const maxCategoryPages = Math.min(maxPages, 30);
  for (const category of categoryTags) {
    console.log(`\n--- Importing from category: ${category} ---`);

    for (let page = 1; page <= maxCategoryPages; page++) {
      const products = await fetchPageByCategory(page, category);
      if (products.length === 0) {
        console.log(`  Page ${page}: empty, done with ${category}`);
        break;
      }

      let pageImported = 0;
      for (const product of products) {
        const result = await upsertProduct(product);
        if (result === "imported") {
          pageImported++;
          totalImported++;
        } else {
          totalSkipped++;
        }
      }

      console.log(
        `  Page ${page}: +${pageImported} imported, ${products.length} fetched (total: ${totalImported})`,
      );

      if (products.length < PAGE_SIZE) break;
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }
  }

  console.log(
    `\nDone. Imported: ${totalImported}, Skipped: ${totalSkipped}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
