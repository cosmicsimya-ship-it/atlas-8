/**
 * Subscription / entitlement persistence — JSON store keyed by userId.
 * Separate from auth_accounts so payment providers can update without touching passwords.
 * Provider customer/subscription IDs are stored server-side only.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  ATLAS_PLANS,
  PREMIUM_ACTIVE_STATUSES,
  SUBSCRIPTION_STATUSES,
} from './capabilities.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', '..', 'data', 'subscriptions.json');

/** @type {string} */
let storePath = DEFAULT_PATH;

function emptyStore() {
  return { version: 1, subscriptions: {} };
}

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * @param {string} [filePath]
 */
export function configureSubscriptionStore(filePath) {
  storePath = filePath || DEFAULT_PATH;
}

export function getSubscriptionStorePath() {
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
  if (!parsed || typeof parsed !== 'object' || typeof parsed.subscriptions !== 'object') {
    throw new Error('corrupt_subscription_store');
  }
  return { version: parsed.version || 1, subscriptions: { ...parsed.subscriptions } };
}

function saveStore(store) {
  ensureDir(storePath);
  const tmp = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tmp, storePath);
}

/**
 * @param {object} raw
 */
function normalizeRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const userId = String(raw.userId || '').trim();
  if (!userId) return null;

  const statusRaw = String(raw.status || 'inactive').toLowerCase();
  const status = SUBSCRIPTION_STATUSES.includes(statusRaw) ? statusRaw : 'inactive';
  const planRaw = String(raw.plan || ATLAS_PLANS.FREE).toLowerCase();
  const plan =
    planRaw === ATLAS_PLANS.PREMIUM || planRaw === ATLAS_PLANS.FREE
      ? planRaw
      : ATLAS_PLANS.FREE;

  return {
    userId,
    plan,
    status,
    provider: raw.provider ? String(raw.provider).slice(0, 64) : null,
    providerCustomerId: raw.providerCustomerId
      ? String(raw.providerCustomerId).slice(0, 128)
      : null,
    providerSubscriptionId: raw.providerSubscriptionId
      ? String(raw.providerSubscriptionId).slice(0, 128)
      : null,
    currentPeriodStart: raw.currentPeriodStart || null,
    currentPeriodEnd: raw.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(raw.cancelAtPeriodEnd),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

/**
 * @param {string} userId
 */
export function getSubscription(userId) {
  const id = String(userId || '').trim();
  if (!id) return null;
  const store = loadStore();
  return normalizeRecord(store.subscriptions[id]);
}

/**
 * Server-side / CLI / future webhook only — never expose via public client POST.
 * @param {{
 *   userId: string,
 *   plan?: string,
 *   status?: string,
 *   provider?: string|null,
 *   providerCustomerId?: string|null,
 *   providerSubscriptionId?: string|null,
 *   currentPeriodStart?: string|null,
 *   currentPeriodEnd?: string|null,
 *   cancelAtPeriodEnd?: boolean,
 * }} input
 */
export function upsertSubscription(input) {
  const userId = String(input?.userId || '').trim();
  if (!userId) {
    const err = new Error('user_id_required');
    err.code = 'user_id_required';
    throw err;
  }

  const store = loadStore();
  const prev = normalizeRecord(store.subscriptions[userId]);
  const now = new Date().toISOString();
  const next = normalizeRecord({
    ...(prev || {}),
    ...input,
    userId,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  });

  store.subscriptions[userId] = next;
  saveStore(store);
  return next;
}

/**
 * @param {string} userId
 */
export function deleteSubscription(userId) {
  const id = String(userId || '').trim();
  if (!id) return false;
  const store = loadStore();
  if (!store.subscriptions[id]) return false;
  delete store.subscriptions[id];
  saveStore(store);
  return true;
}

/**
 * Whether subscription currently grants Premium plan.
 * @param {object|null} sub
 */
export function subscriptionGrantsPremium(sub) {
  if (!sub) return false;
  if (sub.plan !== ATLAS_PLANS.PREMIUM) return false;
  if (!PREMIUM_ACTIVE_STATUSES.includes(sub.status)) return false;
  if (sub.currentPeriodEnd) {
    const end = Date.parse(sub.currentPeriodEnd);
    if (Number.isFinite(end) && end < Date.now() && sub.status !== 'trialing') {
      // Explicit end in the past → treat as expired unless still trialing window
      if (sub.status === 'active' || sub.status === 'past_due') return false;
    }
  }
  return true;
}

export function resetSubscriptionStoreForTests() {
  ensureDir(storePath);
  writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), 'utf8');
}

/**
 * Public-safe subscription summary (no provider IDs).
 * @param {object|null} sub
 */
export function toPublicSubscription(sub) {
  if (!sub) {
    return {
      plan: ATLAS_PLANS.FREE,
      status: 'inactive',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      provider: null,
    };
  }
  return {
    plan: sub.plan,
    status: sub.status,
    cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
    currentPeriodEnd: sub.currentPeriodEnd || null,
    provider: sub.provider || null,
  };
}
