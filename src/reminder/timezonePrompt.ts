import type TelegramBot from "node-telegram-bot-api";

/**
 * Shared timezone/geolocation prompt for determining user's timezone.
 * Used at /start, in reminder settings, and daily by the reminder scheduler.
 */
export const awaitingTimezoneLocation = new Set<string>();

export const TIMEZONE_PROMPT_TEXT =
  "Чтобы «сегодня» и напоминания совпадали с твоим днём, пришли геолокацию (один раз).";

const CANCEL_TEXT = "Отмена";

export function timezonePromptReplyMarkup(): TelegramBot.ReplyKeyboardMarkup {
  const keyboard: TelegramBot.KeyboardButton[][] = [
    [{ text: "📍 Поделиться геолокацией", request_location: true }],
    [{ text: CANCEL_TEXT }],
  ];
  return { keyboard, resize_keyboard: true, one_time_keyboard: true };
}
