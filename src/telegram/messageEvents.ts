import TelegramBot from "node-telegram-bot-api";
import { MessageDirection, MessageType } from "@prisma/client";
import { db } from "../db";

function detectIncomingType(msg: TelegramBot.Message): MessageType {
  if (msg.photo?.length) return MessageType.PHOTO;
  if (msg.text?.startsWith("/")) return MessageType.COMMAND;
  if (msg.text) return MessageType.TEXT;
  return MessageType.OTHER;
}

export async function logIncomingMessage(
  userId: number,
  msg: TelegramBot.Message,
): Promise<void> {
  await db.messageEvent.create({
    data: {
      userId,
      direction: MessageDirection.IN,
      messageType: detectIncomingType(msg),
      telegramMessageId: msg.message_id,
      text: msg.text ?? msg.caption ?? null,
      photoFileId: msg.photo?.[msg.photo.length - 1]?.file_id ?? null,
      payloadJson: msg as unknown as object,
    },
  });
}

export async function logOutgoingMessage(params: {
  userId: number;
  message: TelegramBot.Message;
  messageType?: MessageType;
  draftMealId?: number | null;
  mealId?: number | null;
  payload?: object | null;
}): Promise<void> {
  const { userId, message, messageType, draftMealId, mealId, payload } = params;
  await db.messageEvent.create({
    data: {
      userId,
      direction: MessageDirection.OUT,
      messageType: messageType ?? MessageType.TEXT,
      telegramMessageId: message.message_id,
      text: message.text ?? null,
      photoFileId: null,
      payloadJson: payload ?? undefined,
      draftMealId: draftMealId ?? null,
      mealId: mealId ?? null,
    },
  });
}

export async function sendLoggedMessage(
  bot: TelegramBot,
  params: {
    userId: number;
    chatId: string;
    text: string;
    options?: TelegramBot.SendMessageOptions;
    messageType?: MessageType;
    draftMealId?: number | null;
    mealId?: number | null;
  },
): Promise<TelegramBot.Message> {
  const { userId, chatId, text, options, messageType, draftMealId, mealId } =
    params;
  const message = await bot.sendMessage(chatId, text, options);
  await logOutgoingMessage({
    userId,
    message,
    messageType,
    draftMealId,
    mealId,
    payload: { text, options },
  });
  return message;
}
