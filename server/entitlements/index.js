/**
 * Atlas entitlements / Premium membership public API.
 */

export {
  ATLAS_PLANS,
  SUBSCRIPTION_STATUSES,
  PREMIUM_ACTIVE_STATUSES,
  CAPABILITIES,
  PLAN_CAPABILITY_MATRIX,
  entitlementsForPlan,
  hasCapability,
} from './capabilities.js';

export { getPremiumPricingConfig } from './pricing.js';

export {
  configureSubscriptionStore,
  getSubscriptionStorePath,
  getSubscription,
  upsertSubscription,
  deleteSubscription,
  subscriptionGrantsPremium,
  toPublicSubscription,
  resetSubscriptionStoreForTests,
} from './subscription-store.js';

export {
  resolveEntitlements,
  buildEntitlementsResponse,
  authHasCapability,
  isGuestIdentity,
} from './resolve.js';

export {
  requireCapability,
  requireVoiceLara,
  requireImageAnalysis,
  requirePrimeWorld,
  ENTITLEMENT_ERROR_CODES,
} from './middleware.js';

export { createEntitlementsRouter } from './routes.js';

export {
  createBillingProvider,
  createNullBillingProvider,
  BILLING_PROVIDER_IDS,
} from './billing-providers.js';

export { chatUsageGate } from './usage-guard.js';
export { validateImageAttachment, ALLOWED_IMAGE_MIME_TYPES, getMaxImageBytes } from './image-guard.js';

export const ENTITLEMENTS_VERSION = 'atlas-entitlements-v1';
