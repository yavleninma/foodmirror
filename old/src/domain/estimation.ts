import { EstimateResult, ParseResult, ParsedComponent } from "../llm/contracts";
import { foodResolver } from "../services/foodResolver";

type WeightRange = {
  mean: number;
  min: number;
  max: number;
  usedFallback: boolean;
  assumptions: string[];
};

export type UserOverride = {
  kcalPer100g?: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;
  weight_g_mean?: number;
  weight_g_min?: number;
  weight_g_max?: number;
  source?: "user" | "llm";
};

export type ResolvedComponent = {
  component: ParsedComponent;
  weight: WeightRange;
  reference: {
    id: number;
    canonicalName: string;
    displayLabel: string;
    proteinPer100g: number;
    fatPer100g: number;
    carbsPer100g: number;
    fiberPer100g?: number;
    nutrientRanges?: NutrientRanges;
    source: { name: string; url: string | null };
  };
  usedFallbackReference: boolean;
  kcalPer100gOverride?: number;
  sourceLabel?: "user" | "reference" | "llm";
};

export type ComponentMacros = {
  label: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

type MacroTotals = {
  kcal: number;
  kcalMin: number;
  kcalMax: number;
  protein: number;
  proteinMin: number;
  proteinMax: number;
  fat: number;
  fatMin: number;
  fatMax: number;
  carbs: number;
  carbsMin: number;
  carbsMax: number;
};

// normalizeName lives in utils/foodNames.ts to break circular dep:
//   estimation.ts → foodResolver.ts → openFoodFacts.ts → estimation.ts (was circular)
// Imported here for internal use AND re-exported for backward compatibility.
import { normalizeName } from "../utils/foodNames";
export { normalizeName };

function clampRange(
  mean: number,
  min: number,
  max: number,
  assumptions: string[]
): WeightRange {
  const safeMin = Math.max(0, Math.min(min, mean, max));
  const safeMax = Math.max(mean, min, max);
  const safeMean = Math.min(Math.max(mean, safeMin), safeMax);
  return {
    mean: safeMean,
    min: safeMin,
    max: safeMax,
    usedFallback: false,
    assumptions,
  };
}

function resolveWeight(item: ParsedComponent): WeightRange {
  const mean = item.weight_g_mean;
  const min = item.weight_g_min;
  const max = item.weight_g_max;

  if (typeof mean === "number" && typeof min === "number" && typeof max === "number") {
    return clampRange(mean, min, max, []);
  }

  if (typeof mean === "number" && typeof min === "number") {
    return clampRange(mean, min, Math.max(mean * 1.3, min * 1.3), [
      "диапазон построен по умолчанию",
    ]);
  }

  if (typeof mean === "number" && typeof max === "number") {
    return clampRange(
      mean,
      Math.max(0, Math.min(mean * 0.7, max * 0.7)),
      max,
      ["диапазон построен по умолчанию"]
    );
  }

  if (typeof min === "number" && typeof max === "number") {
    return clampRange((min + max) / 2, min, max, [
      "среднее вычислено",
    ]);
  }

  if (typeof mean === "number") {
    return clampRange(
      mean,
      Math.max(0, mean * 0.7),
      Math.max(mean * 1.3, mean + 10),
      ["диапазон построен по умолчанию"]
    );
  }

  if (typeof min === "number") {
    return clampRange(min * 1.2, min, Math.max(min * 1.5, min + 20), [
      "среднее вычислено",
      "диапазон построен по умолчанию",
    ]);
  }

  if (typeof max === "number") {
    return clampRange(max * 0.8, Math.max(0, max * 0.6), max, [
      "среднее вычислено",
      "диапазон построен по умолчанию",
    ]);
  }

  return {
    mean: 100,
    min: 50,
    max: 200,
    usedFallback: true,
    assumptions: ["вес не указан, диапазон по умолчанию"],
  };
}

export type NutrientRanges = {
  protein?: { min: number; max: number };
  fat?: { min: number; max: number };
  carbs?: { min: number; max: number };
};

/** Модифицированный Atwater: fiber ~2 kcal/g вместо 4 */
function calcKcal(
  protein: number,
  fat: number,
  carbs: number,
  fiber?: number
): number {
  const f = fiber ?? 0;
  return protein * 4 + fat * 9 + (carbs - f) * 4 + f * 2;
}

function calcTotalsFromComponent(
  reference: ResolvedComponent["reference"],
  weight: WeightRange
) {
  const factorMean = weight.mean / 100;
  const factorMin = weight.min / 100;
  const factorMax = weight.max / 100;

  const ranges = reference.nutrientRanges as NutrientRanges | null | undefined;
  const pMean = reference.proteinPer100g;
  const fMean = reference.fatPer100g;
  const cMean = reference.carbsPer100g;
  const pMin = ranges?.protein?.min ?? pMean;
  const pMax = ranges?.protein?.max ?? pMean;
  const fMin = ranges?.fat?.min ?? fMean;
  const fMax = ranges?.fat?.max ?? fMean;
  const cMin = ranges?.carbs?.min ?? cMean;
  const cMax = ranges?.carbs?.max ?? cMean;

  const protein = pMean * factorMean;
  const fat = fMean * factorMean;
  const carbs = cMean * factorMean;

  const proteinMin = pMin * factorMin;
  const fatMin = fMin * factorMin;
  const carbsMin = cMin * factorMin;

  const proteinMax = pMax * factorMax;
  const fatMax = fMax * factorMax;
  const carbsMax = cMax * factorMax;

  return {
    protein,
    fat,
    carbs,
    proteinMin,
    fatMin,
    carbsMin,
    proteinMax,
    fatMax,
    carbsMax,
  };
}

export function buildComponentMacros(
  resolved: ResolvedComponent[]
): ComponentMacros[] {
  return resolved.map((entry) => {
    const totals = calcTotalsFromComponent(entry.reference, entry.weight);
    const fiber = entry.reference.fiberPer100g != null
      ? entry.reference.fiberPer100g * (entry.weight.mean / 100)
      : undefined;
    const kcalPer100g =
      entry.kcalPer100gOverride ??
      calcKcal(
        entry.reference.proteinPer100g,
        entry.reference.fatPer100g,
        entry.reference.carbsPer100g,
        entry.reference.fiberPer100g ?? undefined,
      );
    const factor = entry.weight.mean / 100;
    return {
      label: entry.component.display_label,
      kcal: kcalPer100g * factor,
      protein: totals.protein,
      fat: totals.fat,
      carbs: totals.carbs,
    };
  });
}

/** Per-component values for edit UI: weight (total g), per100g for kcal/Б/Ж/У; totals are derived */
export type ComponentEditTotals = {
  label: string;
  weight: number;
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
};

export function getComponentEditTotals(resolved: ResolvedComponent[]): ComponentEditTotals[] {
  return resolved.map((entry) => {
    const kcalPer100g =
      entry.kcalPer100gOverride ??
      calcKcal(
        entry.reference.proteinPer100g,
        entry.reference.fatPer100g,
        entry.reference.carbsPer100g,
        entry.reference.fiberPer100g ?? undefined,
      );
    return {
      label: entry.component.display_label,
      weight: Math.round(entry.weight.mean),
      kcalPer100g: Math.round(kcalPer100g),
      proteinPer100g: Math.round(entry.reference.proteinPer100g),
      fatPer100g: Math.round(entry.reference.fatPer100g),
      carbsPer100g: Math.round(entry.reference.carbsPer100g),
    };
  });
}

function emptyTotals(): MacroTotals {
  return {
    kcal: 0,
    kcalMin: 0,
    kcalMax: 0,
    protein: 0,
    proteinMin: 0,
    proteinMax: 0,
    fat: 0,
    fatMin: 0,
    fatMax: 0,
    carbs: 0,
    carbsMin: 0,
    carbsMax: 0,
  };
}

function sumTotals(a: MacroTotals, b: MacroTotals): MacroTotals {
  return {
    kcal: a.kcal + b.kcal,
    kcalMin: a.kcalMin + b.kcalMin,
    kcalMax: a.kcalMax + b.kcalMax,
    protein: a.protein + b.protein,
    proteinMin: a.proteinMin + b.proteinMin,
    proteinMax: a.proteinMax + b.proteinMax,
    fat: a.fat + b.fat,
    fatMin: a.fatMin + b.fatMin,
    fatMax: a.fatMax + b.fatMax,
    carbs: a.carbs + b.carbs,
    carbsMin: a.carbsMin + b.carbsMin,
    carbsMax: a.carbsMax + b.carbsMax,
  };
}

export async function estimateFromParse(parse: ParseResult): Promise<{
  estimate: EstimateResult;
  resolved: ResolvedComponent[];
  missingReferences: string[];
}> {
  return estimateFromParseWithOverrides(parse);
}

export async function estimateFromParseWithOverrides(
  parse: ParseResult,
  overrides: Record<string, UserOverride> = {}
): Promise<{
  estimate: EstimateResult;
  resolved: ResolvedComponent[];
  missingReferences: string[];
}> {
  await foodResolver.ensureLoaded();

  const fallbackReference = foodResolver.getFallback();
  if (!fallbackReference) {
    throw new Error("Missing fallback food reference: unknown_generic");
  }

  const resolved: ResolvedComponent[] = [];
  const missingReferences: string[] = [];

  const overrideKeys = Object.keys(overrides);
  const globalOverride = overrides[""] ?? null;
  const namedOverrideKeys = overrideKeys.filter((k) => k !== "");

  function stemMatch(a: string, b: string): boolean {
    if (a === b) return true;
    if (a.length < 3 || b.length < 3) return false;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    if (longer.startsWith(shorter)) return true;
    const stemLen = Math.min(a.length, b.length) - 1;
    if (stemLen >= 3 && a.substring(0, stemLen) === b.substring(0, stemLen))
      return true;
    return false;
  }

  function findOverride(
    canonicalName: string,
    displayLabel: string
  ): UserOverride | null {
    const keyCanonical = normalizeName(canonicalName);
    const keyLabel = normalizeName(displayLabel);
    const direct = overrides[keyCanonical] ?? overrides[keyLabel] ?? null;
    if (direct) return direct;

    const itemTokens = Array.from(
      new Set(
        `${keyCanonical} ${keyLabel}`
          .split("_")
          .filter((t) => t.length >= 3),
      ),
    );
    if (itemTokens.length > 0) {
      for (const oKey of namedOverrideKeys) {
        const oTokens = oKey.split("_").filter((t) => t.length >= 3);
        if (oTokens.length === 0) continue;
        const matches = oTokens.filter((ot) =>
          itemTokens.some((it) => stemMatch(it, ot)),
        );
        if (matches.length > 0 && matches.length / oTokens.length >= 0.5) {
          return overrides[oKey];
        }
      }
    }

    if (parse.items.length === 1) {
      if (namedOverrideKeys.length === 1) return overrides[namedOverrideKeys[0]];
      if (globalOverride) return globalOverride;
    }
    return null;
  }

  for (const item of parse.items) {
    const canonicalName =
      item.canonical_name?.trim() || item.display_label?.trim() || "unknown";
    const displayLabel =
      item.display_label?.trim() || item.canonical_name?.trim() || "неизвестно";
    const barcode = item.barcode?.trim() || null;

    let reference: Awaited<ReturnType<typeof foodResolver.resolve>>["reference"] | undefined;
    if (barcode) {
      const barcodeRef = await foodResolver.resolveByBarcode(barcode);
      if (barcodeRef) reference = barcodeRef;
    }
    if (!reference) {
      const resolveResult = await foodResolver.resolve(canonicalName, displayLabel, { skipOnline: true });
      reference = resolveResult.matchType !== "fallback" ? resolveResult.reference : undefined;
    }
    const usedFallbackReference = !reference;

    if (!reference) {
      missingReferences.push(displayLabel);
    }

    const mapOverride = findOverride(canonicalName, displayLabel);

    const llmOverride: UserOverride | null =
      (item.user_kcal_per_100g != null ||
        item.user_protein_per_100g != null ||
        item.user_fat_per_100g != null ||
        item.user_carbs_per_100g != null)
        ? {
            source: "user",
            kcalPer100g: item.user_kcal_per_100g ?? undefined,
            proteinPer100g: item.user_protein_per_100g ?? undefined,
            fatPer100g: item.user_fat_per_100g ?? undefined,
            carbsPer100g: item.user_carbs_per_100g ?? undefined,
          }
        : null;

    const override: UserOverride | null = mapOverride || llmOverride
      ? {
          ...llmOverride,
          ...mapOverride,
        }
      : null;

    const weight = resolveWeight({
      ...item,
      weight_g_mean: override?.weight_g_mean ?? item.weight_g_mean,
      weight_g_min: override?.weight_g_min ?? item.weight_g_min,
      weight_g_max: override?.weight_g_max ?? item.weight_g_max,
    });
    const referenceBase = reference ?? fallbackReference;

    const effectiveKcal = override?.kcalPer100g;
    const hasExplicitMacros = Boolean(
      override?.proteinPer100g != null ||
        override?.fatPer100g != null ||
        override?.carbsPer100g != null
    );

    let proteinPer100g: number;
    let fatPer100g: number;
    let carbsPer100g: number;

    if (hasExplicitMacros) {
      proteinPer100g = override?.proteinPer100g ?? referenceBase.proteinPer100g;
      fatPer100g = override?.fatPer100g ?? referenceBase.fatPer100g;
      carbsPer100g = override?.carbsPer100g ?? referenceBase.carbsPer100g;
    } else if (effectiveKcal != null) {
      const refKcal = calcKcal(
        referenceBase.proteinPer100g,
        referenceBase.fatPer100g,
        referenceBase.carbsPer100g,
        (referenceBase as { fiberPer100g?: number }).fiberPer100g,
      );
      if (refKcal > 0) {
        const scale = effectiveKcal / refKcal;
        proteinPer100g = referenceBase.proteinPer100g * scale;
        fatPer100g = referenceBase.fatPer100g * scale;
        carbsPer100g = referenceBase.carbsPer100g * scale;
      } else {
        proteinPer100g = 0;
        fatPer100g = 0;
        carbsPer100g = effectiveKcal / 4;
      }
    } else {
      proteinPer100g = referenceBase.proteinPer100g;
      fatPer100g = referenceBase.fatPer100g;
      carbsPer100g = referenceBase.carbsPer100g;
    }

    const usesMacroOverride = Boolean(
      override?.kcalPer100g ??
        override?.proteinPer100g ??
        override?.fatPer100g ??
        override?.carbsPer100g
    );
    const overrideSource = override?.source ?? "user";
    const refWithMeta = referenceBase as (typeof referenceBase) & {
      fiberPer100g?: number;
      nutrientRanges?: NutrientRanges;
    };
    resolved.push({
      component: {
        ...item,
        canonical_name: canonicalName,
        display_label: displayLabel,
      },
      weight,
      reference: {
        id: referenceBase.id,
        canonicalName: referenceBase.canonicalName,
        displayLabel: referenceBase.displayLabel,
        proteinPer100g,
        fatPer100g,
        carbsPer100g,
        fiberPer100g: refWithMeta.fiberPer100g ?? undefined,
        nutrientRanges: usesMacroOverride ? undefined : refWithMeta.nutrientRanges ?? undefined,
        source: {
          name: referenceBase.source.name,
          url: referenceBase.source.url,
        },
      },
      usedFallbackReference,
      kcalPer100gOverride: override?.kcalPer100g,
      sourceLabel: usesMacroOverride ? overrideSource : "reference",
    });
  }

  const totals = resolved.reduce((acc, entry) => {
    const componentTotals = calcTotalsFromComponent(entry.reference, entry.weight);
    const kcalPer100g =
      entry.kcalPer100gOverride ??
      calcKcal(
        entry.reference.proteinPer100g,
        entry.reference.fatPer100g,
        entry.reference.carbsPer100g,
        entry.reference.fiberPer100g
      );
    const factorMean = entry.weight.mean / 100;
    const factorMin = entry.weight.min / 100;
    const factorMax = entry.weight.max / 100;
    const kcal = kcalPer100g * factorMean;
    const kcalMin = kcalPer100g * factorMin;
    const kcalMax = kcalPer100g * factorMax;

    return sumTotals(acc, {
      kcal,
      kcalMin,
      kcalMax,
      protein: componentTotals.protein,
      proteinMin: componentTotals.proteinMin,
      proteinMax: componentTotals.proteinMax,
      fat: componentTotals.fat,
      fatMin: componentTotals.fatMin,
      fatMax: componentTotals.fatMax,
      carbs: componentTotals.carbs,
      carbsMin: componentTotals.carbsMin,
      carbsMax: componentTotals.carbsMax,
    });
  }, emptyTotals());

  const clamp = (v: number) => Math.max(0, v);
  const estimate: EstimateResult = {
    kcal: clamp(totals.kcal),
    kcal_min: clamp(totals.kcalMin),
    kcal_max: clamp(totals.kcalMax),
    protein: clamp(totals.protein),
    protein_min: clamp(totals.proteinMin),
    protein_max: clamp(totals.proteinMax),
    fat: clamp(totals.fat),
    fat_min: clamp(totals.fatMin),
    fat_max: clamp(totals.fatMax),
    carbs: clamp(totals.carbs),
    carbs_min: clamp(totals.carbsMin),
    carbs_max: clamp(totals.carbsMax),
    uncertainty_band: Math.max(
      0,
      (clamp(totals.kcalMax) - clamp(totals.kcalMin)) / 2,
    ),
  };

  return { estimate, resolved, missingReferences };
}
