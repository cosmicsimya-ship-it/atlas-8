// ═══════════════════════════════════════════════════════════════════════
// Atlas User Memory — persistent JSON storage layer
//
// Public API is storage-backend agnostic so SQLite/PostgreSQL can replace
// the JSON implementation without changing callers.
// ═══════════════════════════════════════════════════════════════════════

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DEFAULT_MEMORY_FILE = join(DATA_DIR, 'user_memory.json');

/** @type {Promise<void>} */
let writeLock = Promise.resolve();

const USER_ID_PATTERN = /^(telegram|web|anonymous):[a-zA-Z0-9_-]{1,128}$/;

/** @typedef {Record<string, unknown>} JsonObject */

/** @returns {string} */
export function getMemoryFilePath() {
  const override = process.env.ATLAS_MEMORY_FILE?.trim();
  return override || DEFAULT_MEMORY_FILE;
}

/**
 * @returns {{
 *   profile: {
 *     name: string|null,
 *     timezone: string|null,
 *     location: string|null,
 *     birthDate: string|null,
 *     birthTime: string|null,
 *     birthPlace: string|null,
 *     referenceDate: string|null,
 *     relationshipStatus: string|null,
 *   },
 *   preferences: JsonObject,
 *   facts: JsonObject,
 *   updatedAt: string|null,
 * }}
 */
export function createEmptyUserMemory() {
  return {
    profile: {
      name: null,
      timezone: null,
      location: null,
      birthDate: null,
      birthTime: null,
      birthPlace: null,
      referenceDate: null,
      relationshipStatus: null,
    },
    preferences: {},
    facts: {},
    updatedAt: null,
  };
}

function createEmptyStore() {
  return { users: {} };
}

/**
 * @param {string} userId
 * @returns {boolean}
 */
export function isValidUserId(userId) {
  return typeof userId === 'string' && USER_ID_PATTERN.test(userId.trim());
}

/**
 * @param {string} telegramUserNumericId Telegram user ID (msg.from.id), NOT chat ID
 * @returns {string}
 */
export function telegramUserId(telegramUserNumericId) {
  return `telegram:${String(telegramUserNumericId).trim()}`;
}

/**
 * @param {string} sessionId
 * @returns {string}
 */
export function webUserId(sessionId) {
  return `web:${String(sessionId).trim()}`;
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Recover from malformed JSON by archiving the corrupt file.
 * @returns {{ users: Record<string, ReturnType<typeof createEmptyUserMemory>> }}
 */
function recoverCorruptFile(raw, err) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const memoryFile = getMemoryFilePath();
  const corruptPath = `${memoryFile}.corrupt.${stamp}.json`;
  try {
    writeFileSync(corruptPath, raw, 'utf-8');
    console.error(`[Memory] Corrupt file archived to ${corruptPath}: ${err.message}`);
  } catch (archiveErr) {
    console.error(`[Memory] Failed to archive corrupt file: ${archiveErr.message}`);
  }
  return createEmptyStore();
}

/**
 * @returns {{ users: Record<string, ReturnType<typeof createEmptyUserMemory>> }}
 */
