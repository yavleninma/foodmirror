import TelegramBot from "node-telegram-bot-api";
import { db } from "../db";
import { config } from "../config";
import { isAdmin, adminReplyTarget } from "../support";
import { addDays, endOfDay } from "../utils/time";
import { getPrice, grantSubscription, setPrice } from "../subscription";

const TERMS_TEXT = `Условия использования FoodMirror

Сервис помогает фиксировать фактическое питание: фото и текст еды → оценка калорий и БЖУ с диапазоном неопределённости.

Оплата — через Telegram Stars (внутри приложения). Возвраты — по запросу в поддержку (/terms, кнопка «Поддержка»).

Полные условия будут опубликованы позже.`;

export const termsText = TERMS_TEXT;

export function parseAdminCommand(text: string): {
  cmd: string;
  args: string[];
} | null {
  if (!text?.trim().toLowerCase().startsWith("/admin")) return null;
  const rest = text.replace(/^\/admin\s*/i, "").trim();
  const parts = rest.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { cmd: "summary", args: [] };
  return { cmd: parts[0].toLowerCase(), args: parts.slice(1) };
}

export async function handleAdminCommand(
  bot: TelegramBot,
  chatId: string,
  text: string,
): Promise<boolean> {
  if (!isAdmin(chatId)) return false;
  const parsed = parseAdminCommand(text);
  if (!parsed) return false;

  const { cmd, args } = parsed;

  if (cmd === "grant" && args.length >= 2) {
    const days = parseInt(args[1], 10);
    if (!Number.isFinite(days) || days < 1) {
      await bot.sendMessage(chatId, "Использование: /admin grant <chatId|@username> <дней>");
      return true;
    }
    const targetId = await resolveUserIdentifier(args[0]);
    if (!targetId) {
      await bot.sendMessage(chatId, "Пользователь не найден.");
      return true;
    }
    const userRow = await db.user.findUnique({
      where: { id: targetId },
      select: { subscribedUntil: true, chatId: true },
    });
    const previousEnd = userRow?.subscribedUntil ?? null;
    await db.subscriptionGrant.deleteMany({ where: { userId: targetId } });
    const { subscribedUntil: finalEnd } = await grantSubscription(targetId, days);
    await db.subscriptionAdminLog.create({
      data: {
        userId: targetId,
        action: "grant",
        previousEnd,
        newEnd: finalEnd,
        adminChatId: chatId,
        details: String(days),
      },
    });
    if (userRow?.chatId) {
      const dateStr = finalEnd.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      await bot.sendMessage(
        userRow.chatId,
        `Вам выдана подписка Premium на ${days} дн. Действует до ${dateStr}.`,
      );
    }
    await bot.sendMessage(
      chatId,
      `Подписка выдана на ${days} дн. до ${finalEnd.toISOString().slice(0, 10)}.`,
    );
    return true;
  }

  if (cmd === "setend" && args.length >= 2) {
    const targetId = await resolveUserIdentifier(args[0]);
    if (!targetId) {
      await bot.sendMessage(chatId, "Пользователь не найден.");
      return true;
    }
    const dateMatch = args[1].match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      await bot.sendMessage(chatId, "Использование: /admin setend <chatId|@username> YYYY-MM-DD");
      return true;
    }
    const [, y, m, d] = dateMatch;
    const newEnd = endOfDay(new Date(Date.UTC(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10))));
    const userRow = await db.user.findUnique({
      where: { id: targetId },
      select: { subscribedUntil: true, chatId: true },
    });
    const previousEnd = userRow?.subscribedUntil ?? null;
    await db.subscriptionGrant.deleteMany({ where: { userId: targetId } });
    await db.user.update({
      where: { id: targetId },
      data: { subscribedUntil: newEnd },
    });
    await db.subscriptionAdminLog.create({
      data: {
        userId: targetId,
        action: "set_end",
        previousEnd,
        newEnd,
        adminChatId: chatId,
        details: args[1],
      },
    });
    if (userRow?.chatId) {
      const dateStr = newEnd.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      await bot.sendMessage(
        userRow.chatId,
        `Подписка установлена до ${dateStr}.`,
      );
    }
    await bot.sendMessage(chatId, `Подписка до ${args[1]}.`);
    return true;
  }

  if (cmd === "revoke" && args.length >= 1) {
    const targetId = await resolveUserIdentifier(args[0]);
    if (!targetId) {
      await bot.sendMessage(chatId, "Пользователь не найден.");
      return true;
    }
    const userRow = await db.user.findUnique({
      where: { id: targetId },
      select: { subscribedUntil: true, chatId: true },
    });
    const previousEnd = userRow?.subscribedUntil ?? null;
    await db.subscriptionGrant.deleteMany({ where: { userId: targetId } });
    await db.user.update({
      where: { id: targetId },
      data: { subscribedUntil: null },
    });
    await db.subscriptionAdminLog.create({
      data: {
        userId: targetId,
        action: "revoke",
        previousEnd,
        newEnd: null,
        adminChatId: chatId,
      },
    });
    if (userRow?.chatId) {
      await bot.sendMessage(
        userRow.chatId,
        "Подписка отозвана. Теперь можно записывать один приём в день. Premium — без лимитов.",
      );
    }
    await bot.sendMessage(chatId, "Подписка отозвана.");
    return true;
  }

  if (cmd === "price") {
    if (args.length === 0) {
      const current = await getPrice();
      await bot.sendMessage(chatId, `Цена подписки: ${current} Stars. Чтобы изменить: /admin price <число>`);
      return true;
    }
    const stars = parseInt(args[0], 10);
    if (!Number.isFinite(stars) || stars < 1) {
      await bot.sendMessage(chatId, "Укажите целое число Stars (например: /admin price 399)");
      return true;
    }
    await setPrice(stars);
    await bot.sendMessage(chatId, `Цена подписки установлена: ${stars} Stars. Действует сразу для новых оплат.`);
    return true;
  }

  if (cmd === "summary") {
    const totalUsers = await db.user.count();
    const now = new Date();
    const premiumBySubscribedUntil = await db.user.count({
      where: { subscribedUntil: { gt: now } },
    });
    const premiumByGrant = await db.subscriptionGrant.count({
      where: { grantedUntil: { gt: now } },
    });
    const mealsToday = await db.meal.count({
      where: { dayKey: now.toISOString().slice(0, 10) },
    });
    const msg = [
      `Пользователей: ${totalUsers}`,
      `Premium (subscribedUntil): ${premiumBySubscribedUntil}`,
      `Premium (grants): ${premiumByGrant}`,
      `Приёмов сегодня: ${mealsToday}`,
    ].join("\n");
    await bot.sendMessage(chatId, msg);
    return true;
  }

  if (cmd === "answer" && args.length >= 1) {
    const targetChatId = await resolveTargetChatId(args[0]);
    if (!targetChatId) {
      await bot.sendMessage(chatId, "Пользователь не найден. Укажи chatId или userId (внутренний id).");
      return true;
    }
    adminReplyTarget.set(chatId, targetChatId);
    await bot.sendMessage(chatId, `Жду ваш ответ для пользователя ${targetChatId}.`);
    return true;
  }

  if (cmd === "help" || cmd === "?") {
    await bot.sendMessage(
      chatId,
      [
        "/admin grant <chatId|@username> <дней> — выдать подписку (добавить дни, не уменьшать)",
        "/admin setend <chatId|@username> YYYY-MM-DD — поставить дату окончания подписки",
        "/admin revoke <chatId|@username> — отозвать подписку",
        "/admin price [число] — показать или установить цену в Stars (без перезапуска)",
        "/admin summary — сводка",
        "/admin answer <chatId|userId> — ответить в поддержку",
      ].join("\n"),
    );
    return true;
  }

  await bot.sendMessage(
    chatId,
    "Неизвестная команда. /admin help — список команд.",
  );
  return true;
}

