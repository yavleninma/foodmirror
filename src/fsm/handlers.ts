import TelegramBot from "node-telegram-bot-api";
import { config } from "../config";
import { db } from "../db";
import {
  canEstimate,
  canSendPhoto,
  getPremiumStatus,
  grantSubscription,
  hasFullAccess,
  isPremium,
  recordConfirm,
  recordEstimate,
  recordPhoto,
} from "../subscription";
import { sendPremiumInvoice } from "../subscription/payment";
import {
  isAdmin,
  supportPrompt,
  awaitingSupportInput,
  adminReplyTarget,
} from "../support";
import { handleAdminCommand, termsText } from "../admin";
import {
  buildFoodReference,
  buildMealTitle,
  processDraftConversation,
} from "../llm/adapter";
import { getPortionHintsForLLM } from "../llm/portionHints";
import {
  EstimateResult,
  MealTitleResult,
  ParseResult,
  ParsedComponent,
} from "../llm/contracts";
import {
  estimateFromParseWithOverrides,
  getComponentEditTotals,
  normalizeName,
  type ResolvedComponent,
  type UserOverride,
} from "../domain/estimation";
import { foodResolver } from "../services/foodResolver";
import { searchByText as offSearchByText } from "../services/openFoodFacts";
import { isParseResult } from "../llm/validators";
import {
  formatConfirmSummary,
  formatEstimate,
  formatEstimateWithEditComponents,
  formatExplainEstimate,
  formatHistorySummary,
  buildMealDeleteButtons,
  buildProductListKeyboard,
  buildProductEditKeyboard,
  formatProductEditScreen,
  formatParseSummary,
  formatUncertaintyNote,
  formatStatsSummary,
  EDIT_WEIGHT_MIN_G,
  EDIT_WEIGHT_MAX_G,
} from "../telegram/format";
import {
  logIncomingMessage,
  sendLoggedMessage,
} from "../telegram/messageEvents";
import { toDayKey, toDayKeyForUser } from "../utils/time";
import { logError } from "../utils/logger";
import { find as findTimezone } from "geo-tz";
import {
  awaitingTimezoneLocation,
  TIMEZONE_PROMPT_TEXT,
  timezonePromptReplyMarkup,
} from "../reminder/timezonePrompt";
/** When true, user opened timezone flow from reminder; on cancel we re-show reminder settings. */
const awaitingTimezoneFromReminder = new Set<string>();

/** chatId -> messageId of the last estimate message (for edit on +/- click) */
const estimateMessageByChat = new Map<string, number>();

function clearEstimateMessage(chatId: string) {
  estimateMessageByChat.delete(chatId);
}

const CONFIRM_TEXT = "Подтвердить";
const WHY_TEXT = "Почему так?";
const CANCEL_TEXT = "Отмена";
const FOUND_TEXT = "Найдено";
const CLARIFY_TEXT = "Уточнения";
const TODAY_TEXT = "Сегодня";
const YESTERDAY_TEXT = "Вчера";
const STATS_TEXT = "Статистика";
const PREMIUM_TEXT = "💎 Premium";
const STATUS_TEXT = "Статус подписки";
const SUPPORT_TEXT = "Поддержка";
const HELP_BUTTON = "Помощь";
const TERMS_BUTTON = "Условия";
const REMINDER_BUTTON = "🔔 Напоминание";
const PENDING_MESSAGE = "Обрабатываю…";
const LLM_PENDING_TIMEOUT_MS = 45000;

type DraftConversationStoredEntry = {
  role: "user" | "assistant";
  text: string;
  photoFileId: string | null;
};

const CANCEL_COMMANDS = new Set(["отмена"]);

