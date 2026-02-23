/**
 * Food name normalization utilities.
 * Extracted into a separate module to avoid circular dependencies:
 *   estimation.ts → foodResolver.ts → openFoodFacts.ts → estimation.ts (was circular)
 * All three now import from here instead.
 */

const PREPARATION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /жарен[а-яё]*/gu, label: "жареный" },
  { pattern: /вар[её]н[а-яё]*/gu, label: "варёный" },
  { pattern: /отварн[а-яё]*/gu, label: "варёный" },
  { pattern: /туш[её]н[а-яё]*/gu, label: "тушёный" },
  { pattern: /запеч[её]н[а-яё]*/gu, label: "запечённый" },
  { pattern: /сыр[а-яё]*/gu, label: "сырой" },
];

const NOISE_WORDS = [
  "кусочки",
  "кусок",
  "дольки",
  "ломтики",
  "кольца",
  "посыпка",
  "листья",
  "листовой",
  "гарнир",
  "соус",
  "смесь",
  "салат",
  "зелень",
];

function normalizePreparation(text: string): string {
  let normalized = text;
  for (const entry of PREPARATION_PATTERNS) {
    normalized = normalized.replace(entry.pattern, entry.label);
  }
  return normalized;
}

function extractPreparationTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const entry of PREPARATION_PATTERNS) {
    if (entry.pattern.test(text)) {
      tokens.push(entry.label);
    }
    entry.pattern.lastIndex = 0;
  }
  return tokens;
}

export function normalizeName(value: string): string {
  const lower = value.trim().toLowerCase();
  const prepTokens = extractPreparationTokens(lower);
  let cleaned = normalizePreparation(lower).replace(/\([^)]*\)/g, " ");
  if (prepTokens.length > 0) {
    cleaned = `${cleaned} ${prepTokens.join(" ")}`;
  }
  const noiseRegex = new RegExp(`\\b(?:${NOISE_WORDS.join("|")})\\b`, "gu");
  cleaned = cleaned.replace(noiseRegex, " ");
  return cleaned
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]/gu, "");
}
