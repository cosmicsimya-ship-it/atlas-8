// ═══════════════════════════════════════════════════════════════════════
// Memory ownership — metadata helpers + safe migration (non-destructive)
// ═══════════════════════════════════════════════════════════════════════

import { isValidUserId } from '../user-memory.js';

/** @typedef {'public'|'internal'|'private'|'sensitive'|'restricted'} PrivacyLevel */
/** @typedef {'profile'|'preference'|'relationship'|'health'|'analysis'|'conversation'|'other'} MemoryCategory */

/**
 * @param {string} ownerUserId
 * @param {object} [value]
 * @param {{
 *   id?: string,
 *   subjectUserId?: string,
 *   privacyLevel?: PrivacyLevel,
 *   category?: MemoryCategory,
 *   source?: string,
 * }} [meta]
 */
export function createOwnedMemoryRecord(ownerUserId, value = {}, meta = {}) {
  const now = new Date().toISOString();
  const owner = String(ownerUserId ?? '').trim();
  return {
    id: meta.id ?? `memory_${Date.now()}`,
    ownerUserId: owner,
    subjectUserId: meta.subjectUserId ?? owner,
    privacyLevel: meta.privacyLevel ?? 'private',
    category: meta.category ?? 'other',
    source: meta.source ?? 'system',
    value,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Ensure a legacy user memory object has ownership metadata without deleting data.
 * Backward compatible: original profile/preferences/facts preserved.
 *
 * @param {string} userId
 * @param {object} memory
 * @param {{ source?: string, isFounder?: boolean }} [options]
 */
export function ensureMemoryOwnershipMetadata(userId, memory, options = {}) {
  if (!memory || typeof memory !== 'object') {
    return {
      profile: {},
      preferences: {},
      facts: {},
      updatedAt: null,
      ownership: createOwnedMemoryRecord(userId, {}, {
        category: 'profile',
        source: options.source ?? 'system',
        privacyLevel: options.isFounder ? 'restricted' : 'private',
      }),
    };
  }

  const next = { ...memory };
  if (!next.ownership || typeof next.ownership !== 'object') {
    next.ownership = {
      ownerUserId: userId,
      subjectUserId: userId,
      privacyLevel: options.isFounder ? 'restricted' : 'private',
      category: 'profile',
      source: options.source ?? 'system',
      migratedAt: new Date().toISOString(),
    };
  } else {
    // Fill missing fields only
    if (!next.ownership.ownerUserId) next.ownership.ownerUserId = userId;
    if (!next.ownership.subjectUserId) next.ownership.subjectUserId = userId;
    if (!next.ownership.privacyLevel) {
      next.ownership.privacyLevel = options.isFounder ? 'restricted' : 'private';
    }
  }

  return next;
}

/**
 * Migrate an entire store in-memory (caller persists). Never deletes users.
 * @param {{ users?: Record<string, object> }} store
 * @param {{ isFounderUser?: (id: string) => boolean, source?: string }} [options]
 */
export function migrateMemoryStoreOwnership(store, options = {}) {
  const users = store?.users && typeof store.users === 'object' ? store.users : {};
  const out = { users: {} };
  let migrated = 0;

  for (const [userId, memory] of Object.entries(users)) {
    if (!isValidUserId(userId)) {
      out.users[userId] = memory;
      continue;
    }
    const isFounder = options.isFounderUser ? Boolean(options.isFounderUser(userId)) : false;
    const hadOwnership = memory?.ownership && typeof memory.ownership === 'object';
    out.users[userId] = ensureMemoryOwnershipMetadata(userId, memory, {
      source: options.source ?? 'migration',
      isFounder,
    });
    if (!hadOwnership) migrated += 1;
  }

  return { store: out, migrated };
}

/**
 * @param {object|null|undefined} memory
 * @param {string} requesterUserId
 */
export function memoryBelongsToRequester(memory, requesterUserId) {
  if (!memory || !requesterUserId) return false;
  const owner = memory.ownership?.ownerUserId ?? null;
  if (owner) return owner === requesterUserId;
  // Legacy records without ownership: caller must already key by userId
  return true;
}
