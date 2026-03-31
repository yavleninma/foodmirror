const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const STORE_KEY = 'foodmirror-store-v2';
const DEV_STORE_PATH = path.join(process.cwd(), 'data', 'dev-store.json');
const AUTH_TOKEN_TTL_MS = 1000 * 60 * 15;
let redisClientPromise = null;

function baseStore() {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    profiles: {},
    foodEntries: {},
    weightEntries: {},
    drafts: {},
    authTokens: {}
  };
}

function hasRedisUrl() {
  return Boolean(process.env.REDIS_URL);
}

function hasRedisRest() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function hasRedis() {
  return hasRedisUrl() || hasRedisRest();
}

function normalize(store) {
  const value = store || {};
  return {
    ...baseStore(),
    ...value,
    profiles: value.profiles || {},
    foodEntries: value.foodEntries || {},
    weightEntries: value.weightEntries || {},
    drafts: value.drafts || {},
    authTokens: value.authTokens || {}
  };
}

async function readStore() {
  return normalize(hasRedis() ? await readRedisStore() : await readFileStore());
}

async function writeStore(store) {
  store.updatedAt = new Date().toISOString();
  if (hasRedis()) {
    await writeRedisStore(store);
    return;
  }
  await writeFileStore(store);
}

async function withStore(mutator) {
  const store = await readStore();
  const result = await mutator(store);
  pruneAuthTokens(store);
  await writeStore(store);
  return result;
}

function ensureProfile(store, userId, name = 'User', source = 'web') {
  if (!store.profiles[userId]) {
    store.profiles[userId] = {
      userId,
      name,
      source,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } else {
    if (name && store.profiles[userId].name !== name) {
      store.profiles[userId].name = name;
    }
    if (source && store.profiles[userId].source !== source) {
      store.profiles[userId].source = source;
    }
    store.profiles[userId].updatedAt = new Date().toISOString();
  }
  ensureCollections(store, userId);
  return store.profiles[userId];
}

function ensureCollections(store, userId) {
  if (!Array.isArray(store.foodEntries[userId])) store.foodEntries[userId] = [];
  if (!Array.isArray(store.weightEntries[userId])) store.weightEntries[userId] = [];
}

function getFoodEntries(store, userId) {
  ensureCollections(store, userId);
  return store.foodEntries[userId];
}

function getWeightEntries(store, userId) {
  ensureCollections(store, userId);
  return store.weightEntries[userId];
}

function upsertDraft(store, draft) {
  store.drafts[draft.id] = draft;
  return draft;
}

function getDraft(store, draftId) {
  return store.drafts[draftId] || null;
}

function removeDraft(store, draftId) {
  delete store.drafts[draftId];
}

function createAuthToken(store, payload) {
  const token = crypto.randomBytes(24).toString('hex');
  store.authTokens[token] = {
    ...payload,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + AUTH_TOKEN_TTL_MS).toISOString()
  };
  return token;
}

function consumeAuthToken(store, token) {
  const value = store.authTokens[token];
  delete store.authTokens[token];
  if (!value) return null;
  if (new Date(value.expiresAt).getTime() < Date.now()) return null;
  return value;
}

function pruneAuthTokens(store) {
  const now = Date.now();
  for (const [token, value] of Object.entries(store.authTokens)) {
    if (new Date(value.expiresAt).getTime() < now) {
      delete store.authTokens[token];
    }
  }
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readRedisStore() {
  if (hasRedisUrl()) {
    const client = await getRedisClient();
    const value = await client.get(STORE_KEY);
    if (!value) return baseStore();
    try {
      return JSON.parse(value);
    } catch {
      return baseStore();
    }
  }

  const response = await redisRestCommand(['GET', STORE_KEY]);
  if (!response?.result) return baseStore();
  try {
    return JSON.parse(response.result);
  } catch {
    return baseStore();
  }
}

async function writeRedisStore(store) {
  if (hasRedisUrl()) {
    const client = await getRedisClient();
    await client.set(STORE_KEY, JSON.stringify(store));
    return;
  }

  await redisRestCommand(['SET', STORE_KEY, JSON.stringify(store)]);
}

async function getRedisClient() {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is not configured');
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const { createClient } = require('redis');
      const client = createClient({ url: process.env.REDIS_URL });
      client.on('error', (error) => {
        console.error('Redis client error:', error.message);
      });
      await client.connect();
      return client;
    })();
  }
  return redisClientPromise;
}

async function redisRestCommand(command) {
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!response.ok) {
    throw new Error(`Redis request failed: ${await response.text()}`);
  }
  return response.json();
}

async function readFileStore() {
  try {
    return JSON.parse(await fs.readFile(DEV_STORE_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return baseStore();
    throw error;
  }
}

async function writeFileStore(store) {
  await fs.mkdir(path.dirname(DEV_STORE_PATH), { recursive: true });
  await fs.writeFile(DEV_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

module.exports = {
  consumeAuthToken,
  createAuthToken,
  ensureProfile,
  generateId,
  getDraft,
  getFoodEntries,
  getWeightEntries,
  readStore,
  removeDraft,
  upsertDraft,
  withStore
};
