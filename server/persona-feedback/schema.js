/**
 * Persona Feedback schema validation (Phase 2).
 */

import {
  FEEDBACK_CATEGORIES,
  SCOPE_TYPES,
  POLARITIES,
  PERSISTENCE_LEVELS,
  RECORD_STATUSES,
  PERSONA_FEEDBACK_VERSION,
} from './constants.js';

const CATEGORY_SET = new Set(FEEDBACK_CATEGORIES);
const SCOPE_SET = new Set(SCOPE_TYPES);
const POLARITY_SET = new Set(POLARITIES);
const PERSIST_SET = new Set(PERSISTENCE_LEVELS);
const STATUS_SET = new Set(RECORD_STATUSES);

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, record: object } | { ok: false, error: string }}
 */
export function validateFeedbackRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'record must be an object' };
  }

  const id = String(raw.id ?? '').trim();
  if (!id.startsWith('feedback_')) {
    return { ok: false, error: 'id must start with feedback_' };
  }

  const category = asStringArray(raw.category).filter((c) => CATEGORY_SET.has(c));
  if (!category.length) {
    return { ok: false, error: 'category must include at least one known category' };
  }

  const signal = String(raw.signal ?? '').trim();
  if (!signal) return { ok: false, error: 'signal required' };

  const normalizedPreference = String(raw.normalizedPreference ?? '').trim();
  if (!normalizedPreference) return { ok: false, error: 'normalizedPreference required' };

  const scope = raw.scope && typeof raw.scope === 'object' ? raw.scope : null;
  if (!scope || !SCOPE_SET.has(String(scope.type))) {
    return { ok: false, error: 'scope.type invalid' };
  }

  const polarity = String(raw.polarity ?? '');
  if (!POLARITY_SET.has(polarity)) return { ok: false, error: 'polarity invalid' };

  const strength = Number(raw.strength);
  const confidence = Number(raw.confidence);
  if (!(strength >= 0 && strength <= 1)) return { ok: false, error: 'strength out of range' };
  if (!(confidence >= 0 && confidence <= 1)) return { ok: false, error: 'confidence out of range' };

  const persistence = String(raw.persistence ?? '');
  if (!PERSIST_SET.has(persistence) || persistence === 'ignore') {
    // Stored records must be session|candidate|persistent
    if (!['session', 'candidate', 'persistent'].includes(persistence)) {
      return { ok: false, error: 'persistence invalid for storage' };
    }
  }

  const status = String(raw.status ?? 'active');
  if (!STATUS_SET.has(status)) return { ok: false, error: 'status invalid' };

  const record = {
    id,
    schemaVersion: PERSONA_FEEDBACK_VERSION,
    category,
    signal,
    normalizedPreference,
    scope: {
      type: String(scope.type),
      target: scope.target == null || scope.target === '' ? null : String(scope.target),
    },
    polarity,
    strength,
    confidence,
    persistence,
    source: {
      type: String(raw.source?.type ?? 'explicit_user_feedback'),
      conversationId: raw.source?.conversationId ?? null,
      messageId: raw.source?.messageId ?? null,
    },
    examples: {
      rejected: asStringArray(raw.examples?.rejected).slice(0, 8),
      preferred: asStringArray(raw.examples?.preferred).slice(0, 8),
    },
    firstSeenAt: String(raw.firstSeenAt ?? new Date().toISOString()),
    lastSeenAt: String(raw.lastSeenAt ?? new Date().toISOString()),
    occurrenceCount: Math.max(1, Number(raw.occurrenceCount) || 1),
    status,
    supersedes: asStringArray(raw.supersedes),
    conflictsWith: asStringArray(raw.conflictsWith),
  };

  return { ok: true, record };
}

/**
 * @param {unknown} store
 * @returns {{ ok: true, store: object } | { ok: false, error: string }}
 */
export function validateFeedbackStore(store) {
  if (!store || typeof store !== 'object' || Array.isArray(store)) {
    return { ok: false, error: 'store must be an object' };
  }
  if (!Array.isArray(store.records)) {
    return { ok: false, error: 'store.records must be an array' };
  }
  for (const item of store.records) {
    const v = validateFeedbackRecord(item);
    if (!v.ok) return { ok: false, error: v.error };
  }
  return {
    ok: true,
    store: {
      version: Number(store.version) || 1,
      schemaVersion: PERSONA_FEEDBACK_VERSION,
      updatedAt: store.updatedAt ?? null,
      records: store.records.map((r) => validateFeedbackRecord(r).record),
    },
  };
}

export function emptyFeedbackStore() {
  return {
    version: 1,
    schemaVersion: PERSONA_FEEDBACK_VERSION,
    updatedAt: null,
    records: [],
  };
}
