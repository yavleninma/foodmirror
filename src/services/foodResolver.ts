import { db } from "../db";
import { normalizeName } from "../utils/foodNames";
import { lookupByBarcode as offLookupByBarcode, searchByText as offSearchByText } from "./openFoodFacts";

type FoodReferenceRow = {
  id: number;
  canonicalName: string;
  displayLabel: string;
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g: number | null;
  fdcId: number | null;
  barcode: string | null;
  verified: boolean;
  locale: string | null;
  foodCategory: string | null;
  portionsJson: unknown;
  nutrientRanges: unknown;
  dataCompleteness: number | null;
  source: { name: string; url: string | null };
};

export type ResolveResult = {
  reference: FoodReferenceRow;
  matchType: "exact" | "alias" | "fuzzy" | "fallback";
  matchScore: number;
};

const PROCESSED_FOOD_TOKENS = new Set([
  "dried", "dry", "dehydrated", "jam", "jelly", "juice", "canned",
  "preserved", "sweetened", "candied", "frozen", "concentrate",
  "powder", "powdered", "syrup", "сушён", "сушен", "вялен",
  "консервирован", "варенье", "джем", "сок", "порошок", "сироп",
]);

const TRANSLITERATION: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo",
  ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function transliterate(text: string): string {
  return text
    .split("")
    .map((c) => TRANSLITERATION[c] ?? c)
    .join("");
}

function hasProcessedToken(name: string): boolean {
  const lower = name.toLowerCase();
  for (const token of PROCESSED_FOOD_TOKENS) {
    if (lower.includes(token)) return true;
  }
  return false;
}

function tokenize(value: string): string[] {
  return value
    .split("_")
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);
  const s1Matches = new Array<boolean>(len1).fill(false);
  const s2Matches = new Array<boolean>(len2).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

export class FoodReferenceResolver {
  private references: FoodReferenceRow[] = [];
  private refMap = new Map<string, FoodReferenceRow>();
  private aliasMap = new Map<string, FoodReferenceRow>();
  private fallback: FoodReferenceRow | null = null;
  private loadedAt = 0;
  private static TTL_MS = 5 * 60 * 1000;

  async ensureLoaded(force = false): Promise<void> {
    if (!force && this.references.length > 0 && Date.now() - this.loadedAt < FoodReferenceResolver.TTL_MS) {
      return;
    }
    await this.reload();
  }

  async reload(): Promise<void> {
    const refs = await db.foodReference.findMany({ include: { source: true } });
    this.references = refs;
    this.refMap.clear();
    this.aliasMap.clear();

    for (const ref of refs) {
      this.refMap.set(normalizeName(ref.canonicalName), ref);
      this.refMap.set(normalizeName(ref.displayLabel), ref);
      const translit = transliterate(normalizeName(ref.displayLabel));
      if (!this.refMap.has(translit)) {
        this.refMap.set(translit, ref);
      }
      if (ref.canonicalName === "unknown_generic") {
        this.fallback = ref;
      }
    }

    const aliases = await db.foodAlias.findMany({
      include: { foodReference: { include: { source: true } } },
    });
    for (const a of aliases) {
      const key = normalizeName(a.alias);
      if (!this.aliasMap.has(key)) {
        this.aliasMap.set(key, a.foodReference);
      }
      const translitKey = transliterate(key);
      if (!this.aliasMap.has(translitKey)) {
        this.aliasMap.set(translitKey, a.foodReference);
      }
    }

    this.loadedAt = Date.now();
  }

  invalidateCache(): void {
    this.loadedAt = 0;
  }

  async resolve(
    canonicalName: string,
    displayLabel: string,
    options?: { skipOnline?: boolean },
  ): Promise<ResolveResult> {
    await this.ensureLoaded();

    const normalizedCanonical = normalizeName(canonicalName);
    const normalizedLabel = normalizeName(displayLabel);

    const directRef =
      this.refMap.get(normalizedCanonical) ?? this.refMap.get(normalizedLabel);
    if (directRef && directRef.canonicalName !== "unknown_generic") {
      return { reference: directRef, matchType: "exact", matchScore: 1.0 };
    }

    const translitCanonical = transliterate(normalizedCanonical);
    const translitLabel = transliterate(normalizedLabel);
    const translitRef =
      this.refMap.get(translitCanonical) ?? this.refMap.get(translitLabel);
    if (translitRef && translitRef.canonicalName !== "unknown_generic") {
      return { reference: translitRef, matchType: "exact", matchScore: 0.95 };
    }

    const aliasRef =
      this.aliasMap.get(normalizedCanonical) ??
      this.aliasMap.get(normalizedLabel) ??
      this.aliasMap.get(translitCanonical) ??
      this.aliasMap.get(translitLabel);
    if (aliasRef) {
      return { reference: aliasRef, matchType: "alias", matchScore: 0.9 };
    }

    const fuzzy = this.fuzzyMatch(normalizedCanonical, normalizedLabel, canonicalName, displayLabel);
    if (fuzzy) {
      return { reference: fuzzy.ref, matchType: "fuzzy", matchScore: fuzzy.score };
    }

    if (!options?.skipOnline) {
      try {
        const offResult = await offSearchByText(displayLabel || canonicalName);
        if (offResult) {
          this.invalidateCache();
          await this.ensureLoaded(true);
          const asRow = this.references.find((r) => r.id === offResult.id);
          if (asRow) {
            return { reference: asRow, matchType: "exact", matchScore: 0.75 };
          }
        }
      } catch {
        // OFF unavailable, continue to fallback
      }
    }

    if (!this.fallback) {
      throw new Error("Missing fallback food reference: unknown_generic");
    }
    return { reference: this.fallback, matchType: "fallback", matchScore: 0 };
  }

