// ═══════════════════════════════════════════════════════════════════════
// Admin Control Center — Phase A
//
// Every function here reads from an EXISTING store/module. Nothing is
// fabricated: a metric with no real backing data is reported as
// unavailable/not-yet-tracked rather than estimated.
// ═══════════════════════════════════════════════════════════════════════

import { listAllAccounts, toPublicAccount } from '../auth/index.js';
import { resolveEntitlements, hasCapability } from '../entitlements/resolve.js';
import { CAPABILITIES, ATLAS_PLANS } from '../entitlements/capabilities.js';
import { getChatUsageSnapshot, getChatUsageOverview, getChatDailyQuotaConfig } from '../usage/chat-usage.js';
import { listUserConversations } from '../conversations.js';
import { getUserMemory } from '../user-memory.js';
import { getPrimeProfile, profileCompleteness } from '../prime/profile.js';
import { countCheckinsOnDate, civilDateKey } from '../prime/checkin.js';
import { getOutlookBuildCount } from '../prime/outlook.js';
import { listAdminAuditEvents } from '../auth/admin-audit.js';
import { isVoiceConfigured, getVoice, getLaraMasterPath } from '../voice/registry.js';
import { getBillingConfig } from '../billing/config.js';
import { listFeedback, countFeedbackByStatus } from '../feedback/store.js';
import { listErrors, countErrorsByStatus } from './error-log.js';

/** Deterministic, code-defined threshold — not an arbitrary anomaly model. */
export const NEAR_LIMIT_THRESHOLD_RATIO = 0.8;

function resolveAccountEntitlements(account) {
  try {
    return resolveEntitlements({ authenticated: true, userId: account.userId, isAnonymous: false });
  } catch {
    // Fail closed: an unresolvable record is never shown as premium.
    return { plan: ATLAS_PLANS.FREE, subscriptionStatus: 'unknown', entitlements: {}, subscription: null };
  }
}

function toAdminUserRow(account) {
  const publicAccount = toPublicAccount(account);
  const resolved = resolveAccountEntitlements(account);
  const usage = getChatUsageSnapshot(account.userId, resolved.plan);
  return {
    userId: publicAccount.userId,
    username: publicAccount.username,
    email: publicAccount.email,
    roles: publicAccount.roles,
    plan: resolved.plan,
    subscriptionStatus: resolved.subscriptionStatus,
    usageToday: { dailyUsed: usage.used, dailyLimit: usage.limit },
    createdAt: account.createdAt ?? null,
    lastActive: null, // not tracked anywhere in this codebase — honestly null, never fabricated
  };
}

/**
 * @param {{ search?: string, plan?: string, subscriptionStatus?: string, role?: string, limit?: number, offset?: number }} [opts]
 */
export function listAdminUsers(opts = {}) {
  const MAX_LIMIT = 200;
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), MAX_LIMIT);
  const offset = Math.max(Number(opts.offset) || 0, 0);
  const search = typeof opts.search === 'string' ? opts.search.trim().toLowerCase().slice(0, 200) : '';

  let rows = listAllAccounts().map(toAdminUserRow);

  if (search) {
    rows = rows.filter(
      (r) =>
        (r.email && r.email.toLowerCase().includes(search)) ||
        (r.username && r.username.toLowerCase().includes(search)) ||
        r.userId.toLowerCase().includes(search),
    );
  }
  if (opts.plan) rows = rows.filter((r) => r.plan === opts.plan);
  if (opts.subscriptionStatus) rows = rows.filter((r) => r.subscriptionStatus === opts.subscriptionStatus);
  if (opts.role) rows = rows.filter((r) => r.roles.includes(opts.role));

  const total = rows.length;
  const page = rows.slice(offset, offset + limit);
  return { total, limit, offset, users: page };
}

/**
 * Detail view — safe fields only. Never returns raw conversation content,
 * raw memory fact values, or private media.
 * @param {string} userId
 */
