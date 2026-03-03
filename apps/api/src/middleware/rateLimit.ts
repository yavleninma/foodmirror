import type { Request, Response, NextFunction } from 'express';

const requests = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

/**
 * Простой in-memory rate limiter по userId.
 * Для продакшена заменить на Redis-based.
 */
export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const userId = req.telegramUser?.id;
  if (!userId) {
    next();
    return;
  }

  const now = Date.now();
  const entry = requests.get(userId);

  if (!entry || now > entry.resetAt) {
    requests.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Слишком много запросов. Подожди минуту.' });
    return;
  }

  entry.count++;
  next();
}
