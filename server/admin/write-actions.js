// ═══════════════════════════════════════════════════════════════════════
// Admin Control Center — Phase B write actions.
//
// Every mutation here:
//   - reuses an existing store's existing write function (no new storage)
//   - re-derives entitlements via resolveEntitlements() afterward (never
//     writes a capability flag directly)
//   - logs a before/after SUMMARY to the audit log (never a raw payload)
//   - validates all input server-side (bounded strings, real enums, real
//     ISO dates) and rejects any client-supplied authority field
// ═══════════════════════════════════════════════════════════════════════

import { findAccountByUserId, upsertAccount } from '../auth/index.js';
import { ATLAS_PLANS } from '../entitlements/capabilities.js';
import { getSubscription, upsertSubscription, toPublicSubscription } from '../entitlements/subscription-store.js';
import { resolveEntitlements } from '../entitlements/resolve.js';
import { logAdminAudit } from '../auth/admin-audit.js';
import { deleteUserMemory } from '../user-memory.js';
import { deleteAllUserConversations } from '../conversations.js';
import { resetUserChatUsageToday, getChatUsageSnapshot } from '../usage/chat-usage.js';

const MAX_REASON_LENGTH = 200;
const MAX_DURATION_DAYS = 3650; // ~10 years -- bounds an absurd/typo duration, not a real-world cap
const ADMIN_PROVIDER = 'admin_manual';

function boundedReason(reason) {
  if (reason === undefined || reason === null) return null;
  if (typeof reason !== 'string') return { error: 'Invalid reason' };
  if (reason.length > MAX_REASON_LENGTH) return { error: 'Reason too long' };
  return reason.trim() || null;
}

function isValidIsoDate(value) {
  if (typeof value !== 'string') return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function entitlementsSnapshot(userId) {
  try {
    return resolveEntitlements({ authenticated: true, userId, isAnonymous: false });
  } catch {
    return { plan: ATLAS_PLANS.FREE, subscriptionStatus: 'unknown', entitlements: {} };
  }
}

function subscriptionSummary(sub) {
  const pub = toPublicSubscription(sub);
  return `${pub.plan}/${pub.status}${pub.currentPeriodEnd ? ` until ${pub.currentPeriodEnd}` : ''}`;
}

function audit({ actorId, action, targetUserId, before, after, result, reason }) {
  try {
    logAdminAudit({
      action,
      actor: actorId,
      targetUserId,
      result,
      reason: reason ?? undefined,
      meta: { before, after },
    });
  } catch {
    /* audit failure must never block the actual mutation's response */
  }
}

function requireTargetAccount(userId) {
  const account = findAccountByUserId(userId);
  if (!account) return { ok: false, status: 404, error: 'User not found' };
  return { ok: true, account };
}

// ---- Prime management ---------------------------------------------------

/**
 * @param {{ actorId: string, targetUserId: string, durationDays: number, reason?: string }} input
 */
export function grantPrime({ actorId, targetUserId, durationDays, reason }) {
  const target = requireTargetAccount(targetUserId);
  if (!target.ok) return target;

  const boundedR = boundedReason(reason);
  if (boundedR && boundedR.error) return { ok: false, status: 400, error: boundedR.error };

  const duration = Number(durationDays);
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_DAYS) {
    return { ok: false, status: 400, error: 'Invalid durationDays' };
  }

  const before = getSubscription(targetUserId);
  const beforeEnt = entitlementsSnapshot(targetUserId);

  if (beforeEnt.plan === ATLAS_PLANS.PREMIUM && beforeEnt.subscriptionStatus === 'active') {
    audit({
      actorId,
      action: 'admin.prime.grant',
      targetUserId,
      before: subscriptionSummary(before),
      after: subscriptionSummary(before),
      result: 'already_active',
      reason: boundedR,
    });
    return { ok: false, status: 409, error: 'already_active', subscription: toPublicSubscription(before) };
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + duration * 86400000);
  const next = upsertSubscription({
    userId: targetUserId,
    plan: ATLAS_PLANS.PREMIUM,
    status: 'active',
    provider: ADMIN_PROVIDER,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    cancelAtPeriodEnd: false,
  });

  audit({
    actorId,
    action: 'admin.prime.grant',
    targetUserId,
    before: subscriptionSummary(before),
    after: subscriptionSummary(next),
    result: 'ok',
    reason: boundedR,
  });

  const afterEnt = entitlementsSnapshot(targetUserId);
  return { ok: true, subscription: toPublicSubscription(next), entitlements: afterEnt.entitlements, plan: afterEnt.plan };
}

