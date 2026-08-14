/**
 * Chat usage / cost guard — daily message quota, plan-differentiated.
 * Mirrors server/voice/usage.js (same bucket-by-day pattern). Never logs message text.
 *
 * Server-authoritative: plan is resolved from req.auth via entitlements/resolve.js,
 * never trusted from client body/headers.
 */

import { ATLAS_PLANS } from '../entitlements/capabilities.js';

/** @type {Map<string, { count: number, resetAt: number }>} */
const dailyBuckets = new Map();

function dayKey(userKey) {
  const day = new Date().toISOString().slice(0, 10);
  return `${day}:${userKey}`;
}

function endOfDayMs() {
  return Date.parse(`${new Date().toISOString().slice(0, 10)}T23:59:59.999Z`);
}

function getBucket(userKey) {
  const key = dayKey(userKey);
  const now = Date.now();
  let bucket = dailyBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: endOfDayMs() };
    dailyBuckets.set(key, bucket);
  }
  return bucket;
}

/**
 * Daily message quota per plan. Env-overridable so limits can be tuned to
 * real API cost without a code change. Guest is intentionally the tightest
 * tier (no account, highest abuse risk).
 * @returns {Record<import('../entitlements/capabilities.js').AtlasPlanId, number>}
 */
export function getChatDailyQuotaConfig() {
  const guest = Number(process.env.ATLAS_CHAT_DAILY_QUOTA_GUEST || 15);
  const free = Number(process.env.ATLAS_CHAT_DAILY_QUOTA_FREE || 40);
  const premium = Number(process.env.ATLAS_CHAT_DAILY_QUOTA_PREMIUM || 200);
  return {
    [ATLAS_PLANS.GUEST]: Number.isFinite(guest) && guest > 0 ? guest : 15,
    [ATLAS_PLANS.FREE]: Number.isFinite(free) && free > 0 ? free : 40,
    [ATLAS_PLANS.PREMIUM]: Number.isFinite(premium) && premium > 0 ? premium : 200,
  };
}

/**
 * Per-minute burst ceiling per plan (fed into rateLimitMiddleware's `max`).
 * Anti-abuse, separate from the daily cost quota above.
 */
export function getChatBurstConfig() {
  const guest = Number(process.env.ATLAS_CHAT_BURST_GUEST || 10);
  const free = Number(process.env.ATLAS_CHAT_BURST_FREE || 20);
  const premium = Number(process.env.ATLAS_CHAT_BURST_PREMIUM || 45);
  return {
    [ATLAS_PLANS.GUEST]: Number.isFinite(guest) && guest > 0 ? guest : 10,
    [ATLAS_PLANS.FREE]: Number.isFinite(free) && free > 0 ? free : 20,
    [ATLAS_PLANS.PREMIUM]: Number.isFinite(premium) && premium > 0 ? premium : 45,
  };
}

/**
 * @param {string} userKey
 * @param {import('../entitlements/capabilities.js').AtlasPlanId} plan
 * @returns {{ allowed: boolean, used: number, limit: number, resetAt: number }}
 */
export function checkChatDailyQuota(userKey, plan) {
  const config = getChatDailyQuotaConfig();
  const limit = config[plan] ?? config[ATLAS_PLANS.GUEST];
  const bucket = getBucket(userKey || 'anonymous');
  return {
    allowed: bucket.count < limit,
    used: bucket.count,
    limit,
    resetAt: bucket.resetAt,
  };
}

/**
 * Record one consumed chat message against the daily bucket.
 * Call only after the request is accepted for processing.
 * @param {string} userKey
 */
export function recordChatUsage(userKey) {
  const bucket = getBucket(userKey || 'anonymous');
  bucket.count += 1;
  return bucket.count;
}

/**
 * @param {string} userKey
 * @param {import('../entitlements/capabilities.js').AtlasPlanId} plan
 */
export function getChatUsageSnapshot(userKey, plan) {
  const config = getChatDailyQuotaConfig();
  const limit = config[plan] ?? config[ATLAS_PLANS.GUEST];
  const bucket = getBucket(userKey || 'anonymous');
  return { used: bucket.count, limit, resetAt: bucket.resetAt, plan };
}

/**
 * Admin-only: reset ONE user's daily bucket for TODAY only. Never touches
 * plan/limit config, never touches other users, never touches history
 * (there is no history to touch -- this store is daily-bucket-only by
 * design).
 * @param {string} userKey
 */
export function resetUserChatUsageToday(userKey) {
  dailyBuckets.delete(dayKey(userKey || 'anonymous'));
}

export function resetChatUsageForTests() {
  dailyBuckets.clear();
}

/**
 * Admin-only aggregate over today's buckets — same in-memory Map used for
 * enforcement, just summarized rather than checked per-user. Real counts
 * only; nothing here is estimated or fabricated.
 * @returns {{ totalRequestsToday: number, usersActiveToday: number, perUser: Array<{ userKey: string, count: number }> }}
 */
export function getChatUsageOverview() {
  const today = new Date().toISOString().slice(0, 10);
  const prefix = `${today}:`;
  let total = 0;
  const perUser = [];
  for (const [key, bucket] of dailyBuckets.entries()) {
    if (!key.startsWith(prefix)) continue;
    total += bucket.count;
    perUser.push({ userKey: key.slice(prefix.length), count: bucket.count });
  }
  return { totalRequestsToday: total, usersActiveToday: perUser.length, perUser };
}
