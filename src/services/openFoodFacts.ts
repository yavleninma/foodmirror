import { db } from "../db";
import { normalizeName } from "../utils/foodNames";

const OFF_API_BASE = "https://world.openfoodfacts.org";
const OFF_USER_AGENT = "FoodMirror/1.0 (https://github.com/user/foodmirror)";

const REQUEST_TIMEOUT_MS = 15000;
const SEARCH_RATE_LIMIT_MS = 6500;
const PRODUCT_RATE_LIMIT_MS = 700;
const RETRY_BACKOFF_MS = 3000;
const RETRYABLE_STATUSES = [502, 503, 504];

let lastSearchAt = 0;
let lastProductAt = 0;

const negativeCache = new Map<string, number>();
const NEGATIVE_CACHE_TTL_MS = 30 * 60 * 1000;

function isNegativelyCached(key: string): boolean {
  const ts = negativeCache.get(key);
  if (ts == null) return false;
  if (Date.now() - ts > NEGATIVE_CACHE_TTL_MS) {
    negativeCache.delete(key);
    return false;
  }
  return true;
}

function setNegativeCache(key: string): void {
  negativeCache.set(key, Date.now());
  if (negativeCache.size > 2000) {
    const oldest = negativeCache.keys().next().value;
    if (oldest) negativeCache.delete(oldest);
  }
}

type OffNutriments = {
  "energy-kcal_100g"?: number;
  energy_100g?: number;
  proteins_100g?: number;
  fat_100g?: number;
  carbohydrates_100g?: number;
  fiber_100g?: number;
};

type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  generic_name?: string;
  nutriments?: OffNutriments;
  nutriscore_grade?: string;
  completeness?: number;
  countries_tags?: string[];
};

type OffProductResponse = {
  status: number;
  product?: OffProduct;
};

type OffSearchResponse = {
  count?: number;
  products?: OffProduct[];
};

async function rateLimitedFetch(
  url: string,
  minDelayMs: number,
  lastCallRef: { value: number },
  isRetry = false,
): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastCallRef.value;
  if (elapsed < minDelayMs) {
    await new Promise((r) => setTimeout(r, minDelayMs - elapsed));
  }
  lastCallRef.value = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": OFF_USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!isRetry && RETRYABLE_STATUSES.includes(res.status)) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      return rateLimitedFetch(url, minDelayMs, lastCallRef, true);
    }
    return res;
  } catch (e) {
    clearTimeout(timeout);
    if (!isRetry) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      return rateLimitedFetch(url, minDelayMs, lastCallRef, true);
    }
    throw e;
  }
}

function extractKcal(nutriments: OffNutriments): number | null {
  if (typeof nutriments["energy-kcal_100g"] === "number") {
    return nutriments["energy-kcal_100g"];
  }
  if (typeof nutriments.energy_100g === "number") {
    return Math.round(nutriments.energy_100g / 4.184);
  }
  return null;
}

function isNutrimentComplete(nutriments: OffNutriments | undefined): boolean {
  if (!nutriments) return false;
  const kcal = extractKcal(nutriments);
  return (
    kcal != null &&
    kcal > 0 &&
    typeof nutriments.proteins_100g === "number" &&
    typeof nutriments.fat_100g === "number" &&
    typeof nutriments.carbohydrates_100g === "number"
  );
}

function productToCanonicalName(product: OffProduct): string {
  const name = product.product_name || product.generic_name || "";
  return normalizeName(name) || `off_${product.code}`;
}

export async function lookupByBarcode(barcode: string): Promise<{
  id: number;
  canonicalName: string;
  displayLabel: string;
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g: number | null;
  barcode: string | null;
  source: { name: string; url: string | null };
} | null> {
  const existing = await db.foodReference.findFirst({
    where: { barcode },
    include: { source: true },
  });
  if (existing) return existing;

  if (isNegativelyCached(`barcode:${barcode}`)) return null;

  const lastRef = { value: lastProductAt };
  let res: Response;
  try {
    res = await rateLimitedFetch(
      `${OFF_API_BASE}/api/v2/product/${encodeURIComponent(barcode)}?fields=code,product_name,brands,generic_name,nutriments,completeness,countries_tags`,
      PRODUCT_RATE_LIMIT_MS,
      lastRef,
    );
    lastProductAt = lastRef.value;
  } catch {
    return null;
  }

  if (!res.ok) {
    setNegativeCache(`barcode:${barcode}`);
    return null;
  }

  const data = (await res.json()) as OffProductResponse;
  if (data.status !== 1 || !data.product) {
    setNegativeCache(`barcode:${barcode}`);
    return null;
  }

  const product = data.product;
  if (!isNutrimentComplete(product.nutriments)) {
    setNegativeCache(`barcode:${barcode}`);
    return null;
  }

  return persistOffProduct(product, barcode);
}

