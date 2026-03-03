import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../lib/env.js';
import { validateInitData, type TelegramUser } from '../lib/telegram.js';

export type AuthMode = 'telegram' | 'guest' | 'anonymous';

declare global {
  namespace Express {
    interface Request {
      telegramUser?: TelegramUser;
      authMode?: AuthMode;
    }
  }
}

const GUEST_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEV_MOCK_INIT_DATA_PREFIX = 'dev_mock:';

function isEnabledFlag(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseDevMockInitData(initData: string): TelegramUser | null {
  if (!initData.startsWith(DEV_MOCK_INIT_DATA_PREFIX)) return null;

  try {
    const encoded = initData.slice(DEV_MOCK_INIT_DATA_PREFIX.length);
    const raw = JSON.parse(decodeURIComponent(encoded)) as Record<string, unknown>;
    const id = String(raw.id || '').trim();
    if (!id) return null;

    const firstName = typeof raw.first_name === 'string' ? raw.first_name : env.DEV_TELEGRAM_MOCK_FIRST_NAME;
    const lastName = typeof raw.last_name === 'string' ? raw.last_name : env.DEV_TELEGRAM_MOCK_LAST_NAME;
    const username = typeof raw.username === 'string' ? raw.username : env.DEV_TELEGRAM_MOCK_USERNAME;

    return { id, firstName, lastName, username };
  } catch {
    return null;
  }
}

/**
 * Middleware: определяет пользователя из любого доступного источника.
 * 1. Telegram initData (X-Init-Data) — приоритет, полная валидация HMAC
 * 2. Guest UUID (X-Guest-Token) — для веб-режима, постоянный ID через localStorage
 * 3. Анонимный гость по IP+UA — фоллбэк, если токен гостя не передан
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // 1. Telegram initData
  const initData =
    (req.headers['x-init-data'] as string) ||
    req.body?.initData ||
    (req.query.initData as string);

  if (initData) {
    const canUseDevMock = env.NODE_ENV === 'development' && isEnabledFlag(env.DEV_TELEGRAM_MOCK_ENABLED);
    if (canUseDevMock) {
      const devUser = parseDevMockInitData(initData);
      if (devUser) {
        req.telegramUser = devUser;
        req.authMode = 'telegram';
        next();
        return;
      }
    }

    const user = validateInitData(initData);
    if (user) {
      req.telegramUser = user;
      req.authMode = 'telegram';
      next();
      return;
    }
    // initData есть, но невалидна — возможно старая/подделанная, падаем на гостя
  }

  // 2. UUID гость (веб-режим, хранится в localStorage)
  const guestToken = req.headers['x-guest-token'] as string | undefined;
  if (guestToken && GUEST_TOKEN_RE.test(guestToken)) {
    const hash = crypto.createHash('sha256').update(guestToken).digest('hex').slice(0, 15);
    req.telegramUser = { id: `guest_${hash}`, firstName: 'Гость' };
    req.authMode = 'guest';
    next();
    return;
  }

  // 3. Анонимный фоллбэк по IP+User-Agent
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
  const ua = (req.headers['user-agent'] || '').slice(0, 200);
  const anonHash = crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 15);
  req.telegramUser = { id: `anon_${anonHash}`, firstName: 'Аноним' };
  req.authMode = 'anonymous';
  next();
}

export function requireTelegramUser(req: Request, res: Response, next: NextFunction): void {
  if (req.authMode !== 'telegram') {
    res.status(403).json({ error: 'Эта функция доступна только в Telegram.' });
    return;
  }
  next();
}
