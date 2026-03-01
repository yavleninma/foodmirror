import { db } from "../db";
import { addDays, toDayKey, toDayKeyForUser } from "../utils/time";

type Totals = {
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

export type MealEntry = {
  id: number;
  title: string | null;
  text: string | null;
  kcalMean: number;
  createdAt: Date;
  components: { displayLabel: string }[];
};

function emptyTotals(): Totals {
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

function sumTotals(a: Totals, b: Totals): Totals {
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

export async function getDayTotals(
  userId: number,
  dayKey: string,
): Promise<Totals> {
  const meals = await db.meal.findMany({
    where: { userId, dayKey, deletedAt: null },
  });

  type MealTotalsSource = {
    kcalMean: number;
    kcalMin: number;
    kcalMax: number;
    proteinMean: number;
    proteinMin: number;
    proteinMax: number;
    fatMean: number;
    fatMin: number;
    fatMax: number;
    carbsMean: number;
    carbsMin: number;
    carbsMax: number;
  };

  const typedMeals = meals as MealTotalsSource[];
  return typedMeals.reduce((acc: Totals, meal: MealTotalsSource) => {
    return sumTotals(acc, {
      kcal: meal.kcalMean,
      kcalMin: meal.kcalMin,
      kcalMax: meal.kcalMax,
      protein: meal.proteinMean,
      proteinMin: meal.proteinMin,
      proteinMax: meal.proteinMax,
      fat: meal.fatMean,
      fatMin: meal.fatMin,
      fatMax: meal.fatMax,
      carbs: meal.carbsMean,
      carbsMin: meal.carbsMin,
      carbsMax: meal.carbsMax,
    });
  }, emptyTotals());
}

export async function getDayMeals(
  userId: number,
  dayKey: string,
): Promise<MealEntry[]> {
  return db.meal.findMany({
    where: { userId, dayKey, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      text: true,
      kcalMean: true,
      createdAt: true,
      components: { select: { displayLabel: true } },
    },
  });
}

export type PeriodStats = {
  average: Totals;
  daysWithData: number;
  totalDays: number;
};

export type AverageStats = {
  week: PeriodStats | null;
  month: PeriodStats | null;
  allTime: PeriodStats | null;
};

function averageTotals(sum: Totals, count: number): Totals {
  return {
    kcal: Math.round(sum.kcal / count),
    kcalMin: Math.round(sum.kcalMin / count),
    kcalMax: Math.round(sum.kcalMax / count),
    protein: Math.round(sum.protein / count),
    proteinMin: Math.round(sum.proteinMin / count),
    proteinMax: Math.round(sum.proteinMax / count),
    fat: Math.round(sum.fat / count),
    fatMin: Math.round(sum.fatMin / count),
    fatMax: Math.round(sum.fatMax / count),
    carbs: Math.round(sum.carbs / count),
    carbsMin: Math.round(sum.carbsMin / count),
    carbsMax: Math.round(sum.carbsMax / count),
  };
}

function computePeriod(
  dayTotalsMap: Map<string, Totals>,
  dayKeys: string[],
): PeriodStats | null {
  let sum = emptyTotals();
  let daysWithData = 0;
  for (const key of dayKeys) {
    const t = dayTotalsMap.get(key);
    if (t && t.kcal > 0) {
      sum = sumTotals(sum, t);
      daysWithData += 1;
    }
  }
  if (daysWithData === 0) return null;
  return {
    average: averageTotals(sum, daysWithData),
    daysWithData,
    totalDays: dayKeys.length,
  };
}

export async function getAverageStats(
  userId: number,
  now: Date,
  timezone?: string,
): Promise<AverageStats> {
  // Use user's timezone for day boundaries; fall back to UTC
  const dayKeyFn = timezone
    ? (d: Date) => toDayKeyForUser(d, timezone)
    : toDayKey;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  const firstMeal = await db.meal.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { dayKey: true },
  });

  // "Yesterday" from the user's perspective (exclude today which may be incomplete)
  const yesterday = addDays(now, -1);
  const yesterdayKey = dayKeyFn(yesterday);

  const weekKeys: string[] = [];
  for (let i = 1; i <= 7; i += 1) {
    weekKeys.push(dayKeyFn(addDays(now, -i)));
  }

  // Current calendar month: from the 1st of this month up to (and including) yesterday
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthKeys: string[] = [];
  {
    let cursor = monthStart;
    while (dayKeyFn(cursor) <= yesterdayKey) {
      monthKeys.push(dayKeyFn(cursor));
      cursor = addDays(cursor, 1);
    }
  }

  let allTimeKeys: string[] = [];
  let allTimeStart: Date | null = null;
  if (firstMeal) {
    allTimeStart = new Date(firstMeal.dayKey + "T00:00:00Z");
  } else if (user) {
    allTimeStart = user.createdAt;
  }
  if (allTimeStart) {
    const startKey = toDayKey(allTimeStart);
    let cursor = allTimeStart;
    while (toDayKey(cursor) <= yesterdayKey) {
      allTimeKeys.push(toDayKey(cursor));
      cursor = addDays(cursor, 1);
    }
    if (allTimeKeys.length === 0 && startKey <= yesterdayKey) {
      allTimeKeys.push(startKey);
    }
  }

  const allUniqueKeys = [...new Set([...weekKeys, ...monthKeys, ...allTimeKeys])];

  if (allUniqueKeys.length === 0) {
    return { week: null, month: null, allTime: null };
  }

  const grouped = await db.meal.groupBy({
    by: ["dayKey"],
    where: { userId, dayKey: { in: allUniqueKeys }, deletedAt: null },
    _sum: {
      kcalMean: true, kcalMin: true, kcalMax: true,
      proteinMean: true, proteinMin: true, proteinMax: true,
      fatMean: true, fatMin: true, fatMax: true,
      carbsMean: true, carbsMin: true, carbsMax: true,
    },
  });

  const dayTotalsMap = new Map<string, Totals>();
  for (const row of grouped) {
    const s = row._sum;
    dayTotalsMap.set(row.dayKey, {
      kcal: s.kcalMean ?? 0,
      kcalMin: s.kcalMin ?? 0,
      kcalMax: s.kcalMax ?? 0,
      protein: s.proteinMean ?? 0,
      proteinMin: s.proteinMin ?? 0,
      proteinMax: s.proteinMax ?? 0,
      fat: s.fatMean ?? 0,
      fatMin: s.fatMin ?? 0,
      fatMax: s.fatMax ?? 0,
      carbs: s.carbsMean ?? 0,
      carbsMin: s.carbsMin ?? 0,
      carbsMax: s.carbsMax ?? 0,
    });
  }

  const week = computePeriod(dayTotalsMap, weekKeys);
  // Show current-month average whenever there's at least one completed day in the month
  const month = monthKeys.length > 0 ? computePeriod(dayTotalsMap, monthKeys) : null;
  // Show all-time average whenever there's any history
  const allTime = allTimeKeys.length > 0 ? computePeriod(dayTotalsMap, allTimeKeys) : null;

  return { week, month, allTime };
}

export type MonthStats = {
  monthKey: string;
  period: PeriodStats;
};

/** All months that have at least one day with data, from first use up to yesterday (user TZ). Oldest first. */
export async function getMonthlyStats(
  userId: number,
  now: Date,
  timezone?: string,
): Promise<MonthStats[]> {
  const dayKeyFn = timezone
    ? (d: Date) => toDayKeyForUser(d, timezone)
    : toDayKey;
  const yesterday = addDays(now, -1);
  const yesterdayKey = dayKeyFn(yesterday);

  const rows = await db.meal.groupBy({
    by: ["dayKey"],
    where: {
      userId,
      deletedAt: null,
      dayKey: { lte: yesterdayKey },
    },
    _sum: {
      kcalMean: true,
      kcalMin: true,
      kcalMax: true,
      proteinMean: true,
      proteinMin: true,
      proteinMax: true,
      fatMean: true,
      fatMin: true,
      fatMax: true,
      carbsMean: true,
      carbsMin: true,
      carbsMax: true,
    },
  });

  const dayTotalsMap = new Map<string, Totals>();
  for (const row of rows) {
    const s = row._sum;
    dayTotalsMap.set(row.dayKey, {
      kcal: s.kcalMean ?? 0,
      kcalMin: s.kcalMin ?? 0,
      kcalMax: s.kcalMax ?? 0,
      protein: s.proteinMean ?? 0,
      proteinMin: s.proteinMin ?? 0,
      proteinMax: s.proteinMax ?? 0,
      fat: s.fatMean ?? 0,
      fatMin: s.fatMin ?? 0,
      fatMax: s.fatMax ?? 0,
      carbs: s.carbsMean ?? 0,
      carbsMin: s.carbsMin ?? 0,
      carbsMax: s.carbsMax ?? 0,
    });
  }

  const monthKeys = [
    ...new Set(rows.map((r: { dayKey: string }) => r.dayKey.slice(0, 7))),
  ].sort() as string[];
  if (monthKeys.length === 0) return [];

  const result: MonthStats[] = [];
  for (const monthKey of monthKeys) {
    const [y, m] = monthKey.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const dayKeysInMonth: string[] = [];
    for (let d = 1; d <= lastDay; d += 1) {
      const dk = `${monthKey}-${String(d).padStart(2, "0")}`;
      if (dk <= yesterdayKey) dayKeysInMonth.push(dk);
    }
    const period = computePeriod(dayTotalsMap, dayKeysInMonth);
    if (period && period.daysWithData > 0) {
      result.push({ monthKey, period });
    }
  }
  return result;
}

export type DayTotalsRow = {
  date: Date;
  dayKey: string;
  totals: Totals | null;
};

/** Last N days (excluding today), most recent first. date is that calendar day in user TZ for display. */
export async function getPreviousDaysTotals(
  userId: number,
  now: Date,
  timezone: string,
  limit: number,
): Promise<DayTotalsRow[]> {
  const dayKeyFn = (d: Date) => toDayKeyForUser(d, timezone);
  const dayKeys: string[] = [];
  const dates: Date[] = [];
  for (let i = 1; i <= limit; i += 1) {
    const d = addDays(now, -i);
    dayKeys.push(dayKeyFn(d));
    dates.push(d);
  }

  const rows = await db.meal.groupBy({
    by: ["dayKey"],
    where: { userId, dayKey: { in: dayKeys }, deletedAt: null },
    _sum: {
      kcalMean: true,
      kcalMin: true,
      kcalMax: true,
      proteinMean: true,
      proteinMin: true,
      proteinMax: true,
      fatMean: true,
      fatMin: true,
      fatMax: true,
      carbsMean: true,
      carbsMin: true,
      carbsMax: true,
    },
  });

  const map = new Map<string, Totals>();
  for (const row of rows) {
    const s = row._sum;
    map.set(row.dayKey, {
      kcal: s.kcalMean ?? 0,
      kcalMin: s.kcalMin ?? 0,
      kcalMax: s.kcalMax ?? 0,
      protein: s.proteinMean ?? 0,
      proteinMin: s.proteinMin ?? 0,
      proteinMax: s.proteinMax ?? 0,
      fat: s.fatMean ?? 0,
      fatMin: s.fatMin ?? 0,
      fatMax: s.fatMax ?? 0,
      carbs: s.carbsMean ?? 0,
      carbsMin: s.carbsMin ?? 0,
      carbsMax: s.carbsMax ?? 0,
    });
  }

  return dates.map((date) => {
    const dayKey = dayKeyFn(date);
    const totals = map.get(dayKey) ?? null;
    return { date, dayKey, totals };
  });
}
