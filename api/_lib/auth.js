const crypto = require('node:crypto');

const SESSION_COOKIE = 'foodmirror_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
let botUsernamePromise = null;

function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.TELEGRAM_BOT_TOKEN || 'foodmirror-dev-secret';
}

function isWebSigninAllowed() {
  const raw = process.env.ALLOW_WEB_SIGNIN;
  if (typeof raw === 'string' && raw.length > 0) return raw === 'true';
  return process.env.NODE_ENV !== 'production';
}

function createSessionPayload({ userId, name, source }) {
  return {
    userId,
    name,
    source,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };
}

function signSession(payload) {
  const encoded = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.userId || !payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers?.cookie || '');
  return verifySession(cookies[SESSION_COOKIE]);
}

function setSession(res, session) {
  const token = signSession(createSessionPayload(session));
  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, token, SESSION_TTL_SECONDS));
  return token;
}

function clearSession(res) {
  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, '', 0));
}

function serializeCookie(name, value, maxAge) {
  const parts = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

function parseCookies(header) {
  return header.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = rest.join('=');
    return acc;
  }, {});
}

function verifyTelegramWebApp(initData) {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const params = new URLSearchParams(initData || '');
  const hash = params.get('hash');
  if (!hash) throw new Error('Telegram hash is missing');
  params.delete('hash');

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 60 * 60 * 24) {
    throw new Error('Telegram auth is expired');
  }

  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const digest = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (!safeEqual(hash, digest)) throw new Error('Telegram auth verification failed');

  const user = JSON.parse(params.get('user') || '{}');
  if (!user.id) throw new Error('Telegram user is missing');

  return {
    userId: `tg-${user.id}`,
    name: [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username || `Telegram ${user.id}`,
    source: 'telegram',
    telegramUser: user
  };
}

async function buildBotLoginUrl() {
  const username = await resolveBotUsername();
  return username ? `https://t.me/${username}?start=login` : null;
}

async function resolveBotUsername() {
  const configured = (process.env.TELEGRAM_BOT_NAME || '').trim().replace(/^@/, '');
  if (configured) return configured;
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;
  if (!botUsernamePromise) {
    botUsernamePromise = fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`)
      .then((response) => response.json())
      .then((data) => (data.ok ? data.result?.username || null : null))
      .catch(() => null);
  }
  return botUsernamePromise;
}

function base64url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = {
  buildBotLoginUrl,
  clearSession,
  getSessionFromRequest,
  isWebSigninAllowed,
  setSession,
  verifyTelegramWebApp
};
