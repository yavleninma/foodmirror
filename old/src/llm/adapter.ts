import { config } from "../config";
import { renderTemplate } from "../utils/template";
import { extractJson, safeJsonParse } from "../utils/validation";
import {
  DraftChatResult,
  FoodReferenceResult,
  MealTitleResult,
  ParseResult,
} from "./contracts";
import { buildJsonSchemaResponseFormat } from "./schemas";
import { logLLM } from "../utils/logger";
import { openAiChat } from "./openai";
import {
  isDraftChatResult,
  isFoodReferenceResult,
  isMealTitleResult,
  isParseResult,
} from "./validators";

const SYSTEM_PROMPT = config.llm.systemPrompt;

function parseJsonOrNull(text: string): unknown | null {
  // With response_format JSON modes, the model usually returns pure JSON.
  const direct = safeJsonParse<unknown>(text);
  if (direct !== null) return direct;
  const extracted = extractJson(text);
  if (!extracted) return null;
  return safeJsonParse<unknown>(extracted);
}

function assertApiKey() {
  if (!config.llm.apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download image: ${res.status} ${await res.text()}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const sniffMime = (): string => {
    // JPEG: FF D8 FF
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "image/jpeg";
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return "image/png";
    }
    // GIF: 47 49 46 38
    if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return "image/gif";
    }
    // WEBP: RIFF....WEBP
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return "image/webp";
    }
    return "image/jpeg";
  };

  const headerTypeRaw = res.headers.get("content-type") ?? "";
  const headerType = headerTypeRaw.split(";")[0]?.trim() ?? "";
  const supported = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const contentTypeCandidate = headerType.startsWith("image/") ? headerType : "";
  const contentType =
    (contentTypeCandidate && supported.has(contentTypeCandidate)
      ? contentTypeCandidate
      : sniffMime());

  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

export async function parseMeal(
  text: string,
  imageUrl?: string,
  options?: { portionHints?: string },
): Promise<ParseResult> {
  assertApiKey();

  const userContent:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      > = imageUrl
    ? [
        { type: "text", text },
        { type: "image_url", image_url: { url: imageUrl } },
      ]
    : text;

  const prompt = renderTemplate(config.llm.prompts.parseMeal, {
    contract: config.llm.contracts.parseMeal,
    portion_hints: options?.portionHints ?? "",
  });

  const run = async (finalImageUrl?: string) => {
    const finalUserContent:
      | string
      | Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
        > = finalImageUrl
      ? [
          { type: "text", text },
          { type: "image_url", image_url: { url: finalImageUrl } },
        ]
      : text;

    return openAiChat(
      config.llm.apiKey,
      config.llm.model,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: finalUserContent },
        { role: "user", content: prompt },
      ],
      {
        scope: "llm.parseMeal",
        timeoutMs: config.llm.timeoutMs,
        maxCompletionTokens: config.llm.maxCompletionTokens,
        responseFormat: buildJsonSchemaResponseFormat("parseMeal"),
      },
    );
  };

  let content: string;
  try {
    content = await run(imageUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldRetryWithDataUrl =
      Boolean(imageUrl) &&
      typeof imageUrl === "string" &&
      imageUrl.startsWith("https://api.telegram.org/") &&
      message.includes('"code": "invalid_image_url"');

    if (!shouldRetryWithDataUrl) {
      throw error;
    }

    const dataUrl = await fetchImageAsDataUrl(imageUrl as string);
    content = await run(dataUrl);
  }

  const parsedUnknown = parseJsonOrNull(content);
  if (!parsedUnknown || !isParseResult(parsedUnknown)) {
    throw new Error("OpenAI response did not match Vision/Parsing contract");
  }
  return parsedUnknown;
}

/** Запись диалога: роль, текст, опционально URL изображения */
export type DraftConversationEntry = {
  role: "user" | "assistant";
  text: string;
  imageUrl?: string | null;
};

