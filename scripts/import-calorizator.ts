import "dotenv/config";
import { load } from "cheerio";
import { PrismaClient } from "@prisma/client";

/**
 * Импорт продуктов из Calorizator.ru в FoodReference.
 *
 * Парсит HTML-таблицы калорийности с сайта (по категориям и полному списку).
 * Требуется письменное разрешение правообладателя на использование данных.
 *
 * Приоритет источника для пользователей из России по геопозиции (топ-1).
 *
 * Запуск: npx tsx scripts/import-calorizator.ts [--clear-calorizator] [--pages=N] [--categories=all|list]
 *   --clear-calorizator — удалить все записи с источником Calorizator перед импортом
 *   --pages=N           — макс. страниц пагинации для /product/all (по умолчанию 50)
 *   --categories=all    — только полный список /product/all (по умолчанию)
 *   --categories=list   — обойти все категории по отдельности (без пагинации по категориям)
 */

const db = new PrismaClient();

const BASE_URL = "https://www.calorizator.ru";
const USER_AGENT = "FoodMirror-Calorizator-Import/1.0 (authorized)";
const RATE_LIMIT_MS = 1500;
const REQUEST_TIMEOUT_MS = 30000;
const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 5000;

// Категории с главной страницы /product (slug в URL)
const CATEGORY_SLUGS = [
  "egg",
  "berry",
  "bread",
  "fruit",
  "raw",
  "cheese",
  "snack",
  "sea",
  "nut",
  "vegetable",
  "beef",
  "meal",
  "milk",
  "butter",
  "cereals",
  "sausage",
  "mushroom",
  "chocolate",
  "tort",
  "icecream",
  "cake",
  "juice",
  "drink",
  "alcohol",
  "japan",
  "mcdonalds",
  "kfc",
  "burger-king",
  "soup",
  "salad",
  "sport",
  "baby",
];

const TRANSLITERATION: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo",
  ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function transliterate(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((c) => TRANSLITERATION[c] ?? (/\p{L}/u.test(c) ? c : ""))
    .join("");
}

function slug(text: string): string {
  const t = transliterate(text.trim());
  return t
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 120) || "product";
}

function parseNum(value: string): number | null {
  const s = value.replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type CalorizatorRow = {
  name: string;
  protein: number;
  fat: number;
  carbs: number;
  kcal: number;
};

function parseTable(html: string): CalorizatorRow[] {
  const $ = load(html);
  const rows: CalorizatorRow[] = [];
  const seenNames = new Set<string>();

  $("table").each((_, tableEl) => {
    const $table = $(tableEl);
    const allRows = $table.find("tr").toArray();
    if (allRows.length < 2) return;

    const firstRowCells = $(allRows[0]).find("th, td").toArray();
    const headerTexts = firstRowCells.map((el) => $(el).text().trim().toLowerCase());
    const colProduct = headerTexts.findIndex((t) => t.includes("продукт") || t === "название");
    const colProtein = headerTexts.findIndex((t) => t.includes("бел") || t.includes("белки"));
    const colFat = headerTexts.findIndex((t) => t.includes("жир") || t.includes("жиры"));
    const colCarbs = headerTexts.findIndex((t) => t.includes("угл") || t.includes("углевод"));
    const colKcal = headerTexts.findIndex((t) => t.includes("кал") || t.includes("ккал"));

    const iProduct = colProduct >= 0 ? colProduct : 0;
    const iProtein = colProtein >= 0 ? colProtein : 1;
    const iFat = colFat >= 0 ? colFat : 2;
    const iCarbs = colCarbs >= 0 ? colCarbs : 3;
    const iKcal = colKcal >= 0 ? colKcal : 4;

    for (let i = 1; i < allRows.length; i++) {
      const cells = $(allRows[i]).find("td").toArray();
      if (cells.length < 5) continue;

      const getText = (idx: number) => $(cells[idx]).text().trim();
      const name = getText(iProduct);
      if (!name || name.length < 2 || seenNames.has(name)) continue;
      seenNames.add(name);

      const protein = parseNum(getText(iProtein)) ?? 0;
      const fat = parseNum(getText(iFat)) ?? 0;
      const carbs = parseNum(getText(iCarbs)) ?? 0;
      const kcal = parseNum(getText(iKcal));

      if (kcal == null || kcal < 0 || kcal > 1000) continue;

      rows.push({
        name,
        protein,
        fat,
        carbs,
        kcal: Math.round(kcal),
      });
    }
  });

  return rows;
}

async function fetchPage(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      clearTimeout(timeout);
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < RETRY_ATTEMPTS) {
        console.warn(`  Fetch error, retry ${attempt}/${RETRY_ATTEMPTS}: ${lastError.message}`);
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      }
    }
  }
  throw lastError ?? new Error("Fetch failed");
}

