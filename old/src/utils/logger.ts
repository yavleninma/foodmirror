import fs from "fs/promises";
import path from "path";
import { config } from "../config";

type LogContext = {
  scope: string;
  chatId?: string;
  userId?: number;
  draftId?: number;
  messageId?: number;
  extra?: Record<string, unknown>;
};

type LlmLogEntry = {
  event: "request" | "response" | "error";
  scope?: string;
  model?: string;
  messages?: unknown;
  timeoutMs?: number;
  status?: number;
  durationMs?: number;
  responseText?: string;
  responseJson?: unknown;
  responseContent?: string;
  responseModel?: string;
  usage?: unknown;
  error?: unknown;
  extra?: Record<string, unknown>;
};

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { value: String(error) };
}

async function appendLog(logPath: string, entry: Record<string, unknown>) {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

async function appendLogPlain(logPath: string, line: string) {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, `${line}\n`, "utf8");
}

export async function logError(context: LogContext, error: unknown) {
  try {
    await appendLog(config.errorLogPath, {
      level: "error",
      timestamp: new Date().toISOString(),
      ...context,
      error: serializeError(error),
    });
  } catch (logError) {
    console.error("Failed to write log", logError);
  }
}

const LLM_TIMING_LOG = "logs/llm_timing.log";

export async function logLLM(entry: LlmLogEntry) {
  try {
    await appendLog(config.llmLogPath, {
      level: "llm",
      timestamp: new Date().toISOString(),
      ...entry,
      error: entry.error ? serializeError(entry.error) : undefined,
    });

    if (entry.event === "response" && typeof entry.durationMs === "number") {
      const usage = entry.usage as { completion_tokens_details?: { reasoning_tokens?: number }; prompt_tokens?: number; completion_tokens?: number } | undefined;
      const reasoning = usage?.completion_tokens_details?.reasoning_tokens;
      const line = [
        new Date().toISOString(),
        entry.scope ?? "?",
        entry.responseModel ?? entry.model ?? "?",
        `${entry.durationMs}ms`,
        reasoning != null ? `reasoning:${reasoning}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      await appendLogPlain(LLM_TIMING_LOG, line);
    } else if (entry.event === "error" && entry.error) {
      const msg = (entry.error as Error)?.message ?? String(entry.error);
      const line = `${new Date().toISOString()} ${entry.scope ?? "?"} ERROR ${msg}`;
      await appendLogPlain(LLM_TIMING_LOG, line);
    }
  } catch (logError) {
    console.error("Failed to write log", logError);
  }
}