export function getAdminUserDetail(userId) {
  const accounts = listAllAccounts();
  const account = accounts.find((a) => a.userId === userId);
  if (!account) return { ok: false, error: 'User not found' };

  const publicAccount = toPublicAccount(account);
  const resolved = resolveAccountEntitlements(account);
  const usage = getChatUsageSnapshot(userId, resolved.plan);

  let conversationCount = 0;
  try {
    conversationCount = listUserConversations(userId).length;
  } catch {
    conversationCount = 0;
  }

  let memoryFactCount = 0;
  try {
    memoryFactCount = Object.keys(getUserMemory(userId)?.facts || {}).length;
  } catch {
    memoryFactCount = 0;
  }

  let completeness = null;
  try {
    const profileResult = getPrimeProfile(userId);
    if (profileResult.ok) completeness = profileCompleteness(profileResult.profile);
  } catch {
    completeness = null;
  }

  return {
    ok: true,
    user: {
      userId: publicAccount.userId,
      username: publicAccount.username,
      email: publicAccount.email,
      roles: publicAccount.roles,
      disabled: publicAccount.disabled,
      createdAt: account.createdAt ?? null,
      lastActive: null,
      plan: resolved.plan,
      subscriptionStatus: resolved.subscriptionStatus,
      subscription: resolved.subscription,
      entitlements: {
        'voice.lara': hasCapability(resolved.entitlements, CAPABILITIES.VOICE_LARA),
        'usage.extended': hasCapability(resolved.entitlements, CAPABILITIES.USAGE_EXTENDED),
        'image.analysis': hasCapability(resolved.entitlements, CAPABILITIES.IMAGE_ANALYSIS),
        'memory.extended': hasCapability(resolved.entitlements, CAPABILITIES.MEMORY_EXTENDED),
      },
      usageToday: { dailyUsed: usage.used, dailyLimit: usage.limit },
      conversationCount,
      memoryFactCount,
      profileCompleteness: completeness,
    },
  };
}

export function getAdminOverview() {
  const accounts = listAllAccounts();
  let primeUsers = 0;
  let primeProfilesCompleted = 0;
  for (const account of accounts) {
    const resolved = resolveAccountEntitlements(account);
    if (resolved.plan !== ATLAS_PLANS.PREMIUM) continue;
    primeUsers += 1;
    try {
      const profileResult = getPrimeProfile(account.userId);
      if (profileResult.ok && profileCompleteness(profileResult.profile).deeperPersonalizationReady) {
        primeProfilesCompleted += 1;
      }
    } catch {
      /* skip unreadable profile */
    }
  }
  const totalUsers = accounts.length;
  const freeUsers = totalUsers - primeUsers;

  const usageOverview = getChatUsageOverview();
  const quotaConfig = getChatDailyQuotaConfig();

  const todayKey = civilDateKey('Europe/Istanbul');
  let checkInsToday = 0;
  try {
    // Write path is Prime-gated. Aggregate counts only — never intention text.
    checkInsToday = countCheckinsOnDate(todayKey);
  } catch {
    checkInsToday = 0;
  }

  let backendStatus = 'unknown';
  try {
    backendStatus = getAdminHealth().overallStatus;
  } catch {
    backendStatus = 'unknown';
  }

  let openFeedbackCount = null;
  let recentFeedback = [];
  try {
    const feedbackCounts = countFeedbackByStatus();
    openFeedbackCount = feedbackCounts.new + feedbackCounts.reviewing;
    recentFeedback = listFeedback({ limit: 5 }).entries;
  } catch {
    openFeedbackCount = null;
    recentFeedback = [];
  }

  let openErrorCount = null;
  let recentErrors = [];
  try {
    const errorCounts = countErrorsByStatus();
    openErrorCount = errorCounts.open + errorCounts.investigating;
    recentErrors = listErrors({ limit: 5 }).entries;
  } catch {
    openErrorCount = null;
    recentErrors = [];
  }

  return {
    totalUsers,
    primeUsers,
    freeUsers,
    activeToday: null, // no last-activity tracking exists — honestly unavailable, not fabricated
    chatUsageToday: usageOverview.totalRequestsToday,
    usersActiveInChatToday: usageOverview.usersActiveToday,
    quotaConfig,
    estimatedAiCost: null, // see getAdminCosts() — not yet authoritative
    primeProfilesCompleted,
    checkInsToday,
    outlookGenerationCount: getOutlookBuildCount(),
    backendStatus,
    openFeedbackCount,
    recentFeedback,
    openErrorCount,
    recentErrors,
  };
}

export function getAdminUsage() {
  const accounts = listAllAccounts();
  const rows = accounts.map((account) => {
    const resolved = resolveAccountEntitlements(account);
    const usage = getChatUsageSnapshot(account.userId, resolved.plan);
    const ratio = usage.limit > 0 ? usage.used / usage.limit : 0;
    return {
      userId: account.userId,
      plan: resolved.plan,
      dailyUsed: usage.used,
      dailyLimit: usage.limit,
      nearLimit: ratio >= NEAR_LIMIT_THRESHOLD_RATIO && ratio < 1,
      atLimit: usage.limit > 0 && usage.used >= usage.limit,
    };
  });
  const overview = getChatUsageOverview();
  return {
    totalRequestsToday: overview.totalRequestsToday,
    usersActiveToday: overview.usersActiveToday,
    nearLimitThreshold: NEAR_LIMIT_THRESHOLD_RATIO,
    users: rows,
    usersNearLimit: rows.filter((r) => r.nearLimit),
    usersAtLimit: rows.filter((r) => r.atLimit),
  };
}