export function loadMemory() {
  ensureDataDir();
  const MEMORY_FILE = getMemoryFilePath();

  if (!existsSync(MEMORY_FILE)) {
    const empty = createEmptyStore();
    const bootstrap = saveMemory(empty);
    if (!bootstrap.ok) {
      console.error(`[Memory] Failed to create ${MEMORY_FILE}: ${bootstrap.error}`);
    }
    return empty;
  }

  let raw;
  try {
    raw = readFileSync(MEMORY_FILE, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read memory file: ${err.message}`);
  }

  if (!raw.trim()) {
    const empty = createEmptyStore();
    saveMemory(empty);
    return empty;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return recoverCorruptFile(raw, new Error('Root must be an object'));
    }
    if (!parsed.users || typeof parsed.users !== 'object' || Array.isArray(parsed.users)) {
      parsed.users = {};
    }
    return parsed;
  } catch (err) {
    return recoverCorruptFile(raw, err);
  }
}

/**
 * @param {{ users: Record<string, unknown> }} store
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function saveMemory(store) {
  if (!store || typeof store !== 'object' || Array.isArray(store)) {
    return { ok: false, error: 'Invalid memory store' };
  }
  if (!store.users || typeof store.users !== 'object' || Array.isArray(store.users)) {
    return { ok: false, error: 'Invalid users object' };
  }

  ensureDataDir();

  const memoryFile = getMemoryFilePath();
  const payload = `${JSON.stringify(store, null, 2)}\n`;
  const tempPath = `${memoryFile}.${process.pid}.${Date.now()}.tmp`;

  try {
    writeFileSync(tempPath, payload, 'utf-8');
    renameSync(tempPath, memoryFile);

    if (!existsSync(memoryFile)) {
      return { ok: false, error: 'Write verification failed' };
    }

    return { ok: true };
  } catch (err) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {
      /* ignore cleanup errors */
    }
    return { ok: false, error: err.message };
  }
}

/**
 * Serialize writes to prevent concurrent corruption.
 * @template T
 * @param {() => T | Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withWriteLock(fn) {
  const run = writeLock.then(fn, fn);
  writeLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * @param {string} userId
 * @returns {ReturnType<typeof createEmptyUserMemory>}
 */
export function getUserMemory(userId) {
  if (!isValidUserId(userId)) {
    throw new Error('Invalid user ID');
  }

  const store = loadMemory();
  const existing = store.users[userId];
  if (!existing) {
    return createEmptyUserMemory();
  }
  return normalizeUserMemory(existing);
}

function normalizeUserMemory(raw) {
  const base = createEmptyUserMemory();
  if (!raw || typeof raw !== 'object') {
    return base;
  }

  const profile = raw.profile && typeof raw.profile === 'object' ? raw.profile : {};
  for (const key of Object.keys(base.profile)) {
    const value = profile[key];
    base.profile[key] = typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  base.preferences =
    raw.preferences && typeof raw.preferences === 'object' && !Array.isArray(raw.preferences)
      ? { ...raw.preferences }
      : {};

  base.facts =
    raw.facts && typeof raw.facts === 'object' && !Array.isArray(raw.facts)
      ? { ...raw.facts }
      : {};

  base.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;

  // Preserve optional ownership metadata (backward compatible).
  if (raw.ownership && typeof raw.ownership === 'object' && !Array.isArray(raw.ownership)) {
    base.ownership = { ...raw.ownership };
  }

  return base;
}

/**
 * @param {string} userId
 * @param {ReturnType<typeof createEmptyUserMemory>} memory
 * @returns {Promise<{ ok: true, memory: ReturnType<typeof createEmptyUserMemory> } | { ok: false, error: string }>}
 */
export async function setUserMemory(userId, memory) {
  if (!isValidUserId(userId)) {
    return { ok: false, error: 'Invalid user ID' };
  }
  if (!memory || typeof memory !== 'object') {
    return { ok: false, error: 'Invalid memory object' };
  }

  return withWriteLock(() => {
    const store = loadMemory();
    const normalized = normalizeUserMemory(memory);
    normalized.updatedAt = new Date().toISOString();
    store.users[userId] = normalized;

    const saved = saveMemory(store);
    if (!saved.ok) {
      return saved;
    }
    return { ok: true, memory: normalized };
  });
}

/**
 * Deep-merge partial updates into existing user memory.
 * @param {string} userId
 * @param {Partial<ReturnType<typeof createEmptyUserMemory>>} partial
 */
export async function updateUserMemory(userId, partial) {
  if (!isValidUserId(userId)) {
    return { ok: false, error: 'Invalid user ID' };
  }

  return withWriteLock(() => {
    const store = loadMemory();
    const current = normalizeUserMemory(store.users[userId] ?? createEmptyUserMemory());

    if (partial.profile && typeof partial.profile === 'object') {
      for (const [key, value] of Object.entries(partial.profile)) {
        if (key in current.profile) {
          current.profile[key] =
            value === null || value === undefined
              ? null
              : String(value).trim() || null;
        }
      }
    }

    if (partial.preferences && typeof partial.preferences === 'object') {
      current.preferences = { ...current.preferences, ...partial.preferences };
    }

    if (partial.facts && typeof partial.facts === 'object') {
      current.facts = { ...current.facts, ...partial.facts };
    }

    current.updatedAt = new Date().toISOString();
    store.users[userId] = current;

    const saved = saveMemory(store);
    if (!saved.ok) {
      return saved;
    }
    return { ok: true, memory: current };
  });
}

/**
 * @param {string} userId
 */
export async function deleteUserMemory(userId) {
  if (!isValidUserId(userId)) {
    return { ok: false, error: 'Invalid user ID' };
  }

  return withWriteLock(() => {
    const store = loadMemory();
    if (!store.users[userId]) {
      return { ok: false, error: 'User memory not found' };
    }

    delete store.users[userId];
    const saved = saveMemory(store);
    if (!saved.ok) {
      return saved;
    }
    return { ok: true };
  });
}

/**
 * @param {string} path dot-separated e.g. profile.name or preferences.theme
 */
export function getMemoryField(userId, path) {
  if (!isValidUserId(userId)) {
    throw new Error('Invalid user ID');
  }
  if (typeof path !== 'string' || !path.trim()) {
    throw new Error('Invalid field path');
  }

  const memory = getUserMemory(userId);
  const segments = path.split('.').filter(Boolean);
  let cursor = /** @type {unknown} */ (memory);

  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) {
      return undefined;
    }
    cursor = /** @type {Record<string, unknown>} */ (cursor)[segment];
  }

  return cursor;
}

/**
 * @param {string} userId
 * @param {string} path
 * @param {unknown} value
 */
export async function setMemoryField(userId, path, value) {
  if (!isValidUserId(userId)) {
    return { ok: false, error: 'Invalid user ID' };
  }
  if (typeof path !== 'string' || !path.trim()) {
    return { ok: false, error: 'Invalid field path' };
  }

  const segments = path.split('.').filter(Boolean);
  if (segments.length === 0) {
    return { ok: false, error: 'Invalid field path' };
  }

  return withWriteLock(() => {
    const store = loadMemory();
    const memory = normalizeUserMemory(store.users[userId] ?? createEmptyUserMemory());

    let cursor = /** @type {Record<string, unknown>} */ (memory);
    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      if (!cursor[segment] || typeof cursor[segment] !== 'object') {
        cursor[segment] = {};
      }
      cursor = /** @type {Record<string, unknown>} */ (cursor[segment]);
    }

    const last = segments[segments.length - 1];
    cursor[last] = value;
    memory.updatedAt = new Date().toISOString();
    store.users[userId] = memory;

    const saved = saveMemory(store);
    if (!saved.ok) {
      return saved;
    }
    return { ok: true, memory };
  });
}

/**
 * Remove a fact or profile field.
 * @param {string} userId
 * @param {string} path
 */
export async function deleteMemoryField(userId, path) {
  if (!isValidUserId(userId)) {
    return { ok: false, error: 'Invalid user ID' };
  }

  const segments = path.split('.').filter(Boolean);
  if (segments.length === 0) {
    return { ok: false, error: 'Invalid field path' };
  }

  return withWriteLock(() => {
    const store = loadMemory();
    const memory = normalizeUserMemory(store.users[userId] ?? createEmptyUserMemory());

    let cursor = /** @type {Record<string, unknown>} */ (memory);
    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      if (!cursor[segment] || typeof cursor[segment] !== 'object') {
        return { ok: false, error: 'Field not found' };
      }
      cursor = /** @type {Record<string, unknown>} */ (cursor[segment]);
    }

    const last = segments[segments.length - 1];
    if (!(last in cursor)) {
      return { ok: false, error: 'Field not found' };
    }

    if (segments[0] === 'profile') {
      cursor[last] = null;
    } else {
      delete cursor[last];
    }

    memory.updatedAt = new Date().toISOString();
    store.users[userId] = memory;

    const saved = saveMemory(store);
    if (!saved.ok) {
      return saved;
    }
    return { ok: true, memory };
  });
}

/**
 * Test helper — reset store.
 * Refuses to wipe production data/user_memory.json unless ATLAS_MEMORY_FILE
 * points at an isolated test file (or ATLAS_ALLOW_MEMORY_RESET=1).
 */
export async function resetMemoryStoreForTests(store = createEmptyStore()) {
  const target = getMemoryFilePath();
  const isOverride = Boolean(process.env.ATLAS_MEMORY_FILE?.trim());
  const allowProd = process.env.ATLAS_ALLOW_MEMORY_RESET === '1';
  if (!isOverride && !allowProd && target === DEFAULT_MEMORY_FILE) {
    console.warn(
      `[Memory] resetMemoryStoreForTests refused for production file ${target}. ` +
        `Set ATLAS_MEMORY_FILE to a temp path.`,
    );
    return { ok: false, error: 'refused_production_memory_reset' };
  }
  return withWriteLock(() => saveMemory(store));
}
