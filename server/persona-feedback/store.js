/**
 * Persona Feedback store — atomic JSON persistence (Phase 2).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import {
  emptyFeedbackStore,
  validateFeedbackRecord,
  validateFeedbackStore,
} from './schema.js';
import {
  isPersonaFeedbackLearningEnabled,
  PERSONA_FEEDBACK_VERSION,
  SCOPE_PRIORITY,
} from './constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_RECORDS_FILE = join(
  __dirname,
  '..',
  '..',
  'knowledge',
  'persona-engine',
  'feedback',
  'records.json',
);

/** @type {string} */
let recordsFileOverride = '';

/** In-memory session feedback: conversationId → records[] */
const sessionStores = new Map();

/**
 * @param {string|null|undefined} filePath
 */
export function setFeedbackRecordsPath(filePath) {
  recordsFileOverride = filePath ? String(filePath) : '';
}

export function getFeedbackRecordsPath() {
  return recordsFileOverride || DEFAULT_RECORDS_FILE;
}

export function clearSessionFeedback(conversationId) {
  if (conversationId) sessionStores.delete(String(conversationId));
}

export function resetAllSessionFeedback() {
  sessionStores.clear();
}

function ensureParentDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * @returns {object}
 */
export function loadFeedbackStore() {
  const filePath = getFeedbackRecordsPath();
  if (!existsSync(filePath)) {
    return emptyFeedbackStore();
  }
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    const validated = validateFeedbackStore(raw);
    if (!validated.ok) {
      console.error('[PersonaFeedback] Invalid store, using empty:', validated.error);
      return emptyFeedbackStore();
    }
    return validated.store;
  } catch (err) {
    console.error('[PersonaFeedback] Failed to load store:', err.message);
    return emptyFeedbackStore();
  }
}

/**
 * @param {object} store
 * @returns {{ ok: boolean, error?: string }}
 */
export function saveFeedbackStore(store) {
  if (!isPersonaFeedbackLearningEnabled()) {
    return { ok: false, error: 'learning_disabled' };
  }
  const validated = validateFeedbackStore(store);
  if (!validated.ok) return { ok: false, error: validated.error };

  const filePath = getFeedbackRecordsPath();
  ensureParentDir(filePath);
  const payload = `${JSON.stringify(
    {
      ...validated.store,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`;
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    writeFileSync(tempPath, payload, 'utf-8');
    renameSync(tempPath, filePath);
    if (!existsSync(filePath)) return { ok: false, error: 'Write verification failed' };
    return { ok: true };
  } catch (err) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {
      /* ignore */
    }
    return { ok: false, error: err.message };
  }
}

/**
 * Stable id from category+scope+normalized preference.
 * @param {{ category: string[], scope: { type: string, target?: string|null }, normalizedPreference: string, polarity: string }} draft
 */
export function stableFeedbackId(draft) {
  const key = [
    [...(draft.category || [])].sort().join(','),
    draft.scope?.type,
    draft.scope?.target ?? '',
    draft.polarity,
    String(draft.normalizedPreference || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim(),
  ].join('|');
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 12);
  return `feedback_${hash}`;
}

/**
 * Merge key for reinforcement (same style preference family).
 */
export function mergeKey(record) {
  return [
    [...(record.category || [])].sort().join(','),
    record.scope?.type,
    record.scope?.target ?? '',
    record.polarity,
  ].join('|');
}

/**
 * Whether two preferences are compatible enough to reinforce.
 */
export function preferencesCompatible(a, b) {
  const na = String(a || '').toLowerCase();
  const nb = String(b || '').toLowerCase();
  if (na === nb) return true;
  // Soft cluster: assertive/dense/short tone family
  const clusters = [
    ['tok', 'sert', 'assertive', 'high-impact', 'concise', 'kısa', 'yumuşak değil'],
    ['detay', 'uzun', 'detailed', 'kapsamlı'],
    ['mistik', 'spiritüel', 'sembolik'],
    ['mekanik değil', 'doğal', 'robotik değil'],
    ['profesyonel', 'mesafeli', 'formal'],
    ['samimi', 'sıcak', 'casual'],
  ];
  for (const cluster of clusters) {
    const ha = cluster.some((w) => na.includes(w));
    const hb = cluster.some((w) => nb.includes(w));
    if (ha && hb) return true;
  }
  return false;
}

/**
 * Detect hard conflict between two active preferences.
 */