/**
 * Honest by design: per-request costUsd is computed in openai-client.js but
 * only ever console.log'd today — there is no persisted/aggregated cost
 * store anywhere in this codebase. Rather than fabricate a number, this
 * reports the real state of that gap.
 */
export function getAdminCosts() {
  return {
    authoritative: false,
    reason: 'USAGE_AVAILABLE_COST_NOT_AGGREGATED',
    message:
      'Token/cost hesaplaması her istek için üretiliyor ama hiçbir yerde toplanmıyor (yalnızca sunucu logunda). Bu nedenle maliyet burada gösterilmiyor.',
    todayEstimatedCost: null,
    sevenDayEstimatedCost: null,
    thirtyDayEstimatedCost: null,
    costByCapability: null,
    costByProvider: null,
    costByUser: null,
  };
}

function checkStoreReadable(fn, label) {
  try {
    fn();
    return { service: label, status: 'healthy' };
  } catch (err) {
    return { service: label, status: 'unavailable', detail: err?.message ?? 'read failed' };
  }
}

export function getAdminHealth() {
  const services = [];

  // Voice — real, existing signal.
  try {
    const lara = getVoice('lara');
    const configured = lara ? isVoiceConfigured(lara) : false;
    const assetPresent = Boolean(getLaraMasterPath());
    services.push({
      service: 'voice',
      status: configured && assetPresent ? 'healthy' : configured ? 'degraded' : 'unavailable',
      detail: !assetPresent ? 'lara-master.mp3 missing (pre-existing, not git-tracked)' : undefined,
    });
  } catch (err) {
    services.push({ service: 'voice', status: 'unknown', detail: err?.message });
  }

  // Billing — real, existing signal.
  try {
    const cfg = getBillingConfig();
    services.push({
      service: 'billing',
      status: cfg?.pricing?.monthlyPrice ? 'healthy' : 'degraded',
      detail: cfg?.pricing?.monthlyPrice ? undefined : 'PREMIUM_MONTHLY_PRICE_TRY not configured in this environment',
    });
  } catch (err) {
    services.push({ service: 'billing', status: 'unavailable', detail: err?.message });
  }

  // Storage read-probes — a real probe, not "healthy because it imported".
  services.push(checkStoreReadable(() => listAllAccounts(), 'auth_store'));
  services.push(checkStoreReadable(() => getUserMemory('web:__health_probe__'), 'memory_store'));
  services.push(checkStoreReadable(() => listUserConversations('web:__health_probe__'), 'conversation_store'));
  services.push(checkStoreReadable(() => getChatUsageOverview(), 'usage_store'));
  services.push(checkStoreReadable(() => listAdminAuditEvents(), 'audit_store'));

  // Known, currently-open blockers — reported because they are real and
  // reproducible today, not hardcoded marketing copy about the product.
  services.push({
    service: 'auth_verification_script',
    status: 'unavailable',
    detail: "server/verify-auth.mjs blocked by a pre-existing quran-verse-lookup export mismatch (does not affect the running server, only this one verification script)",
  });

  const overallStatus = services.some((s) => s.status === 'unavailable')
    ? 'degraded'
    : services.some((s) => s.status === 'degraded')
      ? 'degraded'
      : 'healthy';

  return { overallStatus, services, checkedAt: new Date().toISOString() };
}

/**
 * @param {{ limit?: number, offset?: number }} [opts]
 */
export function getAdminAuditLog(opts = {}) {
  const MAX_LIMIT = 200;
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), MAX_LIMIT);
  const offset = Math.max(Number(opts.offset) || 0, 0);

  const all = listAdminAuditEvents().slice().reverse(); // newest first
  const total = all.length;
  const page = all.slice(offset, offset + limit).map((e) => ({
    eventId: e.eventId,
    timestamp: e.timestamp,
    actor: e.actor,
    action: e.action,
    targetUserId: e.targetUserId,
    result: e.result,
    // Deliberately excluded: reason, meta — may carry free-text detail not
    // meant for broad admin-list display; available via targeted lookups
    // if ever needed, not dumped here.
  }));
  return { total, limit, offset, events: page };
}
