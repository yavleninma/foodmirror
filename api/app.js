const { getSessionFromRequest } = require('./_lib/auth');
const { analyzeMealFromImage } = require('./_lib/food');
const { ensureProfile, generateId, getDraft, getFoodEntries, getWeightEntries, readStore, removeDraft, upsertDraft, withStore } = require('./_lib/storage');

module.exports = async function handler(req, res) {
  try {
    const session = getSessionFromRequest(req);
    if (!session?.userId) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'GET') {
      if (req.query.action !== 'bootstrap') return res.status(400).json({ error: 'Unsupported GET action' });
      return res.status(200).json(await bootstrap(session, req.query));
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = req.body || {};

    if (body.action === 'analyze_food') {
      const result = await withStore(async (store) => {
        ensureProfile(store, session.userId, session.name || 'User', session.source || 'web');
        const analysis = await analyzeMealFromImage({ imageDataUrl: body.imageDataUrl, locale: body.lang || 'ru' });
        const draft = {
          id: generateId('draft'),
          userId: session.userId,
          date: normalizeDate(body.date),
          imageDataUrl: body.imageDataUrl,
          source: session.source === 'telegram' ? 'telegram' : 'web',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...analysis
        };
        upsertDraft(store, draft);
        return { draft };
      });
      return res.status(200).json(result);
    }

    if (body.action === 'save_food') {
      const result = await withStore(async (store) => {
        ensureProfile(store, session.userId, session.name || 'User', session.source || 'web');
        const entries = getFoodEntries(store, session.userId);
        const incoming = sanitizeEntry(body.entry, session.userId);
        let saved;

        if (incoming.entryId) {
          const index = entries.findIndex((entry) => entry.id === incoming.entryId);
          if (index === -1) throw new Error('Entry not found');
          saved = { ...entries[index], ...incoming, id: entries[index].id, updatedAt: new Date().toISOString() };
          entries[index] = saved;
        } else {
          saved = {
            ...incoming,
            id: generateId('meal'),
            source: incoming.source || 'web',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          entries.push(saved);
        }

        if (incoming.id) removeDraft(store, incoming.id);
        return { entry: saved };
      });
      return res.status(200).json(result);
    }

    if (body.action === 'reuse_food') {
      const result = await withStore(async (store) => {
        const entries = getFoodEntries(store, session.userId);
        const original = entries.find((entry) => entry.id === body.entryId);
        if (!original) throw new Error('Entry not found');
        const cloned = {
          ...original,
          id: generateId('meal'),
          date: normalizeDate(body.targetDate),
          source: 'repeat',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        entries.push(cloned);
        return { entry: cloned };
      });
      return res.status(200).json(result);
    }

    if (body.action === 'delete_food') {
      await withStore(async (store) => {
        const entries = getFoodEntries(store, session.userId);
        const index = entries.findIndex((entry) => entry.id === body.entryId);
        if (index >= 0) entries.splice(index, 1);
        return {};
      });
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'save_weight') {
      const result = await withStore(async (store) => {
        ensureProfile(store, session.userId, session.name || 'User', session.source || 'web');
        const weights = getWeightEntries(store, session.userId);
        const weight = {
          id: generateId('weight'),
          date: normalizeDate(body.date),
          value: Number(body.value),
          note: String(body.note || ''),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        weights.push(weight);
        return { weight };
      });
      return res.status(200).json(result);
    }

    if (body.action === 'delete_weight') {
      await withStore(async (store) => {
        const weights = getWeightEntries(store, session.userId);
        const index = weights.findIndex((entry) => entry.id === body.weightId);
        if (index >= 0) weights.splice(index, 1);
        return {};
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unsupported action' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unexpected server error' });
  }
};

async function bootstrap(session, query) {
  const store = await readStore();
  ensureProfile(store, session.userId, session.name || 'User', session.source || 'web');

  const selectedDate = normalizeDate(query.date);
  const entries = [...getFoodEntries(store, session.userId)].sort(sortDesc);
  const weights = [...getWeightEntries(store, session.userId)].sort(sortDesc);
  const draft = query.draftId ? getDraft(store, query.draftId) : null;

  return {
    generatedAt: new Date().toISOString(),
    profile: store.profiles[session.userId],
    day: {
      date: selectedDate,
      summary: summarize(entries.filter((entry) => entry.date === selectedDate)),
      entries: entries.filter((entry) => entry.date === selectedDate)
    },
    weights: weights.slice(0, 10),
    calendar: buildCalendar(entries, weights, selectedDate),
    stats: buildStats(entries),
    allEntries: entries,
    draft: draft && draft.userId === session.userId ? draft : null
  };
}

function buildCalendar(entries, weights, selectedDate) {
  const days = [];
  for (let index = 0; index < 21; index += 1) {
    const current = shiftDate(selectedDate, -index);
    days.push({
      date: current,
      summary: summarize(entries.filter((entry) => entry.date === current)),
      weight: weights.find((entry) => entry.date === current) || null
    });
  }
  return days;
}

function buildStats(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    if (!grouped.has(entry.date)) grouped.set(entry.date, []);
    grouped.get(entry.date).push(entry);
  }
  const recent = [...grouped.values()].slice(0, 7);
  if (!recent.length) return { averageCalories: 0, averageProtein: 0, loggedDays: 0 };
  const totals = recent.map(summarize);
  return {
    averageCalories: Math.round(totals.reduce((sum, item) => sum + item.calories, 0) / totals.length),
    averageProtein: Math.round(totals.reduce((sum, item) => sum + item.protein, 0) / totals.length),
    loggedDays: grouped.size
  };
}

function summarize(entries) {
  return entries.reduce(
    (acc, entry) => {
      acc.calories += Number(entry.calories || 0);
      acc.protein += Number(entry.protein || 0);
      acc.fat += Number(entry.fat || 0);
      acc.carbs += Number(entry.carbs || 0);
      return acc;
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
}

function sanitizeEntry(entry, userId) {
  return {
    id: entry.id || null,
    entryId: entry.entryId || null,
    userId,
    date: normalizeDate(entry.date),
    title: String(entry.title || 'Meal').slice(0, 120),
    calories: normalizeNumber(entry.calories),
    protein: normalizeNumber(entry.protein),
    fat: normalizeNumber(entry.fat),
    carbs: normalizeNumber(entry.carbs),
    confidence: ['confident', 'normal', 'check', 'unsure'].includes(entry.confidence) ? entry.confidence : 'normal',
    notes: String(entry.notes || '').slice(0, 500),
    imageDataUrl: String(entry.imageDataUrl || ''),
    source: entry.source || 'web',
    clarificationQuestion: String(entry.clarificationQuestion || '').slice(0, 240),
    analysisSource: String(entry.analysisSource || '')
  };
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function normalizeDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today();
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Asia/Bangkok' }).format(new Date());
}

function shiftDate(iso, delta) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

function sortDesc(left, right) {
  return new Date(right.updatedAt || right.createdAt || right.date) - new Date(left.updatedAt || left.createdAt || left.date);
}
