import TelegramBot from "node-telegram-bot-api";
import { db } from "../db";
import { addDays, endOfDay } from "../utils/time";
import { getPremiumStatus } from "./index";

const TODAY_TEXT = "Сегодня";
const YESTERDAY_TEXT = "Вчера";
const STATS_TEXT = "Статистика";
const PREMIUM_TEXT = "💎 Premium";
const STATUS_TEXT = "Статус подписки";
const REMINDER_BUTTON = "🔔 Напоминание";
const HELP_BUTTON = "Помощь";
const TERMS_BUTTON = "Условия";
const SUPPORT_TEXT = "Поддержка";

async function premiumKeyboard(userId: number) {
  const status = await getPremiumStatus(userId);
  const premiumOrStatus = status
    ? [{ text: STATUS_TEXT }, { text: REMINDER_BUTTON }]
    : [{ text: PREMIUM_TEXT }, { text: REMINDER_BUTTON }];
  return {
    reply_markup: {
      keyboard: [
        [{ text: TODAY_TEXT }, { text: YESTERDAY_TEXT }, { text: STATS_TEXT }],
        [{ text: HELP_BUTTON }, { text: TERMS_BUTTON }, { text: SUPPORT_TEXT }],
        premiumOrStatus,
      ],
      resize_keyboard: true,
    },
  };
}

export async function handlePreCheckout(
  bot: TelegramBot,
  query: TelegramBot.PreCheckoutQuery,
): Promise<void> {
  const payload = query.invoice_payload ?? "";
  if (!payload.startsWith("premium_")) {
    await bot.answerPreCheckoutQuery(query.id, false, {
      error_message: "Неизвестный платёж. Используй кнопку Premium в боте.",
    });
    return;
  }
  await bot.answerPreCheckoutQuery(query.id, true);
}

export async function handleSuccessfulPayment(
  bot: TelegramBot,
  msg: TelegramBot.Message,
): Promise<void> {
  const payment = msg.successful_payment;
  if (!payment) return;
  const chatId = String(msg.chat.id);
  const chargeId = payment.telegram_payment_charge_id;

  const user = await db.user.findUnique({
    where: { chatId },
    select: { id: true, subscribedUntil: true, lastPaymentChargeId: true },
  });
  if (!user) return;

  // Идемпотентность: повторная обработка одного и того же платежа не продлевает подписку дважды
  if (user.lastPaymentChargeId === chargeId) return;

  const now = new Date();
  const paidDays = 30;
  const baseDate =
    user.subscribedUntil && user.subscribedUntil > now ? user.subscribedUntil : now;
  const subscribedUntil = endOfDay(addDays(baseDate, paidDays - 1));
  await db.user.update({
    where: { id: user.id },
    data: {
      subscribedUntil,
      lastPaymentChargeId: chargeId,
    },
  });

  const dateStr = subscribedUntil.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const km = await premiumKeyboard(user.id);
  await bot.sendMessage(
    chatId,
    `Premium продлён до ${dateStr}. Спасибо!`,
    km,
  );
}
