/**
 * Chat usage gate — the real Free vs Prime "Genişletilmiş kullanım" difference.
 *
 * Two layers, both plan-differentiated and server-resolved (never trusts
 * client-supplied plan/entitlement fields):
 *   1. Per-minute burst ceiling (anti-abuse, reuses checkRateLimit)
 *   2. Daily message quota (real cost control, reuses the voice/usage.js bucket pattern)
 *
 * Fails closed: if entitlement resolution throws, the request is treated as
 * guest (tightest limits) rather than silently unlimited.
 */

import { checkRateLimit } from '../auth/rate-limit.js';
import { resolveEntitlements } from './resolve.js';
import { ATLAS_PLANS } from './capabilities.js';
import {
  checkChatDailyQuota,
  getChatBurstConfig,
  recordChatUsage,
} from '../usage/chat-usage.js';

/**
 * @param {{ keyPrefix?: string }} [opts]
 */
export function chatUsageGate(opts = {}) {
  const keyPrefix = opts.keyPrefix || 'chat';

  return function usageGate(req, res, next) {
    let plan = ATLAS_PLANS.GUEST;
    try {
      const resolved = resolveEntitlements(req.auth || {});
      plan = resolved.plan || ATLAS_PLANS.GUEST;
    } catch {
      // Fail closed — resolver error never grants a wider quota.
      plan = ATLAS_PLANS.GUEST;
    }

    const userKey = req.auth?.userId || req.ip || 'anonymous';

    const burstConfig = getChatBurstConfig();
    const burst = checkRateLimit(`${keyPrefix}-burst:${plan}:${userKey}`, {
      windowMs: 60_000,
      max: burstConfig[plan] ?? burstConfig[ATLAS_PLANS.GUEST],
    });

    res.setHeader('X-Atlas-Plan', plan);
    res.setHeader('X-RateLimit-Remaining', String(burst.remaining));

    if (!burst.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(burst.retryAfterMs / 1000)));
      return res.status(429).json({
        error: 'Çok fazla istek. Lütfen kısa bir süre sonra yeniden dene.',
        code: 'rate_limited',
      });
    }

    const quota = checkChatDailyQuota(userKey, plan);
    res.setHeader('X-Atlas-Chat-Daily-Limit', String(quota.limit));
    res.setHeader('X-Atlas-Chat-Daily-Remaining', String(Math.max(0, quota.limit - quota.used)));

    if (!quota.allowed) {
      const upsell =
        plan === ATLAS_PLANS.PREMIUM
          ? null
          : 'Lara Prime ile günlük kullanım sınırın genişler.';
      return res.status(429).json({
        error: upsell
          ? `Günlük kullanım sınırına ulaştın. ${upsell}`
          : 'Günlük kullanım sınırına ulaştın. Lütfen yarın tekrar dene.',
        code: 'daily_quota_exceeded',
        plan,
        limit: quota.limit,
        resetAt: quota.resetAt,
      });
    }

    recordChatUsage(userKey);
    req.atlasUsage = { plan, dailyUsed: quota.used + 1, dailyLimit: quota.limit };
    return next();
  };
}
