import { Router } from 'express';
import multer from 'multer';
import { ACCEPTED_IMAGE_TYPES, MAX_PHOTO_SIZE_MB } from '@foodmirror/shared';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { createInsight } from '../services/insight.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ACCEPTED_IMAGE_TYPES.includes(file.mimetype));
  },
});

export const insightRouter = Router();

insightRouter.post('/', requireAuth, rateLimit, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Фото не прикреплено.' });
      return;
    }

    const result = await createInsight({
      user: req.telegramUser!,
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});
