import { Router } from 'express';
import { HISTORY_PAGE_SIZE } from '@foodmirror/shared';
import { requireAuth, requireTelegramUser } from '../middleware/auth.js';
import { getHistory } from '../services/user.js';

export const historyRouter = Router();

historyRouter.get('/', requireAuth, requireTelegramUser, async (req, res, next) => {
  try {
    const limit = Math.min(
      parseInt(req.query.limit as string, 10) || HISTORY_PAGE_SIZE,
      50
    );
    const cursor = req.query.cursor as string | undefined;
    const result = await getHistory(req.telegramUser!.id, limit, cursor);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
