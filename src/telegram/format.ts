import {
  getDayTotals,
  getDayMeals,
  getAverageStats,
  getMonthlyStats,
  getPreviousDaysTotals,
  type MealEntry,
} from "../domain/daySummary";
import { ResolvedComponent } from "../domain/estimation";
import { ParseResult } from "../llm/contracts";
import { toDayKey, toDayKeyForUser } from "../utils/time";

/* ────────── ±% display helpers ────────── */

const MAX_DISPLAY_PCT = 50;

function pctSpread(mean: number, min: number, max: number): number {
  if (mean === 0) return 0;
  const spread = (max - min) / 2;
  return Math.min(Math.round((spread / Math.abs(mean)) * 100), MAX_DISPLAY_PCT);
}

function clampNonNegative(v: number): number {
  return Math.max(0, v);
}

function formatValuePct(
  value: number,
  min: number,
  max: number,
  unit: string,
): string {
  const safe = clampNonNegative(value);
  const rounded = Math.round(safe);
  if (rounded === 0) return `0 ${unit}`;
  const pct = pctSpread(safe, clampNonNegative(min), clampNonNegative(max));
  if (pct <= 0) return `${rounded} ${unit}`;
  return `${rounded} ${unit} ±${pct}%`;
}

function fmtPct(mean: number, min: number, max: number): string {
  const safe = clampNonNegative(mean);
  const rounded = Math.round(safe);
  if (rounded === 0) return "0";
  const pct = pctSpread(safe, clampNonNegative(min), clampNonNegative(max));
  if (pct <= 0) return String(rounded);
  return `${rounded} ±${pct}%`;
}

/* ─────────────────────────────────────── */

export async function formatConfirmSummary(
  userId: number,
  date: Date,
  title: string | null,
  canSeeStats = true,
): Promise<string> {
  const titleLine = title?.trim() ? `«${title.trim()}»` : null;

  if (!canSeeStats) {
    return ["Принято.", titleLine].filter(Boolean).join("\n");
  }

  const dayKey = toDayKey(date);
  const totals = await getDayTotals(userId, dayKey);

  return [
    "Принято.",
    "",
    "Сегодня:",
    `≈ ${formatValuePct(totals.kcal, totals.kcalMin, totals.kcalMax, "ккал")}`,
    `Б: ${formatValuePct(totals.protein, totals.proteinMin, totals.proteinMax, "г")} · Ж: ${formatValuePct(totals.fat, totals.fatMin, totals.fatMax, "г")} · У: ${formatValuePct(totals.carbs, totals.carbsMin, totals.carbsMax, "г")}`,
    titleLine,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function formatHistorySummary(
  userId: number,
  date: Date,
  title: string,
  timezone?: string,
): Promise<{ text: string; meals: MealEntry[] }> {
  const dayKey = timezone ? toDayKeyForUser(date, timezone) : toDayKey(date);
  const totals = await getDayTotals(userId, dayKey);
  const meals = await getDayMeals(userId, dayKey);

  if (meals.length === 0) {
    return { text: `${title}: нет данных.`, meals: [] };
  }

  const lines: string[] = [
    `${title}:`,
    `≈ ${formatValuePct(totals.kcal, totals.kcalMin, totals.kcalMax, "ккал")}`,
    `Б: ${formatValuePct(totals.protein, totals.proteinMin, totals.proteinMax, "г")} · Ж: ${formatValuePct(totals.fat, totals.fatMin, totals.fatMax, "г")} · У: ${formatValuePct(totals.carbs, totals.carbsMin, totals.carbsMax, "г")}`,
    "Приемы:",
    ...meals.map(
      (meal) => `- ${formatMealLabel(meal.title, meal.text, meal.components)}`,
    ),
  ];

  return { text: lines.join("\n"), meals };
}

/** Build inline keyboard for deleting meals. One button per meal row. */
export function buildMealDeleteButtons(
  meals: MealEntry[],
): { text: string; callback_data: string }[][] {
  return meals.map((meal) => {
    const label = shorten(formatMealLabel(meal.title, meal.text, meal.components), 30);
    const kcal = Math.round(meal.kcalMean);
    return [
      {
        text: `✕ ${label} (${kcal} ккал)`,
        callback_data: `del:${meal.id}`,
      },
    ];
  });
}

const RUSSIAN_MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function getRussianMonthName(date: Date, timezone?: string): string {
  try {
    if (timezone) {
      const monthNum = parseInt(
        new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "numeric" }).format(date),
        10,
      );
      return RUSSIAN_MONTHS[monthNum - 1] ?? RUSSIAN_MONTHS[date.getUTCMonth()];
    }
  } catch {
    // fall through
  }
  return RUSSIAN_MONTHS[date.getUTCMonth()] ?? "Месяц";
}

