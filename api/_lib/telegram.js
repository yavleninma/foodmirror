async function telegramRequest(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram request failed for ${method}`);
  }
  return data.result;
}

async function getTelegramPhotoDataUrl(fileId) {
  const file = await telegramRequest('getFile', { file_id: fileId });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!response.ok) throw new Error('Unable to download Telegram file');
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || guessMimeType(file.file_path);
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:${contentType};base64,${base64}`;
}

function extractIncomingPhoto(update) {
  const message = update.message || update.edited_message;
  if (!message?.photo?.length) return null;
  const photo = [...message.photo].sort((left, right) => (right.file_size || 0) - (left.file_size || 0))[0];
  return {
    chatId: message.chat.id,
    userId: message.from?.id,
    name: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ').trim(),
    caption: message.caption || '',
    fileId: photo.file_id
  };
}

function extractStartCommand(update) {
  const text = update.message?.text || '';
  if (!text.startsWith('/start')) return null;
  const [, payload = ''] = text.split(' ');
  return {
    chatId: update.message.chat.id,
    userId: update.message.from?.id,
    name: [update.message.from?.first_name, update.message.from?.last_name].filter(Boolean).join(' ').trim(),
    payload
  };
}

function buildAuthLink({ token, req }) {
  const url = new URL(resolveBaseUrl(req));
  url.searchParams.set('auth', token);
  return url.toString();
}

function resolveBaseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;

  const host = firstHeaderValue(req?.headers?.['x-forwarded-host']) || firstHeaderValue(req?.headers?.host);
  const proto = firstHeaderValue(req?.headers?.['x-forwarded-proto']) || 'https';
  if (!host) throw new Error('Unable to determine app base URL');
  return `${proto}://${host}`;
}

function firstHeaderValue(value) {
  return String(value || '').split(',')[0].trim();
}

function guessMimeType(filePath) {
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

module.exports = {
  buildAuthLink,
  extractIncomingPhoto,
  extractStartCommand,
  getTelegramPhotoDataUrl,
  telegramRequest
};
