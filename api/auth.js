const { buildBotLoginUrl, clearSession, getSessionFromRequest, isWebSigninAllowed, setSession, verifyTelegramWebApp } = require('./_lib/auth');
const { consumeAuthToken, ensureProfile, generateId, withStore } = require('./_lib/storage');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (req.query.action !== 'session') return res.status(400).json({ error: 'Unsupported GET action' });
      const session = getSessionFromRequest(req);
      return res.status(200).json({
        authenticated: Boolean(session),
        session,
        botLoginUrl: await buildBotLoginUrl(),
        allowWebSignin: isWebSigninAllowed()
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = req.body || {};

    if (body.action === 'logout') {
      clearSession(res);
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'web_signin') {
      if (!isWebSigninAllowed()) return res.status(403).json({ error: 'Web sign-in is disabled' });
      const name = String(body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Name is required' });
      const profile = await withStore(async (store) => ensureProfile(store, `web_${generateId('user')}`, name, 'web'));
      setSession(res, { userId: profile.userId, name: profile.name, source: 'web' });
      return res.status(200).json({ authenticated: true, session: { userId: profile.userId, name: profile.name, source: 'web' } });
    }

    if (body.action === 'exchange_token') {
      const token = String(body.token || '').trim();
      if (!token) return res.status(400).json({ error: 'Token is required' });
      const result = await withStore(async (store) => consumeAuthToken(store, token));
      if (!result?.userId) return res.status(401).json({ error: 'Token is invalid or expired' });
      setSession(res, { userId: result.userId, name: result.name, source: result.source || 'telegram' });
      return res.status(200).json({
        authenticated: true,
        session: { userId: result.userId, name: result.name, source: result.source || 'telegram' },
        draftId: result.draftId || null
      });
    }

    if (body.action === 'telegram_webapp_signin') {
      const telegram = verifyTelegramWebApp(String(body.initData || ''));
      await withStore(async (store) => ensureProfile(store, telegram.userId, telegram.name, 'telegram'));
      setSession(res, telegram);
      return res.status(200).json({ authenticated: true, session: telegram });
    }

    return res.status(400).json({ error: 'Unsupported action' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Auth request failed' });
  }
};
