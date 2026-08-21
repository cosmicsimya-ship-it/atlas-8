// ═══════════════════════════════════════════════════════════════════════
// Memory V2 — contradiction / supersede engine
// ═══════════════════════════════════════════════════════════════════════

import { valuesEqual } from './deduplicate.js';
import { findActiveByKey, supersedeMemory, updateMemoryRecord } from './store.js';

/**
 * Keys that are mutually exclusive (one active value at a time).
 */
const SINGLE_VALUE_KEYS = new Set([
  'profile.name',
  'profile.timezone',
  'profile.location',
  'profile.birthDate',
  'profile.birthTime',
  'profile.birthPlace',
  'profile.referenceDate',
  'profile.relationshipStatus',
  'preferences.preferredName',
  'preferences.preferredLanguage',
  'preferences.responseStyle',
  'preferences.addressStyle',
  'preferences.favoriteSymbolicSystems',
  'preference.favorite_color',
  'preference.coffee.sugar',
  'preference.coffee.milk',
  'preference.diet.vegan',
  'habit.morning_meetings',
  'facts.zodiac',
]);

/**
 * @param {string} key
 */
export function isSingleValueKey(key) {
  return Boolean(key && SINGLE_VALUE_KEYS.has(key));
}

function isUniqueRace(err) {
  return /UNIQUE|constraint|unique/i.test(String(err || ''));
}

/**
 * @param {string} userId
 * @param {{
 *   key?: string|null,
 *   value?: unknown,
 *   text: string,
 *   type: string,
 *   source?: string,
 *   confidence?: number,
 *   importance?: number,
 *   temporal?: string,
 *   conversationId?: string|null,
 *   sourceMessageId?: string|null,
 *   metadata?: object,
 * }} candidate
 * @returns {Promise<{
 *   action: 'insert'|'supersede'|'noop_duplicate'|'noop_skip',
 *   memory?: import('./schema.js').MemoryRecord|null,
 *   old?: import('./schema.js').MemoryRecord|null,
 *   reason?: string,
 *   ok?: boolean,
 *   error?: string,
 * }>}
 */
export async function resolveContradictionOrInsert(userId, candidate, insertFn) {
  if (!candidate.key || !isSingleValueKey(candidate.key)) {
    const created = await insertFn(candidate);
    return {
      action: 'insert',
      memory: created?.memory ?? null,
      reason: 'no_single_key',
      ok: created?.ok !== false,
      error: created?.ok === false ? created.error : undefined,
    };
  }

  const maxAttempts = 6;
  let lastError = '';

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const existing = findActiveByKey(userId, candidate.key);

    if (!existing) {
      const created = await insertFn(candidate);
      if (created?.ok && created.memory) {
        return { action: 'insert', memory: created.memory, reason: 'no_existing', ok: true };
      }
      lastError = created?.error || 'insert_failed';
      if (isUniqueRace(lastError)) continue;
      return {
        action: 'insert',
        memory: null,
        reason: lastError,
        ok: false,
        error: lastError,
      };
    }

    if (valuesEqual(existing.value, candidate.value)) {
      await updateMemoryRecord(userId, existing.id, {
        text: candidate.text || existing.text,
        importance: Math.max(existing.importance, candidate.importance ?? existing.importance),
      });
      return {
        action: 'noop_duplicate',
        memory: findActiveByKey(userId, candidate.key),
        reason: 'same_value',
        ok: true,
      };
    }

    const result = await supersedeMemory(userId, existing.id, {
      type: candidate.type,
      key: candidate.key,
      value: candidate.value,
      text: candidate.text,
      source: candidate.source || 'explicit_user',
      confidence: candidate.confidence ?? 1,
      importance: candidate.importance ?? 0.7,
      conversationId: candidate.conversationId ?? null,
      sourceMessageId: candidate.sourceMessageId ?? null,
      metadata: {
        ...(candidate.metadata || {}),
        temporal: candidate.temporal || 'current',
        supersededReason: 'value_changed',
      },
    });

    if (result.ok) {
      return {
        action: 'supersede',
        memory: result.memory,
        old: result.old,
        reason: 'value_changed',
        ok: true,
      };
    }

    lastError = result.error || 'supersede_failed';
    if (isUniqueRace(lastError) || lastError === 'old_not_found') continue;
    return {
      action: 'insert',
      memory: null,
      reason: lastError,
      ok: false,
      error: lastError,
    };
  }

  return {
    action: 'insert',
    memory: null,
    reason: lastError || 'concurrent_write_exhausted',
    ok: false,
    error: lastError || 'concurrent_write_exhausted',
  };
}