/** Resolve chatId, @username or internal userId to internal User.id. Works for grant/setend/revoke. */
async function resolveUserIdentifier(idOrChatIdOrUsername: string): Promise<number | null> {
  const raw = idOrChatIdOrUsername.trim();
  if (/^\d+$/.test(raw)) {
    const byChatId = await db.user.findUnique({
      where: { chatId: raw },
      select: { id: true },
    });
    if (byChatId) return byChatId.id;
    const byId = await db.user.findUnique({
      where: { id: parseInt(raw, 10) },
      select: { id: true },
    });
    return byId?.id ?? null;
  }
  const usernamePart = raw.startsWith("@") ? raw.slice(1).trim() : raw;
  if (usernamePart) {
    const byUsername = await db.user.findFirst({
      where: { username: { equals: usernamePart, mode: "insensitive" } },
      select: { id: true },
    });
    if (byUsername) return byUsername.id;
  }
  return null;
}

/** Resolve chatId, @username or internal userId to Telegram chatId (for sending messages). Used by /admin answer. */
async function resolveTargetChatId(idOrChatIdOrUsername: string): Promise<string | null> {
  const raw = idOrChatIdOrUsername.trim();
  if (/^\d+$/.test(raw)) {
    const byChatId = await db.user.findUnique({
      where: { chatId: raw },
      select: { chatId: true },
    });
    if (byChatId) return byChatId.chatId;
    const byId = await db.user.findUnique({
      where: { id: parseInt(raw, 10) },
      select: { chatId: true },
    });
    return byId?.chatId ?? null;
  }
  const usernamePart = raw.startsWith("@") ? raw.slice(1).trim() : raw;
  if (usernamePart) {
    const byUsername = await db.user.findFirst({
      where: { username: { equals: usernamePart, mode: "insensitive" } },
      select: { chatId: true },
    });
    if (byUsername) return byUsername.chatId;
  }
  return null;
}