/**
 * @param {{ actorId: string, targetUserId: string, reason?: string }} input
 */
export function revokePrime({ actorId, targetUserId, reason }) {
  const target = requireTargetAccount(targetUserId);
  if (!target.ok) return target;

  const boundedR = boundedReason(reason);
  if (boundedR && boundedR.error) return { ok: false, status: 400, error: boundedR.error };

  const before = getSubscription(targetUserId);

  if (!before || before.status === 'canceled' || before.status === 'inactive') {
    audit({
      actorId,
      action: 'admin.prime.revoke',
      targetUserId,
      before: subscriptionSummary(before),
      after: subscriptionSummary(before),
      result: 'already_inactive',
      reason: boundedR,
    });
    return { ok: true, subscription: toPublicSubscription(before), result: 'already_inactive' };
  }

  const next = upsertSubscription({ ...before, status: 'canceled', cancelAtPeriodEnd: true });

  audit({
    actorId,
    action: 'admin.prime.revoke',
    targetUserId,
    before: subscriptionSummary(before),
    after: subscriptionSummary(next),
    result: 'ok',
    reason: boundedR,
  });

  const afterEnt = entitlementsSnapshot(targetUserId);
  return { ok: true, subscription: toPublicSubscription(next), entitlements: afterEnt.entitlements, plan: afterEnt.plan };
}

/**
 * @param {{ actorId: string, targetUserId: string, durationDays: number, reason?: string }} input
 */
export function extendPrime({ actorId, targetUserId, durationDays, reason }) {
  const target = requireTargetAccount(targetUserId);
  if (!target.ok) return target;

  const boundedR = boundedReason(reason);
  if (boundedR && boundedR.error) return { ok: false, status: 400, error: boundedR.error };

  const duration = Number(durationDays);
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_DAYS) {
    return { ok: false, status: 400, error: 'Invalid durationDays' };
  }

  const before = getSubscription(targetUserId);
  const now = Date.now();
  const currentEnd = before?.currentPeriodEnd ? new Date(before.currentPeriodEnd).getTime() : now;
  const base = Math.max(now, currentEnd);
  const newEnd = new Date(base + duration * 86400000);

  const next = upsertSubscription({
    ...(before || { userId: targetUserId }),
    plan: ATLAS_PLANS.PREMIUM,
    status: 'active',
    provider: before?.provider || ADMIN_PROVIDER,
    currentPeriodEnd: newEnd.toISOString(),
  });

  audit({
    actorId,
    action: 'admin.prime.extend',
    targetUserId,
    before: subscriptionSummary(before),
    after: subscriptionSummary(next),
    result: 'ok',
    reason: boundedR,
  });

  const afterEnt = entitlementsSnapshot(targetUserId);
  return { ok: true, subscription: toPublicSubscription(next), entitlements: afterEnt.entitlements, plan: afterEnt.plan };
}

/**
 * @param {{ actorId: string, targetUserId: string, expiryDate: string, reason?: string }} input
 */
export function setPrimeExpiry({ actorId, targetUserId, expiryDate, reason }) {
  const target = requireTargetAccount(targetUserId);
  if (!target.ok) return target;

  const boundedR = boundedReason(reason);
  if (boundedR && boundedR.error) return { ok: false, status: 400, error: boundedR.error };

  if (!isValidIsoDate(expiryDate)) {
    return { ok: false, status: 400, error: 'Invalid expiryDate (expected ISO 8601)' };
  }

  const before = getSubscription(targetUserId);
  const isPast = new Date(expiryDate).getTime() < Date.now();

  const next = upsertSubscription({
    ...(before || { userId: targetUserId, plan: ATLAS_PLANS.PREMIUM, provider: ADMIN_PROVIDER }),
    currentPeriodEnd: new Date(expiryDate).toISOString(),
    status: isPast ? 'expired' : before?.status === 'canceled' || before?.status === 'inactive' ? before.status : 'active',
  });

  audit({
    actorId,
    action: 'admin.prime.set_expiry',
    targetUserId,
    before: subscriptionSummary(before),
    after: subscriptionSummary(next),
    result: 'ok',
    reason: boundedR,
  });

  const afterEnt = entitlementsSnapshot(targetUserId);
  return { ok: true, subscription: toPublicSubscription(next), entitlements: afterEnt.entitlements, plan: afterEnt.plan };
}

