/**
 * TTS usage / cost guard — request + character quotas.
 * Never logs full user text.
 */

import { getVoiceConfig } from './config.js';
import { VOICE_ERROR_CODES, VoiceError } from './errors.js';

/** @type {Map<string, { requests: number, chars: number, resetAt: number, events: object[] }>} */
const dailyBuckets = new Map();

/** @type {object[]} */
const recentEvents = [];
const MAX_RECENT = 200;

function dayKey(userKey) {
  const day = new Date().toISOString().slice(0, 10);
  return `${day}:${userKey}`;
}

/**
 * @param {string} userKey
 */
function getBucket(userKey) {
  const key = dayKey(userKey);
  const now = Date.now();
  let bucket = dailyBuckets.get(key);
  const endOfDay = Date.parse(`${new Date().toISOString().slice(0, 10)}T23:59:59.999Z`);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { requests: 0, chars: 0, resetAt: endOfDay, events: [] };
    dailyBuckets.set(key, bucket);
  }
  return bucket;
}

/**
 * @param {{
 *   userKey: string,
 *   charCount: number,
 * }} input
 */
export function assertWithinQuota(input) {
  const cfg = getVoiceConfig();
  const bucket = getBucket(input.userKey || 'anonymous');
  if (bucket.requests >= cfg.dailyRequestQuota) {
    throw new VoiceError(VOICE_ERROR_CODES.QUOTA_EXCEEDED, 'daily_request_quota', {
      meta: { requests: bucket.requests, limit: cfg.dailyRequestQuota },
    });
  }
  if (bucket.chars + input.charCount > cfg.dailyCharQuota) {
    throw new VoiceError(VOICE_ERROR_CODES.QUOTA_EXCEEDED, 'daily_char_quota', {
      meta: { chars: bucket.chars, limit: cfg.dailyCharQuota },
    });
  }
}

/**
 * @param {{
 *   userKey?: string,
 *   provider: string,
 *   model?: string|null,
 *   voice: string,
 *   language: string,
 *   charCount: number,
 *   success: boolean,
 *   latencyMs?: number,
 *   errorCode?: string|null,
 *   cacheHit?: boolean,
 * }} event
 */
export function recordUsage(event) {
  const userKey = event.userKey || 'anonymous';
  const bucket = getBucket(userKey);
  bucket.requests += 1;
  if (event.success) {
    bucket.chars += Math.max(0, Number(event.charCount) || 0);
  }

  const row = {
    at: new Date().toISOString(),
    provider: event.provider,
    model: event.model || null,
    voice: event.voice,
    language: event.language,
    charCount: event.charCount,
    success: Boolean(event.success),
    latencyMs: event.latencyMs ?? null,
    errorCode: event.errorCode || null,
    cacheHit: Boolean(event.cacheHit),
    // no text
  };

  bucket.events.push(row);
  if (bucket.events.length > 50) bucket.events.shift();

  recentEvents.push(row);
  if (recentEvents.length > MAX_RECENT) recentEvents.shift();

  // Structured log — no secrets, no full text
  console.log(
    '[VoiceTTS]',
    JSON.stringify({
      scope: 'voice-tts',
      ...row,
    }),
  );
}

/**
 * @param {string} [userKey]
 */
export function getUsageSnapshot(userKey = 'anonymous') {
  const cfg = getVoiceConfig();
  const bucket = getBucket(userKey);
  return {
    requests: bucket.requests,
    chars: bucket.chars,
    dailyRequestQuota: cfg.dailyRequestQuota,
    dailyCharQuota: cfg.dailyCharQuota,
    resetAt: bucket.resetAt,
  };
}

export function getRecentUsageEvents() {
  return [...recentEvents];
}

export function resetUsageForTests() {
  dailyBuckets.clear();
  recentEvents.length = 0;
}
