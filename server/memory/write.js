// ═══════════════════════════════════════════════════════════════════════
// Memory V2 — write orchestrator (normalize → dedup → contradict → store)
// ═══════════════════════════════════════════════════════════════════════

import { findDuplicate } from './deduplicate.js';
import { resolveContradictionOrInsert } from './contradiction.js';
import {
  normalizeEntityToMemory,
  foldMemoryText,
  resolveCanonicalKey,
} from './normalize.js';
import {
  insertMemoryRecord,
  softDeleteMemory,
  listActiveMemories,
  findActiveByKey,
  updateMemoryRecord,
  normalizeCompareText,
} from './store.js';
import { isMemoryWriteFrozen, MEMORY_PAYLOAD_LIMITS } from './config.js';
import { mirrorUserMemoryToJson } from './json-mirror.js';

async function afterMutation(userId) {
  try {
    await mirrorUserMemoryToJson(userId);
  } catch (err) {
    console.warn('[MemoryV2] dual-write mirror failed:', err.message);
  }
}

/**
 * Write from memory-intents validated entity.
 * @param {string} userId
 * @param {object} entity
 * @param {string} rawMessage
 * @param {{ conversationId?: string, sourceMessageId?: string, source?: string }} [opts]
 */
export async function writeFromValidatedEntity(userId, entity, rawMessage, opts = {}) {
  if (isMemoryWriteFrozen()) {
    return { ok: false, error: 'memory_write_frozen', written: false };
  }
  const normalized = normalizeEntityToMemory(entity, rawMessage);
  if (!normalized) {
    return { ok: false, error: 'normalize_failed', written: false };
  }
  if (normalized.skipWrite) {
    return {
      ok: true,
      written: false,
      skipped: true,
      reason: normalized.skipReason,
      replyHint: 'past_not_stored',
    };
  }

  return writeStructuredMemory(userId, {
    type: normalized.type,
    key: normalized.key,
    value: normalized.value,
    text: normalized.text,
    source: opts.source || 'explicit_user',
    confidence: 1,
    importance: normalized.importance,
    temporal: normalized.temporal,
    conversationId: opts.conversationId ?? null,
    sourceMessageId: opts.sourceMessageId ?? null,
    metadata: { rawMessage: String(rawMessage).slice(0, 300) },
  });
}

/**
 * Core structured write with dedup + supersede.
 * @param {string} userId
 * @param {object} candidate
 */
export async function writeStructuredMemory(userId, candidate) {
  if (isMemoryWriteFrozen()) {
    return { ok: false, error: 'memory_write_frozen', written: false };
  }

  const text = String(candidate.text ?? '').trim();
  if (text.length > MEMORY_PAYLOAD_LIMITS.maxRejectChars) {
    return { ok: false, error: 'payload_too_large', written: false };
  }
  if (text.length > MEMORY_PAYLOAD_LIMITS.maxTextChars) {
    return { ok: false, error: 'text_exceeds_limit', written: false };
  }

  const dup = findDuplicate(userId, {
    key: candidate.key ?? null,
    value: candidate.value,
    text: candidate.text,
  });

  if (dup.duplicate && dup.existing) {
    if (
      !candidate.key ||
      (dup.reason === 'exact_text' &&
        (!dup.existing.key || dup.existing.key === candidate.key))
    ) {
      await updateMemoryRecord(userId, dup.existing.id, {
        importance: Math.max(dup.existing.importance, candidate.importance ?? 0.5),
      });
      await afterMutation(userId);
      return {
        ok: true,
        written: false,
        duplicate: true,
        action: 'noop_duplicate',
        memory: dup.existing,
      };
    }
  }

  const insertFn = async (c) =>
    insertMemoryRecord({
      userId,
      type: c.type,
      key: c.key ?? null,
      value: c.value,
      text: c.text,
      source: c.source || 'explicit_user',
      confidence: c.confidence ?? 1,
      importance: c.importance ?? 0.5,
      conversationId: c.conversationId ?? null,
      sourceMessageId: c.sourceMessageId ?? null,
      metadata: c.metadata ?? null,
    });

  const resolved = await resolveContradictionOrInsert(userId, candidate, insertFn);

  if (resolved.ok === false) {
    return {
      ok: false,
      written: false,
      action: resolved.action,
      memory: null,
      error: resolved.error || resolved.reason || 'write_failed',
    };
  }

  if (resolved.action === 'noop_duplicate') {
    await afterMutation(userId);
    return {
      ok: true,
      written: false,
      duplicate: true,
      action: 'noop_duplicate',
      memory: resolved.memory,
    };
  }

  if (resolved.action === 'supersede') {
    await afterMutation(userId);
    return {
      ok: true,
      written: true,
      action: 'supersede',
      memory: resolved.memory,
      old: resolved.old,
    };
  }

  if (resolved.memory) {
    await afterMutation(userId);
    return {
      ok: true,
      written: true,
      action: resolved.action || 'insert',
      memory: resolved.memory,
    };
  }

  // Fallback insert only if contradict path did not already attempt insert.
  if (resolved.reason === 'no_single_key' || resolved.reason === 'no_existing') {
    return {
      ok: false,
      written: false,
      action: 'insert',
      memory: null,
      error: resolved.error || 'insert_failed',
    };
  }

  const created = await insertFn(candidate);
  if (created.ok) await afterMutation(userId);
  return {
    ok: created.ok,
    written: Boolean(created.ok),
    action: 'insert',
    memory: created.memory ?? null,
    error: created.ok ? undefined : created.error,
  };
}

