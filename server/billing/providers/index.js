/**
 * Billing provider factory.
 */

import { createIyzicoBillingProvider } from './iyzico.js';
import { BILLING_ERROR_CODES } from '../errors.js';
import { getBillingConfig } from '../config.js';

function createNullProvider() {
  return {
    id: 'null',
    label: 'No payment provider',
    async healthCheck() {
      return { ok: true, detail: 'billing_not_connected' };
    },
    async createCheckout() {
      return { ok: false, provider: 'null', error: BILLING_ERROR_CODES.NOT_CONFIGURED };
    },
    async verifyPayment() {
      return {
        ok: false,
        paid: false,
        provider: 'null',
        error: BILLING_ERROR_CODES.NOT_CONFIGURED,
      };
    },
    async handleWebhook() {
      return {
        ok: false,
        paid: false,
        provider: 'null',
        error: BILLING_ERROR_CODES.NOT_CONFIGURED,
      };
    },
    async cancelSubscription() {
      return { ok: false, error: BILLING_ERROR_CODES.NOT_CONFIGURED };
    },
  };
}

/** Future slots — architecture only */
function createFutureStub(id, label) {
  return {
    id,
    label,
    async healthCheck() {
      return { ok: false, detail: `${id}_adapter_pending` };
    },
    async createCheckout() {
      return { ok: false, provider: id, error: BILLING_ERROR_CODES.NOT_CONFIGURED };
    },
    async verifyPayment() {
      return { ok: false, paid: false, provider: id, error: BILLING_ERROR_CODES.NOT_CONFIGURED };
    },
    async handleWebhook() {
      return { ok: false, paid: false, provider: id, error: BILLING_ERROR_CODES.NOT_CONFIGURED };
    },
    async cancelSubscription() {
      return { ok: false, error: BILLING_ERROR_CODES.NOT_CONFIGURED };
    },
  };
}

export const BILLING_PROVIDER_IDS = Object.freeze([
  'null',
  'iyzico',
  'apple_app_store',
  'google_play',
  'stripe',
]);

/**
 * @param {string} [id]
 * @param {object} [overrides]
 */
export function createBillingProvider(id, overrides = {}) {
  const cfg = getBillingConfig();
  const key = String(id || cfg.provider || 'iyzico')
    .trim()
    .toLowerCase();

  if (key === 'null') return createNullProvider();
  if (key === 'iyzico') return createIyzicoBillingProvider(overrides);
  if (key === 'apple_app_store') {
    return createFutureStub('apple_app_store', 'Apple App Store (future)');
  }
  if (key === 'google_play') {
    return createFutureStub('google_play', 'Google Play Billing (future)');
  }
  if (key === 'stripe') {
    return createFutureStub('stripe', 'Stripe (future)');
  }
  return createFutureStub(key, `Unknown (${key})`);
}

export { createIyzicoBillingProvider, createNullProvider };
