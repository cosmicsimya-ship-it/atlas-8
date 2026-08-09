/**
 * Resolve canonical plan + entitlements for a request identity.
 * Client-supplied plan/entitlement fields are ignored.
 */

import {
  ATLAS_PLANS,
  CAPABILITIES,
  entitlementsForPlan,
  hasCapability,
} from './capabilities.js';
import { getPremiumPricingConfig } from './pricing.js';
import {
  getSubscription,
  subscriptionGrantsPremium,
  toPublicSubscription,
} from './subscription-store.js';

/**
 * Comma-separated userIds that receive Premium in non-production / explicit grant env.
 * Never trust a client header for this — env/server only.
 * Example: ATLAS_PREMIUM_USER_IDS=web:abc,web:def
 */
function premiumUserIdAllowlist() {
  const raw = String(process.env.ATLAS_PREMIUM_USER_IDS || '').trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * @param {{
 *   authenticated?: boolean,
 *   userId?: string|null,
 *   isAnonymous?: boolean,
 *   roles?: string[],
 * }} auth
 */
export function isGuestIdentity(auth) {
  if (!auth?.authenticated || !auth?.userId) return true;
  if (auth.isAnonymous) return true;
  if (Array.isArray(auth.roles) && auth.roles.includes('anonymous')) return true;
  if (String(auth.userId).startsWith('anonymous:')) return true;
  return false;
}

/**
 * @param {{
 *   authenticated?: boolean,
 *   userId?: string|null,
 *   isAnonymous?: boolean,
 *   roles?: string[],
 * }} [auth]
 * @returns {{
 *   authenticated: boolean,
 *   plan: string,
 *   subscriptionStatus: string,
 *   entitlements: Record<string, boolean>,
 *   subscription: ReturnType<typeof toPublicSubscription>|null,
 *   pricing: ReturnType<typeof getPremiumPricingConfig>|null,
 * }}
 */
export function resolveEntitlements(auth = {}) {
  const guest = isGuestIdentity(auth);

  if (guest) {
    return {
      authenticated: false,
      plan: ATLAS_PLANS.GUEST,
      subscriptionStatus: 'inactive',
      entitlements: entitlementsForPlan(ATLAS_PLANS.GUEST),
      subscription: null,
      pricing: getPremiumPricingConfig(),
    };
  }

  const userId = String(auth.userId);
  const sub = getSubscription(userId);
  const allowlisted = premiumUserIdAllowlist().has(userId);
  const premium = allowlisted || subscriptionGrantsPremium(sub);

  const plan = premium ? ATLAS_PLANS.PREMIUM : ATLAS_PLANS.FREE;
  const subscriptionStatus = premium
    ? allowlisted && !subscriptionGrantsPremium(sub)
      ? 'active'
      : sub?.status || 'active'
    : sub?.status || 'inactive';

  return {
    authenticated: true,
    plan,
    subscriptionStatus,
    entitlements: entitlementsForPlan(plan),
    subscription: toPublicSubscription(
      premium
        ? {
            ...(sub || {
              userId,
              plan: ATLAS_PLANS.PREMIUM,
              status: 'active',
            }),
            plan: ATLAS_PLANS.PREMIUM,
            status: subscriptionStatus,
          }
        : sub,
    ),
    pricing: getPremiumPricingConfig(),
  };
}

/**
 * @param {object} [auth]
 * @param {string} capability
 */
export function authHasCapability(auth, capability) {
  const resolved = resolveEntitlements(auth);
  return hasCapability(resolved.entitlements, capability);
}

/**
 * Public API payload — no provider IDs / secrets.
 * @param {object} [auth]
 */
export function buildEntitlementsResponse(auth) {
  const resolved = resolveEntitlements(auth);
  return {
    authenticated: resolved.authenticated,
    plan: resolved.plan,
    subscriptionStatus: resolved.subscriptionStatus,
    entitlements: resolved.entitlements,
    subscription: resolved.subscription,
    pricing: {
      productId: resolved.pricing?.productId ?? null,
      productName: resolved.pricing?.productName ?? null,
      currency: resolved.pricing?.currency ?? 'TRY',
      interval: resolved.pricing?.interval ?? 'month',
      monthlyPrice: resolved.pricing?.monthlyPrice ?? null,
      displayPrice: resolved.pricing?.displayPrice ?? null,
    },
    capabilities: { ...CAPABILITIES },
  };
}

export { CAPABILITIES, ATLAS_PLANS, hasCapability };
