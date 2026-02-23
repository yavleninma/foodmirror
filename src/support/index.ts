import { config } from "../config";

const SUPPORT_PROMPT =
  "Опишите проблему или вопрос и отправьте сообщение — я передам его в поддержку. Ответим в ближайшее время.";

export const supportPrompt = SUPPORT_PROMPT;

export const awaitingSupportInput = new Set<string>();
export const adminReplyTarget = new Map<string, string>();

export function isAdmin(chatId: string): boolean {
  return config.subscription.adminChatId === chatId;
}
