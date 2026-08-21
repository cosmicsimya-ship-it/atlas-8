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

import {
  deleteMemoryField,
  getLatestUserMemoryFact,
  getUserMemory,
  isValidUserId,
} from '../user-memory.js';

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
const MAX_CONTINUITY_CHARS = 80;

function truncate(value, max = MAX_CONTINUITY_CHARS) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * One continuity statement for Prime Home. Never dumps the fact list.
 * Never invents a focus the user did not save.
 * @param {string} userId
 */
export function buildMemoryContinuity(userId) {
  const listed = listPrimeMemoryFacts(userId);
  if (!listed.ok || !listed.facts.length) {
    return {
      available: false,
      statement: null,
      kind: null,
      action: { label: 'Atlas ile konuş', href: '/atlas' },
    };
  }
  const latest = getLatestUserMemoryFact(userId);
  if (!latest) {
    return {
      available: false,
      statement: null,
      kind: null,
      action: { label: 'Atlas ile konuş', href: '/atlas' },
    };
  }
  const snippet = truncate(latest.value);
  if (!snippet) {
    return {
      available: false,
      statement: null,
      kind: null,
      action: { label: 'Atlas ile konuş', href: '/atlas' },
    };
  }
  return {
    available: true,
    kind: 'recently_saved',
    statement: `Yakın zamanda kaydedilen: ${snippet}`,
    factKey: latest.key,
    action: { label: 'Kaldığın yerden devam et', href: '/atlas' },
  };
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
  // Dotted V2 public keys (preference.* / habit.*) are valid; reject unsafe segments.
  if (!/^[a-zA-Z0-9_.-]+$/.test(factKey) || factKey.includes('__proto__') || factKey.includes('constructor')) {
    return { ok: false, error: 'Invalid fact key' };
  }
  const existing = getUserMemory(userId);
  if (!existing?.facts || !(factKey in existing.facts)) {
    return { ok: false, error: 'Fact not found' };
  }
  return deleteMemoryField(userId, `facts.${factKey}`);
}
