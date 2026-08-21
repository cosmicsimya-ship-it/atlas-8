// ═══════════════════════════════════════════════════════════════════════
// Memory V2 — deduplication (exact + canonical key/value)
// ═══════════════════════════════════════════════════════════════════════

import { foldMemoryText } from './normalize.js';
import { findActiveByKey, listActiveMemories, normalizeCompareText } from './store.js';

/**
 * @param {unknown} a
 * @param {unknown} b
 */
export function valuesEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a === 'object' || typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return foldMemoryText(String(a)) === foldMemoryText(String(b));
}

/**
 * @param {string} userId
 * @param {{ key?: string|null, value?: unknown, text: string }} candidate
 * @returns {{ duplicate: boolean, existing: import('./schema.js').MemoryRecord|null, reason?: string }}
 */
export function findDuplicate(userId, candidate) {
  const normText = normalizeCompareText(candidate.text);

  if (candidate.key) {
    const byKey = findActiveByKey(userId, candidate.key);
    if (byKey && valuesEqual(byKey.value, candidate.value)) {
      return { duplicate: true, existing: byKey, reason: 'canonical_key_value' };
    }
    // Same key + near-identical text
    if (byKey && normalizeCompareText(byKey.text) === normText) {
      return { duplicate: true, existing: byKey, reason: 'canonical_key_text' };
    }
  }

  const active = listActiveMemories(userId);
  for (const mem of active) {
    if (normalizeCompareText(mem.text) === normText) {
      return { duplicate: true, existing: mem, reason: 'exact_text' };
    }
  }

  return { duplicate: false, existing: null };
}