export async function processDraftConversation(
  conversation: DraftConversationEntry[],
  options?: { portionHints?: string; previousParse?: ParseResult },
): Promise<DraftChatResult> {
  assertApiKey();

  const pointCorrectionBlock =
    options?.previousParse?.items?.length
      ? `\nТекущий разбор (измени ТОЛЬКО продукт, который пользователь уточнил; остальные верни без изменений):\n\`\`\`json\n${JSON.stringify(options.previousParse.items)}\n\`\`\``
      : "";

  const prompt = renderTemplate(config.llm.prompts.draftChat, {
    contract: config.llm.contracts.draftChat,
    portion_hints: options?.portionHints ?? "",
    point_correction_block: pointCorrectionBlock,
  });

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

  const messages: Array<{ role: "user" | "assistant"; content: string | ContentPart[] }> =
    conversation.map((entry) => {
      if (entry.role === "assistant") {
        return { role: "assistant" as const, content: entry.text };
      }
      const parts: ContentPart[] = [{ type: "text", text: entry.text }];
      if (entry.imageUrl) {
        parts.push({ type: "image_url", image_url: { url: entry.imageUrl } });
      }
      return {
        role: "user" as const,
        content: parts.length === 1 ? entry.text : parts,
      };
    });

  const imageCount = conversation.filter((e) => e.imageUrl).length;
  const baseTokens = config.llm.maxCompletionTokensDraftChat ?? config.llm.maxCompletionTokens;
  const maxTokens =
    imageCount > 2 ? Math.max(baseTokens, 4000) : baseTokens;

  const content = await openAiChat(
    config.llm.apiKey,
    config.llm.model,
    [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
      { role: "user", content: prompt },
    ],
    {
      scope: "llm.processDraftConversation",
      timeoutMs: config.llm.timeoutMs,
      maxCompletionTokens: maxTokens,
      responseFormat: buildJsonSchemaResponseFormat("draftChat"),
    },
  );

  const parsedUnknown = parseJsonOrNull(content);
  if (!parsedUnknown || !isDraftChatResult(parsedUnknown)) {
    await logLLM({
      event: "error",
      scope: "llm.processDraftConversation",
      error: new Error("OpenAI response did not match DraftChat contract"),
      responseText: content,
      responseJson: parsedUnknown,
    });
    throw new Error("OpenAI response did not match DraftChat contract");
  }
  return parsedUnknown;
}

/** Запрещённые подстроки в названии приёма пищи (уверенность/точность). Слова с ними удаляются. */
const MEAL_TITLE_FORBIDDEN_SUBSTRINGS = [
  "неподтвержден",
  "неуверен",
  "неточн",
  "приблизительно",
  "ориентировочно",
  "возможно",
  "примерно",
  "похоже",
  "вероятно",
];

function sanitizeMealTitle(title: string | null): string | null {
  if (title == null || title === "") return title;
  const tokens = title.trim().split(/\s+/);
  const allowed = tokens.filter((t) => {
    const lower = t.toLowerCase();
    return !MEAL_TITLE_FORBIDDEN_SUBSTRINGS.some((sub) => lower.includes(sub));
  });
  const result = allowed.join(" ").trim();
  return result === "" ? null : result;
}

export async function buildMealTitle(context: string): Promise<MealTitleResult> {
  assertApiKey();

  const prompt = renderTemplate(config.llm.prompts.mealTitle, {
    contract: config.llm.contracts.mealTitle,
  });

  const content = await openAiChat(
    config.llm.apiKey,
    config.llm.model,
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: context },
      { role: "user", content: prompt },
    ],
    {
      scope: "llm.buildMealTitle",
      timeoutMs: config.llm.timeoutMs,
      maxCompletionTokens: config.llm.maxCompletionTokens,
      responseFormat: buildJsonSchemaResponseFormat("mealTitle"),
    },
  );

  const parsedUnknown = parseJsonOrNull(content);
  if (!parsedUnknown || !isMealTitleResult(parsedUnknown)) {
    throw new Error("OpenAI response did not match MealTitle contract");
  }
  const raw = parsedUnknown as MealTitleResult;
  return {
    title: sanitizeMealTitle(raw.title),
  };
}

export async function buildFoodReference(
  items: string[],
): Promise<FoodReferenceResult> {
  assertApiKey();

  const normalizedItems = items.map((item) => item.trim()).filter(Boolean);
  const prompt = renderTemplate(config.llm.prompts.foodReference, {
    contract: config.llm.contracts.foodReference,
    items_json: JSON.stringify(normalizedItems),
  });

  const content = await openAiChat(
    config.llm.apiKey,
    config.llm.model,
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    {
      scope: "llm.buildFoodReference",
      timeoutMs: config.llm.timeoutMs,
      maxCompletionTokens: config.llm.maxCompletionTokens,
      responseFormat: buildJsonSchemaResponseFormat("foodReference"),
    },
  );

  const parsedUnknown = parseJsonOrNull(content);
  if (!parsedUnknown || !isFoodReferenceResult(parsedUnknown)) {
    throw new Error("OpenAI response did not match FoodReference contract");
  }
  return parsedUnknown;
}
