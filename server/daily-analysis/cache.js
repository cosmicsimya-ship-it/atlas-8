/**
 * Lightweight in-memory cache for daily analysis layers.
 * Key includes date + timezone + location + layer id + version.
 */

import { DAILY_ANALYSIS_VERSION } from './schema.js';

/** @type {Map<string, { expiresAt: number, value: unknown }>} */
const STORE = new Map();

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * @param {{
 *   layerId: string,
 *   dateKey: string,
 *   timezone: string,
 *   latitude?: number|null,
 *   longitude?: number|null,
 *   locale?: string,
 *   extra?: string,
 * }} parts
 */
export function buildCacheKey(parts) {
  const lat =
    parts.latitude == null || !Number.isFinite(Number(parts.latitude))
      ? 'na'
      : Number(parts.latitude).toFixed(4);
  const lon =
    parts.longitude == null || !Number.isFinite(Number(parts.longitude))
      ? 'na'
      : Number(parts.longitude).toFixed(4);
  return [
    DAILY_ANALYSIS_VERSION,
    parts.layerId,
    parts.dateKey,
    parts.timezone || 'na',
    lat,
    lon,
    parts.locale || 'na',
    parts.extra || '',
  ].join('|');
}

/**
 * @param {string} key
 * @returns {unknown|undefined}
 */
export function cacheGet(key) {
  const hit = STORE.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    STORE.delete(key);
    return undefined;
  }
  return hit.value;
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {number} [ttlMs]
 */
export function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  STORE.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheClear() {
  STORE.clear();
}

export function cacheSize() {
  return STORE.size;
}
