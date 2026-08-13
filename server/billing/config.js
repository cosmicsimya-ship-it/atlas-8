/**
 * Billing / payout configuration — server-side only.
 * Never put IBAN or Iyzico secrets in client responses by default.
 */

import { getPremiumPricingConfig } from '../entitlements/pricing.js';

const SANDBOX_BASE_URL = 'https://sandbox-api.iyzipay.com';
const PRODUCTION_HOST_MARKERS = ['://api.iyzipay.com', 'api.iyzipay.com'];

/**
 * @param {string|undefined|null} value
 * @param {boolean} [fallback]
 */
export function envFlag(value, fallback = false) {
  if (value == null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

/**
 * This phase allows only Iyzico sandbox. Production host or NODE_ENV=production → blocked.
 * @param {string} [baseUrl]
 * @param {string} [nodeEnv]
 * @returns {{ allowed: boolean, reason?: string, baseUrl: string }}
 */
export function assertIyzicoSandboxOnly(baseUrl, nodeEnv = process.env.NODE_ENV) {
  const url = String(baseUrl || SANDBOX_BASE_URL)
    .trim()
    .replace(/\/$/, '')
    .toLowerCase();
  const env = String(nodeEnv || '').trim().toLowerCase();

  if (env === 'production') {
    return {
      allowed: false,
      reason: 'NODE_ENV_production_blocked_in_sandbox_phase',
      baseUrl: url,
    };
  }

  for (const marker of PRODUCTION_HOST_MARKERS) {
    if (url.includes(marker) && !url.includes('sandbox-api.iyzipay.com')) {
      return {
        allowed: false,
        reason: 'iyzico_production_url_blocked',
        baseUrl: url,
      };
    }
  }

  if (!url.includes('sandbox-api.iyzipay.com')) {
    return {
      allowed: false,
      reason: 'iyzico_non_sandbox_url_blocked',
      baseUrl: url,
    };
  }

  return { allowed: true, baseUrl: url };
}

export function getBillingConfig() {
  const provider = String(process.env.ATLAS_BILLING_PROVIDER || 'iyzico')
    .trim()
    .toLowerCase() || 'iyzico';

  // Default remains true — do not flip env from application code.
  const dryRun =
    envFlag(process.env.ATLAS_BILLING_DRY_RUN, true) ||
    envFlag(process.env.IYZICO_DRY_RUN, false);

  const iyzicoApiKey = String(process.env.IYZICO_API_KEY || '').trim();
  const iyzicoSecretKey = String(process.env.IYZICO_SECRET_KEY || '').trim();
  const iyzicoBaseUrl = String(process.env.IYZICO_BASE_URL || SANDBOX_BASE_URL)
    .trim()
    .replace(/\/$/, '');

  const webhookSecret = String(
    process.env.ATLAS_BILLING_WEBHOOK_SECRET || process.env.IYZICO_SECRET_KEY || '',
  ).trim();

  const callbackUrl = String(process.env.IYZICO_CALLBACK_URL || '').trim();
  const sandboxGate = assertIyzicoSandboxOnly(iyzicoBaseUrl);

  const frontendOrigin = String(
    process.env.BILLING_RESULT_ORIGIN ||
      process.env.FRONTEND_ORIGIN ||
      'http://localhost:5173',
  )
    .trim()
    .replace(/\/$/, '');

  const liveCheckoutEnabled =
    envFlag(process.env.ATLAS_BILLING_LIVE_CHECKOUT, false) &&
    !dryRun &&
    Boolean(iyzicoApiKey && iyzicoSecretKey) &&
    sandboxGate.allowed;

  return {
    provider,
    dryRun,
    liveCheckoutEnabled,
    sandboxOnly: true,
    sandboxGate,
    pricing: getPremiumPricingConfig(),
    frontendOrigin,
    iyzico: {
      apiKey: iyzicoApiKey,
      secretKey: iyzicoSecretKey,
      baseUrl: iyzicoBaseUrl,
      callbackUrl,
      configured: Boolean(iyzicoApiKey && iyzicoSecretKey),
    },
    webhookSecret,
    payout: {
      iban: String(process.env.PREMIUM_PAYOUT_IBAN || '').trim(),
      accountName: String(process.env.PREMIUM_PAYOUT_ACCOUNT_NAME || '').trim(),
      bankName: String(process.env.PREMIUM_PAYOUT_BANK_NAME || '').trim(),
      currency: String(process.env.PREMIUM_PAYOUT_CURRENCY || 'TRY').trim().toUpperCase() || 'TRY',
    },
  };
}

/**
 * Public-safe billing config — never includes secrets or full IBAN.
 */
export function getPublicBillingConfig() {
  const cfg = getBillingConfig();
  const pricing = cfg.pricing;
  return {
    provider: cfg.provider,
    dryRun: cfg.dryRun,
    liveCheckoutEnabled: cfg.liveCheckoutEnabled,
    checkoutAvailable: cfg.liveCheckoutEnabled,
    sandboxOnly: true,
    product: {
      productId: pricing.productId,
      productName: pricing.productName,
      monthlyPrice: pricing.monthlyPrice,
      currency: pricing.currency,
      interval: pricing.interval,
      displayPrice: pricing.displayPrice,
    },
    features: [
      'Lara Voice',
      'Türkçe sesli yanıt',
      'İngilizce sesli yanıt',
    ],
  };
}

export { SANDBOX_BASE_URL };

/**
 * Safe frontend billing result URL — never includes tokens/secrets.
 * @param {'success'|'failed'|'canceled'|'invalid'|'pending'} status
 * @param {string} [code]
 */
export function buildBillingResultRedirectUrl(status, code) {
  const cfg = getBillingConfig();
  const safeStatus = ['success', 'failed', 'canceled', 'invalid', 'pending'].includes(status)
    ? status
    : 'invalid';
  const params = new URLSearchParams({ status: safeStatus });
  if (code) {
    const safeCode = String(code)
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 64);
    if (safeCode) params.set('code', safeCode);
  }
  return `${cfg.frontendOrigin}/#/billing/result?${params.toString()}`;
}
