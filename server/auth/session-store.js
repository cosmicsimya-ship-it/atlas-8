// ═══════════════════════════════════════════════════════════════════════
// Session store — hashed tokens only; fails closed on I/O errors
// Abstraction ready for Redis / SQLite / PostgreSQL.
// ═══════════════════════════════════════════════════════════════════════

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', '..', 'data', 'auth_sessions.json');

/** @type {string} */
let storePath = DEFAULT_PATH;
/** @type {boolean} */
let failClosed = false;

/**
 * @param {string} rawToken
 */
export function hashSessionToken(rawToken) {
  return createHash('sha256').update(String(rawToken), 'utf8').digest('hex');
}

/**
 * @param {string} a
 * @param {string} b
 */
export function safeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a), 'utf8');
    const bb = Buffer.from(String(b), 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function emptyStore() {
  return { sessions: {} };
}

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * @param {string} [filePath]
 */
export function configureSessionStore(filePath) {
  storePath = filePath || DEFAULT_PATH;
  failClosed = false;
}

export function getSessionStorePath() {
  return storePath;
}

/**
 * @returns {{ sessions: Record<string, object> }}
 */
function loadStore() {
  try {
    ensureDir(storePath);
    if (!existsSync(storePath)) {
      const empty = emptyStore();
      writeFileSync(storePath, JSON.stringify(empty, null, 2), 'utf8');
      return empty;
    }
    const raw = readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.sessions !== 'object') {
      failClosed = true;
      throw new Error('corrupt_session_store');
    }
    failClosed = false;
    return { sessions: { ...parsed.sessions } };
  } catch (err) {
    failClosed = true;
    const error = new Error(`session_store_unavailable: ${err?.message ?? err}`);
    error.code = 'SESSION_STORE_FAIL';
    throw error;
  }
}

/**
 * @param {{ sessions: Record<string, object> }} store
 */
function saveStore(store) {
  try {
    ensureDir(storePath);
    const tmp = `${storePath}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    renameSync(tmp, storePath);
    failClosed = false;
  } catch (err) {
    failClosed = true;
    const error = new Error(`session_store_write_failed: ${err?.message ?? err}`);
    error.code = 'SESSION_STORE_FAIL';
    throw error;
  }
}

export function isSessionStoreFailedClosed() {
  return failClosed;
}

/**
 * Create a session. Returns raw token once (never stored).
 * @param {{
 *   userId: string,
 *   roles?: string[],
 *   authMethod?: string,
 *   ttlMs?: number,
 *   meta?: object,
 * }} input
 */
export function createSession(input) {
  const store = loadStore();
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(rawToken);
  const now = new Date();
  const ttlMs = input.ttlMs ?? Number(process.env.ATLAS_SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

  store.sessions[tokenHash] = {
    userId: input.userId,
    roles: Array.isArray(input.roles) ? [...input.roles] : ['user'],
    authMethod: input.authMethod ?? 'session',
    createdAt: now.toISOString(),
    expiresAt,
    lastSeenAt: now.toISOString(),
    revokedAt: null,
    meta: input.meta ?? {},
  };

  saveStore(store);
  return { rawToken, tokenHash, expiresAt, session: store.sessions[tokenHash] };
}

/**
 * @param {string} rawToken
 * @returns {object|null}
 */
export function getSessionByRawToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const store = loadStore();
  const tokenHash = hashSessionToken(rawToken);
  const session = store.sessions[tokenHash];
  if (!session) return null;
  return { ...session, tokenHash };
}

/**
 * @param {string} rawToken
 * @returns {{ ok: true, session: object } | { ok: false, reason: string }}
 */
export function validateSession(rawToken) {
  try {
    const session = getSessionByRawToken(rawToken);
    if (!session) return { ok: false, reason: 'not_found' };
    if (session.revokedAt) return { ok: false, reason: 'revoked' };
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, session };
  } catch (err) {
    if (err?.code === 'SESSION_STORE_FAIL') {
      return { ok: false, reason: 'store_unavailable' };
    }
    return { ok: false, reason: 'error' };
  }
}

/**
 * @param {string} rawToken
 */
export function touchSession(rawToken) {
  const store = loadStore();
  const tokenHash = hashSessionToken(rawToken);
  const session = store.sessions[tokenHash];
  if (!session || session.revokedAt) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
  session.lastSeenAt = new Date().toISOString();
  saveStore(store);
  return session;
}

/**
 * @param {string} rawToken
 */
export function revokeSession(rawToken) {
  const store = loadStore();
  const tokenHash = hashSessionToken(rawToken);
  const session = store.sessions[tokenHash];
  if (!session) return false;
  session.revokedAt = new Date().toISOString();
  saveStore(store);
  return true;
}

/**
 * Refresh roles on active (non-revoked, non-expired) sessions for a userId.
 * Used after CLI role grants so existing cookies pick up new roles.
 * @param {string} userId
 * @param {string[]} roles
 * @returns {number} updated session count
 */
export function updateActiveSessionRolesForUser(userId, roles) {
  if (!userId || !Array.isArray(roles)) return 0;
  const store = loadStore();
  const now = Date.now();
  let updated = 0;
  for (const session of Object.values(store.sessions)) {
    if (session.userId !== userId) continue;
    if (session.revokedAt) continue;
    if (new Date(session.expiresAt).getTime() <= now) continue;
    session.roles = [...roles];
    session.lastSeenAt = new Date().toISOString();
    updated += 1;
  }
  if (updated > 0) saveStore(store);
  return updated;
}

/**
 * Rotate: revoke old, create new with same identity.
 * @param {string} rawToken
 */
export function rotateSession(rawToken) {
  const current = getSessionByRawToken(rawToken);
  if (!current || current.revokedAt) {
    return null;
  }
  if (new Date(current.expiresAt).getTime() <= Date.now()) {
    return null;
  }
  revokeSession(rawToken);
  return createSession({
    userId: current.userId,
    roles: current.roles,
    authMethod: current.authMethod,
    meta: current.meta,
  });
}

/**
 * Test helper — wipe store file contents.
 * @param {string} [filePath]
 */
export function resetSessionStoreForTests(filePath) {
  if (filePath) configureSessionStore(filePath);
  ensureDir(storePath);
  writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), 'utf8');
  failClosed = false;
}

/**
 * Inspect whether any raw-looking tokens leaked into store (tests).
 */
export function sessionStoreContainsRawToken(rawToken) {
  try {
    const raw = readFileSync(storePath, 'utf8');
    return raw.includes(rawToken);
  } catch {
    return false;
  }
}
