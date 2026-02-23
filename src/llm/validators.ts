import {
  DraftChatResult,
  DraftReplyResult,
  FoodReferenceResult,
  MealTitleResult,
  ParseResult,
} from "./contracts";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArrayOrNull(value: unknown): value is string[] | null {
  if (value === null) return true;
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function validateParsedItem(item: unknown): boolean {
  if (!isObject(item)) return false;
  if (typeof item.canonical_name !== "string") return false;
  if (typeof item.display_label !== "string") return false;
  if (!isFiniteNumberOrNull(item.weight_g_mean)) return false;
  if (!isFiniteNumberOrNull(item.weight_g_min)) return false;
  if (!isFiniteNumberOrNull(item.weight_g_max)) return false;
  if (
    item.confidence !== "LOW" &&
    item.confidence !== "MEDIUM" &&
    item.confidence !== "HIGH"
  ) {
    return false;
  }
  if (!isStringArrayOrNull(item.confidence_reasons)) return false;
  if (!isStringOrNull(item.barcode ?? null)) return false;
  if (!isFiniteNumberOrNull(item.user_kcal_per_100g ?? null)) return false;
  if (!isFiniteNumberOrNull(item.user_protein_per_100g ?? null)) return false;
  if (!isFiniteNumberOrNull(item.user_fat_per_100g ?? null)) return false;
  if (!isFiniteNumberOrNull(item.user_carbs_per_100g ?? null)) return false;
  return true;
}

export function isParseResult(value: unknown): value is ParseResult {
  if (!isObject(value)) return false;
  if (!Array.isArray(value.items)) return false;
  if (
    !(
      typeof value.overall_confidence === "number" &&
      Number.isFinite(value.overall_confidence)
    )
  ) {
    return false;
  }
  if (!isStringOrNull(value.notes)) return false;
  for (const item of value.items) {
    if (!validateParsedItem(item)) return false;
  }
  return true;
}

export function isDraftReplyResult(value: unknown): value is DraftReplyResult {
  return isObject(value) && isStringOrNull(value.reply);
}

export function isDraftChatResult(value: unknown): value is DraftChatResult {
  if (!isObject(value)) return false;
  if (!isStringOrNull(value.reply)) return false;
  if (!Array.isArray(value.items)) return false;
  if (
    !(
      typeof value.overall_confidence === "number" &&
      Number.isFinite(value.overall_confidence)
    )
  ) {
    return false;
  }
  if (!isStringOrNull(value.notes)) return false;
  for (const item of value.items) {
    if (!validateParsedItem(item)) return false;
  }
  return true;
}

export function isMealTitleResult(value: unknown): value is MealTitleResult {
  return isObject(value) && isStringOrNull(value.title);
}

export function isFoodReferenceResult(
  value: unknown,
): value is FoodReferenceResult {
  if (!isObject(value)) return false;
  if (!Array.isArray(value.items)) return false;
  for (const item of value.items) {
    if (!isObject(item)) return false;
    if (typeof item.name !== "string") return false;
    if (!isFiniteNumberOrNull(item.kcal_per_100g)) return false;
    if (!isFiniteNumberOrNull(item.protein_per_100g)) return false;
    if (!isFiniteNumberOrNull(item.fat_per_100g)) return false;
    if (!isFiniteNumberOrNull(item.carbs_per_100g)) return false;
    if (
      item.confidence !== null &&
      item.confidence !== "LOW" &&
      item.confidence !== "MEDIUM" &&
      item.confidence !== "HIGH"
    ) {
      return false;
    }
    if (!isStringOrNull(item.notes)) return false;
  }
  return true;
}

