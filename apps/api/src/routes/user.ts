import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireTelegramUser } from '../middleware/auth.js';
import { updateGoal, ensureUser } from '../services/user.js';

export const userRouter = Router();

const goalSchema = z.object({
  goal: z.string().min(1).max(200),
});

userRouter.put('/goal', requireAuth, requireTelegramUser, async (req, res, next) => {
  try {
    const parsed = goalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Укажи цель (1–200 символов).' });
      return;
    }
    const result = await updateGoal(req.telegramUser!, parsed.data.goal);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

userRouter.get('/me', requireAuth, requireTelegramUser, async (req, res, next) => {
  try {
    const user = await ensureUser(req.telegramUser!);
    res.json({
      id: user.id,
      firstName: user.firstName,
      goal: user.goal,
    });
  } catch (err) {
    next(err);
  }
});
