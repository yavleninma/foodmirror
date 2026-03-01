import { db } from "../db";
import { config } from "../config";
import { toDayKey, endOfDay, addDays } from "../utils/time";

const TRIAL_DAYS = config.subscription.trialDays;
const MAX_PHOTOS_PER_DAY = config.subscription.maxPhotosPerDay;
const MAX_ESTIMATE_REQUESTS_PER_DAY = config.subscription.maxEstimateRequestsPerDay;

export async function isPremium(userId: number): Promise<boolean> {
  const status = await getPremiumStatus(userId);
  return status !== null;
}

/** True if user can see statistics and use reminders. = isPremium (subscribedUntil or grants). */
export async function hasFullAccess(userId: number): Promise<boolean> {
  return isPremium(userId);
}

/**
 * Выдать подписку на N дней. Используется для триала (первый confirm) и админом.
 * Если уже есть активная подписка (subscribedUntil > now) — продлевает только если newEnd позже.
 */
export async function grantSubscription(
  userId: number,
  days: number,
): Promise<{ granted: boolean; subscribedUntil: Date }> {
  const now = new Date();
  const newEnd = endOfDay(addDays(now, days - 1));

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { subscribedUntil: true },
  });
  const currentEnd = user?.subscribedUntil ?? null;
  const hasActive = currentEnd && currentEnd > now;
  const effectiveEnd = !hasActive ? newEnd : newEnd > currentEnd! ? newEnd : currentEnd;

  await db.user.update({
    where: { id: userId },
    data: { subscribedUntil: effectiveEnd },
  });

  return { granted: !hasActive || effectiveEnd > currentEnd!, subscribedUntil: effectiveEnd };
}

export type PremiumStatus = {
  daysLeft: number;
  until: Date;
  source: "payment" | "grant";
};

/**
 * Effective subscription end = max(user.subscribedUntil, max(grants)).
 * Stored/compared as "last moment of access" (end of last day when applicable).
 */
export async function getEffectiveSubscriptionEnd(
  userId: number,
): Promise<Date | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { subscribedUntil: true },
  });
  const grant = await db.subscriptionGrant.findFirst({
    where: { userId },
    orderBy: { grantedUntil: "desc" },
    select: { grantedUntil: true },
  });
  const candidates: Date[] = [];
  if (user?.subscribedUntil) candidates.push(user.subscribedUntil);
  if (grant?.grantedUntil) candidates.push(grant.grantedUntil);
  if (candidates.length === 0) return null;
  const effective = candidates.reduce((a, b) => (a > b ? a : b));
  const now = new Date();
  return now <= effective ? effective : null;
}

export async function getPremiumStatus(
  userId: number,
): Promise<PremiumStatus | null> {
  const now = new Date();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { subscribedUntil: true },
  });
  const grant = await db.subscriptionGrant.findFirst({
    where: { userId },
    orderBy: { grantedUntil: "desc" },
    select: { grantedUntil: true },
  });
  const fromPayment = user?.subscribedUntil && now <= user.subscribedUntil
    ? user.subscribedUntil
    : null;
  const fromGrant = grant?.grantedUntil && now <= grant.grantedUntil
    ? grant.grantedUntil
    : null;
  const effective = !fromPayment
    ? fromGrant
    : !fromGrant
      ? fromPayment
      : fromPayment >= fromGrant
        ? fromPayment
        : fromGrant;
  if (!effective) return null;
  const daysLeft = Math.ceil(
    (effective.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  );
  const source: "payment" | "grant" =
    fromPayment === effective ? "payment" : "grant";
  return { daysLeft, until: effective, source };
}

/** Anti-abuse: max estimate requests per day for all users. */
export async function canEstimate(userId: number): Promise<boolean> {
  const usage = await getOrCreateFreeUsage(userId);
  return usage.estimateRequestsUsed < MAX_ESTIMATE_REQUESTS_PER_DAY;
}