// ---- Usage ---------------------------------------------------------------

/**
 * @param {{ actorId: string, targetUserId: string, reason?: string }} input
 */
export function resetUsageToday({ actorId, targetUserId, reason }) {
  const target = requireTargetAccount(targetUserId);
  if (!target.ok) return target;

  const boundedR = boundedReason(reason);
  if (boundedR && boundedR.error) return { ok: false, status: 400, error: boundedR.error };

  const ent = entitlementsSnapshot(targetUserId);
  const before = getChatUsageSnapshot(targetUserId, ent.plan);
  resetUserChatUsageToday(targetUserId);
  const after = getChatUsageSnapshot(targetUserId, ent.plan);

  audit({
    actorId,
    action: 'admin.usage.reset_today',
    targetUserId,
    before: `${before.used}/${before.limit}`,
    after: `${after.used}/${after.limit}`,
    result: 'ok',
    reason: boundedR,
  });

  return { ok: true, usage: { dailyUsed: after.used, dailyLimit: after.limit } };
}

// ---- Account ---------------------------------------------------------------

/**
 * @param {{ actorId: string, targetUserId: string, disabled: boolean, reason?: string }} input
 */
export async function setAccountDisabled({ actorId, targetUserId, disabled, reason }) {
  const target = requireTargetAccount(targetUserId);
  if (!target.ok) return target;

  if (actorId === targetUserId && disabled) {
    return { ok: false, status: 400, error: 'Cannot disable your own account' };
  }

  const boundedR = boundedReason(reason);
  if (boundedR && boundedR.error) return { ok: false, status: 400, error: boundedR.error };

  const before = Boolean(target.account.disabled);
  await upsertAccount({ id: target.account.id, disabled: Boolean(disabled) });

  audit({
    actorId,
    action: disabled ? 'admin.account.disable' : 'admin.account.enable',
    targetUserId,
    before: before ? 'disabled' : 'enabled',
    after: disabled ? 'disabled' : 'enabled',
    result: 'ok',
    reason: boundedR,
  });

  return { ok: true, disabled: Boolean(disabled) };
}

// ---- Privacy ---------------------------------------------------------------

/**
 * Matches the EXACT scope of the existing self-service
 * DELETE /api/memory/:userId endpoint (memory + conversations together) --
 * shown as one action because that is genuinely what it does.
 * @param {{ actorId: string, targetUserId: string, reason?: string }} input
 */
export async function erasePersonalData({ actorId, targetUserId, reason }) {
  const target = requireTargetAccount(targetUserId);
  if (!target.ok) return target;

  const boundedR = boundedReason(reason);
  if (boundedR && boundedR.error) return { ok: false, status: 400, error: boundedR.error };

  const memResult = await deleteUserMemory(targetUserId);
  // Phase 3 check-ins live on the same user-memory record, so erase above
  // removes primeCheckins with profile/facts. No separate store to wipe.
  let conversationsDeleted = 0;
  try {
    const convResult = await deleteAllUserConversations(targetUserId);
    if (convResult.ok) conversationsDeleted = convResult.deleted ?? 0;
  } catch {
    conversationsDeleted = 0;
  }

  audit({
    actorId,
    action: 'admin.privacy.erase',
    targetUserId,
    before: 'memory+conversations present',
    after: `erased (conversationsDeleted=${conversationsDeleted})`,
    result: memResult.ok ? 'ok' : 'partial',
    reason: boundedR,
  });

  return { ok: true, memoryErased: memResult.ok, conversationsDeleted };
}
