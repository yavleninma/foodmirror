import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.TELEGRAM_BOT_TOKEN ??= 'test-token';
process.env.OPENAI_API_KEY ??= 'test-key';
process.env.OPENAI_MODEL ??= 'gpt-4o-mini';

const { analyzeFoodPhoto } = await import('./openai.js');

const ORIGINAL_FETCH = globalThis.fetch;

function createCompletionResponse(content: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

test.afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

test('analyzeFoodPhoto retries transient fetch failure and uses max_completion_tokens payload', async () => {
  let calls = 0;

  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls += 1;

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body.max_completion_tokens, 256);
    assert.equal('max_tokens' in body, false);

    if (calls === 1) {
      throw new TypeError('fetch failed');
    }

    return createCompletionResponse('{"verdict":"норма","correction":"ешь медленнее"}');
  }) as typeof fetch;

  const result = await analyzeFoodPhoto(Buffer.from([1, 2, 3]), 'image/png');

  assert.equal(result.verdict, 'норма');
  assert.equal(result.correction, 'ешь медленнее');
  assert.equal(calls, 2);
});

test('analyzeFoodPhoto accepts markdown wrapped JSON from model response', async () => {
  globalThis.fetch = (async () => {
    return createCompletionResponse('```json\n{"verdict":"хорошо","correction":"оставь такой же темп"}\n```');
  }) as typeof fetch;

  const result = await analyzeFoodPhoto(Buffer.from([1, 2, 3]), 'image/jpeg');

  assert.equal(result.verdict, 'хорошо');
  assert.equal(result.correction, 'оставь такой же темп');
});

test('analyzeFoodPhoto does not retry OpenAI 429 responses', async () => {
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    return new Response('rate limited', {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }) as typeof fetch;

  await assert.rejects(
    () => analyzeFoodPhoto(Buffer.from([1, 2, 3]), 'image/webp'),
    /OpenAI:\s*429/
  );

  assert.equal(calls, 1);
});