/** No limit on confirms. Kept for API compatibility. */
export async function canConfirm(_userId: number): Promise<boolean> {
  return true;
}

/** Freemium: no usage limits for core features. Always false. */
export async function isFreeTierExhausted(_userId: number): Promise<boolean> {
  return false;
}

async function getOrCreateFreeUsage(userId: number) {
  const dayKey = toDayKey(new Date());
  return db.freeUsage.upsert({
    where: { userId_dayKey: { userId, dayKey } },
    create: {
      userId,
      dayKey,
      estimatesUsed: 0,
      confirmsUsed: 0,
      photosUsed: 0,
      estimateRequestsUsed: 0,
    },
    update: {},
  });
}

/** Increment estimate-request counter (anti-abuse). Call when user requests an estimate. */
export async function recordEstimate(userId: number): Promise<void> {
  const dayKey = toDayKey(new Date());
  await db.freeUsage.upsert({
    where: { userId_dayKey: { userId, dayKey } },
    create: {
      userId,
      dayKey,
      estimatesUsed: 0,
      confirmsUsed: 0,
      photosUsed: 0,
      estimateRequestsUsed: 1,
    },
    update: { estimateRequestsUsed: { increment: 1 } },
  });
}

/** Alias for recordEstimate. Call when user requests an estimate. */
export async function recordEstimateRequest(userId: number): Promise<void> {
  return recordEstimate(userId);
}

export async function canSendPhoto(userId: number): Promise<boolean> {
  const usage = await getOrCreateFreeUsage(userId);
  return usage.photosUsed < MAX_PHOTOS_PER_DAY;
}

export async function recordPhoto(userId: number): Promise<void> {
  const dayKey = toDayKey(new Date());
  await db.freeUsage.upsert({
    where: { userId_dayKey: { userId, dayKey } },
    create: {
      userId,
      dayKey,
      estimatesUsed: 0,
      confirmsUsed: 0,
      photosUsed: 1,
      estimateRequestsUsed: 0,
    },
    update: { photosUsed: { increment: 1 } },
  });
}

export async function recordConfirm(userId: number): Promise<void> {
  const dayKey = toDayKey(new Date());
  await db.freeUsage.upsert({
    where: { userId_dayKey: { userId, dayKey } },
    create: { userId, dayKey, estimatesUsed: 0, confirmsUsed: 1 },
    update: { confirmsUsed: { increment: 1 } },
  });
}

const PRICE_KEY = "subscription_price_stars";
const DEFAULT_PRICE = 399;

/** Цена подписки в Stars (из БД, без перезапуска). По умолчанию 399. */
export async function getPrice(): Promise<number> {
  const row = await db.appSetting.findUnique({
    where: { key: PRICE_KEY },
    select: { value: true },
  });
  if (!row) return DEFAULT_PRICE;
  const n = parseInt(row.value, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PRICE;
}

/** Установить цену подписки (админ). Сразу действует для новых инвойсов. */
export async function setPrice(stars: number): Promise<void> {
  await db.appSetting.upsert({
    where: { key: PRICE_KEY },
    create: { key: PRICE_KEY, value: String(stars) },
    update: { value: String(stars) },
  });
}

export async function getFreeUsageStats(userId: number): Promise<{
  estimatesUsed: number;
  estimatesLeft: number;
  confirmsUsed: number;
  confirmsLeft: number;
}> {
  const dayKey = toDayKey(new Date());
  const usage = await db.freeUsage.findUnique({
    where: { userId_dayKey: { userId, dayKey } },
  });
  const estimatesUsed = usage?.estimatesUsed ?? 0;
  const confirmsUsed = usage?.confirmsUsed ?? 0;
  const limit = MAX_ESTIMATE_REQUESTS_PER_DAY;
  return {
    estimatesUsed,
    estimatesLeft: Math.max(0, limit - (usage?.estimateRequestsUsed ?? 0)),
    confirmsUsed,
    confirmsLeft: -1,
  };
}
