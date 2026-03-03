import crypto from 'node:crypto';
import { env } from './env.js';

export interface TelegramUser {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

/**
 * Валидация Telegram WebApp initData по HMAC-SHA256.
 * Возвращает данные пользователя или null если невалидно.
 */
export function validateInitData(initData: string): TelegramUser | null {
  if (!initData || typeof initData !== 'string') return null;

  const params: Record<string, string> = {};
  const rawPairs: [string, string][] = [];

  for (const pair of initData.split('&')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const k = decodeURIComponent(pair.slice(0, eq));
    const v = pair.slice(eq + 1);
    params[k] = v;
    rawPairs.push([k, v]);
  }

  const hash = params.hash;
  if (!hash) return null;

  const dataCheckString = rawPairs
    .filter(([k]) => k !== 'hash')
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // Правильный порядок по Telegram docs: HMAC(key="WebAppData", data=bot_token)
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(env.TELEGRAM_BOT_TOKEN)
    .digest();

  const computed = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computed !== hash) return null;

  try {
    const user = JSON.parse(decodeURIComponent(params.user || '{}'));
    if (!user.id) return null;
    return {
      id: String(user.id),
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
    };
  } catch {
    return null;
  }
}