export function preferencesConflict(a, b) {
  if (a.polarity === b.polarity && preferencesCompatible(a.normalizedPreference, b.normalizedPreference)) {
    return false;
  }
  // Different scopes → not a hard conflict
  if (
    a.scope?.type !== b.scope?.type ||
    String(a.scope?.target ?? '') !== String(b.scope?.target ?? '')
  ) {
    // Same category opposing at overlapping global vs specific handled in resolve
    if (a.scope?.type !== 'global' && b.scope?.type !== 'global') {
      if (a.scope?.type !== b.scope?.type || String(a.scope?.target) !== String(b.scope?.target)) {
        return false;
      }
    }
  }

  const pairs = [
    [/kısa|concise|short|tok/, /detay|uzun|detailed|verbose/],
    [/mistik|spiritüel|sembolik yoğun/, /mistik olmasın|bilimsel|factual|literal/],
    [/soru kullanma|no question/, /soruyla aç|question hook/],
    [/samimi|sıcak|warm/, /profesyonel|mesafeli|formal|distant/],
    [/yumuşak/, /sert|tok|assertive/],
  ];

  const na = `${a.normalizedPreference} ${a.signal}`.toLowerCase();
  const nb = `${b.normalizedPreference} ${b.signal}`.toLowerCase();

  for (const [reA, reB] of pairs) {
    if ((reA.test(na) && reB.test(nb)) || (reB.test(na) && reA.test(nb))) {
      // Same scope required for hard conflict
      if (
        a.scope?.type === b.scope?.type &&
        String(a.scope?.target ?? '') === String(b.scope?.target ?? '')
      ) {
        return true;
      }
      // global vs more specific content_type/task may conflict if both claim same axis
      if (a.scope?.type === 'global' || b.scope?.type === 'global') {
        const other = a.scope?.type === 'global' ? b : a;
        if (['content_type', 'task_type', 'global'].includes(other.scope?.type)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Upsert candidate/persistent record. Session records stay in memory.
 * @param {object} draft
 * @param {{ conversationId?: string|null, learningEnabled?: boolean }} [options]
 */
export function upsertFeedbackRecord(draft, options = {}) {
  const learningEnabled =
    options.learningEnabled ?? isPersonaFeedbackLearningEnabled();

  const now = new Date().toISOString();
  const id = draft.id || stableFeedbackId(draft);
  const candidate = {
    ...draft,
    id,
    firstSeenAt: draft.firstSeenAt || now,
    lastSeenAt: now,
    occurrenceCount: draft.occurrenceCount || 1,
    status: draft.status || 'active',
    supersedes: draft.supersedes || [],
    conflictsWith: draft.conflictsWith || [],
    source: draft.source || { type: 'explicit_user_feedback', conversationId: null, messageId: null },
    examples: draft.examples || { rejected: [], preferred: [] },
  };

  const validated = validateFeedbackRecord(candidate);
  if (!validated.ok) {
    return { ok: false, error: validated.error, record: null, merged: false };
  }

  let record = validated.record;

  // Session / single_response → memory only
  if (
    record.persistence === 'session' ||
    record.scope.type === 'temporary_session' ||
    record.scope.type === 'single_response'
  ) {
    const key = String(options.conversationId || record.source.conversationId || 'default');
    const list = sessionStores.get(key) || [];
    const idx = list.findIndex(
      (r) => mergeKey(r) === mergeKey(record) && preferencesCompatible(r.normalizedPreference, record.normalizedPreference),
    );
    if (idx >= 0) {
      const prev = list[idx];
      record = {
        ...prev,
        ...record,
        id: prev.id,
        firstSeenAt: prev.firstSeenAt,
        lastSeenAt: now,
        occurrenceCount: (prev.occurrenceCount || 1) + 1,
        strength: Math.min(1, Math.max(prev.strength, record.strength) + 0.05),
        confidence: Math.min(1, Math.max(prev.confidence, record.confidence)),
        examples: {
          rejected: [...new Set([...(prev.examples?.rejected || []), ...(record.examples?.rejected || [])])].slice(0, 8),
          preferred: [...new Set([...(prev.examples?.preferred || []), ...(record.examples?.preferred || [])])].slice(0, 8),
        },
      };
      list[idx] = record;
      sessionStores.set(key, list);
      return { ok: true, record, merged: true, persisted: false, skippedReason: null };
    }
    list.push(record);
    sessionStores.set(key, list);
    return { ok: true, record, merged: false, persisted: false, skippedReason: null };
  }

  if (!learningEnabled) {
    return {
      ok: true,
      record,
      merged: false,
      persisted: false,
      skippedReason: 'learning_disabled',
    };
  }

  // Disk store for candidate + persistent
  const store = loadFeedbackStore();
  const records = store.records.slice();

  // Find mergeable
  let mergeIdx = records.findIndex(
    (r) =>
      r.status === 'active' &&
      mergeKey(r) === mergeKey(record) &&
      preferencesCompatible(r.normalizedPreference, record.normalizedPreference),
  );

  // Conflict linking
  for (let i = 0; i < records.length; i++) {
    const existing = records[i];
    if (existing.status !== 'active' || existing.id === record.id) continue;
    if (!preferencesConflict(existing, record)) continue;
    const existingPri = SCOPE_PRIORITY[existing.scope.type] ?? 0;
    const newPri = SCOPE_PRIORITY[record.scope.type] ?? 0;
    // Newer explicit + higher/equal priority supersedes
    if (newPri >= existingPri || record.persistence === 'persistent') {
      record.supersedes = [...new Set([...(record.supersedes || []), existing.id])];
      record.conflictsWith = [...new Set([...(record.conflictsWith || []), existing.id])];
      records[i] = {
        ...existing,
        conflictsWith: [...new Set([...(existing.conflictsWith || []), record.id || id])],
        // Do not delete — mark relationship only; resolve() prefers newer
      };
    } else {
      record.conflictsWith = [...new Set([...(record.conflictsWith || []), existing.id])];
    }
  }

  if (mergeIdx >= 0) {
    const prev = records[mergeIdx];
    record = {
      ...prev,
      ...record,
      id: prev.id,
      firstSeenAt: prev.firstSeenAt,
      lastSeenAt: now,
      occurrenceCount: (prev.occurrenceCount || 1) + 1,
      strength: Math.min(1, ((prev.strength || 0) + record.strength) / 2 + 0.1),
      confidence: Math.min(1, Math.max(prev.confidence, record.confidence) + 0.05),
      // Promote candidate → persistent after enough reinforced occurrences
      persistence:
        prev.persistence === 'persistent' || record.persistence === 'persistent'
          ? 'persistent'
          : (prev.occurrenceCount || 1) + 1 >= 3 && Math.max(prev.confidence, record.confidence) >= 0.85
            ? 'persistent'
            : 'candidate',
      supersedes: [...new Set([...(prev.supersedes || []), ...(record.supersedes || [])])],
      conflictsWith: [...new Set([...(prev.conflictsWith || []), ...(record.conflictsWith || [])])],
      examples: {
        rejected: [...new Set([...(prev.examples?.rejected || []), ...(record.examples?.rejected || [])])].slice(0, 8),
        preferred: [...new Set([...(prev.examples?.preferred || []), ...(record.examples?.preferred || [])])].slice(0, 8),
      },
    };
    const revalidate = validateFeedbackRecord(record);
    if (!revalidate.ok) return { ok: false, error: revalidate.error, record: null, merged: false };
    records[mergeIdx] = revalidate.record;
    const saved = saveFeedbackStore({ ...store, records });
    return {
      ok: saved.ok,
      error: saved.error,
      record: revalidate.record,
      merged: true,
      persisted: saved.ok,
      skippedReason: saved.ok ? null : saved.error,
    };
  }

  // Promote single high-confidence explicit persistent
  if (record.persistence === 'candidate' && record.confidence >= 0.95 && /bundan sonra|her zaman|daima|bir daha/i.test(record.signal)) {
    record = { ...record, persistence: 'persistent' };
  }

  const final = validateFeedbackRecord(record);
  if (!final.ok) return { ok: false, error: final.error, record: null, merged: false };
  records.push(final.record);
  const saved = saveFeedbackStore({ ...store, records });
  return {
    ok: saved.ok,
    error: saved.error,
    record: final.record,
    merged: false,
    persisted: saved.ok,
    skippedReason: saved.ok ? null : saved.error,
  };
}

/**
 * @param {string|null|undefined} conversationId
 */
export function getSessionFeedback(conversationId) {
  const key = String(conversationId || 'default');
  return (sessionStores.get(key) || []).slice();
}

export function listActiveFeedbackRecords(options = {}) {
  const disk = loadFeedbackStore().records.filter((r) => r.status === 'active');
  const session = getSessionFeedback(options.conversationId);
  return [...disk, ...session];
}

export { PERSONA_FEEDBACK_VERSION };
