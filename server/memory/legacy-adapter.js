// ═══════════════════════════════════════════════════════════════════════
// Memory V2 — legacy profile/preferences/facts adapter
// Reconstructs the classic UserMemory blob from typed records.
// ═══════════════════════════════════════════════════════════════════════

import { createEmptyUserMemory } from '../user-memory-types.js';
import {
  listActiveMemories,
  listMemories,
  hardDeleteAllUserMemories,
  softDeleteAllUserMemories,
  softDeleteMemory,
  findActiveByKey,
} from './store.js';
import { writeStructuredMemory } from './write.js';
import { formatMemoryText } from './normalize.js';

/**
 * @param {string} userId
 * @returns {ReturnType<typeof createEmptyUserMemory>}
 */
export function legacyMemoryFromStore(userId) {
  const base = createEmptyUserMemory();
  const active = listActiveMemories(userId);
  let latest = null;

  for (const mem of active) {
    if (!latest || mem.updatedAt > latest) latest = mem.updatedAt;

    if (mem.key?.startsWith('profile.')) {
      const field = mem.key.slice('profile.'.length);
      if (field in base.profile) {
        base.profile[field] =
          mem.value == null || mem.value === ''
            ? null
            : String(mem.value);
      }
      continue;
    }

    if (mem.key?.startsWith('preferences.')) {
      const field = mem.key.slice('preferences.'.length);
      base.preferences[field] = mem.value;
      continue;
    }

    if (mem.key === 'facts.zodiac') {
      base.facts.zodiac = mem.value;
      continue;
    }

    // Structured prefs that were not in classic preferences blob
    if (mem.key?.startsWith('preference.') || mem.key?.startsWith('habit.')) {
      base.facts[mem.key] = mem.value;
      // Also keep readable text under a stable fact alias for older readers
      continue;
    }

    if (mem.key?.startsWith('facts.')) {
      base.facts[mem.key.slice('facts.'.length)] = mem.value;
      continue;
    }

    // Free-form facts
    if (mem.type === 'fact' && !mem.key) {
      base.facts[`note_${mem.id.replace(/[^a-zA-Z0-9]/g, '').slice(-10)}`] = mem.text;
    } else if (mem.type === 'fact' && mem.key) {
      base.facts[mem.key] = mem.value ?? mem.text;
    }
  }

  base.updatedAt = latest;
  return base;
}

/**
 * Apply classic partial update onto V2 records.
 * @param {string} userId
 * @param {Partial<ReturnType<typeof createEmptyUserMemory>>} partial
 */
export async function applyLegacyPartialUpdate(userId, partial) {
  /** @type {Array<{ ok: boolean }>} */
  const results = [];

  // primeCheckins is intentionally not handled here. It is an opaque legacy
  // extension preserved by json-mirror.js, not a Memory V2 record family.

  if (partial.profile && typeof partial.profile === 'object') {
    for (const [field, value] of Object.entries(partial.profile)) {
      if (value === null || value === undefined || value === '') {
        const existing = findActiveByKey(userId, `profile.${field}`);
        if (existing) {
          await softDeleteMemory(userId, existing.id);
        }
        continue;
      }
      results.push(
        await writeStructuredMemory(userId, {
          type: 'profile',
          key: `profile.${field}`,
          value: String(value).trim(),
          text: formatMemoryText(`profile.${field}`, String(value).trim()),
          source: 'system',
          importance: 0.9,
        }),
      );
      if (field === 'name') {
        results.push(
          await writeStructuredMemory(userId, {
            type: 'preference',
            key: 'preferences.preferredName',
            value: String(value).trim(),
            text: formatMemoryText('preferences.preferredName', String(value).trim()),
            source: 'system',
            importance: 0.85,
          }),
        );
      }
    }
  }

  if (partial.preferences && typeof partial.preferences === 'object') {
    for (const [field, value] of Object.entries(partial.preferences)) {
      const key = `preferences.${field}`;
      if (value === null || value === undefined) {
        const existing = findActiveByKey(userId, key);
        if (existing) {
          await softDeleteMemory(userId, existing.id);
        }
        continue;
      }
      results.push(
        await writeStructuredMemory(userId, {
          type: 'preference',
          key,
          value,
          text: formatMemoryText(key, value, String(value)),
          source: 'system',
          importance: field === 'memoryEnabled' ? 1 : 0.75,
        }),
      );
    }
  }

  if (partial.facts && typeof partial.facts === 'object') {
    for (const [factKey, factValue] of Object.entries(partial.facts)) {
      if (factValue === null || factValue === undefined) continue;
      const text =
        typeof factValue === 'string' ? factValue : JSON.stringify(factValue);
      if (factKey === 'zodiac') {
        results.push(
          await writeStructuredMemory(userId, {
            type: 'fact',
            key: 'facts.zodiac',
            value: factValue,
            text: `Burç: ${factValue}`,
            source: 'system',
            importance: 0.6,
          }),
        );
        continue;
      }
      // Prefer structured write for known fact keys that look like preference.*
      if (factKey.startsWith('preference.') || factKey.startsWith('habit.')) {
        results.push(
          await writeStructuredMemory(userId, {
            type: factKey.startsWith('habit.') ? 'habit' : 'preference',
            key: factKey,
            value: factValue,
            text: typeof factValue === 'string' ? factValue : text,
            source: 'system',
            importance: 0.7,
          }),
        );
        continue;
      }
      results.push(
        await writeStructuredMemory(userId, {
          type: 'fact',
          key: factKey.startsWith('note_') ? null : `facts.${factKey}`,
          value: factValue,
          text,
          source: 'explicit_user',
          importance: 0.45,
        }),
      );
    }
  }

  return {
    ok: results.every((r) => r.ok !== false),
    memory: legacyMemoryFromStore(userId),
  };
}

/**
 * Replace entire classic blob.
 * @param {string} userId
 * @param {ReturnType<typeof createEmptyUserMemory>} memory
 */
export async function replaceLegacyMemory(userId, memory) {
  await softDeleteAllUserMemories(userId);
  return applyLegacyPartialUpdate(userId, memory);
}

/**
 * Full erase for account deletion (hard).
 * @param {string} userId
 */
export async function eraseUserMemoryV2(userId) {
  return hardDeleteAllUserMemories(userId);
}

/**
 * Diagnostics: count by status for a user.
 * @param {string} userId
 */
export function legacyAdapterStats(userId) {
  const all = listMemories(userId, { limit: 50000 });
  const byStatus = { active: 0, superseded: 0, deleted: 0 };
  for (const m of all) {
    if (byStatus[m.status] != null) byStatus[m.status] += 1;
  }
  return { total: all.length, byStatus };
}
