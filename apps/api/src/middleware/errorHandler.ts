import type { Request, Response, NextFunction } from 'express';
import { env } from '../lib/env.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[error]', err);

  if (err.message && /OpenAI:\s*429/.test(err.message)) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: 'Слишком много запросов. Подожди минуту.' });
    return;
  }

  const message = env.NODE_ENV === 'production'
    ? 'Что-то пошло не так. Попробуй позже.'
    : err.message;

  res.status(500).json({ error: message });
}
