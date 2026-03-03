import { Router } from 'express';
import { requireAuth, requireTelegramUser } from '../middleware/auth.js';
import { getStats } from '../services/user.js';

export const statsRouter = Router();

statsRouter.get('/', requireAuth, requireTelegramUser, async (req, res, next) => {
  try {
    const result = await getStats(req.telegramUser!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
