import TelegramBot from "node-telegram-bot-api";
import { getPrice } from "./index";

const INVOICE_TITLE = "Premium на 1 месяц";
const INVOICE_DESCRIPTION =
  "Итоги за день, статистика 7/30 дней, напоминания. Оплачивая, вы соглашаетесь с условиями. /terms";

export async function sendPremiumInvoice(
  bot: TelegramBot,
  chatId: string,
): Promise<TelegramBot.Message> {
  const price = await getPrice();
  const payload = `premium_${Date.now()}_${chatId}`;
  const prices = [{ label: "1 месяц", amount: price }];
  return bot.sendInvoice(
    chatId,
    INVOICE_TITLE,
    INVOICE_DESCRIPTION,
    payload,
    "",
    "XTR",
    prices,
    {},
  );
}
