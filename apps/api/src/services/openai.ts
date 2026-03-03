import { env } from '../lib/env.js';

interface InsightResult {
  verdict: string;
  correction: string;
}

interface OpenAiError extends Error {
  status?: number;
}

const SYSTEM_PROMPT = [
  'Ты — поведенческий модуль FoodMirror.',
  'Цель пользователя: не расползтись. Не считаешь калории.',
  'Анализируешь фото еды и даёшь один короткий поведенческий инсайт.',
  'Отвечай только на русском. Коротко, максимум 1–2 предложения на поле.',
  'Вердикт: «норма», «риск», «хорошо» и т.п. — одно слово или короткая фраза.',
  'Правка: одна конкретная поведенческая подсказка (что изменить в следующий раз).',
  'Без советов по калориям, БЖУ, диетам. Только поведение.',
].join('\n');

const USER_PROMPT = [
  'По фото еды верни строго JSON:',
  '{ "verdict": "строка (вердикт)", "correction": "строка (одна правка)" }',
  'verdict — одно слово или короткая фраза.',
  'correction — одна поведенческая правка, 1–2 предложения.',
].join(' ');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
const RETRY_DELAYS_MS = env.NODE_ENV === 'test' ? [0, 0] : [300, 1000];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseInsightResult(rawContent: string): InsightResult {
  const content = rawContent.trim();
  const withoutFence = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const candidates = withoutFence === content ? [content] : [withoutFence, content];

  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(withoutFence.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (typeof parsed.verdict === 'string' && typeof parsed.correction === 'string') {
        const verdict = parsed.verdict.trim();
        const correction = parsed.correction.trim();
        if (verdict && correction) {
          return { verdict, correction };
        }
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error('OpenAI: invalid response format');
}

function extractMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return '';

        const text = (item as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

function isRetryableError(err: OpenAiError): boolean {
  if (typeof err.status === 'number') {
    return RETRYABLE_STATUSES.has(err.status);
  }

  if (err.name === 'AbortError') return true;
  if (err.message.startsWith('OpenAI: invalid response')) return true;
  if (err instanceof TypeError) return true;

  return false;
}

function createHttpError(status: number, bodyText: string): OpenAiError {
  const err = new Error(`OpenAI: ${status} ${bodyText}`) as OpenAiError;
  err.status = status;
  return err;
}

export async function analyzeFoodPhoto(imageBuffer: Buffer, mimeType: string): Promise<InsightResult> {
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const payload = {
    model: env.OPENAI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: USER_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    max_completion_tokens: 256,
    response_format: { type: 'json_object' },
  };

  let lastErr: OpenAiError | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const bodyText = await res.text();
        throw createHttpError(res.status, bodyText);
      }

      const data = await res.json() as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };

      const rawContent = extractMessageContent(data.choices?.[0]?.message?.content);
      if (!rawContent) {
        throw new Error('OpenAI: invalid response format');
      }

      return parseInsightResult(rawContent);
    } catch (err) {
      const normalized = err instanceof Error
        ? (err as OpenAiError)
        : (new Error('OpenAI: unknown error') as OpenAiError);
      lastErr = normalized;

      if (attempt >= MAX_ATTEMPTS - 1 || !isRetryableError(normalized)) {
        throw normalized;
      }

      const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] ?? 0;
      await wait(delay);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastErr ?? new Error('OpenAI: unknown error');
}