export async function searchByText(query: string): Promise<{
  id: number;
  canonicalName: string;
  displayLabel: string;
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g: number | null;
  barcode: string | null;
  source: { name: string; url: string | null };
} | null> {
  if (isNegativelyCached(`search:${query}`)) return null;

  const lastRef = { value: lastSearchAt };
  let res: Response;
  try {
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: "5",
      fields: "code,product_name,brands,generic_name,nutriments,completeness,countries_tags",
    });
    res = await rateLimitedFetch(
      `${OFF_API_BASE}/cgi/search.pl?${params}`,
      SEARCH_RATE_LIMIT_MS,
      lastRef,
    );
    lastSearchAt = lastRef.value;
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const data = (await res.json()) as OffSearchResponse;
  const products = data.products ?? [];

  const best = products.find((p) => isNutrimentComplete(p.nutriments));
  if (!best) {
    setNegativeCache(`search:${query}`);
    return null;
  }

  const barcode = best.code ?? undefined;
  if (barcode) {
    const existing = await db.foodReference.findFirst({
      where: { barcode },
      include: { source: true },
    });
    if (existing) return existing;
  }

  return persistOffProduct(best, barcode);
}

async function persistOffProduct(
  product: OffProduct,
  barcode?: string,
): Promise<{
  id: number;
  canonicalName: string;
  displayLabel: string;
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g: number | null;
  barcode: string | null;
  source: { name: string; url: string | null };
} | null> {
  const nutriments = product.nutriments!;
  const kcal = extractKcal(nutriments);
  if (kcal == null) return null;

  const protein = nutriments.proteins_100g ?? 0;
  const fat = nutriments.fat_100g ?? 0;
  const carbs = nutriments.carbohydrates_100g ?? 0;
  const fiber = nutriments.fiber_100g ?? null;

  const offSource = await db.foodSource.findUnique({
    where: { name: "Open Food Facts" },
  });
  if (!offSource) return null;

  const displayLabel = [product.product_name, product.brands]
    .filter(Boolean)
    .join(" — ")
    .trim() || `OFF product ${barcode}`;

  let canonicalName = productToCanonicalName(product);

  const existing = await db.foodReference.findUnique({
    where: { canonicalName },
  });
  if (existing) {
    if (barcode && !existing.barcode) {
      await db.foodReference.update({
        where: { id: existing.id },
        data: { barcode },
      });
    }
    const ref = await db.foodReference.findUnique({
      where: { id: existing.id },
      include: { source: true },
    });
    return ref;
  }

  const completeness = product.completeness ?? 0;
  const dataCompleteness = Math.min(1, completeness > 0 ? completeness : 0.6);

  try {
    const ref = await db.foodReference.create({
      data: {
        canonicalName,
        displayLabel,
        kcalPer100g: kcal,
        proteinPer100g: protein,
        fatPer100g: fat,
        carbsPer100g: carbs,
        fiberPer100g: fiber,
        sourceId: offSource.id,
        verified: true,
        barcode: barcode ?? null,
        offProductId: product.code ?? null,
        locale: "world",
        dataCompleteness,
      },
      include: { source: true },
    });

    if (product.generic_name) {
      const aliasKey = normalizeName(product.generic_name);
      if (aliasKey && aliasKey !== canonicalName) {
        await db.foodAlias
          .create({
            data: { alias: aliasKey, locale: "ru", foodReferenceId: ref.id },
          })
          .catch(() => {});
      }
    }

    // Cache invalidation is handled by the caller (foodResolver.ts calls ensureLoaded(true) after this)
    return ref;
  } catch {
    return null;
  }
}
