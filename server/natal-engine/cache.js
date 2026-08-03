import { createHash } from 'node:crypto';
import { ENGINE_VERSION } from './constants.js';

/** @type {Map<string, { expires: number, result: object }>} */
const CACHE = new Map();
const DEFAULT_TTL_MS = 30 * 60_000;
const MAX_ENTRIES = 200;

/**
 * @param {object} parts
 */
export function buildNatalCacheKey(parts) {
  const payload = JSON.stringify({
    birthDate: parts.birthDate,
    birthTime: parts.birthTime ?? null,
    latitude: parts.latitude ?? null,
    longitude: parts.longitude ?? null,
    timezone: parts.timezone ?? null,
    zodiacSystem: parts.zodiacSystem,
    houseSystem: parts.houseSystem ?? null,
    ayanamsa: parts.ayanamsa ?? null,
    methodologyId: parts.methodologyId,
    rulesetVersion: parts.rulesetVersion,
    engineVersion: ENGINE_VERSION,
    includeMinorAspects: Boolean(parts.includeMinorAspects),
  });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * @param {string} key
 */
export function getCachedNatal(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    CACHE.delete(key);
    return null;
  }
  return hit.result;
}

/**
 * @param {string} key
 * @param {object} result
 * @param {number} [ttlMs]
 */
export function setCachedNatal(key, result, ttlMs = DEFAULT_TTL_MS) {
  if (CACHE.size >= MAX_ENTRIES) {
    const first = CACHE.keys().next().value;
    if (first) CACHE.delete(first);
  }
  CACHE.set(key, { expires: Date.now() + ttlMs, result });
}

export function clearNatalCache() {
  CACHE.clear();
}
