import TelegramBot from "node-telegram-bot-api";
import { MessageType } from "@prisma/client";
import { db } from "../db";
import { toDayKey } from "../utils/time";
import { sendLoggedMessage } from "../telegram/messageEvents";
import { getRandomQuote } from "./quotes";
import {
  awaitingTimezoneLocation,
  TIMEZONE_PROMPT_TEXT,
  timezonePromptReplyMarkup,
} from "./timezonePrompt";
function getLocalHour(now: Date, timezone: string): number {
  try {
    return parseInt(
      new Intl.DateTimeFormat("en", {
        hour: "numeric",
        hour12: false,
        timeZone: timezone,
      }).format(now),
      10,
    );
  } catch {
    return now.getUTCHours();
  }
}

const SUBSCRIPTION_REMINDER_DAYS = [7, 3, 1] as const;

function subscriptionReminderText(daysLeft: number): string {
  return `Подписка заканчивается через ${daysLeft} ${daysLeft === 1 ? "день" : "дня"}. Оценка останется бесплатной, статистика — в Premium.`;
}

const SUBSCRIPTION_ENDED_TEXT =
  "Подписка закончилась. Оценка по фото и тексту — бесплатно без ограничений. Статистика — в Premium.";

type ReminderUser = {
  id: number;
  chatId: string;
  reminderMode: string;
  reminderHour: number;
  timezone: string;
  timezoneSetByUser: boolean;
  lastReminderAt: Date | null;
  subscribedUntil: Date | null;
  trialReminderSent7At: Date | null;
  trialReminderSent3At: Date | null;
  trialReminderSent1At: Date | null;
  trialEndReminderSentAt: Date | null;
};

function hasFullAccess(user: ReminderUser, now: Date, hasActiveGrant: boolean): boolean {
  if (user.subscribedUntil && now <= user.subscribedUntil) return true;
  return hasActiveGrant;
}

function daysUntilEnd(subscribedUntil: Date): number {
  const now = new Date();
  return Math.ceil(
    (subscribedUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  );
}

export function startReminder(bot: TelegramBot) {
  const intervalMs = 5 * 60 * 1000;

  setInterval(async () => {
    try {
      const now = new Date();
      const todayKey = toDayKey(now);

      const users = await db.user.findMany({
        where: { reminderMode: { not: "OFF" } },
        select: {
          id: true,
          chatId: true,
          reminderMode: true,
          reminderHour: true,
          timezone: true,
          timezoneSetByUser: true,
          lastReminderAt: true,
          subscribedUntil: true,
          trialReminderSent7At: true,
          trialReminderSent3At: true,
          trialReminderSent1At: true,
          trialEndReminderSentAt: true,
        },
      }) as ReminderUser[];

      if (users.length === 0) return;

      const userIds = users.map((u) => u.id);
      const activeGrants = await db.subscriptionGrant.findMany({
        where: { userId: { in: userIds }, grantedUntil: { gt: now } },
        select: { userId: true },
      });
      const grantUserIds = new Set(activeGrants.map((g: { userId: number }) => g.userId));

      const userIdsWithNoMealsMode = users
        .filter((u) => u.reminderMode === "NO_MEALS")
        .map((u) => u.id);
      const usersWithMealsToday = new Set<number>();
      if (userIdsWithNoMealsMode.length > 0) {
        const mealCounts = await db.meal.groupBy({
          by: ["userId"],
          where: { userId: { in: userIdsWithNoMealsMode }, dayKey: todayKey },
          _count: true,
        });
        for (const entry of mealCounts) {
          if (entry._count > 0) usersWithMealsToday.add(entry.userId);
        }
      }

      for (const user of users) {
        const lastReminderKey = user.lastReminderAt ? toDayKey(user.lastReminderAt) : null;
        const localHour = getLocalHour(now, user.timezone);
        const hasAccess = hasFullAccess(user, now, grantUserIds.has(user.id));

        if (hasAccess && user.subscribedUntil && localHour === user.reminderHour) {
          const daysLeft = daysUntilEnd(user.subscribedUntil);
          if (SUBSCRIPTION_REMINDER_DAYS.includes(daysLeft as 7 | 3 | 1)) {
            const sentKey =
              daysLeft === 7 ? "trialReminderSent7At" : daysLeft === 3 ? "trialReminderSent3At" : "trialReminderSent1At";
            const sentAt = user[sentKey];
            if (!sentAt) {
              await sendLoggedMessage(bot, {
                userId: user.id,
                chatId: user.chatId,
                text: subscriptionReminderText(daysLeft),
                messageType: MessageType.SYSTEM,
              });
              await db.user.update({
                where: { id: user.id },
                data: { [sentKey]: now },
              });
            }
          }
        } else if (!hasAccess && user.subscribedUntil && user.subscribedUntil < now && !user.trialEndReminderSentAt && localHour === user.reminderHour) {
          await sendLoggedMessage(bot, {
            userId: user.id,
            chatId: user.chatId,
            text: SUBSCRIPTION_ENDED_TEXT,
            messageType: MessageType.SYSTEM,
          });
          await db.user.update({
            where: { id: user.id },
            data: { trialEndReminderSentAt: now },
          });
        }

        if (!hasAccess) continue;
        if (lastReminderKey === todayKey) continue;
        if (localHour !== user.reminderHour) continue;
        if (user.reminderMode === "NO_MEALS" && usersWithMealsToday.has(user.id)) continue;

        if (!user.timezoneSetByUser) {
          await bot.sendMessage(user.chatId, TIMEZONE_PROMPT_TEXT, {
            reply_markup: timezonePromptReplyMarkup(),
          });
          awaitingTimezoneLocation.add(user.chatId);
        } else {
          const reminderIntro = "Итог дня по еде можно зафиксировать здесь.";
          await sendLoggedMessage(bot, {
            userId: user.id,
            chatId: user.chatId,
            text: `${reminderIntro}\n\n${getRandomQuote()}`,
            messageType: MessageType.SYSTEM,
          });
        }
        await db.user.update({
          where: { id: user.id },
          data: { lastReminderAt: now },
        });
      }
    } catch (err) {
      console.error("[reminder] scheduler tick error:", err);
    }
  }, intervalMs);
}