async function main() {
  const args = process.argv.slice(2);
  const clearCalorizator = args.includes("--clear-calorizator");
  const maxPages = parseInt(
    args.find((a) => a.startsWith("--pages="))?.split("=")[1] ?? "50",
    10,
  );
  const categoriesArg = args.find((a) => a.startsWith("--categories="))?.split("=")[1] ?? "all";
  const useCategoryList = categoriesArg === "list";

  const calorizatorSource = await db.foodSource.upsert({
    where: { name: "Calorizator.ru" },
    update: {},
    create: {
      name: "Calorizator.ru",
      url: "https://calorizator.ru/",
      notes: "Таблица калорийности продуктов. Приоритет для РФ по геопозиции. Использование по разрешению.",
    },
  });

  if (clearCalorizator) {
    const deleted = await db.foodReference.deleteMany({
      where: { sourceId: calorizatorSource.id },
    });
    console.log(`Удалено записей Calorizator: ${deleted.count}`);
  }

  let totalImported = 0;
  let totalSkipped = 0;
  const seenCanonical = new Set<string>();

  async function upsertRow(row: CalorizatorRow): Promise<"imported" | "skipped"> {
    const displayLabel = row.name.trim();
    if (!displayLabel) return "skipped";

    const canonicalName = "calorizator_" + slug(displayLabel);
    if (!canonicalName || canonicalName === "calorizator_product") return "skipped";

    const kcal = row.kcal;
    const protein = row.protein;
    const fat = row.fat;
    const carbs = row.carbs;
    if (kcal < 0 || protein < 0 || fat < 0 || carbs < 0) return "skipped";

    try {
      await db.foodReference.upsert({
        where: { canonicalName },
        update: {
          displayLabel,
          kcalPer100g: kcal,
          proteinPer100g: protein,
          fatPer100g: fat,
          carbsPer100g: carbs,
          sourceId: calorizatorSource.id,
          locale: "ru",
          updatedAt: new Date(),
        },
        create: {
          canonicalName,
          displayLabel,
          kcalPer100g: kcal,
          proteinPer100g: protein,
          fatPer100g: fat,
          carbsPer100g: carbs,
          sourceId: calorizatorSource.id,
          locale: "ru",
        },
      });
      if (!seenCanonical.has(canonicalName)) {
        seenCanonical.add(canonicalName);
        totalImported++;
      }
      return "imported";
    } catch (e) {
      totalSkipped++;
      return "skipped";
    }
  }

  if (useCategoryList) {
    for (const slug of CATEGORY_SLUGS) {
      const path = `/product/${slug}`;
      console.log(`Категория: ${slug}`);
      try {
        const html = await fetchPage(path);
        const rows = parseTable(html);
        for (const row of rows) {
          await upsertRow(row);
        }
        console.log(`  Строк: ${rows.length}, всего импорт: ${totalImported}`);
        await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
      } catch (e) {
        console.warn(`  Ошибка ${path}:`, e instanceof Error ? e.message : e);
      }
    }
  } else {
    for (let page = 0; page < maxPages; page++) {
      const path = `/product/all?page=${page}`;
      console.log(`Полный список, страница ${page + 1}/${maxPages}`);
      try {
        const html = await fetchPage(path);
        const rows = parseTable(html);
        if (rows.length === 0) {
          console.log("  Пусто, завершение.");
          break;
        }
        for (const row of rows) {
          await upsertRow(row);
        }
        console.log(`  Строк: ${rows.length}, всего импорт: ${totalImported}`);
        if (rows.length < 50) break;
        await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
      } catch (e) {
        console.warn(`  Ошибка:`, e instanceof Error ? e.message : e);
        break;
      }
    }
  }

  console.log(`\nГотово. Импортировано уникальных: ${totalImported}, пропущено: ${totalSkipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