  async resolveByBarcode(barcode: string): Promise<FoodReferenceRow | null> {
    await this.ensureLoaded();
    const localRef = this.references.find((r) => r.barcode === barcode);
    if (localRef) return localRef;

    const dbRef = await db.foodReference.findFirst({
      where: { barcode },
      include: { source: true },
    });
    if (dbRef) return dbRef;

    try {
      const offRef = await offLookupByBarcode(barcode);
      if (offRef) {
        this.invalidateCache();
        return offRef as FoodReferenceRow;
      }
    } catch {
      // OFF unavailable
    }

    return null;
  }

  private fuzzyMatch(
    normalizedCanonical: string,
    normalizedLabel: string,
    rawCanonical: string,
    rawLabel: string,
  ): { ref: FoodReferenceRow; score: number } | null {
    const inputTokens = Array.from(
      new Set(tokenize(normalizedCanonical).concat(tokenize(normalizedLabel))),
    );
    if (inputTokens.length === 0) return null;

    const inputIsProcessed = hasProcessedToken(rawCanonical) || hasProcessedToken(rawLabel);

    type Candidate = {
      ref: FoodReferenceRow;
      coverage: number;
      commonCount: number;
      processedPenalty: number;
      jwScore: number;
    };

    const candidates: Candidate[] = [];

    for (const ref of this.references) {
      if (ref.canonicalName === "unknown_generic") continue;
      const refCanonical = normalizeName(ref.canonicalName);
      const refLabel = normalizeName(ref.displayLabel);
      const refTokens = Array.from(
        new Set(tokenize(refCanonical).concat(tokenize(refLabel))),
      );
      if (refTokens.length === 0) continue;

      const common = inputTokens.filter((token) =>
        refTokens.some((rt) => rt === token || jaroWinkler(token, rt) >= 0.88),
      );
      if (common.length === 0) continue;

      const coverage = common.length / inputTokens.length;
      let processedPenalty = 0;
      if (
        !inputIsProcessed &&
        (hasProcessedToken(ref.canonicalName) || hasProcessedToken(ref.displayLabel))
      ) {
        processedPenalty = 1;
      }

      const jwCanon = jaroWinkler(normalizedCanonical, refCanonical);
      const jwLabel = jaroWinkler(normalizedLabel, refLabel);
      const jwScore = Math.max(jwCanon, jwLabel);

      candidates.push({ ref, coverage, commonCount: common.length, processedPenalty, jwScore });
    }

    if (candidates.length === 0) return null;

    const minCoverage = inputTokens.length <= 2 ? 0.5 : 0.6;
    const filtered = candidates.filter((c) => c.coverage >= minCoverage);
    const scored = filtered.length > 0 ? filtered : candidates;

    scored.sort((a, b) => {
      if (a.processedPenalty !== b.processedPenalty) return a.processedPenalty - b.processedPenalty;
      const aComposite = a.coverage * 0.6 + a.jwScore * 0.4;
      const bComposite = b.coverage * 0.6 + b.jwScore * 0.4;
      if (bComposite !== aComposite) return bComposite - aComposite;
      if (b.commonCount !== a.commonCount) return b.commonCount - a.commonCount;
      return a.ref.displayLabel.length - b.ref.displayLabel.length;
    });

    const best = scored[0];
    if (!best || best.coverage < minCoverage) return null;

    const compositeScore = best.coverage * 0.6 + best.jwScore * 0.4;
    return { ref: best.ref, score: Math.min(compositeScore, 0.85) };
  }

  getFallback(): FoodReferenceRow | null {
    return this.fallback;
  }

  getAllReferences(): FoodReferenceRow[] {
    return this.references;
  }
}

export const foodResolver = new FoodReferenceResolver();
