/** Day key in UTC (YYYY-MM-DD). Server timezone must be UTC. */
export function toDayKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Day key (YYYY-MM-DD) in the user's IANA timezone.
 * Falls back to UTC if the timezone is invalid or formatting fails.
 *
 * Example: toDayKeyForUser(new Date(), "Europe/Moscow")
 * → returns "2026-02-20" when it's 1am Moscow but still Feb 19 UTC.
 */
export function toDayKeyForUser(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // en-CA locale formats as YYYY-MM-DD directly
    return formatter.format(date);
  } catch {
    return toDayKey(date);
  }
}

export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** End of the given day in UTC (23:59:59.999). Used for subscription "last day inclusive". */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}