/**
 * Forget helpers — soft delete by name, key topic, or text match.
 * @param {string} userId
 * @param {{ kind: string, value?: string|null, field?: string }} entity
 * @param {string} rawMessage
 */
export async function forgetFromEntity(userId, entity, rawMessage) {
  if (isMemoryWriteFrozen()) {
    return { ok: false, deleted: 0, error: 'memory_write_frozen' };
  }

  if (entity?.kind === 'forget-name') {
    const keys = ['profile.name', 'preferences.preferredName', 'preferences.addressStyle'];
    let count = 0;
    for (const key of keys) {
      const mem = findActiveByKey(userId, key);
      if (mem) {
        await softDeleteMemory(userId, mem.id);
        count += 1;
      }
    }
    await afterMutation(userId);
    return { ok: true, deleted: count, mode: 'name' };
  }

  const msg = String(rawMessage ?? '');
  const topicCoffee = /\bkahve\b/i.test(msg);
  const topicColor = /\brenk\b/i.test(msg);
  const topicVegan = /\bvegan\b/i.test(msg);

  /** @type {string[]} */
  const topicKeys = [];
  if (topicCoffee) {
    topicKeys.push('preference.coffee.sugar', 'preference.coffee.milk');
  }
  if (topicColor) topicKeys.push('preference.favorite_color');
  if (topicVegan) topicKeys.push('preference.diet.vegan');

  if (/\b(tercih|bilgi).{0,20}unut|\bunut.{0,40}(tercih|kahve|renk)/i.test(msg)) {
    if (topicCoffee || /\bkahve\b/i.test(msg)) {
      topicKeys.push('preference.coffee.sugar', 'preference.coffee.milk');
    }
  }

  let deleted = 0;
  const uniqueKeys = [...new Set(topicKeys)];
  for (const key of uniqueKeys) {
    const mem = findActiveByKey(userId, key);
    if (mem) {
      await softDeleteMemory(userId, mem.id);
      deleted += 1;
    }
  }

  const needle =
    entity?.kind === 'forget-fact' && entity.value
      ? foldMemoryText(String(entity.value))
      : '';

  if (needle.length >= 3 || deleted === 0) {
    const active = listActiveMemories(userId);
    const search =
      needle ||
      foldMemoryText(
        msg
          .replace(
            /\b(bunu|şunu|unut|sil|hafızandan|bilgiyi|tercihimle|ilgili)\b/gi,
            '',
          )
          .trim(),
      );
    if (search.length >= 3) {
      for (const mem of active) {
        const hay = `${mem.key || ''} ${mem.text} ${JSON.stringify(mem.value ?? '')}`;
        if (
          foldMemoryText(hay).includes(search) ||
          search.includes(foldMemoryText(mem.text)) ||
          (mem.key && resolveCanonicalKey(search) === mem.key)
        ) {
          await softDeleteMemory(userId, mem.id);
          deleted += 1;
        }
      }
    }
  }

  if (deleted > 0) await afterMutation(userId);
  return { ok: true, deleted, mode: deleted ? 'matched' : 'none' };
}

/**
 * Detect current-message overrides that should suppress conflicting memories in retrieval.
 * @param {string} message
 * @returns {string[]}
 */
export function detectCurrentMessageOverrides(message) {
  const t = String(message ?? '');
  /** @type {string[]} */
  const suppressed = [];

  if (/\b(artık\s+)?vegan\s+değil|vegan\s+değilim|not\s+vegan|etli\b/i.test(t)) {
    suppressed.push('preference.diet.vegan');
  }
  if (
    (/\b(şekersiz|sekersiz|şekeri\s*bırak|artık.{0,20}şekersiz)\b/i.test(t) ||
      /\b(şekerli|sekerli)\b/i.test(t)) &&
    (/\bkahve\b/i.test(t) || /\bşeker|seker\b/i.test(t))
  ) {
    suppressed.push('preference.coffee.sugar');
  }
  if (/\b(taşındım|taşındık|konumum|artık.{0,15}yaşıyorum)\b/i.test(t)) {
    suppressed.push('profile.location');
  }

  return [...new Set(suppressed)];
}

export { normalizeCompareText };
