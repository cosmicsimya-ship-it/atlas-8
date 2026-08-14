// ═══════════════════════════════════════════════════════════════════════
// Prime Memory UX — user-controlled view/delete of their own `facts`.
// Reuses server/user-memory.js entirely; no new memory engine.
//
// Never exposes: internal scoring, system prompt data, hidden inference
// metadata, raw model traces, security metadata. `facts` values in this
// store are already plain user-facing text (see memory-intents.js's
// entity extraction) — nothing internal is stored alongside them, so a
// safe list is simply { key, value, } pairs with no extra fields to redact.
// ═══════════════════════════════════════════════════════════════════════

import { getUserMemory, deleteMemoryField, isValidUserId } from '../user-memory.js';

/**
 * @param {string} userId
 * @returns {{ ok: true, facts: Array<{ key: string, value: string }> } | { ok: false, error: string }}
 */
export function listPrimeMemoryFacts(userId) {
  if (!isValidUserId(userId)) return { ok: false, error: 'Invalid user ID' };
  const memory = getUserMemory(userId);
  const facts = Object.entries(memory?.facts || {}).map(([key, value]) => ({
    key,
    value: String(value ?? ''),
  }));
  return { ok: true, facts };
}

/**
 * Owner-scoped, IDOR-safe by construction — deleteMemoryField only ever
 * touches the given userId's own bucket.
 * @param {string} userId
 * @param {string} factKey
 */
export async function deletePrimeMemoryFact(userId, factKey) {
  if (!isValidUserId(userId)) return { ok: false, error: 'Invalid user ID' };
  if (typeof factKey !== 'string' || !factKey.trim()) {
    return { ok: false, error: 'Invalid fact key' };
  }
  // Reject path-traversal-style keys — facts are a flat map, dots would be
  // (mis)interpreted as a nested path by deleteMemoryField's dot-path walk.
  if (factKey.includes('.') || factKey.includes('__proto__') || factKey.includes('constructor')) {
    return { ok: false, error: 'Invalid fact key' };
  }
  const existing = getUserMemory(userId);
  if (!existing?.facts || !(factKey in existing.facts)) {
    return { ok: false, error: 'Fact not found' };
  }
  return deleteMemoryField(userId, `facts.${factKey}`);
}
