import { prisma } from '../lib/prisma.js';
import { DEFAULT_GOAL, HISTORY_PAGE_SIZE } from '@foodmirror/shared';
import type { TelegramUser } from '../lib/telegram.js';
import { calculateStreakFromDates, getStartOfWeekMonday } from '../lib/time.js';

type HistoryItem = {
  id: string;
  verdict: string;
  correction: string;
  createdAt: Date;
};

type StreakItem = {
  createdAt: Date;
};

export async function getHistory(userId: string, limit: number = HISTORY_PAGE_SIZE, cursor?: string) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  let effectiveCursor: string | undefined;

  if (cursor) {
    const cursorEntry = await prisma.insight.findUnique({
      where: { id: cursor },
      select: { id: true, userId: true },
    });
    if (cursorEntry?.userId === userId) {
      effectiveCursor = cursorEntry.id;
    }
  }

  const entries = await prisma.insight.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(effectiveCursor ? { cursor: { id: effectiveCursor }, skip: 1 } : {}),
    take: safeLimit + 1,
  });

  const hasMore = entries.length > safeLimit;
  const items = hasMore ? entries.slice(0, safeLimit) : entries;
  const nextCursor = hasMore ? items[items.length - 1].id : undefined;

  return {
    entries: items.map((e: HistoryItem) => ({
      id: e.id,
      verdict: e.verdict,
      correction: e.correction,
      createdAt: e.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

export async function getStats(userId: string) {
  const now = new Date();
  const startOfThisWeek = getStartOfWeekMonday(now);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const [thisWeek, lastWeek, streak] = await Promise.all([
    prisma.insight.count({
      where: { userId, createdAt: { gte: startOfThisWeek } },
    }),
    prisma.insight.count({
      where: { userId, createdAt: { gte: startOfLastWeek, lt: startOfThisWeek } },
    }),
    calculateStreak(userId),
  ]);

  return { thisWeek, lastWeek, streak };
}

async function calculateStreak(userId: string): Promise<number> {
  const insights = await prisma.insight.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
    take: 90,
  });

  return calculateStreakFromDates(insights.map((i: StreakItem) => i.createdAt));
}

export async function updateGoal(user: TelegramUser, goal: string) {
  await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      goal,
    },
    update: { goal },
  });
  return { goal };
}

export async function ensureUser(user: TelegramUser) {
  return prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      goal: DEFAULT_GOAL,
    },
    update: {
      lastActiveAt: new Date(),
    },
  });
}
