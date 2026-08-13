/**
 * Canonical capability / entitlement catalog.
 * Plan labels are derived from entitlements — never trust client plan strings.
 */

/** @typedef {'guest'|'free'|'premium'} AtlasPlanId */

/** @typedef {'inactive'|'trialing'|'active'|'past_due'|'canceled'|'expired'} SubscriptionStatus */

export const ATLAS_PLANS = Object.freeze({
  GUEST: 'guest',
  FREE: 'free',
  PREMIUM: 'premium',
});

export const SUBSCRIPTION_STATUSES = Object.freeze([
  'inactive',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired',
]);

/** Statuses that grant premium capabilities */
export const PREMIUM_ACTIVE_STATUSES = Object.freeze(['active', 'trialing']);

/**
 * Capability ids — extend here when adding Premium features.
 */
export const CAPABILITIES = Object.freeze({
  ATLAS_BASIC: 'atlas.basic',
  ATLAS_HISTORY: 'atlas.history',
  VOICE_LARA: 'voice.lara',
  VOICE_MULTILINGUAL: 'voice.multilingual',
  ANALYSIS_EXTENDED: 'analysis.extended',
  USAGE_EXTENDED: 'usage.extended',
  IMAGE_ANALYSIS: 'image.analysis',
  MEMORY_EXTENDED: 'memory.extended',
  PREMIUM_FEATURES: 'premium.features',
  PRIME_WORLD: 'prime.world',
});

/**
 * Default capability matrix by plan.
 * Source of truth for product gating (not frontend hard-codes).
 * @type {Readonly<Record<string, Readonly<Record<string, boolean>>>>}
 */
export const PLAN_CAPABILITY_MATRIX = Object.freeze({
  [ATLAS_PLANS.GUEST]: Object.freeze({
    [CAPABILITIES.ATLAS_BASIC]: true,
    [CAPABILITIES.ATLAS_HISTORY]: false,
    [CAPABILITIES.VOICE_LARA]: false,
    [CAPABILITIES.VOICE_MULTILINGUAL]: false,
    [CAPABILITIES.ANALYSIS_EXTENDED]: false,
    [CAPABILITIES.USAGE_EXTENDED]: false,
    [CAPABILITIES.IMAGE_ANALYSIS]: false,
    [CAPABILITIES.MEMORY_EXTENDED]: false,
    [CAPABILITIES.PREMIUM_FEATURES]: false,
    [CAPABILITIES.PRIME_WORLD]: false,
  }),
  [ATLAS_PLANS.FREE]: Object.freeze({
    [CAPABILITIES.ATLAS_BASIC]: true,
    [CAPABILITIES.ATLAS_HISTORY]: true,
    [CAPABILITIES.VOICE_LARA]: false,
    [CAPABILITIES.VOICE_MULTILINGUAL]: false,
    [CAPABILITIES.ANALYSIS_EXTENDED]: false,
    [CAPABILITIES.USAGE_EXTENDED]: false,
    [CAPABILITIES.IMAGE_ANALYSIS]: false,
    [CAPABILITIES.MEMORY_EXTENDED]: false,
    [CAPABILITIES.PREMIUM_FEATURES]: false,
    [CAPABILITIES.PRIME_WORLD]: false,
  }),
  [ATLAS_PLANS.PREMIUM]: Object.freeze({
    [CAPABILITIES.ATLAS_BASIC]: true,
    [CAPABILITIES.ATLAS_HISTORY]: true,
    [CAPABILITIES.VOICE_LARA]: true,
    [CAPABILITIES.VOICE_MULTILINGUAL]: true,
    [CAPABILITIES.ANALYSIS_EXTENDED]: true,
    [CAPABILITIES.USAGE_EXTENDED]: true,
    [CAPABILITIES.IMAGE_ANALYSIS]: true,
    [CAPABILITIES.MEMORY_EXTENDED]: true,
    [CAPABILITIES.PREMIUM_FEATURES]: true,
    [CAPABILITIES.PRIME_WORLD]: true,
  }),
});

/**
 * @param {string} plan
 * @returns {Record<string, boolean>}
 */
export function entitlementsForPlan(plan) {
  const id = String(plan || ATLAS_PLANS.GUEST).toLowerCase();
  const matrix = PLAN_CAPABILITY_MATRIX[id] || PLAN_CAPABILITY_MATRIX[ATLAS_PLANS.GUEST];
  return { ...matrix };
}

/**
 * @param {Record<string, boolean>} entitlements
 * @param {string} capability
 */
export function hasCapability(entitlements, capability) {
  return Boolean(entitlements?.[capability]);
}
