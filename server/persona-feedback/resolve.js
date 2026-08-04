/**
 * Resolve applicable feedback for runtime injection (Phase 2).
 */

import { SCOPE_PRIORITY } from './constants.js';
import { listActiveFeedbackRecords, preferencesConflict } from './store.js';

/**
 * Scope match: does record apply to current context?
 */
export function scopeMatches(record, ctx) {
  const type = record.scope?.type;
  const target = record.scope?.target;

  if (type === 'global') return true;
  if (type === 'temporary_session' || type === 'single_response') {
    return true; // already filtered by conversation session list
  }
  if (type === 'channel') {
    return (
      String(ctx.channel || '').toLowerCase() === String(target || '').toLowerCase() ||
      String(ctx.activeVoice || '').toLowerCase() === String(target || '').toLowerCase()
    );
  }
  if (type === 'brand' || type === 'voice') {
    const voice = String(ctx.activeVoice || ctx.voiceId || '').toLowerCase();
    const brand = String(ctx.brand || '').toLowerCase();
    const t = String(target || '').toLowerCase();
    return voice === t || brand === t || voice.includes(t) || t.includes(voice);
  }
  if (type === 'content_type' || type === 'task_type') {
    const hay = `${ctx.contentType || ''} ${ctx.taskType || ''} ${ctx.mode || ''}`.toLowerCase();
    return hay.includes(String(target || '').toLowerCase());
  }
  return false;
}

/**
 * Spec priority order for selecting winners among conflicts.
 */
function instructionRank(record, ctx) {
  let score = SCOPE_PRIORITY[record.scope?.type] ?? 0;
  // Current explicit / persistent boost
  if (record.persistence === 'persistent') score += 8;
  if (record.persistence === 'candidate') score += 3;
  score += (record.confidence || 0) * 5;
  score += Math.min(5, (record.occurrenceCount || 1) * 0.5);
  // Recency
  const ts = Date.parse(record.lastSeenAt || record.firstSeenAt || 0);
  if (!Number.isNaN(ts)) score += Math.min(5, ts / 1e13);
  // Prefer channel/voice matching current context slightly
  if (record.scope?.type === 'channel' && scopeMatches(record, ctx)) score += 2;
  return score;
}

/**
 * @param {{
 *   activeVoice?: string|null,
 *   brand?: string|null,
 *   channel?: string|null,
 *   contentType?: string|null,
 *   taskType?: string|null,
 *   mode?: string|null,
 *   conversationId?: string|null,
 *   sessionContext?: object,
 *   limit?: number,
 * }} input
 */
export function resolveApplicableFeedback(input = {}) {
  const ctx = {
    activeVoice: input.activeVoice || input.voiceId || null,
    voiceId: input.activeVoice || input.voiceId || null,
    brand: input.brand || null,
    channel: input.channel || null,
    contentType: input.contentType || null,
    taskType: input.taskType || input.mode || null,
    mode: input.mode || null,
  };

  const all = listActiveFeedbackRecords({ conversationId: input.conversationId });
  const matched = [];
  const excluded = [];

  for (const record of all) {
    if (record.status !== 'active') {
      excluded.push({ id: record.id, reason: 'inactive' });
      continue;
    }
    if (!scopeMatches(record, ctx)) {
      excluded.push({ id: record.id, reason: 'scope_mismatch' });
      continue;
    }
    matched.push(record);
  }

  // Sort by priority descending
  matched.sort((a, b) => instructionRank(b, ctx) - instructionRank(a, ctx));

  const applied = [];
  const conflicts = [];
  const suppressed = new Set();

  for (const record of matched) {
    if (suppressed.has(record.id)) continue;
    let conflicted = false;
    for (const other of applied) {
      if (!preferencesConflict(record, other)) continue;
      // Higher rank already applied wins; suppress lower
      conflicts.push({ winner: other.id, loser: record.id });
      suppressed.add(record.id);
      conflicted = true;
      break;
    }
    if (!conflicted) applied.push(record);
  }

  // Also suppress records superseded by an applied one
  for (const record of applied) {
    for (const sid of record.supersedes || []) {
      suppressed.add(sid);
    }
  }
  const finalApplied = applied.filter((r) => !suppressed.has(r.id));

  const limit = input.limit ?? 8;
  const limited = finalApplied.slice(0, limit);

  const sessionPrefs = limited.filter(
    (r) =>
      r.persistence === 'session' ||
      r.scope.type === 'temporary_session' ||
      r.scope.type === 'single_response',
  );
  const durablePrefs = limited.filter((r) => !sessionPrefs.includes(r));

  const promptRules = limited.map((r) => {
    const scopeLabel =
      r.scope.type === 'global'
        ? 'global'
        : `${r.scope.type}:${r.scope.target || '*'}`;
    const verb =
      r.polarity === 'ban' || r.polarity === 'avoid'
        ? 'Kaçın'
        : r.polarity === 'continue'
          ? 'Sürdür'
          : 'Tercih et';
    return `- [${scopeLabel}] ${verb}: ${r.normalizedPreference}`;
  });

  return {
    activePreferences: durablePrefs,
    sessionPreferences: sessionPrefs,
    conflicts,
    excluded,
    appliedFeedbackIds: limited.map((r) => r.id),
    promptRules,
    promptBlock: promptRules.length
      ? `## Active Editorial Feedback (scoped)\n${promptRules.join('\n')}`
      : '',
  };
}

/**
 * Compact debug metadata (no raw private prose).
 */
export function buildFeedbackDebugMeta(extraction, upsertResults, resolution) {
  return {
    detectedSignals: (extraction?.signals || []).map((s) => ({
      category: s.category,
      polarity: s.polarity,
      scope: s.scope,
      persistence: s.persistence,
      confidence: s.confidence,
    })),
    appliedFeedbackIds: resolution?.appliedFeedbackIds || [],
    persistenceDecision: extraction?.persistenceDecision || '',
    skippedReason: extraction?.skippedReason || '',
    conflicts: resolution?.conflicts || [],
    upserts: (upsertResults || []).map((u) => ({
      ok: u.ok,
      persisted: u.persisted,
      merged: u.merged,
      id: u.record?.id ?? null,
      skippedReason: u.skippedReason ?? null,
    })),
  };
}
