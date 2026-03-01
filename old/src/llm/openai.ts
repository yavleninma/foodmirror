import { logLLM } from "../utils/logger";

type OpenAiMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

export type OpenAiResponseFormat =
  | { type: "json_object" }
  | {
      type: "json_schema";
      json_schema: {
        name: string;
        strict: true;
        schema: unknown;
      };
    };

type OpenAiChatOptions = {
  timeoutMs?: number;
  scope?: string;
  maxCompletionTokens?: number;
  responseFormat?: OpenAiResponseFormat;
};

function sanitizeMessagesForLog(messages: OpenAiMessage[]): OpenAiMessage[] {
  return messages.map((m) => {
    if (typeof m.content === "string") return m;
    const sanitizedParts = m.content.map((part) => {
      if (part.type !== "image_url") return part;
      const url = part.image_url?.url ?? "";
      if (typeof url === "string" && url.startsWith("data:")) {
        return { ...part, image_url: { url: "<data_url>" } };
      }
      return part;
    });
    return { ...m, content: sanitizedParts };
  });
}

export async function openAiChat(
  apiKey: string,
  model: string,
  messages: OpenAiMessage[],
  options: OpenAiChatOptions = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 45000;
  const scope = options.scope ?? "llm.openai";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const messagesForLog = sanitizeMessagesForLog(messages);
  const basePayload: {
    model: string;
    messages: OpenAiMessage[];
    max_completion_tokens?: number;
    response_format?: OpenAiResponseFormat;
  } = { model, messages };
  if (
    typeof options.maxCompletionTokens === "number" &&
    Number.isFinite(options.maxCompletionTokens)
  ) {
    basePayload.max_completion_tokens = options.maxCompletionTokens;
  }
  if (options.responseFormat) {
    basePayload.response_format = options.responseFormat;
  }

  const shouldFallbackResponseFormat = (status: number, text: string) => {
    if (status !== 400 && status !== 422) return false;
    const normalized = text.toLowerCase();
    return (
      normalized.includes("response_format") ||
      normalized.includes("json_schema")
    );
  };

  const startedAt = Date.now();
  let attempt = 0;
  let payload = basePayload;
  let didFallbackResponseFormat = false;
  let didIncreaseMaxTokens = false;
  let response: Response;
  let responseText = "";
  let parsedData:
    | {
        model?: string;
        choices?: Array<{
          message?: { content?: string };
          finish_reason?: string | null;
        }>;
        usage?: unknown;
      }
    | null = null;
  try {
    while (true) {
      attempt += 1;
      await logLLM({
        event: "request",
        scope,
        model,
        messages: messagesForLog,
        timeoutMs,
        extra: {
          attempt,
          responseFormat: payload.response_format?.type ?? null,
          maxCompletionTokens: payload.max_completion_tokens ?? null,
        },
      });

      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      responseText = await response.text();
      if (response.ok) {
        // Parse here to detect edge cases like "reasoning-only" completions.
        try {
          parsedData = JSON.parse(responseText) as {
            model?: string;
            choices?: Array<{
              message?: { content?: string };
              finish_reason?: string | null;
            }>;
            usage?: unknown;
          };
        } catch (error) {
          await logLLM({
            event: "error",
            scope,
            model,
            error,
            extra: { responseText },
          });
          throw new Error("OpenAI response is not JSON");
        }

        const finishReason = parsedData.choices?.[0]?.finish_reason ?? null;
        const responseContent = parsedData.choices?.[0]?.message?.content ?? "";
        const reasoningTokens = (parsedData.usage as any)?.completion_tokens_details
          ?.reasoning_tokens;

        const isEmptyOutput =
          typeof responseContent === "string" && responseContent.trim() === "";

        // Some reasoning models can spend the entire max token budget on reasoning,
        // producing an empty visible output with finish_reason="length".
        if (
          !didIncreaseMaxTokens &&
          isEmptyOutput &&
          finishReason === "length" &&
          typeof payload.max_completion_tokens === "number" &&
          Number.isFinite(payload.max_completion_tokens)
        ) {
          didIncreaseMaxTokens = true;
          const nextMax = Math.min(
            Math.max(payload.max_completion_tokens * 3, 900),
            8000,
          );
          await logLLM({
            event: "response",
            scope,
            status: response.status,
            durationMs: Date.now() - startedAt,
            responseText,
            extra: {
              attempt,
              finishReason,
              reasoningTokens: typeof reasoningTokens === "number" ? reasoningTokens : null,
              emptyOutputRetry: true,
              increasedMaxCompletionTokens: nextMax,
            },
          });
          payload = { ...payload, max_completion_tokens: nextMax };
          continue;
        }

        break;
      }

      const canFallbackResponseFormat =
        !didFallbackResponseFormat &&
        payload.response_format?.type === "json_schema" &&
        shouldFallbackResponseFormat(response.status, responseText);

      await logLLM({
        event: "response",
        scope,
        status: response.status,
        durationMs: Date.now() - startedAt,
        responseText,
        extra: {
          attempt,
          willFallbackToJsonObject: canFallbackResponseFormat,
        },
      });

      if (canFallbackResponseFormat) {
        didFallbackResponseFormat = true;
        payload = { ...payload, response_format: { type: "json_object" } };
        continue;
      }

      throw new Error(`OpenAI error: ${response.status} ${responseText}`);
    }
  } catch (error) {
    const normalizedError =
      error instanceof Error && error.name === "AbortError"
        ? new Error("OpenAI request timed out")
        : error;
    await logLLM({
      event: "error",
      scope,
      model,
      messages: messagesForLog,
      timeoutMs,
      error: normalizedError,
      extra: {
        attempt,
        didFallbackResponseFormat,
        didIncreaseMaxTokens,
      },
    });
    throw normalizedError;
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = Date.now() - startedAt;

  const data =
    parsedData ??
    (JSON.parse(responseText) as {
      model?: string;
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string | null;
      }>;
      usage?: unknown;
    });

  const responseContent = data.choices?.[0]?.message?.content ?? "";
  await logLLM({
    event: "response",
    scope,
    status: response.status,
    durationMs,
    responseJson: data,
    responseContent,
    responseModel: data.model,
    usage: data.usage,
    extra: {
      attempt,
      responseFormat: payload.response_format?.type ?? null,
      maxCompletionTokens: payload.max_completion_tokens ?? null,
      didFallbackResponseFormat,
      didIncreaseMaxTokens,
    },
  });

  return responseContent;
}
