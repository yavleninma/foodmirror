import test from 'node:test';
import assert from 'node:assert/strict';
import type { NextFunction, Request, Response } from 'express';

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.TELEGRAM_BOT_TOKEN ??= 'test-token';
process.env.OPENAI_API_KEY ??= 'test-key';
process.env.DEV_TELEGRAM_MOCK_ENABLED ??= '1';

const { requireAuth, requireTelegramUser } = await import('./auth.js');

interface MockResponse extends Partial<Response> {
  statusCode?: number;
  jsonBody?: unknown;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res as Response;
  };
  res.json = (body: unknown) => {
    res.jsonBody = body;
    return res as Response;
  };
  return res;
}

test('requireAuth resolves guest mode from X-Guest-Token', () => {
  const req = {
    headers: { 'x-guest-token': '00000000-0000-4000-8000-000000000000' },
    body: {},
    query: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;

  const res = createMockResponse() as Response;
  let called = false;
  const next: NextFunction = () => {
    called = true;
  };

  requireAuth(req, res, next);

  assert.equal(called, true);
  assert.equal(req.authMode, 'guest');
  assert.match(req.telegramUser?.id ?? '', /^guest_/);
});

test('requireAuth resolves telegram mode from local dev mock initData', () => {
  const devInitData = `dev_mock:${encodeURIComponent(JSON.stringify({
    id: '424242',
    first_name: 'LocalDev',
    username: 'local_dev',
  }))}`;

  const req = {
    headers: {
      'x-init-data': devInitData,
    },
    body: {},
    query: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;

  const res = createMockResponse() as Response;
  let called = false;
  const next: NextFunction = () => {
    called = true;
  };

  requireAuth(req, res, next);

  assert.equal(called, true);
  assert.equal(req.authMode, 'telegram');
  assert.equal(req.telegramUser?.id, '424242');
  assert.equal(req.telegramUser?.firstName, 'LocalDev');
});

test('requireAuth falls back to anonymous mode when no Telegram or guest token', () => {
  const req = {
    headers: { 'user-agent': 'node-test' },
    body: {},
    query: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;

  const res = createMockResponse() as Response;
  let called = false;
  const next: NextFunction = () => {
    called = true;
  };

  requireAuth(req, res, next);

  assert.equal(called, true);
  assert.equal(req.authMode, 'anonymous');
  assert.match(req.telegramUser?.id ?? '', /^anon_/);
});

test('requireTelegramUser blocks non-telegram mode', () => {
  const req = { authMode: 'guest' } as Request;
  const res = createMockResponse();
  let called = false;
  const next: NextFunction = () => {
    called = true;
  };

  requireTelegramUser(req, res as Response, next);

  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.jsonBody, { error: 'Эта функция доступна только в Telegram.' });
});