async function mainKeyboardMarkup(userId: number) {
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

async function ensureUser(chatId: string) {
  return db.user.upsert({
    where: { chatId },
    update: {},
    create: { chatId },
  });
}

/** Update stored Telegram username when user sends a message (for admin @username lookup). */
async function syncUserUsername(chatId: string, username: string | undefined | null): Promise<void> {
  if (!username?.trim()) return;
  await db.user.update({
    where: { chatId },
    data: { username: username.trim() },
  });
}

function confirmKeyboardMarkup() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: CONFIRM_TEXT }, { text: CANCEL_TEXT }],
        [{ text: WHY_TEXT }, { text: FOUND_TEXT }, { text: CLARIFY_TEXT }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

function pendingKeyboardMarkup() {
  return {
    reply_markup: {
      keyboard: [[{ text: CANCEL_TEXT }]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

function supportKeyboardMarkup() {
  return {
    reply_markup: {
      keyboard: [[{ text: CANCEL_TEXT }]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

async function setPendingKeyboard(params: {
  bot: TelegramBot;
  chatId: string;
  userId: number;
  draftMealId?: number | null;
}) {
  await sendLoggedMessage(params.bot, {
    userId: params.userId,
    chatId: params.chatId,
    text: PENDING_MESSAGE,
    options: pendingKeyboardMarkup(),
    messageType: "SYSTEM",
    draftMealId: params.draftMealId ?? null,
  });
}

function hideKeyboardMarkup() {
  return { reply_markup: { remove_keyboard: true } };
}

// --- Reminder settings UI helpers ---

type ReminderModeValue = "OFF" | "NO_MEALS" | "ALWAYS";

type ReminderUser = {
  reminderMode: ReminderModeValue;
  reminderHour: number;
  timezone: string;
  timezoneSetByUser?: boolean;
};

function reminderSettingsText(user: ReminderUser): string {
  const timeStr = `${String(user.reminderHour).padStart(2, "0")}:00`;
  const tzLabel = user.timezoneSetByUser ? user.timezone : "часовой пояс не задан";
  if (user.reminderMode === "OFF") {
    return `Напоминание выключено.\nВремя: ${timeStr} · ${tzLabel}`;
  }
  return `Напоминание: ${timeStr}\n${tzLabel}`;
}

function reminderMainInlineKeyboard(user: ReminderUser) {
  const isOn = user.reminderMode !== "OFF";
  const timeBtn = { text: `🕐 ${String(user.reminderHour).padStart(2, "0")}:00`, callback_data: "rem:time" };
  const toggleBtn = isOn
    ? { text: "✅ Включено", callback_data: "rem:toggle" }
    : { text: "☐ Выключено", callback_data: "rem:toggle" };
  const tzBtn = {
    text: user.timezoneSetByUser ? `📍 ${user.timezone}` : "📍 Указать часовой пояс",
    callback_data: "rem:tz" as const,
  };
  return {
    reply_markup: {
      inline_keyboard: [
        [timeBtn, toggleBtn],
        [tzBtn],
      ],
    },
  };
}

function reminderTimeInlineKeyboard(currentHour: number) {
  const rows: { text: string; callback_data: string }[][] = [];
  const hours = Array.from({ length: 16 }, (_, i) => i + 8); // 8..23
  for (let i = 0; i < hours.length; i += 4) {
    rows.push(
      hours.slice(i, i + 4).map((h) => ({
        text: h === currentHour ? `[${String(h).padStart(2, "0")}:00]` : `${String(h).padStart(2, "0")}:00`,
        callback_data: `rem:h:${h}`,
      })),
    );
  }
  rows.push([{ text: "← Назад", callback_data: "rem:back" }]);
  return { reply_markup: { inline_keyboard: rows } };
}

// --- End reminder UI helpers ---

function normalizeInput(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function isCancelCommand(text: string | null): boolean {
  if (!text) return false;
  return CANCEL_COMMANDS.has(normalizeInput(text));
}

function isConfirmCommand(text: string | null): boolean {
  if (!text) return false;
  return normalizeInput(text) === normalizeInput(CONFIRM_TEXT);
}

function isWhyCommand(text: string | null): boolean {
  if (!text) return false;
  return normalizeInput(text) === normalizeInput(WHY_TEXT);
}

function isFoundCommand(text: string | null): boolean {
  if (!text) return false;
  return normalizeInput(text) === normalizeInput(FOUND_TEXT);
}

function isClarifyCommand(text: string | null): boolean {
  if (!text) return false;
  return normalizeInput(text) === normalizeInput(CLARIFY_TEXT);
}

/** Проверяет, относятся ли два item'а к одному продукту (для merge) */
function itemsMatch(a: ParsedComponent, b: ParsedComponent): boolean {
  const tokenize = (s: string) =>
    normalizeName(s)
      .split("_")
      .filter((t) => t.length >= 2);
  const tokensA = new Set([
    ...tokenize(a.canonical_name),
    ...tokenize(a.display_label),
  ]);
  const tokensB = new Set([
    ...tokenize(b.canonical_name),
    ...tokenize(b.display_label),
  ]);
  const common = [...tokensA].filter((t) => tokensB.has(t));
  if (common.length === 0) return false;
  const overlap = common.length / Math.min(tokensA.size, tokensB.size);
  return overlap >= 0.5;
}

/** Возвращает эффективные min, max для item (если только mean — строим диапазон как в estimation). */
function getWeightBounds(
  item: ParsedComponent,
): { min: number; max: number; mean: number } | null {
  const mean = item.weight_g_mean;
  const min = item.weight_g_min;
  const max = item.weight_g_max;
  if (typeof mean !== "number") return null;
  if (typeof min === "number" && typeof max === "number" && min <= max) {
    return { min, max, mean };
  }
  return {
    min: Math.max(0, mean * 0.7),
    max: Math.max(mean * 1.3, mean + 10),
    mean,
  };
}

/**
 * Объединяет веса из двух оценок (например, два фото одного блюда).
 * Если диапазоны пересекаются — берём пересечение (уточнение).
 * Если не пересекаются — объединение (честная неопределённость).
 */
function combineWeights(
  prev: ParsedComponent,
  incoming: ParsedComponent,
): {
  weight_g_mean: number;
  weight_g_min: number;
  weight_g_max: number;
} {
  const a = getWeightBounds(prev);
  const b = getWeightBounds(incoming);
  if (!a && !b)
    return {
      weight_g_mean: incoming.weight_g_mean ?? prev.weight_g_mean ?? 100,
      weight_g_min: incoming.weight_g_min ?? prev.weight_g_min ?? 50,
      weight_g_max: incoming.weight_g_max ?? prev.weight_g_max ?? 200,
    };
  if (!a)
    return {
      weight_g_mean: b!.mean,
      weight_g_min: b!.min,
      weight_g_max: b!.max,
    };
  if (!b)
    return { weight_g_mean: a.mean, weight_g_min: a.min, weight_g_max: a.max };

  const overlapMin = Math.max(a.min, b.min);
  const overlapMax = Math.min(a.max, b.max);

  if (overlapMin <= overlapMax) {
    return {
      weight_g_mean: Math.round((overlapMin + overlapMax) / 2),
      weight_g_min: Math.round(overlapMin),
      weight_g_max: Math.round(overlapMax),
    };
  }

  const unionMin = Math.min(a.min, b.min);
  const unionMax = Math.max(a.max, b.max);
  const unionMean = Math.round((a.mean + b.mean) / 2);
  return {
    weight_g_mean: unionMean,
    weight_g_min: Math.round(unionMin),
    weight_g_max: Math.round(unionMax),
  };
}

/** При совпадении item'ов объединяем веса из нескольких оценок (фото). */
function mergeMatchedItem(
  prev: ParsedComponent,
  incoming: ParsedComponent,
): ParsedComponent {
  const combined = combineWeights(prev, incoming);
  return {
    canonical_name: incoming.canonical_name,
    display_label: incoming.display_label,
    ...combined,
    confidence:
      weightUncertaintyWidth(incoming) <= weightUncertaintyWidth(prev)
        ? incoming.confidence
        : prev.confidence,
    confidence_reasons:
      weightUncertaintyWidth(incoming) <= weightUncertaintyWidth(prev)
        ? incoming.confidence_reasons
        : prev.confidence_reasons,
    barcode: incoming.barcode ?? prev.barcode ?? null,
    user_kcal_per_100g: incoming.user_kcal_per_100g ?? prev.user_kcal_per_100g ?? null,
    user_protein_per_100g: incoming.user_protein_per_100g ?? prev.user_protein_per_100g ?? null,
    user_fat_per_100g: incoming.user_fat_per_100g ?? prev.user_fat_per_100g ?? null,
    user_carbs_per_100g: incoming.user_carbs_per_100g ?? prev.user_carbs_per_100g ?? null,
  };
}

function weightUncertaintyWidth(item: ParsedComponent): number {
  const b = getWeightBounds(item);
  return b ? b.max - b.min : 999;
}

/**
 * Determines which items from `previousItems` the user's latest message refers to.
 * Returns a set of indices into previousItems. If no items are detected
 * (user may have rephrased the entire meal), returns ALL indices so nothing
 * gets locked — we only lock when we can confidently identify unmentioned items.
 */
function detectMentionedItems(
  text: string | null,
  previousItems: ParsedComponent[],
): Set<number> {
  const all = new Set(previousItems.map((_, i) => i));
  if (!text || previousItems.length === 0) return all;

  const textNorm = normalizeToken(text);
  if (!textNorm || textNorm.length < 2) return all;

  const textTokens = textNorm.split(/\s+/).filter((t) => t.length >= 3);
  if (textTokens.length === 0) return all;

  const mentioned = new Set<number>();
  for (let i = 0; i < previousItems.length; i++) {
    const item = previousItems[i];
    const label = normalizeToken(item.display_label);
    const canonical = normalizeToken(item.canonical_name.replace(/_/g, " "));
    const itemTokens = `${label} ${canonical}`
      .split(/\s+/)
      .filter((t) => t.length >= 3);
    if (itemTokens.length === 0) continue;

    if (textNorm.includes(label) && label.length >= 3) {
      mentioned.add(i);
      continue;
    }

    let matched = false;
    for (const it of itemTokens) {
      for (const tt of textTokens) {
        if (stemMatchTokens(it, tt)) {
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (matched) mentioned.add(i);
  }

  return mentioned.size > 0 ? mentioned : all;
}

/**
 * After mergeParse, restores weights of items that the user did NOT mention
 * in their latest message. This prevents LLM from silently changing weights
 * of products the user didn't ask about.
 */
function protectUnmentionedWeights(
  merged: ParseResult,
  previous: ParseResult,
  mentionedIndices: Set<number>,
): ParseResult {
  if (previous.items.length === 0) return merged;
  const items = merged.items.map((item) => {
    const prevIdx = previous.items.findIndex((p) => itemsMatch(p, item));
    if (prevIdx < 0) return item;
    if (mentionedIndices.has(prevIdx)) return item;
    const prev = previous.items[prevIdx];
    return {
      ...item,
      weight_g_mean: prev.weight_g_mean,
      weight_g_min: prev.weight_g_min,
      weight_g_max: prev.weight_g_max,
    };
  });
  return { ...merged, items };
}

/**
 * Мержит новый разбор от LLM с сохранённым. Первое сообщение = полный parse.
 * Последующие = merge: обновляем совпадающие (вес — из более точной оценки), добавляем новые, сохраняем забытые LLM.
 */
function mergeParse(
  previous: ParseResult,
  incoming: ParseResult,
  options?: { carryForwardUnmatched?: boolean },
): ParseResult {
  const carryForward = options?.carryForwardUnmatched ?? true;
  const resultItems: ParsedComponent[] = [];
  const matchedPrevious = new Set<number>();

  for (const newItem of incoming.items) {
    const prevIndex = previous.items.findIndex(
      (p, i) => !matchedPrevious.has(i) && itemsMatch(p, newItem),
    );
    if (prevIndex >= 0) {
      matchedPrevious.add(prevIndex);
      resultItems.push(mergeMatchedItem(previous.items[prevIndex], newItem));
    } else {
      resultItems.push(newItem);
    }
  }

  if (carryForward) {
    for (let i = 0; i < previous.items.length; i++) {
      if (!matchedPrevious.has(i)) {
        resultItems.push(previous.items[i]);
      }
    }
  }

  return {
    items: resultItems,
    overall_confidence: incoming.overall_confidence,
    notes: incoming.notes,
  };
}

function normalizeDraftConversation(
  raw: unknown,
): DraftConversationStoredEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: DraftConversationStoredEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as DraftConversationStoredEntry;
    if (
      (candidate.role !== "user" && candidate.role !== "assistant") ||
      typeof candidate.text !== "string"
    ) {
      continue;
    }
    entries.push({
      role: candidate.role,
      text: candidate.text,
      photoFileId: candidate.photoFileId ?? null,
    });
  }
  return entries;
}

function buildDraftText(conversation: DraftConversationStoredEntry[]): string {
  return conversation
    .filter((entry) => entry.role === "user")
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .join(". ");
}

function capDraftConversationByLimits(
  conversation: DraftConversationStoredEntry[],
): DraftConversationStoredEntry[] {
  const max = config.draft.maxMessages;
  if (max <= 0 || conversation.length <= max) return conversation;
  return conversation.slice(-max);
}

function countDraftImages(
  conversation: DraftConversationStoredEntry[],
): number {
  return conversation.filter((e) => e.photoFileId).length;
}

async function resolveConversationImageUrls(
  bot: TelegramBot,
  conversation: DraftConversationStoredEntry[],
): Promise<
  Array<{ role: "user" | "assistant"; text: string; imageUrl?: string | null }>
> {
  const result: Array<{
    role: "user" | "assistant";
    text: string;
    imageUrl?: string | null;
  }> = [];
  for (const entry of conversation) {
    if (entry.role === "assistant") {
      result.push({ role: "assistant", text: entry.text });
      continue;
    }
    let imageUrl: string | undefined;
    if (entry.photoFileId) {
      try {
        imageUrl = await bot.getFileLink(entry.photoFileId);
      } catch {
        imageUrl = undefined;
      }
    }
    result.push({
      role: "user",
      text: entry.text,
      imageUrl,
    });
  }
  return result;
}

function getLatestUserText(
  conversation: DraftConversationStoredEntry[],
): string | null {
  for (let i = conversation.length - 1; i >= 0; i -= 1) {
    const entry = conversation[i];
    if (entry.role === "user" && entry.text.trim()) {
      return entry.text.trim();
    }
  }
  return null;
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOverrideKey(value: string): string {
  return normalizeName(value);
}

function parseNumber(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

type UserOverridesMap = Record<string, UserOverride>;

function normalizeUserOverrides(raw: unknown): UserOverridesMap {
  if (!raw || typeof raw !== "object") return {};
  const data = raw as UserOverridesMap;
  const result: UserOverridesMap = {};
  for (const [key, value] of Object.entries(data)) {
    if (!key || !value || typeof value !== "object") continue;
    result[key] = value;
  }
  return result;
}

function hasMacroOverrides(value: UserOverride | undefined): boolean {
  if (!value) return false;
  return Boolean(
    value.kcalPer100g ??
    value.proteinPer100g ??
    value.fatPer100g ??
    value.carbsPer100g,
  );
}

function mergeOverrides(
  base: UserOverridesMap,
  additions: UserOverridesMap,
): UserOverridesMap {
  const result: UserOverridesMap = { ...base };

  for (const [key, value] of Object.entries(additions)) {
    const current = result[key] ?? {};
    const merged: UserOverride = { ...current };
    if (merged.kcalPer100g === undefined && value.kcalPer100g !== undefined) {
      merged.kcalPer100g = value.kcalPer100g;
    }
    if (
      merged.proteinPer100g === undefined &&
      value.proteinPer100g !== undefined
    ) {
      merged.proteinPer100g = value.proteinPer100g;
    }
    if (merged.fatPer100g === undefined && value.fatPer100g !== undefined) {
      merged.fatPer100g = value.fatPer100g;
    }
    if (merged.carbsPer100g === undefined && value.carbsPer100g !== undefined) {
      merged.carbsPer100g = value.carbsPer100g;
    }
    if (
      merged.weight_g_mean === undefined &&
      value.weight_g_mean !== undefined
    ) {
      merged.weight_g_mean = value.weight_g_mean;
    }
    if (merged.weight_g_min === undefined && value.weight_g_min !== undefined) {
      merged.weight_g_min = value.weight_g_min;
    }
    if (merged.weight_g_max === undefined && value.weight_g_max !== undefined) {
      merged.weight_g_max = value.weight_g_max;
    }
    if (hasMacroOverrides(value) && !hasMacroOverrides(current)) {
      merged.source = value.source;
    } else if (current.source) {
      merged.source = current.source;
    }
    result[key] = merged;
  }

  return result;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * Deterministic weight-only extraction from user text.
 * Nutritional overrides (kcal, protein, fat, carbs) are handled by
 * the LLM via user_* fields in ParsedComponent — NOT parsed here.
 */
function extractWeightOverridesFromText(text: string): Array<{
  key: string;
  override: UserOverride;
}> {
  const segments = text
    .split(/[;,\n]/g)
    .map((part) => part.trim())
    .filter(Boolean);
  const overrides: Array<{ key: string; override: UserOverride }> = [];

  for (const segment of segments) {
    const nameMatch = segment.match(
      /^([^0-9]+?)(?:\s+\d)/i,
    );
    let name = nameMatch ? nameMatch[1].trim() : "";
    if (!name) continue;

    let weight: number | null = null;
    const weightRegex = /(\d+(?:[.,]\d+)?)\s*г(рамм|)?/giu;
    for (const match of segment.matchAll(weightRegex)) {
      const value = parseNumber(match[1]);
      if (value === null) continue;
      const prefix = segment.slice(0, match.index ?? 0);
      if (/на\s*100\s*$/iu.test(prefix) && value === 100) continue;
      if (/\/\s*100\s*$/iu.test(prefix) && value === 100) continue;
      weight = value;
      break;
    }
    if (weight === null) {
      const mlRegex = /(\d+(?:[.,]\d+)?)\s*мл/giu;
      for (const match of segment.matchAll(mlRegex)) {
        const value = parseNumber(match[1]);
        if (value === null) continue;
        weight = value;
        break;
      }
    }
    if (weight === null) {
      const literRegex = /(\d+(?:[.,]\d+)?)\s*л(итр(а|ов)?)?/giu;
      for (const match of segment.matchAll(literRegex)) {
        const value = parseNumber(match[1]);
        if (value === null) continue;
        weight = value * 1000;
        break;
      }
    }

    if (weight === null) continue;

    const override: UserOverride = {
      source: "user",
      weight_g_mean: weight,
      weight_g_min: weight,
      weight_g_max: weight,
    };
    overrides.push({ key: normalizeOverrideKey(name), override });
  }

  return overrides;
}

/* ── Stem-based fuzzy matching helpers ── */

const FOOD_SYNONYMS: [string, string][] = [
  ["картош", "картофел"],
  ["помидор", "томат"],
];

function stemMatchTokens(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 3 && longer.startsWith(shorter)) return true;
  if (a.length >= 4 && b.length >= 4) {
    const stemLen = Math.min(a.length, b.length) - 1;
    if (stemLen >= 4 && a.substring(0, stemLen) === b.substring(0, stemLen))
      return true;
  }
  for (const [s1, s2] of FOOD_SYNONYMS) {
    if (
      (a.startsWith(s1) && b.startsWith(s2)) ||
      (a.startsWith(s2) && b.startsWith(s1))
    )
      return true;
  }
  return false;
}

function findBestMatchingItem(
  fragment: string,
  items: ParsedComponent[],
): number {
  const normalizedFragment = normalizeToken(fragment);
  if (!normalizedFragment || normalizedFragment.length < 2) return -1;

  let bestIdx = -1;
  let bestScore = 0;
  let tiedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const label = normalizeToken(item.display_label);
    const canonical = normalizeToken(item.canonical_name.replace(/_/g, " "));
    const combined = `${label} ${canonical}`;

    let score = 0;

    if (
      combined.includes(normalizedFragment) ||
      normalizedFragment.includes(label)
    ) {
      score = 1000 + normalizedFragment.length;
    } else {
      const fragTokens = normalizedFragment
        .split(/\s+/)
        .filter((t) => t.length >= 3);
      const itemTokens = combined.split(/\s+/).filter((t) => t.length >= 3);
      let matches = 0;
      for (const ft of fragTokens) {
        for (const it of itemTokens) {
          if (stemMatchTokens(ft, it)) {
            matches++;
            break;
          }
        }
      }
      if (matches > 0 && matches / Math.max(fragTokens.length, 1) >= 0.5) {
        score = matches;
      }
    }

    if (score > 0 && score > bestScore) {
      bestScore = score;
      bestIdx = i;
      tiedCount = 1;
    } else if (score > 0 && score === bestScore) {
      tiedCount++;
    }
  }

  if (tiedCount > 1) return -1;
  return bestIdx;
}

/* ── Targeted negation parsing ── */

/**
 * Слова, которые в «без X» описывают способ приготовления (курица без кожи, рыба без костей),
 * а не отдельные ингредиенты для удаления. Такие цели игнорируем, чтобы не удалить весь продукт.
 */
const DESCRIPTIVE_PREPARATION_PREFIXES = ["кож", "кост", "шкур", "плёнк"];

function isDescriptivePreparation(target: string): boolean {
  const t = normalizeToken(target);
  if (!t || t.length < 3) return false;
  return DESCRIPTIVE_PREPARATION_PREFIXES.some((prefix) =>
    t.startsWith(prefix),
  );
}

function extractNegationTargets(text: string): string[] {
  const targets: string[] = [];

  const prefixPatterns: Array<{ pattern: RegExp; skipDescriptive?: boolean }> =
    [
      {
        pattern:
          /(?:убери|убрать|убра\w*|удали|удалить|удал\w*|исключи|исключить)\s+(.+?)(?:\s*[,;.]|$)/giu,
      },
      { pattern: /без\s+(.+?)(?:\s*[,;.]|$)/giu, skipDescriptive: true },
      {
        pattern:
          /не\s+(?:ел[аи]?|ем|ешь|ест|пил[аи]?|пью|пьёт|пьет|пьём|пьем|пьют)\s+(.+?)(?:\s*[,;.]|$)/giu,
      },
      { pattern: /не\s+(?:считай|учитывай)\s+(.+?)(?:\s*[,;.]|$)/giu },
      { pattern: /(?:чужой|чужая|чужое|чужие)\s+(.+?)(?:\s*[,;.]|$)/giu },
    ];

  for (const { pattern, skipDescriptive } of prefixPatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const target = match[1]?.trim();
      if (target && (!skipDescriptive || !isDescriptivePreparation(target))) {
        targets.push(target);
      }
    }
  }

  const suffixPatterns = [
    /(.+?)\s+(?:убери|убрать|убра\w*|удали|удалить|удал\w*)\b/giu,
  ];

  for (const pattern of suffixPatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const candidate = match[1]?.trim();
      if (candidate && !targets.includes(candidate)) targets.push(candidate);
    }
  }

  return targets;
}

function applyUserNegations(
  parse: ParseResult,
  latestUserText: string | null,
): ParseResult {
  if (!latestUserText) return parse;
  if (parse.items.length === 0) return parse;

  const targets = extractNegationTargets(latestUserText);
  if (targets.length === 0) return parse;

  const subTargets = targets.flatMap((t) =>
    t
      .split(/\s*(?:,|;|\sи\s)\s*/g)
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const removeIndices = new Set<number>();
  for (const target of subTargets) {
    const idx = findBestMatchingItem(target, parse.items);
    if (idx >= 0) removeIndices.add(idx);
  }

  if (removeIndices.size === 0) return parse;

  const filteredItems = parse.items.filter((_, idx) => !removeIndices.has(idx));
  if (filteredItems.length === 0) {
    console.warn(
      "[applyUserNegations] Negations would empty items, reverting. " +
      `text="${latestUserText?.slice(0, 80)}" targets=[${subTargets.join(", ")}]`,
    );
    return parse;
  }
  return { ...parse, items: filteredItems };
}

function wordToNumber(value: string): number | null {
  const normalized = normalizeToken(value);
  const map: Record<string, number> = {
    один: 1,
    одна: 1,
    одно: 1,
    два: 2,
    две: 2,
    три: 3,
    четыре: 4,
    пять: 5,
    шесть: 6,
    семь: 7,
    восемь: 8,
    девять: 9,
    десять: 10,
  };
  return map[normalized] ?? null;
}

function parseCountValue(value: string): number | null {
  const numeric = parseNumber(value);
  if (numeric !== null) return Math.round(numeric);
  return wordToNumber(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractCountFromLabel(label: string): number | null {
  const match = label.match(/(\d+)\s*(шт\.?|штук|кусочк\w*)/iu);
  if (!match) return null;
  return parseCountValue(match[1]);
}

function normalizeUnitLabel(unit: string, count: number): string {
  const normalized = normalizeToken(unit);
  if (normalized.startsWith("шт")) return "шт.";
  if (normalized.startsWith("кусочк")) {
    if (count > 4 || count === 0) return "кусочков";
    return "кусочка";
  }
  return unit.trim();
}

function applyCountOverridesFromText(
  parse: ParseResult,
  latestUserText: string | null,
): ParseResult {
  if (!latestUserText) return parse;
  const normalizedText = normalizeToken(latestUserText);
  if (!normalizedText) return parse;
  const itemKeyCounts = new Map<string, number>();
  for (const item of parse.items) {
    const key =
      normalizeOverrideKey(item.canonical_name) ||
      normalizeOverrideKey(item.display_label);
    itemKeyCounts.set(key, (itemKeyCounts.get(key) ?? 0) + 1);
  }

  const items = parse.items.map((item) => {
    const tokens = Array.from(
      new Set(
        normalizeToken(
          `${item.display_label} ${item.canonical_name.replace(/_/g, " ")}`,
        )
          .split(" ")
          .filter((token) => token.length > 2),
      ),
    );
    if (tokens.length === 0) return item;

    let foundCount: number | null = null;
    let foundUnit = "шт.";
    const countToken =
      "(\\d+|один|одна|одно|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять)";
    const unitToken = "(шт\\.?|штук|кусочк\\w*)";
    for (const token of tokens) {
      const escaped = escapeRegExp(token);
      const forward = new RegExp(
        `${escaped}\\D{0,12}${countToken}\\s*${unitToken}`,
        "iu",
      );
      const backward = new RegExp(
        `${countToken}\\s*${unitToken}\\D{0,12}${escaped}`,
        "iu",
      );
      const match =
        normalizedText.match(forward) ?? normalizedText.match(backward);
      if (match) {
        const count = parseCountValue(match[1]);
        if (typeof count === "number" && count > 0) {
          foundCount = count;
          foundUnit = match[2] ?? foundUnit;
          break;
        }
      }
    }
    if (!foundCount) return item;

    const oldCount = extractCountFromLabel(item.display_label);
    const itemKey =
      normalizeOverrideKey(item.canonical_name) ||
      normalizeOverrideKey(item.display_label);
    const matchesCount = itemKeyCounts.get(itemKey) ?? 0;
    if (!oldCount && matchesCount > 1) {
      return item;
    }
    const unitLabel = normalizeUnitLabel(foundUnit, foundCount);
    let nextLabel = item.display_label;
    const wordCountPattern =
      /(один|одна|одно|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять)\s*(шт\.?|штук|кусочк\w*)/iu;
    if (/(\d+)\s*(шт\.?|штук|кусочк\w*)/iu.test(nextLabel)) {
      nextLabel = nextLabel.replace(
        /(\d+)\s*(шт\.?|штук|кусочк\w*)/iu,
        `${foundCount} ${unitLabel}`,
      );
    } else if (wordCountPattern.test(nextLabel)) {
      nextLabel = nextLabel.replace(
        wordCountPattern,
        `${foundCount} ${unitLabel}`,
      );
    } else {
      nextLabel = `${nextLabel} (${foundCount} ${unitLabel})`;
    }

    if (!oldCount || oldCount <= 0) {
      if (
        item.weight_g_mean === null &&
        item.weight_g_min === null &&
        item.weight_g_max === null
      ) {
        const perPiece = normalizeToken(foundUnit).startsWith("кусочк")
          ? 20
          : 60;
        const mean = foundCount * perPiece;
        return {
          ...item,
          display_label: nextLabel,
          weight_g_mean: mean,
          weight_g_min: Math.max(5, Math.round(mean * 0.5)),
          weight_g_max: Math.round(mean * 1.4),
        };
      }
      return { ...item, display_label: nextLabel };
    }
    const ratio = foundCount / oldCount;
    const scale = (value: number | null) =>
      typeof value === "number" ? value * ratio : value;
    let weightMean = scale(item.weight_g_mean);
    let weightMin = scale(item.weight_g_min);
    let weightMax = scale(item.weight_g_max);
    if (normalizeToken(unitLabel).startsWith("кусочк") && foundCount > 0) {
      const maxPerPiece = 50;
      const minPerPiece = 15;
      const meanPerPiece = 30;
      const capMean =
        typeof weightMean === "number"
          ? Math.min(weightMean, foundCount * meanPerPiece)
          : foundCount * meanPerPiece;
      const capMin =
        typeof weightMin === "number"
          ? Math.min(weightMin, foundCount * minPerPiece)
          : foundCount * minPerPiece;
      const capMax =
        typeof weightMax === "number"
          ? Math.min(weightMax, foundCount * maxPerPiece)
          : foundCount * maxPerPiece;
      weightMean = capMean;
      weightMin = capMin;
      weightMax = capMax;
    }
    return {
      ...item,
      display_label: nextLabel,
      weight_g_mean: weightMean,
      weight_g_min: weightMin,
      weight_g_max: weightMax,
    };
  });
  return { ...parse, items };
}

function applyReplacementFromText(
  parse: ParseResult,
  latestUserText: string | null,
): ParseResult {
  if (!latestUserText) return parse;
  const match = latestUserText.match(
    /(?:это\s+)?не\s+([^,;.]+?)\s*,?\s*а\s+([^,;.]+)/iu,
  );
  if (!match) return parse;
  const fromText = match[1]?.trim();
  const toText = match[2]?.trim();
  if (!fromText || !toText) return parse;
  const fromTokens = normalizeToken(fromText)
    .split(" ")
    .filter((token) => token.length > 2);
  if (fromTokens.length === 0) return parse;
  const targetKey = normalizeOverrideKey(toText);
  const items = [...parse.items];
  const index = items.findIndex((item) => {
    const label = normalizeToken(item.display_label);
    const canonical = normalizeToken(item.canonical_name.replace(/_/g, " "));
    return fromTokens.some(
      (token) => label.includes(token) || canonical.includes(token),
    );
  });
  if (index === -1) return parse;
  const target = items[index];
  const normalizedTo = toText.replace(/\s+/g, " ").trim();
  if (
    normalizeOverrideKey(target.display_label) === targetKey ||
    normalizeOverrideKey(target.canonical_name) === targetKey
  ) {
    return parse;
  }
  items[index] = {
    ...target,
    canonical_name: normalizeName(normalizedTo),
    display_label: normalizedTo,
    confidence: "LOW",
    confidence_reasons: null,
  };
  return { ...parse, items };
}

function applyTextAdjustments(
  parse: ParseResult,
  latestUserText: string | null,
): ParseResult {
  let updated = applyReplacementFromText(parse, latestUserText);
  updated = applyCountOverridesFromText(updated, latestUserText);
  return updated;
}

/** Точечная правка: пользователь указывает один продукт и «чуть меньше/больше» или точный вес. */
function isPointCorrection(text: string | null): boolean {
  if (!text || text.length > 200) return false;
  const t = text.trim().toLowerCase();
  if (/[;]/.test(t) || (t.includes(" и ") && /\d+\s*г/.test(t))) return false;
  if (/почти\s+угадал|угадал\s*,?\s*там\s+чуть/.test(t)) return true;
  if (/чуть[- ]?чуть\s+(меньше|больше)|чуть\s+(меньше|больше)/.test(t))
    return true;
  const explicitWeight = /^[^\d]+\d+\s*г\b/im.test(t);
  if (explicitWeight && !t.includes(",") && !t.includes(";")) return true;
  if (/^(?:добавь|добавить|плюс|ещё|еще)\s+/iu.test(t) && /\d+\s*г/i.test(t))
    return true;
  if (/^(?:там\s+)?(?:ещё|еще)\s+/iu.test(t)) return true;
  return false;
}

/* ── Deterministic correction system ── */

type CorrectionAction =
  | { type: "set_weight"; itemIdx: number; weight: number }
  | { type: "adjust_weight"; itemIdx: number; factor: number }
  | { type: "remove"; itemIdx: number };

function splitByConnectors(text: string): string[] {
  return text
    .split(/\s*(?:[,;]|\sи\s)\s*/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

function parseRemovalAction(
  part: string,
  items: ParsedComponent[],
): CorrectionAction | null {
  const patterns = [
    /^(?:убери|убрать|убра\w*|удали|удалить|удал\w*|исключи|исключить)\s+(.+)/iu,
    /^без\s+(.+)/iu,
    /^не\s+(?:ел[аи]?|ем|ешь|ест|пил[аи]?|пью|пьёт|пьет)\s+(.+)/iu,
    /(.+?)\s+(?:убери|убрать|убра\w*|удали|удалить|удал\w*)$/iu,
  ];
  for (const pattern of patterns) {
    const match = part.match(pattern);
    if (match) {
      const target = match[1].trim();
      const idx = findBestMatchingItem(target, items);
      if (idx >= 0) return { type: "remove", itemIdx: idx };
    }
  }
  return null;
}

function parseAbsoluteWeightAction(
  part: string,
  items: ParsedComponent[],
): CorrectionAction | null {
  const match = part.match(
    /(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:г(?:рамм(?:ов)?)?|мл)\b/iu,
  );
  if (!match) return null;
  const name = match[1].trim();
  const weight = parseFloat(match[2].replace(",", "."));
  if (!weight || weight <= 0) return null;
  const idx = findBestMatchingItem(name, items);
  if (idx < 0) return null;
  return { type: "set_weight", itemIdx: idx, weight };
}

function parseRelativeWeightAction(
  part: string,
  items: ParsedComponent[],
): CorrectionAction | null {
  const patterns: Array<{ pattern: RegExp; factor: number; group: number }> = [
    {
      pattern: /(.+?)\s+чуть[- ]?чуть\s+(?:по)?меньше/iu,
      factor: 0.85,
      group: 1,
    },
    { pattern: /(.+?)\s+чуть\s+(?:по)?меньше/iu, factor: 0.85, group: 1 },
    { pattern: /(.+?)\s+(?:по)?меньше/iu, factor: 0.8, group: 1 },
    {
      pattern: /(.+?)\s+чуть[- ]?чуть\s+(?:по)?больше/iu,
      factor: 1.15,
      group: 1,
    },
    { pattern: /(.+?)\s+чуть\s+(?:по)?больше/iu, factor: 1.15, group: 1 },
    { pattern: /(.+?)\s+(?:по)?больше/iu, factor: 1.2, group: 1 },
    { pattern: /(?:по)?меньше\s+(.+)/iu, factor: 0.8, group: 1 },
    {
      pattern: /чуть[- ]?чуть\s+(?:по)?меньше\s+(.+)/iu,
      factor: 0.85,
      group: 1,
    },
    { pattern: /(?:по)?больше\s+(.+)/iu, factor: 1.2, group: 1 },
    {
      pattern: /чуть[- ]?чуть\s+(?:по)?больше\s+(.+)/iu,
      factor: 1.15,
      group: 1,
    },
  ];
  for (const { pattern, factor, group } of patterns) {
    const match = part.match(pattern);
    if (match) {
      const target = match[group]?.trim();
      if (!target) continue;
      const idx = findBestMatchingItem(target, items);
      if (idx >= 0) return { type: "adjust_weight", itemIdx: idx, factor };
    }
  }
  return null;
}

function parseDeterministicCorrections(
  text: string,
  items: ParsedComponent[],
): CorrectionAction[] | null {
  if (!text || text.length > 200) return null;

  const parts = splitByConnectors(text);
  if (parts.length === 0) return null;

  const actions: CorrectionAction[] = [];
  let lastWasRemoval = false;

  for (const part of parts) {
    const removal = parseRemovalAction(part, items);
    if (removal) {
      actions.push(removal);
      lastWasRemoval = true;
      continue;
    }
    const weightSet = parseAbsoluteWeightAction(part, items);
    if (weightSet) {
      actions.push(weightSet);
      lastWasRemoval = false;
      continue;
    }
    const adjust = parseRelativeWeightAction(part, items);
    if (adjust) {
      actions.push(adjust);
      lastWasRemoval = false;
      continue;
    }
    if (lastWasRemoval) {
      const idx = findBestMatchingItem(part, items);
      if (idx >= 0) {
        actions.push({ type: "remove", itemIdx: idx });
        continue;
      }
    }
    return null;
  }
  return actions.length > 0 ? actions : null;
}

function applyDeterministicCorrections(
  parse: ParseResult,
  actions: CorrectionAction[],
): ParseResult {
  const removeSet = new Set<number>();
  const items = parse.items.map((item, idx) => {
    const action = actions.find((a) => a.itemIdx === idx);
    if (!action) return item;
    if (action.type === "remove") {
      removeSet.add(idx);
      return item;
    }
    if (action.type === "set_weight") {
      return {
        ...item,
        weight_g_mean: action.weight,
        weight_g_min: Math.round(action.weight * 0.9),
        weight_g_max: Math.round(action.weight * 1.1),
      };
    }
    if (action.type === "adjust_weight") {
      return {
        ...item,
        weight_g_mean:
          item.weight_g_mean != null
            ? Math.round(item.weight_g_mean * action.factor)
            : null,
        weight_g_min:
          item.weight_g_min != null
            ? Math.round(item.weight_g_min * action.factor)
            : null,
        weight_g_max:
          item.weight_g_max != null
            ? Math.round(item.weight_g_max * action.factor)
            : null,
      };
    }
    return item;
  });
  return { ...parse, items: items.filter((_, idx) => !removeSet.has(idx)) };
}

const RISK_PATTERNS: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /жарен|фритюр|масл|майонез|соус|сливочн/iu, score: 3 },
  { pattern: /орех|шоколад|сыр|сосиск|колбас|бекон|сало/iu, score: 3 },
  { pattern: /бургер|пицц|шаурм|выпечк|пирож|торт|морожен|чипс/iu, score: 2 },
  { pattern: /прожарк|подлив|заправк|панировк/iu, score: 2 },
  { pattern: /макарон|паста|лапша|рис|картоф|хлеб/iu, score: 1 },
];

const LOW_CALORIE_CLARIFICATION_PATTERNS = [
  /огурец|cucumber/iu,
  /помидор|томат|tomato/iu,
  /редис|radish|редиска/iu,
  /сельдерей|celery/iu,
  /листья|lettuce|leafy|руккол|петрушк|укроп|базилик|зелень/iu,
];

function isLowCalorieForClarification(label: string): boolean {
  const text = `${label} `.toLowerCase();
  return LOW_CALORIE_CLARIFICATION_PATTERNS.some((p) => p.test(text));
}

function riskScoreForText(text: string): number {
  let score = 0;
  for (const entry of RISK_PATTERNS) {
    if (entry.pattern.test(text)) {
      score += entry.score;
    }
    entry.pattern.lastIndex = 0;
  }
  return score;
}

function riskScoreForItem(item: ParsedComponent): number {
  const text = normalizeToken(
    `${item.display_label} ${item.canonical_name.replace(/_/g, " ")}`,
  );
  return riskScoreForText(text);
}

function sortParseByRisk(parse: ParseResult): ParseResult {
  const items = parse.items
    .map((item, index) => ({
      item,
      index,
      score: riskScoreForItem(item),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
  return { ...parse, items };
}

function sortResolvedByRisk(
  resolved: ResolvedComponent[],
): ResolvedComponent[] {
  return resolved
    .map((entry, index) => ({
      entry,
      index,
      score: riskScoreForItem(entry.component),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    })
    .map((entry) => entry.entry);
}

function prioritizeMissingReferences(
  parse: ParseResult,
  missingReferences: string[],
): string[] {
  if (missingReferences.length === 0) return [];
  const indexed = missingReferences.map((name, index) => {
    const key = normalizeOverrideKey(name);
    const match =
      parse.items.find(
        (item) =>
          normalizeOverrideKey(item.display_label) === key ||
          normalizeOverrideKey(item.canonical_name) === key,
      ) ?? null;
    const score = match ? riskScoreForItem(match) : 0;
    return { name, index, score };
  });
  return indexed
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    })
    .map((entry) => entry.name)
    .slice(0, 2);
}

function selectRiskyClarificationItems(parse: ParseResult): string[] {
  const candidates = parse.items
    .map((item, index) => {
      const score = riskScoreForItem(item);
      if (score <= 0) return null;
      const min =
        typeof item.weight_g_min === "number" ? item.weight_g_min : null;
      const max =
        typeof item.weight_g_max === "number" ? item.weight_g_max : null;
      const hasRange = min !== null && max !== null;
      const spread = hasRange
        ? max - min
        : item.weight_g_mean === null
          ? 999
          : 0;
      const lowConfidence = item.confidence === "LOW";
      if (!lowConfidence && spread < 150) return null;
      return {
        label: item.display_label.trim(),
        score,
        spread,
        index,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        label: string;
        score: number;
        spread: number;
        index: number;
      } => Boolean(entry),
    );
  return candidates
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.spread !== a.spread) return b.spread - a.spread;
      return a.index - b.index;
    })
    .map((entry) => entry.label)
    .filter((label, idx, list) => list.indexOf(label) === idx)
    .slice(0, 2);
}

function findOverrideForItem(
  item: { canonical_name: string; display_label: string },
  overrides: UserOverridesMap,
  totalItems: number,
): UserOverride | undefined {
  const keyC = normalizeOverrideKey(item.canonical_name);
  const keyL = normalizeOverrideKey(item.display_label);
  const direct = overrides[keyC] ?? overrides[keyL];
  if (direct) return direct;

  const namedKeys = Object.keys(overrides).filter((k) => k !== "");
  const itemTokens = Array.from(
    new Set(
      `${keyC} ${keyL}`.split("_").filter((t) => t.length >= 3),
    ),
  );
  if (itemTokens.length > 0) {
    for (const oKey of namedKeys) {
      const oTokens = oKey.split("_").filter((t) => t.length >= 3);
      if (oTokens.length === 0) continue;
      const matches = oTokens.filter((ot) =>
        itemTokens.some((it) => {
          if (it === ot) return true;
          if (it.length < 3 || ot.length < 3) return false;
          const shorter = it.length <= ot.length ? it : ot;
          const longer = it.length <= ot.length ? ot : it;
          if (longer.startsWith(shorter)) return true;
          const stemLen = Math.min(it.length, ot.length) - 1;
          return stemLen >= 3 && it.substring(0, stemLen) === ot.substring(0, stemLen);
        }),
      );
      if (matches.length > 0 && matches.length / oTokens.length >= 0.5) {
        return overrides[oKey];
      }
    }
  }

  if (totalItems === 1) {
    if (namedKeys.length === 1) return overrides[namedKeys[0]];
    if (overrides[""]) return overrides[""];
  }
  return undefined;
}

function applyOverridesToParse(
  parse: ParseResult,
  overrides: UserOverridesMap,
): ParseResult {
  if (parse.items.length === 0) return parse;
  const items = parse.items.map((item) => {
    const override = findOverrideForItem(item, overrides, parse.items.length);
    if (!override) return item;
    return {
      ...item,
      weight_g_mean: override.weight_g_mean ?? item.weight_g_mean,
      weight_g_min: override.weight_g_min ?? item.weight_g_min,
      weight_g_max: override.weight_g_max ?? item.weight_g_max,
    };
  });
  return { ...parse, items };
}

async function deleteMessageSafe(
  bot: TelegramBot,
  chatId: string,
  messageId: number,
) {
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch {
    return;
  }
}

async function clearErrorMessage(
  bot: TelegramBot,
  chatId: string,
  user: { id: number; lastErrorMessageId: number | null },
) {
  if (!user.lastErrorMessageId) return;
  await deleteMessageSafe(bot, chatId, user.lastErrorMessageId);
  await db.user.update({
    where: { id: user.id },
    data: { lastErrorMessageId: null },
  });
}

async function sendErrorMessage(
  bot: TelegramBot,
  chatId: string,
  user: { id: number; lastErrorMessageId: number | null },
  text: string,
  options?: { replyMarkup?: Awaited<ReturnType<typeof mainKeyboardMarkup>> },
): Promise<void> {
  if (user.lastErrorMessageId) {
    await deleteMessageSafe(bot, chatId, user.lastErrorMessageId);
  }
  const message = await sendLoggedMessage(bot, {
    userId: user.id,
    chatId,
    text,
    options: options?.replyMarkup ?? (await mainKeyboardMarkup(user.id)),
    messageType: "SYSTEM",
  });
  await db.user.update({
    where: { id: user.id },
    data: { lastErrorMessageId: message.message_id },
  });
}

async function sendStatsMessage(
  bot: TelegramBot,
  chatId: string,
  user: { id: number },
  text: string,
) {
  const message = await sendLoggedMessage(bot, {
    userId: user.id,
    chatId,
    text,
    options: await mainKeyboardMarkup(user.id),
    messageType: "TEXT",
  });
  await db.user.update({
    where: { id: user.id },
    data: { lastStatsMessageId: message.message_id },
  });
}

async function clearDraft(userId: number) {
  await db.draftMeal.deleteMany({ where: { userId } });
}

async function createDraft(
  userId: number,
  text: string | null,
  photoFileId: string | null,
  draftConversation?: DraftConversationStoredEntry[],
) {
  await clearDraft(userId);
  return db.draftMeal.create({
    data: {
      userId,
      text,
      photoFileId,
      status: "DRAFT_MEAL",
      draftConversation: draftConversation ?? undefined,
    },
  });
}

async function getDraft(userId: number) {
  return db.draftMeal.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

function isPendingExpired(draft: {
  llmPending: boolean;
  llmPendingStartedAt: Date | null;
}) {
  if (!draft.llmPending) return false;
  if (!draft.llmPendingStartedAt) return true;
  const elapsed = Date.now() - draft.llmPendingStartedAt.getTime();
  return elapsed > LLM_PENDING_TIMEOUT_MS;
}

async function clearPending(draftId: number) {
  await db.draftMeal.updateMany({
    where: { id: draftId },
    data: { llmPending: false, llmPendingStartedAt: null },
  });
  // updateMany не бросает ошибку, если запись не найдена (race/deletion)
}

async function trySetPending(draftId: number): Promise<boolean> {
  const updated = await db.draftMeal.updateMany({
    where: { id: draftId, llmPending: false },
    data: { llmPending: true, llmPendingStartedAt: new Date() },
  });
  return updated.count > 0;
}

async function updateDraftConversation(
  draftId: number,
  conversation: DraftConversationStoredEntry[],
  mergedText: string,
  photoFileId: string | null | undefined,
) {
  await db.draftMeal.update({
    where: { id: draftId },
    data: {
      draftConversation: conversation,
      text: mergedText,
      photoFileId: photoFileId ?? undefined,
      pendingQuestion: null,
    },
  });
}

async function updateDraftOverrides(
  draftId: number,
  overrides: UserOverridesMap,
) {
  await db.draftMeal.update({
    where: { id: draftId },
    data: { userOverrides: overrides },
  });
}

function validateFoodReferenceValues(item: {
  name?: string;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
  carbs_per_100g: number | null;
}): boolean {
  const p = item.protein_per_100g;
  const f = item.fat_per_100g;
  const c = item.carbs_per_100g;
  const k = item.kcal_per_100g;
  if (p !== null && (p < 0 || p > 100)) return false;
  if (f !== null && (f < 0 || f > 100)) return false;
  if (c !== null && (c < 0 || c > 100)) return false;
  if (k !== null && (k < 0 || k > 900)) return false;
  if (p !== null && f !== null && c !== null && p + f + c > 110) return false;
  if (k !== null && p !== null && f !== null && c !== null) {
    const calc = p * 4 + f * 9 + c * 4;
    if (calc > 0 && Math.abs(k - calc) / calc > 0.4) return false;
  }
  if (f !== null && f >= 70) {
    const name = (item.name ?? "").toLowerCase();
    if (
      !/масл|oil|butter|сливочн|жир|сало|маргарин|lard|ghee|шпик/iu.test(name)
    ) {
      return false;
    }
  }
  return true;
}

async function persistLlmFoodReference(item: {
  name: string;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
  carbs_per_100g: number | null;
}): Promise<void> {
  const canonicalName = normalizeName(item.name);
  if (!canonicalName || canonicalName === "unknown_generic") return;

  const existing = await db.foodReference.findUnique({
    where: { canonicalName },
  });
  if (existing) return;

  const llmSource = await db.foodSource.findUnique({
    where: { name: "LLM-generated" },
  });
  if (!llmSource) return;

  const protein = item.protein_per_100g ?? 0;
  const fat = item.fat_per_100g ?? 0;
  const carbs = item.carbs_per_100g ?? 0;
  const kcal = item.kcal_per_100g ?? Math.round(protein * 4 + fat * 9 + carbs * 4);

  await db.foodReference.create({
    data: {
      canonicalName,
      displayLabel: item.name.trim(),
      kcalPer100g: kcal,
      proteinPer100g: protein,
      fatPer100g: fat,
      carbsPer100g: carbs,
      sourceId: llmSource.id,
      verified: false,
      dataCompleteness: item.protein_per_100g != null && item.fat_per_100g != null && item.carbs_per_100g != null ? 0.7 : 0.3,
    },
  });

  foodResolver.invalidateCache();
}

async function estimateDraft(
  bot: TelegramBot,
  chatId: string,
  draft: { id: number; userId: number; parsedJson?: ParseResult | null },
  conversation: DraftConversationStoredEntry[],
  overrides: UserOverridesMap,
  conversationWithUrls: Array<{
    role: "user" | "assistant";
    text: string;
    imageUrl?: string | null;
  }>,
) {
  if (!(await canEstimate(draft.userId))) {
    await sendLoggedMessage(bot, {
      userId: draft.userId,
      chatId,
      text: "Достигнут дневной лимит запросов. Попробуй завтра.",
      options: await mainKeyboardMarkup(draft.userId),
      messageType: "SYSTEM",
    });
    return;
  }
  const previousParse =
    draft.parsedJson && isParseResult(draft.parsedJson)
      ? (draft.parsedJson as ParseResult)
      : null;
  const latestUserText = getLatestUserText(conversation);
  const userMessageCount = conversation.filter((e) => e.role === "user").length;
  const latestEntry = [...conversation]
    .reverse()
    .find((e) => e.role === "user");
  const latestHasPhoto = Boolean(latestEntry?.photoFileId);

  let adjustedParse!: ParseResult;
  let chatReply: string | null = null;
  let usedDeterministicPath = false;

  if (
    previousParse &&
    userMessageCount > 1 &&
    latestUserText &&
    !latestHasPhoto
  ) {
    const actions = parseDeterministicCorrections(
      latestUserText,
      previousParse.items,
    );
    if (actions) {
      adjustedParse = applyDeterministicCorrections(previousParse, actions);
      usedDeterministicPath = true;
    }
  }

  if (!usedDeterministicPath) {
    const hasPrevious = previousParse && userMessageCount > 1;

    let chatResult;
    try {
      const portionHints = await getPortionHintsForLLM();
      chatResult = await processDraftConversation(conversationWithUrls, {
        portionHints: portionHints || undefined,
        previousParse: hasPrevious ? previousParse : undefined,
      });
    } catch (error) {
      console.error("[llm.processDraftConversation]", error);
      await logError(
        {
          scope: "llm.processDraftConversation",
          chatId,
          userId: draft.userId,
          draftId: draft.id,
        },
        error,
      );
      if (await isDraftCancelled(draft.id)) return;
      await db.draftMeal.update({
        where: { id: draft.id },
        data: { status: "DRAFT_MEAL", parsedJson: null, estimateJson: null },
      });
      await db.user.update({
        where: { chatId },
        data: { state: "DRAFT_MEAL" },
      });
      const user = await ensureUser(chatId);
      await sendErrorMessage(
        bot,
        chatId,
        user,
        "Не удалось получить оценку. Попробуй ещё раз.",
      );
      return;
    }

    if (await isDraftCancelled(draft.id)) return;

    chatReply = chatResult.reply ?? null;

    const incomingParse: ParseResult = {
      items: chatResult.items,
      overall_confidence: chatResult.overall_confidence,
      notes: chatResult.notes,
    };

    let parsed: ParseResult =
      hasPrevious
        ? mergeParse(previousParse, incomingParse, {
          carryForwardUnmatched: true,
        })
        : incomingParse;

    if (hasPrevious) {
      const mentioned = detectMentionedItems(latestUserText, previousParse.items);
      parsed = protectUnmentionedWeights(parsed, previousParse, mentioned);
    }

    adjustedParse = applyUserNegations(parsed, latestUserText);
    adjustedParse = applyTextAdjustments(adjustedParse, latestUserText);
  }

  let estimate: EstimateResult;
  let missingReferences: string[] = [];
  let activeOverrides = overrides;
  const overridesFromText = latestUserText
    ? extractWeightOverridesFromText(latestUserText)
    : [];
  if (overridesFromText.length > 0) {
    const nextOverrides: UserOverridesMap = { ...activeOverrides };
    for (const { key, override } of overridesFromText) {
      const current = nextOverrides[key] ?? {};
      nextOverrides[key] = { ...current, ...override };
    }
    activeOverrides = nextOverrides;
    await updateDraftOverrides(draft.id, activeOverrides);
  }
  const llmOverrideKeys = new Set<string>();
  try {
    const result = await estimateFromParseWithOverrides(
      adjustedParse,
      activeOverrides,
    );
    estimate = result.estimate;
    missingReferences = result.missingReferences;
  } catch (error) {
    console.error("[domain.estimateFromParse]", error);
    await logError(
      {
        scope: "domain.estimateFromParse",
        chatId,
        userId: draft.userId,
        draftId: draft.id,
      },
      error,
    );
    await db.draftMeal.update({
      where: { id: draft.id },
      data: { status: "DRAFT_MEAL", parsedJson: null, estimateJson: null },
    });
    await db.user.update({ where: { chatId }, data: { state: "DRAFT_MEAL" } });
    const user = await ensureUser(chatId);
    await sendErrorMessage(
      bot,
      chatId,
      user,
      "Не удалось получить оценку. Попробуй ещё раз.",
    );
    return;
  }

  if (missingReferences.length > 0) {
    const uniqueMissing = Array.from(new Set(missingReferences)).filter(
      Boolean,
    );
    let pendingMissing = uniqueMissing.filter((name) => {
      const key = normalizeOverrideKey(name);
      return !hasMacroOverrides(activeOverrides[key]);
    });

    // ── Step 1: Try OFF text search for up to 2 missing items BEFORE LLM ──
    // This runs online search (6-7s per item) to find real nutritional data,
    // so "выдумка ИИ" only appears for truly obscure products.
    // Results are persisted to FoodReference, so subsequent lookups are instant.
    const offCandidates = pendingMissing.slice(0, 2);
    const foundViaOff = new Set<string>();
    for (const name of offCandidates) {
      try {
        const offResult = await offSearchByText(name);
        if (offResult) {
          // Product found and persisted – reload resolver cache and re-resolve
          await foodResolver.ensureLoaded(true);
          foundViaOff.add(name);
        }
      } catch {
        // OFF unavailable – fall through to LLM
      }
    }
    if (foundViaOff.size > 0) {
      if (await isDraftCancelled(draft.id)) return;
      // Re-estimate with the newly persisted OFF references
      const reResult = await estimateFromParseWithOverrides(
        adjustedParse,
        activeOverrides,
      );
      estimate = reResult.estimate;
      // Remove found items from pending list
      const stillMissing = reResult.missingReferences;
      pendingMissing = pendingMissing.filter(
        (name) => stillMissing.some((m) => m === name) && !foundViaOff.has(name),
      );
    }

    if (await isDraftCancelled(draft.id)) return;

    const batches = chunkArray(pendingMissing, 6);

    for (const batch of batches) {
      if (batch.length === 0) continue;
      let attempt = 0;
      while (attempt < 2) {
        try {
          const referenceResult = await buildFoodReference(batch);
          for (const item of referenceResult.items ?? []) {
            const name = item.name?.trim();
            if (!name) continue;
            const key = normalizeOverrideKey(name);
            if (
              item.kcal_per_100g === null &&
              item.protein_per_100g === null &&
              item.fat_per_100g === null &&
              item.carbs_per_100g === null
            ) {
              continue;
            }
            if (!validateFoodReferenceValues(item)) {
              continue;
            }
            llmOverrideKeys.add(key);
            const next = { ...activeOverrides };
            next[key] = {
              ...next[key],
              source: "llm",
              kcalPer100g: item.kcal_per_100g ?? undefined,
              proteinPer100g: item.protein_per_100g ?? undefined,
              fatPer100g: item.fat_per_100g ?? undefined,
              carbsPer100g: item.carbs_per_100g ?? undefined,
            };
            activeOverrides = next;

            persistLlmFoodReference(item).catch((e) =>
              console.error("[persistLlmFoodReference]", e),
            );
          }
          break;
        } catch (error) {
          attempt += 1;
          if (attempt >= 2) {
            await logError(
              {
                scope: "llm.buildFoodReference",
                chatId,
                userId: draft.userId,
                draftId: draft.id,
                extra: { batchSize: batch.length, attempt },
              },
              error,
            );
          }
        }
      }
    }

    if (llmOverrideKeys.size > 0) {
      if (await isDraftCancelled(draft.id)) return;
      await updateDraftOverrides(draft.id, activeOverrides);
      const result = await estimateFromParseWithOverrides(
        adjustedParse,
        activeOverrides,
      );
      estimate = result.estimate;
      missingReferences = result.missingReferences;
    }
  }

  const missingReferencesForPrompt = missingReferences.filter(
    (name) => !llmOverrideKeys.has(normalizeOverrideKey(name)),
  );
  const prioritizedMissingReferences = prioritizeMissingReferences(
    adjustedParse,
    missingReferencesForPrompt,
  );
  const riskyClarificationItems = selectRiskyClarificationItems(adjustedParse);
  let promptTargets =
    prioritizedMissingReferences.length > 0
      ? prioritizedMissingReferences
      : riskyClarificationItems;
  promptTargets = promptTargets.filter(
    (label) => !isLowCalorieForClarification(label),
  );

  if (await isDraftCancelled(draft.id)) return;

  const conversationWithAssistantReply = chatReply
    ? [
      ...conversation,
      {
        role: "assistant" as const,
        text: chatReply,
        photoFileId: null as string | null,
      },
    ]
    : conversation;
  await db.draftMeal.update({
    where: { id: draft.id },
    data: {
      status: "CONFIRM",
      parsedJson: adjustedParse,
      estimateJson: estimate,
      draftConversation: conversationWithAssistantReply,
    },
  });
  await db.user.update({ where: { chatId }, data: { state: "CONFIRM" } });

  const uncertaintyText = formatUncertaintyNote({
    parse: adjustedParse,
    missingReferences: promptTargets,
  });
  const clarificationParts = [
    chatReply?.trim() || null,
    uncertaintyText,
  ].filter(Boolean);
  const clarificationText =
    clarificationParts.length > 0 ? clarificationParts.join("\n") : null;

  await db.draftMeal.update({
    where: { id: draft.id },
    data: { pendingQuestion: clarificationText },
  });

  await recordEstimate(draft.userId);
  const parseWithOverrides = applyOverridesToParse(adjustedParse, activeOverrides);
  const estimateText = formatEstimateWithEditComponents(estimate, parseWithOverrides);
  const editKeyboard = buildProductListKeyboard(parseWithOverrides.items);
  const message = await sendLoggedMessage(bot, {
    userId: draft.userId,
    chatId,
    text: estimateText,
    options: {
      reply_markup: { inline_keyboard: editKeyboard },
    },
    messageType: "TEXT",
    draftMealId: draft.id,
  });
  estimateMessageByChat.set(chatId, message.message_id ?? 0);
}

async function confirmDraft(bot: TelegramBot, chatId: string, userId: number) {
  const user = await ensureUser(chatId);
  const userTimezone = user.timezone ?? "UTC";
  const draft = await getDraft(userId);
  if (!draft || !draft.parsedJson || !draft.estimateJson) {
    await sendErrorMessage(bot, chatId, user, "Нет активного черновика.");
    return;
  }
  await setPendingKeyboard({
    bot,
    chatId,
    userId,
    draftMealId: draft.id,
  });

  let estimate: EstimateResult;
  let resolved;
  try {
    const overrides = normalizeUserOverrides(draft.userOverrides);
    const result = await estimateFromParseWithOverrides(
      draft.parsedJson as ParseResult,
      overrides,
    );
    estimate = result.estimate;
    resolved = result.resolved;
  } catch (error) {
    await logError(
      {
        scope: "domain.estimateFromParse",
        chatId,
        userId,
        draftId: draft.id,
      },
      error,
    );
    const user = await ensureUser(chatId);
    await sendErrorMessage(
      bot,
      chatId,
      user,
      "Не удалось пересчитать оценку. Попробуй ещё раз.",
    );
    return;
  }

  let title: MealTitleResult = { title: null };
  try {
    const parse = draft.parsedJson as ParseResult;
    const labels = parse.items
      .map((item) => item.display_label)
      .filter(Boolean);
    const contextParts = [
      draft.text ? `Описание: ${draft.text}` : null,
      labels.length > 0 ? `Состав: ${labels.join(", ")}` : null,
    ].filter(Boolean);
    const context = contextParts.join(". ");
    if (context) {
      title = await buildMealTitle(context);
    }
  } catch (error) {
    await logError(
      {
        scope: "llm.buildMealTitle",
        chatId,
        userId,
        draftId: draft.id,
      },
      error,
    );
    title = { title: null };
  }

  await recordConfirm(userId);

  const { granted: trialGranted, subscribedUntil } = await grantSubscription(
    userId,
    config.subscription.trialDays,
  );

  const meal = await db.meal.create({
    data: {
      userId,
      title: title.title?.trim() || null,
      text: draft.text,
      photoFileId: draft.photoFileId,
      dayKey: toDayKeyForUser(new Date(), userTimezone),
      kcalMean: estimate.kcal,
      kcalMin: estimate.kcal_min,
      kcalMax: estimate.kcal_max,
      proteinMean: estimate.protein,
      proteinMin: estimate.protein_min,
      proteinMax: estimate.protein_max,
      fatMean: estimate.fat,
      fatMin: estimate.fat_min,
      fatMax: estimate.fat_max,
      carbsMean: estimate.carbs,
      carbsMin: estimate.carbs_min,
      carbsMax: estimate.carbs_max,
      uncertaintyBand: estimate.uncertainty_band,
      components: {
        create: resolved.map((entry) => {
          const reasons = [...(entry.component.confidence_reasons ?? [])];
          if (entry.sourceLabel === "user") {
            reasons.push("значение задано пользователем");
          }
          if (entry.usedFallbackReference) {
            reasons.push("нет в USDA");
          }
          if (entry.weight.assumptions.length) {
            reasons.push(...entry.weight.assumptions);
          }
          return {
            foodReferenceId: entry.reference.id,
            canonicalName: entry.component.canonical_name,
            displayLabel: entry.component.display_label,
            weightMean: entry.weight.mean,
            weightMin: entry.weight.min,
            weightMax: entry.weight.max,
            confidence: entry.component.confidence,
            confidenceReasons: reasons.length > 0 ? reasons : undefined,
          };
        }),
      },
    },
  });

  await clearDraft(userId);
  clearEstimateMessage(chatId);
  await db.user.update({ where: { chatId }, data: { state: "IDLE" } });

  const mealTitle = title.title?.trim() || null;
  const canSeeStats = await hasFullAccess(userId);
  const summary = await formatConfirmSummary(userId, new Date(), mealTitle, canSeeStats);

  let grantMessage = "";
  if (trialGranted) {
    const dateStr = subscribedUntil.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    grantMessage = `Вам выдана подписка Premium на ${config.subscription.trialDays} дней. Действует до ${dateStr}.`;
  } else if (canSeeStats) {
    const status = await getPremiumStatus(userId);
    if (status && status.daysLeft > 0) {
      grantMessage = `Подписка до ${status.until.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}. Осталось ${status.daysLeft} дн.`;
    }
  }
  const message = [summary, grantMessage].filter(Boolean).join("\n\n");

  await sendLoggedMessage(bot, {
    userId,
    chatId,
    text: message,
    options: await mainKeyboardMarkup(userId),
    messageType: "TEXT",
    mealId: meal.id,
  });
}

async function isDraftCancelled(draftId: number): Promise<boolean> {
  const draft = await db.draftMeal.findUnique({ where: { id: draftId } });
  return draft === null;
}

async function cancelDraft(bot: TelegramBot, chatId: string, userId: number) {
  await clearDraft(userId);
  clearEstimateMessage(chatId);
  await db.user.update({ where: { chatId }, data: { state: "IDLE" } });
  await sendLoggedMessage(bot, {
    userId,
    chatId,
    text: "Черновик отменён.",
    options: await mainKeyboardMarkup(userId),
    messageType: "TEXT",
  });
}

async function handleHistory(
  bot: TelegramBot,
  chatId: string,
  user: { id: number; lastErrorMessageId: number | null; timezone?: string },
  offset: number,
  title: string,
) {
  await clearErrorMessage(bot, chatId, user);
  const timezone = user.timezone ?? "UTC";
  try {
    const now = new Date();
    // Compute the target date in the user's timezone by stepping offset days back
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offset);
    const { text: summary, meals } = await formatHistorySummary(user.id, date, title, timezone);

    // Show inline delete buttons only for today (offset=0) and yesterday (offset=1)
    const canDelete = offset <= 1 && meals.length > 0;
    if (canDelete) {
      const deleteButtons = buildMealDeleteButtons(meals);
      const message = await sendLoggedMessage(bot, {
        userId: user.id,
        chatId,
        text: summary,
        options: { reply_markup: { inline_keyboard: deleteButtons } },
        messageType: "TEXT",
      });
      await db.user.update({
        where: { id: user.id },
        data: { lastStatsMessageId: message.message_id },
      });
    } else {
      await sendStatsMessage(bot, chatId, user, summary);
    }
  } catch (error) {
    await logError(
      { scope: "history.summary", chatId, userId: user.id, extra: { title } },
      error,
    );
    await sendErrorMessage(
      bot,
      chatId,
      user,
      "Не удалось получить статистику.",
    );
  }
}

type DraftInputSingle = {
  text: string;
  photoFileId?: string | null;
  photoUrl?: string;
};
type DraftInputBatch = {
  entries: Array<{
    text: string;
    photoFileId: string | null;
    photoUrl?: string;
  }>;
};

async function handleDraftInput(
  bot: TelegramBot,
  chatId: string,
  user: { id: number; state: string; lastErrorMessageId: number | null },
  params: DraftInputSingle | DraftInputBatch,
) {
  let draft = await getDraft(user.id);
  if (draft?.llmPending) {
    if (!isPendingExpired(draft)) {
      return;
    }
    await clearPending(draft.id);
    await sendLoggedMessage(bot, {
      userId: user.id,
      chatId,
      text: "Обработка заняла слишком много времени. Попробуй ещё раз.",
      options: await mainKeyboardMarkup(user.id),
      messageType: "SYSTEM",
      draftMealId: draft.id,
    });
  }

  const userEntries: DraftConversationStoredEntry[] =
    "entries" in params
      ? params.entries.map((e) => ({
        role: "user" as const,
        text: e.text.trim(),
        photoFileId: e.photoFileId ?? null,
      }))
      : [
        {
          role: "user" as const,
          text: params.text.trim(),
          photoFileId: params.photoFileId ?? null,
        },
      ];

  let conversation: DraftConversationStoredEntry[] = [];
  if (!draft || user.state === "IDLE") {
    conversation = [...userEntries];
    const mergedText = buildDraftText(conversation);
    draft = await createDraft(
      user.id,
      mergedText,
      userEntries[0]?.photoFileId ?? null,
      conversation,
    );
    await db.user.update({ where: { chatId }, data: { state: "DRAFT_MEAL" } });
  } else {
    conversation = normalizeDraftConversation(draft.draftConversation);
    conversation = [...conversation, ...userEntries];
    conversation = capDraftConversationByLimits(conversation);

    const imageCount = countDraftImages(conversation);
    if (imageCount > config.draft.maxImages) {
      const userForErr = await ensureUser(chatId);
      await sendErrorMessage(
        bot,
        chatId,
        userForErr,
        `Лимит фото (${config.draft.maxImages}) в одном приёме. Подтверди текущее или отмени.`,
        { replyMarkup: confirmKeyboardMarkup() },
      );
      return;
    }
    if (conversation.length >= config.draft.maxMessages) {
      const userForErr = await ensureUser(chatId);
      await sendErrorMessage(
        bot,
        chatId,
        userForErr,
        `Достигнут лимит сообщений (${config.draft.maxMessages}). Подтверди или отмени.`,
        { replyMarkup: confirmKeyboardMarkup() },
      );
      return;
    }

    const mergedText = buildDraftText(conversation);
    const nextPhotoFileId =
      userEntries[userEntries.length - 1]?.photoFileId ??
      draft.photoFileId ??
      null;
    await updateDraftConversation(
      draft.id,
      conversation,
      mergedText,
      nextPhotoFileId,
    );
    await db.user.update({ where: { chatId }, data: { state: "DRAFT_MEAL" } });
    draft = { ...draft, text: mergedText, photoFileId: nextPhotoFileId };
  }

  if (!draft) return;

  const nextOverrides = normalizeUserOverrides(draft.userOverrides);

  const pendingSet = await trySetPending(draft.id);
  if (!pendingSet) {
    return;
  }

  await setPendingKeyboard({
    bot,
    chatId,
    userId: user.id,
    draftMealId: draft.id,
  });

  try {
    await bot.sendChatAction(chatId, "typing");
    const conversationWithUrls = await resolveConversationImageUrls(
      bot,
      conversation,
    );
    const hasPhotoOnlyMessage = conversation.some(
      (e) =>
        e.role === "user" &&
        e.photoFileId &&
        e.text.trim() === "Фото без описания",
    );
    const resolvedCount = conversationWithUrls.filter(
      (e) => e.role === "user" && e.imageUrl,
    ).length;
    if (hasPhotoOnlyMessage && resolvedCount === 0) {
      await sendErrorMessage(
        bot,
        chatId,
        user,
        "Не удалось получить фото. Пришли его ещё раз.",
      );
      return;
    }

    await bot.sendChatAction(chatId, "typing");
    await estimateDraft(
      bot,
      chatId,
      {
        id: draft.id,
        userId: draft.userId,
        parsedJson: (draft.parsedJson as ParseResult | null) ?? null,
      },
      conversation,
      nextOverrides,
      conversationWithUrls,
    );
  } finally {
    await clearPending(draft.id);
  }
}

/** Call before enqueue: if user sent "Отмена" and draft is pending LLM, cancel immediately and return true. */
export async function tryCancelDuringPending(
  bot: TelegramBot,
  chatId: string,
  msg: { text?: string | null },
): Promise<boolean> {
  if (!isCancelCommand(msg.text ?? null)) return false;
  const user = await db.user.findUnique({ where: { chatId } });
  if (!user) return false;
  const draft = await getDraft(user.id);
  if (!draft?.llmPending) return false;
  await clearPending(draft.id);
  await cancelDraft(bot, chatId, user.id);
  return true;
}

export async function handleMediaGroup(
  bot: TelegramBot,
  chatId: string,
  msgs: TelegramBot.Message[],
): Promise<void> {
  const user = await ensureUser(chatId);
  const firstFrom = msgs[0]?.from;
  if (firstFrom?.username) {
    await syncUserUsername(chatId, firstFrom.username);
  }
  for (const msg of msgs) {
    try {
      await logIncomingMessage(user.id, msg);
    } catch (error) {
      await logError(
        { scope: "message.log.incoming", chatId, userId: user.id },
        error,
      );
    }
  }

  const sorted = [...msgs].sort(
    (a, b) => (a.message_id ?? 0) - (b.message_id ?? 0),
  );
  const entries: Array<{
    text: string;
    photoFileId: string;
    photoUrl?: string;
  }> = [];
  for (const msg of sorted) {
    const photo = msg.photo?.[msg.photo.length - 1];
    if (!photo) continue;
    let photoUrl: string | undefined;
    try {
      photoUrl = await bot.getFileLink(photo.file_id);
    } catch {
      photoUrl = undefined;
    }
    const caption = msg.caption?.trim();
    entries.push({
      text: caption ?? "Фото без описания",
      photoFileId: photo.file_id,
      photoUrl,
    });
  }
  if (entries.length === 0) return;

  await handleDraftInput(bot, chatId, user, { entries });
}

export async function handleMessage(
  bot: TelegramBot,
  msg: TelegramBot.Message,
) {
  const chatId = String(msg.chat.id);
  const user = await ensureUser(chatId);
  if (msg.from?.username) {
    await syncUserUsername(chatId, msg.from.username);
  }
  try {
    await logIncomingMessage(user.id, msg);
  } catch (error) {
    await logError(
      {
        scope: "message.log.incoming",
        chatId,
        userId: user.id,
      },
      error,
    );
  }

  // Handle location message for timezone detection
  if (msg.location && awaitingTimezoneLocation.has(chatId)) {
    awaitingTimezoneLocation.delete(chatId);
    awaitingTimezoneFromReminder.delete(chatId);
    const { latitude, longitude } = msg.location;
    const zones = findTimezone(latitude, longitude);
    const timezone = zones[0] ?? "Europe/Moscow";
    await db.user.update({ where: { id: user.id }, data: { timezone, timezoneSetByUser: true } });
    await sendLoggedMessage(bot, {
      userId: user.id,
      chatId,
      text: `Часовой пояс определён: ${timezone}`,
      options: await mainKeyboardMarkup(user.id),
      messageType: "SYSTEM",
    });
    return;
  }

  if (awaitingTimezoneLocation.has(chatId) && isCancelCommand(msg.text ?? null)) {
    const fromReminder = awaitingTimezoneFromReminder.has(chatId);
    awaitingTimezoneLocation.delete(chatId);
    awaitingTimezoneFromReminder.delete(chatId);
    const text = fromReminder ? reminderSettingsText(user) : "Ок. Часовой пояс можно указать позже в «Напоминание».";
    await sendLoggedMessage(bot, {
      userId: user.id,
      chatId,
      text,
      options: await mainKeyboardMarkup(user.id),
      messageType: "SYSTEM",
    });
    return;
  }

  const pendingDraft = await getDraft(user.id);
  if (pendingDraft?.llmPending && isCancelCommand(msg.text ?? null)) {
    await clearPending(pendingDraft.id);
    await cancelDraft(bot, chatId, user.id);
    return;
  }
  if (pendingDraft?.llmPending) {
    if (!isPendingExpired(pendingDraft)) {
      await bot.sendChatAction(chatId, "typing");
      return;
    }
    await clearPending(pendingDraft.id);
  }

  if (msg.text?.startsWith("/admin")) {
    if (!isAdmin(chatId)) {
      await sendLoggedMessage(bot, {
        userId: user.id,
        chatId,
        text: "Доступ запрещён. Убедитесь, что ADMIN_CHAT_ID в .env совпадает с вашим chat ID в Telegram.",
        messageType: "SYSTEM",
      });
      return;
    }
    try {
      const handled = await handleAdminCommand(bot, chatId, msg.text ?? "");
      if (handled) return;
    } catch (err) {
      const msgErr = err instanceof Error ? err.message : String(err);
      await logError({ scope: "admin.command", chatId }, err);
      await bot.sendMessage(
        chatId,
        `Ошибка админки: ${msgErr}`,
      );
      return;
    }
  }

  if (isAdmin(chatId)) {
    const targetChatId = adminReplyTarget.get(chatId);
    if (targetChatId && (msg.text || msg.photo?.length)) {
      adminReplyTarget.delete(chatId);
      try {
        const targetUser = await db.user.findUnique({
          where: { chatId: targetChatId },
          select: { id: true },
        });
        const km = await mainKeyboardMarkup(targetUser?.id ?? 0);
        if (msg.text) {
          await bot.sendMessage(
            targetChatId,
            `Ответ поддержки:\n\n${msg.text}`,
            km,
          );
        } else if (msg.photo?.length) {
          const photo = msg.photo[msg.photo.length - 1];
          await bot.sendPhoto(targetChatId, photo.file_id, {
            caption: "Ответ поддержки:",
            ...km,
          });
        }
        await bot.sendMessage(chatId, "Ответ отправлен.");
      } catch (err) {
        await bot.sendMessage(chatId, `Не удалось отправить: ${err}`);
      }
      return;
    }
  }

  if (awaitingSupportInput.has(chatId) && isCancelCommand(msg.text ?? null)) {
    awaitingSupportInput.delete(chatId);
    await sendLoggedMessage(bot, {
      userId: user.id,
      chatId,
      text: "Отменено.",
      options: await mainKeyboardMarkup(user.id),
      messageType: "SYSTEM",
    });
    return;
  }

  if (awaitingSupportInput.has(chatId)) {
    awaitingSupportInput.delete(chatId);
    const supportText = msg.text ?? msg.caption ?? "(фото без подписи)";
    const adminChatId = config.subscription.adminChatId;
    const username = msg.from?.username ? `@${msg.from.username}` : "—";
    const supportHeader = `📩 ${user.id} · ${chatId} · ${username}`;
    if (adminChatId) {
      await bot.sendMessage(
        adminChatId,
        `${supportHeader}\n${supportText}`,
      );
      if (msg.photo?.length) {
        const photo = msg.photo[msg.photo.length - 1];
        await bot.sendPhoto(adminChatId, photo.file_id, {
          caption: supportHeader,
        });
      }
    }
    await sendLoggedMessage(bot, {
      userId: user.id,
      chatId,
      text: "Сообщение передано в поддержку. Ответим в ближайшее время.",
      options: await mainKeyboardMarkup(user.id),
      messageType: "SYSTEM",
    });
    return;
  }

  if (msg.text === "/reminder" || msg.text === REMINDER_BUTTON) {
    if (!(await hasFullAccess(user.id))) {
      await sendLoggedMessage(bot, {
        userId: user.id,
        chatId,
        text: "Напоминание доступно в Premium.",
        options: await mainKeyboardMarkup(user.id),
        messageType: "SYSTEM",
      });
      return;
    }
    await sendLoggedMessage(bot, {
      userId: user.id,
      chatId,
      text: reminderSettingsText(user),
      options: reminderMainInlineKeyboard(user),
      messageType: "SYSTEM",
    });
    return;
  }

  if (msg.text === "/terms" || msg.text === TERMS_BUTTON) {
    await sendLoggedMessage(bot, {
      userId: user.id,
      chatId,
      text: termsText,
      options: await mainKeyboardMarkup(user.id),
      messageType: "TEXT",
    });
    return;
  }

  if (msg.text === SUPPORT_TEXT || msg.text === "/support") {
    awaitingSupportInput.add(chatId);
    await sendLoggedMessage(bot, {
      userId: user.id,
      chatId,
      text: supportPrompt,
      options: supportKeyboardMarkup(),
      messageType: "SYSTEM",
    });
    return;
  }

  if (msg.text?.startsWith("/start") || msg.text === HELP_BUTTON) {
    const startText = [
      "Отправь фото еды или текст. Перед сохранением будет подтверждение.",
      "",
      "Триал 14 дней — полный доступ. Затем бесплатно: оценка без ограничений, статистика — в Premium.",
      "",
      "/reminder — настроить напоминание",
    ].join("\n");
    await sendLoggedMessage(bot, {
      userId: user.id,
      chatId,
      text: startText,
      options: await mainKeyboardMarkup(user.id),
      messageType: "TEXT",
    });
    // Ask for timezone once so "сегодня" and reminders match user's day
    if (!user.timezoneSetByUser) {
      await bot.sendMessage(chatId, TIMEZONE_PROMPT_TEXT, {
        reply_markup: timezonePromptReplyMarkup(),
      });
      awaitingTimezoneLocation.add(chatId);
    }
    return;
  }

  if (msg.text?.startsWith("/") && msg.text.length > 1) {
    const helpText = [
      "Неизвестная команда.",
      "",
      "/start — как пользоваться",
      "/reminder — напоминание",
      "/terms — условия",
      "/support — связь с нами",
    ].join("\n");
    await sendLoggedMessage(bot, {
      userId: user.id,
      chatId,
      text: helpText,
      options: await mainKeyboardMarkup(user.id),
      messageType: "SYSTEM",
    });
    return;
  }

  if (msg.text === PREMIUM_TEXT) {
    await sendPremiumInvoice(bot, chatId);
    return;
  }

  if (msg.text === STATUS_TEXT) {
    const status = await getPremiumStatus(user.id);
    if (!status) {
      await sendLoggedMessage(bot, {
        userId: user.id,
        chatId,
        text: "Нет активной подписки. Premium — статистика, итоги за день, напоминания.",
        options: await mainKeyboardMarkup(user.id),
        messageType: "SYSTEM",
      });
    } else {
      const dateStr = status.until.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      await sendLoggedMessage(bot, {
        userId: user.id,
        chatId,
        text: `Premium до ${dateStr}. Осталось ${status.daysLeft} дн.`,
        options: await mainKeyboardMarkup(user.id),
        messageType: "TEXT",
      });
    }
    return;
  }

  if (isCancelCommand(msg.text ?? null)) {
    await cancelDraft(bot, chatId, user.id);
    return;
  }

  if (msg.text === TODAY_TEXT) {
    if (!(await hasFullAccess(user.id))) {
      await sendLoggedMessage(bot, {
        userId: user.id,
        chatId,
        text: "Итоги за день — в Premium. Подключи подписку, чтобы видеть статистику.",
        options: await mainKeyboardMarkup(user.id),
        messageType: "SYSTEM",
      });
      await sendPremiumInvoice(bot, chatId);
      return;
    }
    await bot.sendChatAction(chatId, "typing");
    await handleHistory(bot, chatId, user, 0, TODAY_TEXT);
    return;
  }

  if (msg.text === YESTERDAY_TEXT) {
    if (!(await hasFullAccess(user.id))) {
      await sendLoggedMessage(bot, {
        userId: user.id,
        chatId,
        text: "Итоги за день — в Premium. Подключи подписку, чтобы видеть статистику.",
        options: await mainKeyboardMarkup(user.id),
        messageType: "SYSTEM",
      });
      await sendPremiumInvoice(bot, chatId);
      return;
    }
    await bot.sendChatAction(chatId, "typing");
    await handleHistory(bot, chatId, user, 1, YESTERDAY_TEXT);
    return;
  }

  if (msg.text === STATS_TEXT) {
    if (!(await hasFullAccess(user.id))) {
      await sendLoggedMessage(bot, {
        userId: user.id,
        chatId,
        text: "Статистика за неделю и месяц — в Premium. Подключи подписку.",
        options: await mainKeyboardMarkup(user.id),
        messageType: "SYSTEM",
      });
      await sendPremiumInvoice(bot, chatId);
      return;
    }
    await setPendingKeyboard({
      bot,
      chatId,
      userId: user.id,
    });
    await bot.sendChatAction(chatId, "typing");
    try {
      await clearErrorMessage(bot, chatId, user);
      const summary = await formatStatsSummary(user.id, new Date(), user.timezone);
      await sendStatsMessage(bot, chatId, user, summary);
    } catch (error) {
      await logError({ scope: "history.stats", chatId, userId: user.id }, error);
      await sendErrorMessage(
        bot,
        chatId,
        user,
        "Не удалось получить статистику.",
      );
    }
    return;
  }

  if (isConfirmCommand(msg.text ?? null)) {
    await confirmDraft(bot, chatId, user.id);
    return;
  }

  if (isWhyCommand(msg.text ?? null)) {
    const draft = await getDraft(user.id);
    if (!draft?.parsedJson) {
      await sendErrorMessage(bot, chatId, user, "Нет активной оценки.");
      return;
    }
    try {
      const overrides = normalizeUserOverrides(draft.userOverrides);
      const result = await estimateFromParseWithOverrides(
        draft.parsedJson as ParseResult,
        overrides,
      );
      const orderedResolved = sortResolvedByRisk(result.resolved);
      const explanation = formatExplainEstimate(orderedResolved);
      await sendLoggedMessage(bot, {
        userId: user.id,
        chatId,
        text: explanation,
        options: confirmKeyboardMarkup(),
        messageType: "TEXT",
        draftMealId: draft.id,
      });
    } catch (error) {
      await logError(
        {
          scope: "domain.estimateFromParse",
          chatId,
          userId: user.id,
          draftId: draft.id,
        },
        error,
      );
      await sendErrorMessage(
        bot,
        chatId,
        user,
        "Не удалось показать объяснение.",
      );
    }
    return;
  }

  if (isFoundCommand(msg.text ?? null)) {
    const draft = await getDraft(user.id);
    if (!draft?.parsedJson) {
      await sendErrorMessage(bot, chatId, user, "Нет активной оценки.");
      return;
    }
    try {
      const overrides = normalizeUserOverrides(draft.userOverrides);
      const parse = draft.parsedJson as ParseResult;
      const parsedForDisplay = applyOverridesToParse(parse, overrides);
      const orderedParseForDisplay = sortParseByRisk(parsedForDisplay);
      const parseSummary = formatParseSummary(orderedParseForDisplay);
      await sendLoggedMessage(bot, {
        userId: user.id,
        chatId,
        text: parseSummary,
        options: confirmKeyboardMarkup(),
        messageType: "TEXT",
        draftMealId: draft.id,
      });
    } catch (error) {
      await logError(
        {
          scope: "ui.found",
          chatId,
          userId: user.id,
          draftId: draft.id,
        },
        error,
      );
      await sendErrorMessage(bot, chatId, user, "Не удалось показать список.");
    }
    return;
  }

  if (isClarifyCommand(msg.text ?? null)) {
    const draft = await getDraft(user.id);
    if (!draft) {
      await sendErrorMessage(bot, chatId, user, "Нет активной оценки.");
      return;
    }
    const clarification =
      typeof draft.pendingQuestion === "string" && draft.pendingQuestion.trim()
        ? draft.pendingQuestion.trim()
        : "Нет уточнений.";
    await sendLoggedMessage(bot, {
      userId: user.id,
      chatId,
      text: clarification,
      options: confirmKeyboardMarkup(),
      messageType: "TEXT",
      draftMealId: draft.id,
    });
    return;
  }

  const photo = msg.photo?.[msg.photo.length - 1];
  const caption = msg.caption?.trim() ?? null;
  const text = msg.text?.trim() ?? null;

  if (photo) {
    if (!(await canSendPhoto(user.id))) {
      await sendLoggedMessage(bot, {
        userId: user.id,
        chatId,
        text: "Достигнут дневной лимит фото. Попробуй завтра.",
        options: await mainKeyboardMarkup(user.id),
        messageType: "SYSTEM",
      });
      return;
    }
    await recordPhoto(user.id);
    let photoUrl: string | undefined;
    try {
      photoUrl = await bot.getFileLink(photo.file_id);
    } catch {
      photoUrl = undefined;
    }
    await handleDraftInput(bot, chatId, user, {
      text: caption ?? "Фото без описания",
      photoFileId: photo.file_id,
      photoUrl,
    });
    return;
  }

  if (text) {
    const barcodeMatch = text.match(/^\s*(\d{8,13})\s*$/);
    if (barcodeMatch) {
      const barcode = barcodeMatch[1];
      try {
        const ref = await foodResolver.resolveByBarcode(barcode);
        if (ref) {
          await handleDraftInput(bot, chatId, user, {
            text: `${ref.displayLabel} (штрих-код ${barcode})`,
          });
          return;
        }
      } catch {
        // barcode lookup failed, fall through to normal text handling
      }
    }
    await handleDraftInput(bot, chatId, user, { text });
    return;
  }

  await sendErrorMessage(bot, chatId, user, "Не удалось распознать сообщение.");
}

export async function handleReminderCallback(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
): Promise<void> {
  const data = query.data ?? "";
  if (!data.startsWith("rem:")) return;

  const chatId = String(query.message?.chat.id ?? query.from.id);
  const messageId = query.message?.message_id;

  const user = await db.user.findUnique({ where: { chatId } });
  if (!user) {
    await bot.answerCallbackQuery(query.id);
    return;
  }

  let updatedUser = user;

  if (data === "rem:time") {
    await bot.answerCallbackQuery(query.id);
    if (messageId) {
      await bot.editMessageText("Выбери час напоминания:", {
        chat_id: chatId,
        message_id: messageId,
        ...reminderTimeInlineKeyboard(user.reminderHour),
      });
    }
    return;
  }

  if (data === "rem:back") {
    await bot.answerCallbackQuery(query.id);
    if (messageId) {
      await bot.editMessageText(reminderSettingsText(user), {
        chat_id: chatId,
        message_id: messageId,
        ...reminderMainInlineKeyboard(user),
      });
    }
    return;
  }

  if (data.startsWith("rem:h:")) {
    const hour = parseInt(data.slice(6), 10);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
      await bot.answerCallbackQuery(query.id);
      return;
    }
    updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        reminderHour: hour,
        reminderMode: user.reminderMode === "OFF" ? "NO_MEALS" : user.reminderMode,
      },
    });
    await bot.answerCallbackQuery(query.id, { text: `Время: ${String(hour).padStart(2, "0")}:00` });
    if (messageId) {
      await bot.editMessageText(reminderSettingsText(updatedUser), {
        chat_id: chatId,
        message_id: messageId,
        ...reminderMainInlineKeyboard(updatedUser),
      });
    }
    return;
  }

  if (data === "rem:tz") {
    await bot.answerCallbackQuery(query.id);
    const tzPrompt = user.timezoneSetByUser
      ? "Нажми кнопку ниже, чтобы определить часовой пояс по геолокации."
      : "Часовой пояс не задан — «сегодня» и напоминание могут быть в неправильном времени. Поделись геолокацией (один раз), чтобы определить его.";
    await bot.sendMessage(chatId, tzPrompt, {
      reply_markup: timezonePromptReplyMarkup(),
    });
    awaitingTimezoneLocation.add(chatId);
    awaitingTimezoneFromReminder.add(chatId);
    return;
  }

  if (data === "rem:toggle") {
    const newMode = user.reminderMode === "OFF" ? "NO_MEALS" : "OFF";
    if (newMode !== "OFF" && !(await hasFullAccess(user.id))) {
      await bot.answerCallbackQuery(query.id, { text: "Напоминание доступно в Premium." });
      return;
    }
    if (newMode === "OFF" && !user.timezoneSetByUser) {
      await bot.answerCallbackQuery(query.id, {
        text: "Сначала поделись геолокацией (📍 Указать часовой пояс), чтобы выключить напоминание.",
      });
      return;
    }
    updatedUser = await db.user.update({
      where: { id: user.id },
      data: { reminderMode: newMode },
    });
    const toastText = newMode === "OFF" ? "Напоминание выключено" : "Напоминание включено";
    await bot.answerCallbackQuery(query.id, { text: toastText });
    if (messageId) {
      await bot.editMessageText(reminderSettingsText(updatedUser), {
        chat_id: chatId,
        message_id: messageId,
        ...reminderMainInlineKeyboard(updatedUser),
      });
    }
    return;
  }

  await bot.answerCallbackQuery(query.id);
}

/**
 * Handles edit:* (weight +/-) and e:* (confirm/cancel/why/found/clarify) callbacks.
 */
export async function handleEstimateInlineCallback(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
): Promise<void> {
  const data = query.data ?? "";
  const chatId = String(query.message?.chat.id ?? query.from.id);
  const messageId = query.message?.message_id;

  const user = await db.user.findUnique({ where: { chatId } });
  if (!user) {
    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (data === "e:ok") {
    await bot.answerCallbackQuery(query.id, { text: "Сохранено" });
    await confirmDraft(bot, chatId, user.id);
    return;
  }

  if (data === "e:cancel") {
    await bot.answerCallbackQuery(query.id, { text: "Отменено" });
    await cancelDraft(bot, chatId, user.id);
    return;
  }

  if (data === "e:why") {
    const draft = await getDraft(user.id);
    if (!draft?.parsedJson) {
      await bot.answerCallbackQuery(query.id, { text: "Нет активной оценки." });
      return;
    }
    try {
      const overrides = normalizeUserOverrides(draft.userOverrides);
      const result = await estimateFromParseWithOverrides(
        draft.parsedJson as ParseResult,
        overrides,
      );
      const orderedResolved = sortResolvedByRisk(result.resolved);
      const explanation = formatExplainEstimate(orderedResolved);
      await bot.answerCallbackQuery(query.id);
      await sendLoggedMessage(bot, {
        userId: user.id,
        chatId,
        text: explanation,
        options: confirmKeyboardMarkup(),
        messageType: "TEXT",
        draftMealId: draft.id,
      });
    } catch (error) {
      await logError(
        { scope: "estimate.inline.why", chatId, userId: user.id, draftId: draft?.id },
        error,
      );
      await bot.answerCallbackQuery(query.id, { text: "Ошибка" });
    }
    return;
  }

  if (data === "e:found") {
    const draft = await getDraft(user.id);
    if (!draft?.parsedJson) {
      await bot.answerCallbackQuery(query.id, { text: "Нет активной оценки." });
      return;
    }
    try {
      const overrides = normalizeUserOverrides(draft.userOverrides);
      const parse = draft.parsedJson as ParseResult;
      const parsedForDisplay = applyOverridesToParse(parse, overrides);
      const orderedParseForDisplay = sortParseByRisk(parsedForDisplay);
      const parseSummary = formatParseSummary(orderedParseForDisplay);
      await bot.answerCallbackQuery(query.id);
      await sendLoggedMessage(bot, {
        userId: user.id,
        chatId,
        text: parseSummary,
        options: confirmKeyboardMarkup(),
        messageType: "TEXT",
        draftMealId: draft.id,
      });
    } catch (error) {
      await logError(
        { scope: "estimate.inline.found", chatId, userId: user.id, draftId: draft?.id },
        error,
      );
      await bot.answerCallbackQuery(query.id, { text: "Ошибка" });
    }
    return;
  }

  if (data === "e:clarify") {
    const draft = await getDraft(user.id);
    if (!draft) {
      await bot.answerCallbackQuery(query.id, { text: "Нет активной оценки." });
      return;
    }
    const clarification =
      typeof draft.pendingQuestion === "string" && draft.pendingQuestion.trim()
        ? draft.pendingQuestion.trim()
        : "Нет уточнений.";
    await bot.answerCallbackQuery(query.id);
    await sendLoggedMessage(bot, {
      userId: user.id,
      chatId,
      text: clarification,
      options: confirmKeyboardMarkup(),
      messageType: "TEXT",
      draftMealId: draft.id,
    });
    return;
  }

  // edit:* — product list, open, back, or field adjustment
  if (data.startsWith("edit:")) {
    const draft = await getDraft(user.id);
    if (!draft?.parsedJson || !draft.estimateJson) {
      await bot.answerCallbackQuery(query.id, { text: "Нет активной оценки." });
      return;
    }

    const parse = draft.parsedJson as ParseResult;
    const overrides = normalizeUserOverrides(draft.userOverrides);
    const storedMsgId = estimateMessageByChat.get(chatId);
    if (!storedMsgId || messageId !== storedMsgId) {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === "edit:back") {
      const result = await estimateFromParseWithOverrides(parse, overrides);
      const parseWithOverrides = applyOverridesToParse(parse, overrides);
      const text = formatEstimateWithEditComponents(result.estimate, parseWithOverrides);
      const keyboard = buildProductListKeyboard(parseWithOverrides.items);
      try {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: storedMsgId,
          reply_markup: { inline_keyboard: keyboard },
        });
      } catch (err) {
        await logError({ scope: "estimate.inline.back", chatId }, err);
      }
      await bot.answerCallbackQuery(query.id, { text: "Назад" });
      return;
    }

    const openMatch = data.match(/^edit:open:(\d+)$/);
    if (openMatch) {
      const itemIdx = parseInt(openMatch[1], 10);
      const result = await estimateFromParseWithOverrides(parse, overrides);
      const compTotals = getComponentEditTotals(result.resolved);
      if (itemIdx < 0 || itemIdx >= compTotals.length) {
        await bot.answerCallbackQuery(query.id, { text: "Неверный компонент" });
        return;
      }
      const comp = compTotals[itemIdx];
      const text = formatProductEditScreen(comp, result.estimate);
      const keyboard = buildProductEditKeyboard(itemIdx, comp);
      try {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: storedMsgId,
          reply_markup: { inline_keyboard: keyboard },
        });
      } catch (err) {
        await logError({ scope: "estimate.inline.open", chatId }, err);
      }
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const nopMatch = data.match(/^edit:\d+:nop$/);
    if (nopMatch) {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const fieldMatch = data.match(/^edit:(\d+):(w|k|p|f|c):(-?\d+)$/);
    if (!fieldMatch) {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const itemIdx = parseInt(fieldMatch[1], 10);
    const field = fieldMatch[2];
    const delta = parseInt(fieldMatch[3], 10);
    const result = await estimateFromParseWithOverrides(parse, overrides);
    const compTotals = getComponentEditTotals(result.resolved);
    if (itemIdx < 0 || itemIdx >= compTotals.length) {
      await bot.answerCallbackQuery(query.id, { text: "Неверный компонент" });
      return;
    }

    const origItem = parse.items[itemIdx];
    const key = normalizeOverrideKey(origItem.canonical_name) || normalizeOverrideKey(origItem.display_label);
    const comp = compTotals[itemIdx];
    const current = overrides[key] ?? {};
    let nextOverrides: UserOverridesMap = { ...overrides };

    if (field === "w") {
      const newWeight = Math.round(
        Math.max(EDIT_WEIGHT_MIN_G, Math.min(EDIT_WEIGHT_MAX_G, comp.weight + delta)),
      );
      nextOverrides[key] = {
        ...current,
        source: "user" as const,
        weight_g_mean: newWeight,
        weight_g_min: newWeight,
        weight_g_max: newWeight,
      };
    } else {
      if (field === "k") {
        const newPer100 = Math.max(0, comp.kcalPer100g + delta);
        nextOverrides[key] = { ...current, source: "user" as const, kcalPer100g: newPer100 };
      } else if (field === "p") {
        const newPer100 = Math.max(0, comp.proteinPer100g + delta);
        nextOverrides[key] = { ...current, source: "user" as const, proteinPer100g: newPer100 };
      } else if (field === "f") {
        const newPer100 = Math.max(0, comp.fatPer100g + delta);
        nextOverrides[key] = { ...current, source: "user" as const, fatPer100g: newPer100 };
      } else {
        const newPer100 = Math.max(0, comp.carbsPer100g + delta);
        nextOverrides[key] = { ...current, source: "user" as const, carbsPer100g: newPer100 };
      }
    }

    await updateDraftOverrides(draft.id, nextOverrides);

    let newResult: { estimate: EstimateResult; resolved: ResolvedComponent[] };
    try {
      newResult = await estimateFromParseWithOverrides(parse, nextOverrides);
    } catch (error) {
      await logError(
        { scope: "estimate.inline.edit", chatId, userId: user.id, draftId: draft.id },
        error,
      );
      await bot.answerCallbackQuery(query.id, { text: "Ошибка пересчёта" });
      return;
    }

    await db.draftMeal.update({
      where: { id: draft.id },
      data: { estimateJson: newResult.estimate },
    });

    const newCompTotals = getComponentEditTotals(newResult.resolved);
    const newComp = newCompTotals[itemIdx];
    const newText = formatProductEditScreen(newComp, newResult.estimate);
    const newKeyboard = buildProductEditKeyboard(itemIdx, newComp);

    try {
      await bot.editMessageText(newText, {
        chat_id: chatId,
        message_id: storedMsgId,
        reply_markup: { inline_keyboard: newKeyboard },
      });
    } catch (err) {
      await logError({ scope: "estimate.inline.editMessage", chatId, messageId: storedMsgId }, err);
    }

    let toast = "";
    if (field === "w") toast = `${newComp.weight} г`;
    else if (field === "k") toast = `${newComp.kcalPer100g} ккал/100г`;
    else if (field === "p") toast = `${newComp.proteinPer100g} Б/100г`;
    else if (field === "f") toast = `${newComp.fatPer100g} Ж/100г`;
    else toast = `${newComp.carbsPer100g} У/100г`;
    await bot.answerCallbackQuery(query.id, { text: toast });
    return;
  }

  await bot.answerCallbackQuery(query.id);
}

/**
 * Handles del:* and delc:* callback queries for meal deletion.
 *
 * del:<mealId>        -- show confirmation prompt
 * delc:yes:<mealId>   -- confirm: soft-delete the meal, re-render summary
 * delc:no:<mealId>    -- cancel: re-render original summary
 */
export async function handleMealDeleteCallback(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
): Promise<void> {
  const data = query.data ?? "";
  if (!data.startsWith("del:") && !data.startsWith("delc:")) return;

  const chatId = String(query.message?.chat.id ?? query.from.id);
  const messageId = query.message?.message_id;

  const user = await db.user.findUnique({ where: { chatId } });
  if (!user) {
    await bot.answerCallbackQuery(query.id);
    return;
  }

  // ── del:<mealId>: show confirmation ──────────────────────────────────────
  if (data.startsWith("del:")) {
    const mealId = parseInt(data.slice(4), 10);
    if (!Number.isFinite(mealId)) {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const meal = await db.meal.findFirst({
      where: { id: mealId, userId: user.id, deletedAt: null },
      include: { components: { select: { displayLabel: true } } },
    });
    if (!meal) {
      await bot.answerCallbackQuery(query.id, { text: "Приём не найден." });
      return;
    }

    const label = meal.title?.trim()
      || meal.components.map((c: { displayLabel: string }) => c.displayLabel).join(", ")
      || meal.text?.trim()
      || "Приём пищи";
    const kcal = Math.round(meal.kcalMean);
    const confirmText = `Удалить «${label}» (${kcal} ккал)?`;

    await bot.answerCallbackQuery(query.id);
    if (messageId) {
      await bot.editMessageText(confirmText, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Да, удалить", callback_data: `delc:yes:${mealId}` },
              { text: "Нет", callback_data: `delc:no:${mealId}` },
            ],
          ],
        },
      });
    }
    return;
  }

  // ── delc:yes/<no>:<mealId>: execute or cancel ─────────────────────────────
  if (data.startsWith("delc:")) {
    const parts = data.split(":");
    const action = parts[1]; // "yes" or "no"
    const mealId = parseInt(parts[2] ?? "", 10);
    if (!Number.isFinite(mealId)) {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (action === "yes") {
      const meal = await db.meal.findFirst({
        where: { id: mealId, userId: user.id, deletedAt: null },
      });
      if (!meal) {
        await bot.answerCallbackQuery(query.id, { text: "Уже удалено." });
        return;
      }

      // Soft-delete
      await db.meal.update({
        where: { id: mealId },
        data: { deletedAt: new Date() },
      });
      await bot.answerCallbackQuery(query.id, { text: "Удалено." });
    } else {
      await bot.answerCallbackQuery(query.id);
    }

    // Re-render the history summary for the same day
    if (messageId) {
      try {
        const userTz = user.timezone ?? "UTC";
        const mealForDay = await db.meal.findFirst({
          where: { id: mealId, userId: user.id },
          select: { dayKey: true },
        });
        const todayKey = toDayKeyForUser(new Date(), userTz);
        const yesterdayKey = toDayKeyForUser(
          new Date(Date.now() - 86400000),
          userTz,
        );
        const dayKey = mealForDay?.dayKey ?? todayKey;
        const offsetDays = dayKey === todayKey ? 0 : dayKey === yesterdayKey ? 1 : 1;
        const titleText = offsetDays === 0 ? TODAY_TEXT : YESTERDAY_TEXT;

        const date = new Date();
        date.setUTCDate(date.getUTCDate() - offsetDays);
        const { text: summary, meals } = await formatHistorySummary(user.id, date, titleText, userTz);

        if (meals.length > 0) {
          const deleteButtons = buildMealDeleteButtons(meals);
          await bot.editMessageText(summary, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: deleteButtons },
          });
        } else {
          await bot.editMessageText(summary, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [] },
          });
        }
      } catch {
        // Edit may fail if message is too old or unchanged — ignore
      }
    }
    return;
  }
}
