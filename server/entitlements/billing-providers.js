/**
 * Compatibility shim — real adapters live in server/billing.
 * Kept so entitlements/index.js imports continue to work.
 */

export {
  BILLING_PROVIDER_IDS,
  createBillingProvider,
  createNullProvider as createNullBillingProvider,
} from '../billing/providers/index.js';