const NBSP = "\u00A0";

/** DD.MM.YYYY in user timezone */
function formatDateDDMMYYYY(date: Date, timezone?: string): string {
  try {
    if (timezone) {
      return new Intl.DateTimeFormat("ru-RU", {
        timeZone: timezone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
    }
  } catch {
    // fall through
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatKcalAndMacros(kcal: number, protein: number, fat: number, carbs: number): string {
  const k = Math.round(kcal);
  const p = Math.round(protein);
  const f = Math.round(fat);
  const c = Math.round(carbs);
  return `КК ${k} Б ${p} · Ж ${f} · У ${c}`;
}

const MONTH_LABEL_WIDTH = 10; // "сентябрь" + margin for alignment

function monthKeyToShortLabel(monthKey: string): string {
  const [, m] = monthKey.split("-").map(Number);
  const name = RUSSIAN_MONTHS[m - 1] ?? "месяц";
  return name.toLowerCase();
}

function padMonthLabel(label: string): string {
  const nbspPad = MONTH_LABEL_WIDTH - label.length;
  return nbspPad > 0 ? label + NBSP.repeat(nbspPad) : label;
}

export async function formatStatsSummary(
  userId: number,
  date: Date,
  timezone?: string,
): Promise<string> {
  const tz = timezone ?? "UTC";
  const [avgStats, monthly, previousDays] = await Promise.all([
    getAverageStats(userId, date, tz),
    getMonthlyStats(userId, date, tz),
    getPreviousDaysTotals(userId, date, tz, 30),
  ]);

  const hasAny =
    avgStats.week ||
    avgStats.allTime ||
    monthly.length > 0 ||
    previousDays.some((d) => d.totals !== null);
  if (!hasAny) {
    return "Статистика: нет данных.";
  }

  const lines: string[] = ["Средний день:"];

  if (avgStats.week) {
    const w = avgStats.week;
    const a = w.average;
    lines.push(`неделя: ${formatKcalAndMacros(a.kcal, a.protein, a.fat, a.carbs)}`);
  }

  if (monthly.length > 0) {
    let lastYear = "";
    for (const { monthKey, period } of monthly) {
      const year = monthKey.slice(0, 4);
      if (year !== lastYear) {
        lines.push(year);
        lastYear = year;
      }
      const label = monthKeyToShortLabel(monthKey);
      const padded = padMonthLabel(label);
      const a = period.average;
      lines.push(`${padded} ${formatKcalAndMacros(a.kcal, a.protein, a.fat, a.carbs)}`);
    }
  }

  if (avgStats.allTime) {
    const w = avgStats.allTime;
    const a = w.average;
    lines.push(`Всё время ${formatKcalAndMacros(a.kcal, a.protein, a.fat, a.carbs)}`);
  }

  if (previousDays.length > 0) {
    lines.push("", "По дням:");
    for (const { date: dayDate, totals } of previousDays) {
      const dateStr = formatDateDDMMYYYY(dayDate, tz);
      if (!totals || totals.kcal <= 0) {
        lines.push(`${dateStr}: нет данных`);
        continue;
      }
      lines.push(`${dateStr} ${formatKcalAndMacros(totals.kcal, totals.protein, totals.fat, totals.carbs)}`);
    }
  }

  return lines.join("\n");
}

function formatWeightRange(
  mean: number | null,
  min: number | null,
  max: number | null,
): string {
  if (
    typeof mean !== "number" ||
    typeof min !== "number" ||
    typeof max !== "number"
  ) {
    return "100 г ±50%";
  }
  return formatValuePct(mean, min, max, "г");
}

function overallConfidenceLabel(value: number): string {
  if (value < 0.35) return "низкая";
  if (value < 0.7) return "средняя";
  return "высокая";
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function formatMealLabel(
  title: string | null,
  text: string | null,
  components: { displayLabel: string }[],
): string {
  const titleTrimmed = title?.trim();
  if (titleTrimmed) return shorten(titleTrimmed, 80);

  const names = components.map((item) => item.displayLabel).filter(Boolean);
  if (names.length > 0) {
    return shorten(names.join(", "), 80);
  }

  const trimmed = text?.trim();
  if (trimmed) return shorten(trimmed, 80);

  return "без описания";
}

export function formatParseSummary(parse: ParseResult): string {
  const lines: string[] = ["Найдено:"];
  if (parse.items.length === 0) {
    lines.push("ничего");
  } else {
    for (const item of parse.items) {
      lines.push(
        `${item.display_label} — ${formatWeightRange(
          item.weight_g_mean,
          item.weight_g_min,
          item.weight_g_max,
        )}`,
      );
    }
  }

  return lines.join("\n");
}

export function formatEstimate(
  estimate: {
    kcal: number;
    kcal_min: number;
    kcal_max: number;
    protein: number;
    protein_min: number;
    protein_max: number;
    fat: number;
    fat_min: number;
    fat_max: number;
    carbs: number;
    carbs_min: number;
    carbs_max: number;
  },
): string {
  const lines: string[] = [
    "Оценка:",
    `≈ ${formatValuePct(estimate.kcal, estimate.kcal_min, estimate.kcal_max, "ккал")}`,
    `Б: ${formatValuePct(estimate.protein, estimate.protein_min, estimate.protein_max, "г")}`,
    `Ж: ${formatValuePct(estimate.fat, estimate.fat_min, estimate.fat_max, "г")}`,
    `У: ${formatValuePct(estimate.carbs, estimate.carbs_min, estimate.carbs_max, "г")}`,
  ];
  return lines.join("\n");
}

/** Estimate + component list for edit UI. parse must have overrides already applied. */
export function formatEstimateWithEditComponents(
  estimate: {
    kcal: number;
    kcal_min: number;
    kcal_max: number;
    protein: number;
    protein_min: number;
    protein_max: number;
    fat: number;
    fat_min: number;
    fat_max: number;
    carbs: number;
    carbs_min: number;
    carbs_max: number;
  },
  parseWithOverrides: { items: Array<{ display_label: string; weight_g_mean: number | null; weight_g_min: number | null; weight_g_max: number | null }> },
): string {
  const estimateLines = formatEstimate(estimate);
  const componentLines = parseWithOverrides.items.map((item) => {
    const w = formatWeightRange(item.weight_g_mean, item.weight_g_min, item.weight_g_max);
    return `${item.display_label} — ${w}`;
  });
  const parts = [estimateLines];
  if (componentLines.length > 0) {
    parts.push("", ...componentLines);
  }
  return parts.join("\n");
}

const EDIT_WEIGHT_MIN_G = 10;
const EDIT_WEIGHT_MAX_G = 2000;
const MAX_EDIT_COMPONENTS = 15;

type ComponentForList = { display_label: string; weight_g_mean: number | null };

/** Main screen: product list (tap to open edit) + actions */
export function buildProductListKeyboard(
  items: ComponentForList[],
): { text: string; callback_data: string }[][] {
  const rows: { text: string; callback_data: string }[][] = [];
  const limited = items.slice(0, MAX_EDIT_COMPONENTS);
  for (let i = 0; i < limited.length; i++) {
    const w = limited[i].weight_g_mean ?? 100;
    rows.push([{ text: `${limited[i].display_label} — ${Math.round(w)} г`, callback_data: `edit:open:${i}` }]);
  }
  rows.push(
    [{ text: "Подтвердить", callback_data: "e:ok" }, { text: "Отмена", callback_data: "e:cancel" }],
    [
      { text: "Почему так?", callback_data: "e:why" },
      { text: "Найдено", callback_data: "e:found" },
      { text: "Уточнения", callback_data: "e:clarify" },
    ],
  );
  return rows;
}

/** Message text for product edit submenu. per100g are editable; totals derived. */
export function formatProductEditScreen(
  comp: {
    label: string;
    weight: number;
    kcalPer100g: number;
    proteinPer100g: number;
    fatPer100g: number;
    carbsPer100g: number;
  },
  estimate: { kcal: number; protein: number; fat: number; carbs: number },
): string {
  const factor = comp.weight / 100;
  const totalKcal = Math.round(comp.kcalPer100g * factor);
  const totalProtein = Math.round(comp.proteinPer100g * factor);
  const totalFat = Math.round(comp.fatPer100g * factor);
  const totalCarbs = Math.round(comp.carbsPer100g * factor);
  return [
    `Редактирование: ${comp.label}`,
    "",
    `⚖️ ${comp.weight} г`,
    "",
    "На 100 г:",
    `Ккал ${comp.kcalPer100g} · Б ${comp.proteinPer100g} · Ж ${comp.fatPer100g} · У ${comp.carbsPer100g}`,
    "",
    "Общее:",
    `Ккал ${totalKcal} · Б ${totalProtein} · Ж ${totalFat} · У ${totalCarbs}`,
  ].join("\n");
}

/** Submenu: first row = total weight; остальные = на 100 г */
export function buildProductEditKeyboard(
  itemIdx: number,
  comp: {
    label: string;
    weight: number;
    kcalPer100g: number;
    proteinPer100g: number;
    fatPer100g: number;
    carbsPer100g: number;
  },
): { text: string; callback_data: string }[][] {
  const rows: { text: string; callback_data: string }[][] = [];
  rows.push([{ text: `← ${comp.label}`, callback_data: "edit:back" }]);
  rows.push([
    { text: "−10г", callback_data: `edit:${itemIdx}:w:-10` },
    { text: "−1г", callback_data: `edit:${itemIdx}:w:-1` },
    { text: `${comp.weight} г`, callback_data: `edit:${itemIdx}:nop` },
    { text: "+1г", callback_data: `edit:${itemIdx}:w:1` },
    { text: "+10г", callback_data: `edit:${itemIdx}:w:10` },
  ]);
  rows.push([{ text: "· · ·", callback_data: `edit:${itemIdx}:nop` }]);
  rows.push([
    { text: "−10", callback_data: `edit:${itemIdx}:k:-10` },
    { text: "−1", callback_data: `edit:${itemIdx}:k:-1` },
    { text: `${comp.kcalPer100g} ккал/100г`, callback_data: `edit:${itemIdx}:nop` },
    { text: "+1", callback_data: `edit:${itemIdx}:k:1` },
    { text: "+10", callback_data: `edit:${itemIdx}:k:10` },
  ]);
  const macros = [["Б", "p"] as const, ["Ж", "f"] as const, ["У", "c"] as const];
  for (const [label, letter] of macros) {
    const val = letter === "p" ? comp.proteinPer100g : letter === "f" ? comp.fatPer100g : comp.carbsPer100g;
    rows.push([
      { text: "−10", callback_data: `edit:${itemIdx}:${letter}:-10` },
      { text: "−1", callback_data: `edit:${itemIdx}:${letter}:-1` },
      { text: `${val} ${label}/100г`, callback_data: `edit:${itemIdx}:nop` },
      { text: "+1", callback_data: `edit:${itemIdx}:${letter}:1` },
      { text: "+10", callback_data: `edit:${itemIdx}:${letter}:10` },
    ]);
  }
  return rows;
}

export { EDIT_WEIGHT_MIN_G, EDIT_WEIGHT_MAX_G };

export function formatUncertaintyNote(params: {
  parse: ParseResult;
  missingReferences: string[];
}): string | null {
  const { parse, missingReferences } = params;
  const lines: string[] = [];
  if (parse.overall_confidence < 0.7) {
    lines.push(`Точность: ${overallConfidenceLabel(parse.overall_confidence)}`);
  }
  if (parse.notes) {
    const normalized = parse.notes.replace(
      /уточнение может потребоваться/gi,
      "возможны уточнения",
    );
    lines.push(shorten(normalized.trim(), 140));
  }
  if (missingReferences.length > 0) {
    lines.push(`Уточни: ${missingReferences.join(", ")}. И примерно сколько?`);
  } else if (parse.overall_confidence < 0.35) {
    lines.push("Уточни состав и примерный вес.");
  }
  if (lines.length === 0) return null;
  return lines.join("\n");
}

export function formatExplainEstimate(resolved: ResolvedComponent[]): string {
  if (resolved.length === 0) {
    return "Почему так:\nнет данных.";
  }

  const lines: string[] = ["Почему так:\n"];
  for (const entry of resolved) {
    const reasons: string[] = [];
    if (entry.component.confidence_reasons?.length) {
      reasons.push(...entry.component.confidence_reasons);
    }
    if (entry.weight.assumptions.length) {
      reasons.push(...entry.weight.assumptions);
    }
    const kcalPer100 = Math.round(
      entry.kcalPer100gOverride ??
        entry.reference.proteinPer100g * 4 +
          entry.reference.carbsPer100g * 4 +
          entry.reference.fatPer100g * 9,
    );
    const factorMean = entry.weight.mean / 100;
    const factorMin = entry.weight.min / 100;
    const factorMax = entry.weight.max / 100;
    const clamp = (v: number) => Math.max(0, v);
    const proteinMean = clamp(entry.reference.proteinPer100g * factorMean);
    const fatMean = clamp(entry.reference.fatPer100g * factorMean);
    const carbsMean = clamp(entry.reference.carbsPer100g * factorMean);
    const proteinMin = clamp(entry.reference.proteinPer100g * factorMin);
    const fatMin = clamp(entry.reference.fatPer100g * factorMin);
    const carbsMin = clamp(entry.reference.carbsPer100g * factorMin);
    const proteinMax = clamp(entry.reference.proteinPer100g * factorMax);
    const fatMax = clamp(entry.reference.fatPer100g * factorMax);
    const carbsMax = clamp(entry.reference.carbsPer100g * factorMax);
    const kcalMean = clamp(
      (entry.kcalPer100gOverride ?? kcalPer100) * factorMean,
    );
    const kcalMin = clamp(
      (entry.kcalPer100gOverride ?? kcalPer100) * factorMin,
    );
    const kcalMax = clamp(
      (entry.kcalPer100gOverride ?? kcalPer100) * factorMax,
    );
    lines.push(
      `${entry.component.display_label}: ${formatWeightRange(
        entry.weight.mean,
        entry.weight.min,
        entry.weight.max,
      )}`,
      `На 100 г: КК ${kcalPer100} · Б ${Math.round(
        entry.reference.proteinPer100g,
      )} · Ж ${Math.round(entry.reference.fatPer100g)} · У ${Math.round(
        entry.reference.carbsPer100g,
      )}`,
    );
    lines.push(
      `Расчёты на общий вес:\nКК ${fmtPct(kcalMean, kcalMin, kcalMax)} · Б ${fmtPct(proteinMean, proteinMin, proteinMax)} · Ж ${fmtPct(fatMean, fatMin, fatMax)} · У ${fmtPct(carbsMean, carbsMin, carbsMax)}`,
    );
    if (reasons.length > 0) {
      lines.push(`Причины: ${reasons.join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
