/**
 * Webhook / payment event idempotency store.
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', '..', 'data', 'billing_events.json');

/** @type {string} */
let storePath = DEFAULT_PATH;

function emptyStore() {
  return { version: 1, events: {} };
}

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function configureBillingEventStore(filePath) {
  storePath = filePath || DEFAULT_PATH;
}

export function getBillingEventStorePath() {
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
  if (!parsed || typeof parsed !== 'object' || typeof parsed.events !== 'object') {
    throw new Error('corrupt_billing_event_store');
  }
  return { version: parsed.version || 1, events: { ...parsed.events } };
}

function saveStore(store) {
  ensureDir(storePath);
  const tmp = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tmp, storePath);
}

/**
 * @param {string} provider
 * @param {string} eventId
 */
export function makeEventKey(provider, eventId) {
  return createHash('sha256')
    .update(`${provider}:${eventId}`)
    .digest('hex')
    .slice(0, 40);
}

/**
 * @param {string} provider
 * @param {string} eventId
 * @returns {object|null}
 */
export function getBillingEvent(provider, eventId) {
  const key = makeEventKey(provider, eventId);
  const store = loadStore();
  return store.events[key] || null;
}

/**
 * @param {{
 *   provider: string,
 *   eventId: string,
 *   userId?: string|null,
 *   kind: string,
 *   status: string,
 *   meta?: object,
 * }} input
 * @returns {{ created: boolean, record: object }}
 */
export function recordBillingEvent(input) {
  const provider = String(input.provider || '').trim();
  const eventId = String(input.eventId || '').trim();
  if (!provider || !eventId) {
    const err = new Error('event_id_required');
    err.code = 'event_id_required';
    throw err;
  }

  const key = makeEventKey(provider, eventId);
  const store = loadStore();
  if (store.events[key]) {
    return { created: false, record: store.events[key] };
  }

  const now = new Date().toISOString();
  const record = {
    key,
    provider,
    eventId,
    userId: input.userId || null,
    kind: input.kind,
    status: input.status,
    // Never store IBAN / secrets / full card data
    meta: sanitizeEventMeta(input.meta),
    createdAt: now,
  };
  store.events[key] = record;
  saveStore(store);
  return { created: true, record };
}

/**
 * @param {unknown} meta
 */
function sanitizeEventMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    const key = k.toLowerCase();
    if (
      key.includes('iban') ||
      key.includes('secret') ||
      key.includes('apikey') ||
      key.includes('api_key') ||
      key.includes('card') ||
      key.includes('cvv') ||
      key.includes('pan')
    ) {
      continue;
    }
    if (typeof v === 'string' && v.length > 200) {
      out[k] = `${v.slice(0, 40)}…`;
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function resetBillingEventStoreForTests() {
  ensureDir(storePath);
  writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), 'utf8');
}
