import TelegramBot from "node-telegram-bot-api";
import { config } from "./config";
import {
  handleMediaGroup,
  handleMessage,
  handleReminderCallback,
  handleMealDeleteCallback,
  handleEstimateInlineCallback,
  tryCancelDuringPending,
} from "./fsm/handlers";
import { handlePreCheckout, handleSuccessfulPayment } from "./subscription/paymentHandlers";
import { startReminder } from "./reminder/scheduler";
import { logError } from "./utils/logger";
import { db } from "./db";
import { sendLoggedMessage } from "./telegram/messageEvents";
import { MessageType } from "@prisma/client";

if (!config.telegramToken) {
  throw new Error("TELEGRAM_BOT_TOKEN is required");
}

if (!config.llm.apiKey) {
  throw new Error("OPENAI_API_KEY is required");
}

const bot = new TelegramBot(config.telegramToken, { polling: true });

bot.on("pre_checkout_query", (query) => {
  handlePreCheckout(bot, query).catch((err) => {
    logError(
      { scope: "payment.pre_checkout", extra: { queryId: query.id } },
      err instanceof Error ? err : new Error(String(err)),
    );
    console.error(err);
  });
});

const MEDIA_GROUP_DELAY_MS = 400;

// Per-user message queue to prevent race conditions on concurrent messages
const userQueues = new Map<string, Promise<void>>();

function enqueueForUser(chatId: string, task: () => Promise<void>): void {
  const prev = userQueues.get(chatId) ?? Promise.resolve();
  const next = prev.then(task, task);
  userQueues.set(chatId, next);
  // Clean up the map entry when the queue drains
  next.then(() => {
    if (userQueues.get(chatId) === next) {
      userQueues.delete(chatId);
    }
  });
}

const mediaGroupBuffers = new Map<
  string,
  { msgs: TelegramBot.Message[]; timeout: NodeJS.Timeout }
>();

function getMediaGroupKey(chatId: string, mediaGroupId: string): string {
  return `${chatId}:${mediaGroupId}`;
}

function flushMediaGroup(chatId: string, mediaGroupId: string): void {
  const key = getMediaGroupKey(chatId, mediaGroupId);
  const buf = mediaGroupBuffers.get(key);
  if (!buf) return;
  clearTimeout(buf.timeout);
  mediaGroupBuffers.delete(key);
  const msgs = buf.msgs;
  if (msgs.length > 0) {
    enqueueForUser(chatId, async () => {
      try {
        await handleMediaGroup(bot, chatId, msgs);
      } catch (err) {
        logError(
          { scope: "telegram.media_group", chatId },
          err instanceof Error ? err : new Error(String(err)),
        );
        console.error(err);
      }
    });
  }
}

async function deleteMessageSafe(chatId: string, messageId: number) {
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch {
    return;
  }
}

bot.on("message", async (msg) => {
  const chatId = String(msg.chat.id);
  const mediaGroupId = msg.media_group_id;

  if (mediaGroupId && msg.photo?.length) {
    const key = getMediaGroupKey(chatId, mediaGroupId);
    const existing = mediaGroupBuffers.get(key);
    if (existing) {
      existing.msgs.push(msg);
      clearTimeout(existing.timeout);
    } else {
      mediaGroupBuffers.set(key, {
        msgs: [msg],
        timeout: setTimeout(
          () => flushMediaGroup(chatId, mediaGroupId),
          MEDIA_GROUP_DELAY_MS,
        ),
      });
      return;
    }
    existing.timeout = setTimeout(
      () => flushMediaGroup(chatId, mediaGroupId),
      MEDIA_GROUP_DELAY_MS,
    );
    return;
  }

  if (msg.successful_payment) {
    try {
      await handleSuccessfulPayment(bot, msg);
    } catch (error) {
      logError(
        { scope: "payment.successful", chatId },
        error instanceof Error ? error : new Error(String(error)),
      );
      console.error(error);
    }
    return;
  }

  if (msg.text?.trim()) {
    const cancelled = await tryCancelDuringPending(bot, chatId, msg);
    if (cancelled) return;
  }

  // Enqueue message processing per user to prevent race conditions
  enqueueForUser(chatId, async () => {
    try {
      await handleMessage(bot, msg);
    } catch (error) {
      await logError(
        {
          scope: "telegram.message",
          chatId,
          messageId: msg.message_id,
          extra: {
            hasPhoto: Boolean(msg.photo?.length),
            text: msg.text ?? null,
          },
        },
        error,
      );
      const user = await db.user.findUnique({ where: { chatId } });
      if (user?.lastErrorMessageId) {
        await deleteMessageSafe(chatId, user.lastErrorMessageId);
      }
      if (user) {
        const message = await sendLoggedMessage(bot, {
          userId: user.id,
          chatId,
          text: "Что-то пошло не так. Попробуй ещё раз.",
          messageType: MessageType.SYSTEM,
        });
        await db.user.update({
          where: { id: user.id },
          data: { lastErrorMessageId: message.message_id },
        });
      } else {
        await bot.sendMessage(chatId, "Что-то пошло не так. Попробуй ещё раз.");
      }
      console.error(error);
    }
  });
});

bot.on("callback_query", (query) => {
  const data = query.data ?? "";
  const handler =
    data.startsWith("del:") || data.startsWith("delc:")
      ? handleMealDeleteCallback(bot, query)
      : data.startsWith("edit:") || data.startsWith("e:")
        ? handleEstimateInlineCallback(bot, query)
        : handleReminderCallback(bot, query);

  handler.catch((err) => {
    logError(
      { scope: "telegram.callback_query", extra: { queryId: query.id } },
      err instanceof Error ? err : new Error(String(err)),
    );
    console.error(err);
  });
});

startReminder(bot);
