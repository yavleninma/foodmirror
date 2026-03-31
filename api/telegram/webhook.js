const { analyzeMealFromImage } = require('../_lib/food');
const { createAuthToken, ensureProfile, generateId, upsertDraft, withStore } = require('../_lib/storage');
const { buildAuthLink, extractIncomingPhoto, extractStartCommand, getTelegramPhotoDataUrl, telegramRequest } = require('../_lib/telegram');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
      return res.status(401).json({ error: 'Invalid Telegram secret' });
    }

    const update = req.body || {};
    const start = extractStartCommand(update);
    if (start) {
      await sendLoginButton(req, start.chatId, `tg-${start.userId}`, start.name || 'Telegram user');
      return res.status(200).json({ ok: true, mode: 'start' });
    }

    const photo = extractIncomingPhoto(update);
    if (!photo) return res.status(200).json({ ok: true, ignored: true });

    const userId = `tg-${photo.userId}`;
    const name = photo.name || 'Telegram user';
    const imageDataUrl = await getTelegramPhotoDataUrl(photo.fileId);
    const analysis = await analyzeMealFromImage({ imageDataUrl, locale: 'ru', hint: photo.caption });

    const result = await withStore(async (store) => {
      ensureProfile(store, userId, name, 'telegram');
      const draft = {
        id: generateId('draft'),
        userId,
        date: today(),
        imageDataUrl,
        source: 'telegram',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...analysis
      };
      upsertDraft(store, draft);
      const authToken = createAuthToken(store, { userId, name, source: 'telegram', draftId: draft.id });
      return { draft, authToken };
    });

    const link = buildAuthLink({ token: result.authToken, req });
    let message = `Черновик готов: ${result.draft.title}\n${result.draft.calories} ккал · Б ${result.draft.protein} / Ж ${result.draft.fat} / У ${result.draft.carbs}\nУверенность: ${label(result.draft.confidence)}.`;
    if (result.draft.clarificationQuestion) {
      message += `\n\nПроверь: ${result.draft.clarificationQuestion}`;
    }

    await telegramRequest('sendMessage', {
      chat_id: photo.chatId,
      text: message,
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть FoodMirror', url: link }]]
      }
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Telegram webhook failed' });
  }
};

async function sendLoginButton(req, chatId, userId, name) {
  const authToken = await withStore(async (store) => {
    ensureProfile(store, userId, name, 'telegram');
    return createAuthToken(store, { userId, name, source: 'telegram' });
  });

  await telegramRequest('sendMessage', {
    chat_id: chatId,
    text: 'Открываю FoodMirror в твоем аккаунте. Нажми кнопку ниже.',
    reply_markup: {
      inline_keyboard: [[{ text: 'Открыть FoodMirror', url: buildAuthLink({ token: authToken, req }) }]]
    }
  });
}

function label(value) {
  if (value === 'confident') return 'Уверенно';
  if (value === 'check') return 'Стоит проверить';
  if (value === 'unsure') return 'Неуверенно';
  return 'Нормально';
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Asia/Bangkok' }).format(new Date());
}
