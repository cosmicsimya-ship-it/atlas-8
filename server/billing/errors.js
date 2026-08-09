/**
 * Billing provider contract.
 *
 * @typedef {object} CheckoutRequest
 * @property {string} userId
 * @property {string} [email]
 * @property {string} [displayName]
 * @property {string} [conversationId]
 * @property {AbortSignal} [signal]
 *
 * @typedef {object} CheckoutResult
 * @property {boolean} ok
 * @property {string} provider
 * @property {string} [checkoutId]
 * @property {string} [paymentPageUrl]
 * @property {string} [token]
 * @property {string} [error]
 * @property {Record<string, unknown>} [meta]
 *
 * @typedef {object} VerifyPaymentRequest
 * @property {string} [token]
 * @property {string} [paymentId]
 * @property {string} [conversationId]
 * @property {object} [raw]
 *
 * @typedef {object} VerifyPaymentResult
 * @property {boolean} ok
 * @property {boolean} paid
 * @property {string} provider
 * @property {string} [userId]
 * @property {string} [providerCustomerId]
 * @property {string} [providerSubscriptionId]
 * @property {string} [providerPaymentId]
 * @property {string} [status]
 * @property {string} [error]
 * @property {Record<string, unknown>} [meta]
 *
 * @typedef {object} BillingProvider
 * @property {string} id
 * @property {string} label
 * @property {(req: CheckoutRequest) => Promise<CheckoutResult>} createCheckout
 * @property {(req: VerifyPaymentRequest) => Promise<VerifyPaymentResult>} verifyPayment
 * @property {(raw: object, headers?: Record<string,string>) => Promise<VerifyPaymentResult>} handleWebhook
 * @property {() => Promise<{ ok: boolean, detail?: string }>} [healthCheck]
 * @property {(userId: string) => Promise<object|null>} [getSubscription]
 * @property {(userId: string) => Promise<{ ok: boolean, error?: string }>} [cancelSubscription]
 */

export const BILLING_ERROR_CODES = Object.freeze({
  NOT_CONFIGURED: 'billing_not_configured',
  DRY_RUN: 'billing_dry_run',
  LIVE_DISABLED: 'billing_live_disabled',
  PRODUCTION_BLOCKED: 'billing_production_blocked',
  UNAUTHORIZED: 'billing_unauthorized',
  INVALID_INPUT: 'billing_invalid_input',
  VERIFICATION_FAILED: 'billing_verification_failed',
  WEBHOOK_INVALID: 'billing_webhook_invalid',
  DUPLICATE_EVENT: 'billing_duplicate_event',
  PROVIDER_ERROR: 'billing_provider_error',
  SESSION_MISMATCH: 'billing_session_mismatch',
  AMOUNT_MISMATCH: 'billing_amount_mismatch',
  CURRENCY_MISMATCH: 'billing_currency_mismatch',
});
