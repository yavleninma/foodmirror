import { prisma } from '../lib/prisma.js';
import { analyzeFoodPhoto } from './openai.js';
import type { TelegramUser } from '../lib/telegram.js';
import { DEFAULT_GOAL } from '@foodmirror/shared';

interface CreateInsightParams {
  user: TelegramUser;
  imageBuffer: Buffer;
  mimeType: string;
}

export async function createInsight({ user, imageBuffer, mimeType }: CreateInsightParams) {
  const { verdict, correction } = await analyzeFoodPhoto(imageBuffer, mimeType);

  await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      goal: DEFAULT_GOAL,
    },
    update: {
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      lastActiveAt: new Date(),
    },
  });

  const insight = await prisma.insight.create({
    data: {
      userId: user.id,
      verdict,
      correction,
    },
  });

  return {
    id: insight.id,
    verdict: insight.verdict,
    correction: insight.correction,
    createdAt: insight.createdAt.toISOString(),
  };
}
