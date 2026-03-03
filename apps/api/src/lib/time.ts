export function getStartOfWeekMonday(date: Date): Date {
  const start = new Date(date);
  const dayFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayFromMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function toLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calculateStreakFromDates(dates: Date[], now: Date = new Date()): number {
  if (dates.length === 0) return 0;

  const insightDates = new Set(dates.map(toLocalDayKey));
  const currentDate = new Date(now);
  currentDate.setHours(0, 0, 0, 0);
  let streak = 0;

  if (!insightDates.has(toLocalDayKey(currentDate))) {
    currentDate.setDate(currentDate.getDate() - 1);
  }

  while (insightDates.has(toLocalDayKey(currentDate))) {
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
}
