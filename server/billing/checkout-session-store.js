/**
 * Pending checkout sessions — token → userId / amount / currency.
 * Server-side only; never expose secrets.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', '..', 'data', 'billing_checkout_sessions.json');

/** @type {string} */
let storePath = DEFAULT_PATH;

/** @typedef {'pending'|'completed'|'failed'|'expired'} CheckoutSessionStatus */

function emptyStore() {
  return { version: 1, sessions: {} };
}

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function configureCheckoutSessionStore(filePath) {
  storePath = filePath || DEFAULT_PATH;
}

export function getCheckoutSessionStorePath() {
  return storePath;
}

function loadStore() {
  ensureDir(storePath);
  if (!existsSync(storePath)) {
    const empty = emptyStore();
    writeFileSync(storePath, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
  const parsed = JSON.parse(readFileSync(storePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || typeof parsed.sessions !== 'object') {
    throw new Error('corrupt_checkout_session_store');
  }
  return { version: parsed.version || 1, sessions: { ...parsed.sessions } };
}

function saveStore(store) {
  ensureDir(storePath);
  const tmp = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tmp, storePath);
}

/**
 * @param {{
 *   token: string,
 *   userId: string,
 *   amount: number,
 *   currency: string,
 *   conversationId?: string|null,
 *   status?: CheckoutSessionStatus,
 * }} input
 */
export function createCheckoutSession(input) {
  const token = String(input.token || '').trim();
  const userId = String(input.userId || '').trim();
  if (!token || !userId) {
    const err = new Error('checkout_session_invalid');
    err.code = 'checkout_session_invalid';
    throw err;
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error('checkout_amount_invalid');
    err.code = 'checkout_amount_invalid';
    throw err;
  }
  const currency = String(input.currency || 'TRY').trim().toUpperCase() || 'TRY';
  const now = new Date().toISOString();
  const store = loadStore();
  const record = {
    token,
    userId,
    amount,
    currency,
    conversationId: input.conversationId || null,
    status: input.status || 'pending',
    paymentId: null,
    createdAt: now,
    updatedAt: now,
  };
  store.sessions[token] = record;
  saveStore(store);
  return record;
}

/**
 * @param {string} token
 */
export function getCheckoutSession(token) {
  const key = String(token || '').trim();
  if (!key) return null;
  const store = loadStore();
  return store.sessions[key] || null;
}

/**
 * @param {string} token
 * @param {Partial<{ status: CheckoutSessionStatus, paymentId: string|null }>} patch
 */
export function updateCheckoutSession(token, patch = {}) {
  const key = String(token || '').trim();
  if (!key) return null;
  const store = loadStore();
  const prev = store.sessions[key];
  if (!prev) return null;
  const next = {
    ...prev,
    ...patch,
    token: prev.token,
    userId: prev.userId,
    amount: prev.amount,
    currency: prev.currency,
    updatedAt: new Date().toISOString(),
  };
  store.sessions[key] = next;
  saveStore(store);
  return next;
}

export function resetCheckoutSessionStoreForTests() {
  ensureDir(storePath);
  writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), 'utf8');
}
