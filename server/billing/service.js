/**
 * Billing service — bridges verified provider events → subscription store → entitlements.
 * Providers must never write plan flags directly outside this path.
 */

import { ATLAS_PLANS } from '../entitlements/capabilities.js';
import {
  getSubscription,
  upsertSubscription,
  toPublicSubscription,
} from '../entitlements/subscription-store.js';
import { buildEntitlementsResponse } from '../entitlements/resolve.js';
import { getBillingConfig, getPublicBillingConfig, buildBillingResultRedirectUrl } from './config.js';
import { BILLING_ERROR_CODES } from './errors.js';
import { createBillingProvider } from './providers/index.js';
import { getBillingEvent, recordBillingEvent } from './webhook-store.js';
import {
  createCheckoutSession,
  getCheckoutSession,
  updateCheckoutSession,
} from './checkout-session-store.js';

/** @type {import('./errors.js').BillingProvider|null} */
let cachedProvider = null;

/**
 * @param {import('./errors.js').BillingProvider} [provider]
 */
export function setBillingProviderForTests(provider) {
  cachedProvider = provider || null;
}

export function getActiveBillingProvider() {
  if (cachedProvider) return cachedProvider;
  return createBillingProvider(getBillingConfig().provider);
}

function amountsEqual(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) < 0.005;
}

/**
 * Fail-closed amount parse — null/undefined/''/NaN/non-finite → null.
 * @param {unknown} value
 * @returns {number|null}
 */
export function parseRequiredAmount(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Fail-closed currency parse — missing/empty → null.
 * @param {unknown} value
 * @returns {string|null}
 */
export function parseRequiredCurrency(value) {
  const c = String(value ?? '')
    .trim()
    .toUpperCase();
  return c || null;
}

/**
 * Three-way amount + currency gate before entitlement grant.
 * provider == session == canonical; any missing/mismatch → reject.
 * @param {{
 *   providerAmount: unknown,
 *   providerCurrency: unknown,
 *   sessionAmount: unknown,
 *   sessionCurrency: unknown,
 *   canonicalAmount: unknown,
 *   canonicalCurrency?: unknown,
 * }} input
 * @returns {{ ok: true } | { ok: false, error: string, message: string }}
 */
export function assertCheckoutPriceInvariant(input) {
  const canonicalAmount = parseRequiredAmount(input.canonicalAmount);
  const canonicalCurrency = parseRequiredCurrency(input.canonicalCurrency ?? 'TRY');
  const sessionAmount = parseRequiredAmount(input.sessionAmount);
  const sessionCurrency = parseRequiredCurrency(input.sessionCurrency);
  const providerAmount = parseRequiredAmount(input.providerAmount);
  const providerCurrency = parseRequiredCurrency(input.providerCurrency);

  if (canonicalAmount == null || !canonicalCurrency) {
    return {
      ok: false,
      error: BILLING_ERROR_CODES.NOT_CONFIGURED,
      message: 'Premium fiyat yapılandırılmamış.',
    };
  }

  if (sessionAmount == null || !amountsEqual(sessionAmount, canonicalAmount)) {
    return {
      ok: false,
      error: BILLING_ERROR_CODES.AMOUNT_MISMATCH,
      message: 'Checkout oturumu tutarı kanonik fiyat ile eşleşmiyor.',
    };
  }

  if (!sessionCurrency || sessionCurrency !== canonicalCurrency) {
    return {
      ok: false,
      error: BILLING_ERROR_CODES.CURRENCY_MISMATCH,
      message: 'Checkout oturumu para birimi kanonik değer ile eşleşmiyor.',
    };
  }

  if (providerAmount == null) {
    return {
      ok: false,
      error: BILLING_ERROR_CODES.AMOUNT_MISMATCH,
      message: 'Sağlayıcı ödeme tutarı eksik.',
    };
  }

  if (
    !amountsEqual(providerAmount, sessionAmount) ||
    !amountsEqual(providerAmount, canonicalAmount)
  ) {
    return {
      ok: false,
      error: BILLING_ERROR_CODES.AMOUNT_MISMATCH,
      message: 'Ödeme tutarı eşleşmiyor.',
    };
  }

  if (!providerCurrency) {
    return {
      ok: false,
      error: BILLING_ERROR_CODES.CURRENCY_MISMATCH,
      message: 'Sağlayıcı para birimi eksik.',
    };
  }

  if (providerCurrency !== sessionCurrency || providerCurrency !== canonicalCurrency) {
    return {
      ok: false,
      error: BILLING_ERROR_CODES.CURRENCY_MISMATCH,
      message: 'Ödeme para birimi eşleşmiyor.',
    };
  }

  return { ok: true };
}

/**
 * Apply a verified payment / subscription event to canonical subscription store.
 * @param {{
 *   userId: string,
 *   provider: string,
 *   status: string,
 *   providerCustomerId?: string|null,
 *   providerSubscriptionId?: string|null,
 *   providerPaymentId?: string|null,
 *   currentPeriodEnd?: string|null,
 *   cancelAtPeriodEnd?: boolean,
 *   eventId?: string|null,
 *   kind?: string,
 * }} input
 */
export function applyVerifiedBillingEvent(input) {
  const userId = String(input.userId || '').trim();
  if (!userId) {
    const err = new Error('user_id_required');
    err.code = 'user_id_required';
    throw err;
  }

  const status = String(input.status || 'inactive').toLowerCase();
  const grantsPremium = status === 'active' || status === 'trialing';

  if (input.eventId) {
    const existing = getBillingEvent(input.provider || 'unknown', input.eventId);
    if (existing) {
      const existingUser = String(existing.userId || '').trim();
      if (existingUser && existingUser !== userId) {
        const err = new Error('event_user_mismatch');
        err.code = BILLING_ERROR_CODES.UNAUTHORIZED;
        throw err;
      }
      const alreadyGranted =
        existing.status === 'active' || existing.status === 'trialing';
      if (alreadyGranted) {
        return {
          duplicate: true,
          subscription: getSubscription(userId),
          entitlements: buildEntitlementsResponse({
            authenticated: true,
            userId,
            isAnonymous: false,
          }),
        };
      }
      // Previous failed/pending record for the same event may upgrade to a grant.
    }
    recordBillingEvent({
      provider: input.provider || 'unknown',
      eventId: input.eventId,
      userId,
      kind: input.kind || 'payment',
      status,
      meta: {
        providerPaymentId: input.providerPaymentId || null,
        providerSubscriptionId: input.providerSubscriptionId || null,
      },
    });
  }

  const now = new Date();
  const periodEnd =
    input.currentPeriodEnd ||
    (grantsPremium
      ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null);

  const subscription = upsertSubscription({
    userId,
    plan: grantsPremium ? ATLAS_PLANS.PREMIUM : ATLAS_PLANS.FREE,
    status,
    provider: input.provider || null,
    providerCustomerId: input.providerCustomerId || null,
    providerSubscriptionId: input.providerSubscriptionId || null,
    currentPeriodStart: grantsPremium ? now.toISOString() : null,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
  });

  return {
    duplicate: false,
    subscription,
    entitlements: buildEntitlementsResponse({
      authenticated: true,
      userId,
      isAnonymous: false,
    }),
  };
}

/**
 * @param {{ userId: string, email?: string|null, displayName?: string|null, clientIp?: string|null }} account
 */
export async function startCheckout(account) {
  const userId = String(account?.userId || '').trim();
  if (!userId) {
    return {
      ok: false,
      error: BILLING_ERROR_CODES.UNAUTHORIZED,
      message: 'Giriş gerekli.',
    };
  }

  const cfg = getBillingConfig();
  if (!cfg.sandboxGate.allowed) {
    return {
      ok: false,
      error: BILLING_ERROR_CODES.PRODUCTION_BLOCKED,
      message: 'Bu fazda yalnız Iyzico sandbox kullanılabilir.',
      dryRun: cfg.dryRun,
      liveCheckoutEnabled: false,
      product: getPublicBillingConfig().product,
      features: getPublicBillingConfig().features,
    };
  }

  const amount = cfg.pricing.monthlyPrice;
  const currency = cfg.pricing.currency || 'TRY';
  if (amount == null || !Number.isFinite(Number(amount))) {
    return {
      ok: false,
      error: BILLING_ERROR_CODES.NOT_CONFIGURED,
      message: 'Premium fiyat yapılandırılmamış.',
    };
  }

  const provider = getActiveBillingProvider();
  const result = await provider.createCheckout({
    userId,
    email: account.email || undefined,
    displayName: account.displayName || undefined,
    clientIp: account.clientIp || undefined,
    amount: Number(amount),
    currency,
    officialSampleParity: Boolean(account.officialSampleParity),
    parityPayload: account.parityPayload || undefined,
  });

  const publicCfg = getPublicBillingConfig();

  if (result.ok && result.token) {
    // Session always stores server-canonical price — never provider/client overrides.
    createCheckoutSession({
      token: result.token,
      userId,
      amount: Number(amount),
      currency: String(currency).toUpperCase(),
      conversationId: result.meta?.conversationId || userId,
      status: 'pending',
    });
  }

  return {
    ok: Boolean(result.ok),
    provider: result.provider,
    checkoutId: result.checkoutId || null,
    paymentPageUrl: result.paymentPageUrl || null,
    token: result.token || null,
    dryRun: Boolean(result.meta?.dryRun ?? publicCfg.dryRun),
    liveCheckoutEnabled: publicCfg.liveCheckoutEnabled,
    product: publicCfg.product,
    features: publicCfg.features,
    error: result.error || null,
    errorMeta: result.meta
      ? {
          reason: result.meta.reason || null,
          errorCode: result.meta.errorCode || null,
          errorMessage: result.meta.errorMessage || null,
          iyzicoStatus: result.meta.iyzicoStatus || null,
        }
      : null,
    message: result.ok
      ? result.meta?.message || null
      : result.error === BILLING_ERROR_CODES.PRODUCTION_BLOCKED
        ? 'Production Iyzico bu fazda engellendi.'
        : result.error === BILLING_ERROR_CODES.LIVE_DISABLED
          ? 'Canlı ödeme bu ortamda kapalı.'
          : result.error === BILLING_ERROR_CODES.NOT_CONFIGURED
            ? 'Ödeme sağlayıcısı yapılandırılmamış.'
            : 'Checkout başlatılamadı.',
    meta: {
      dryRun: Boolean(result.meta?.dryRun),
    },
  };
}

/**
 * Server-side verify — ignores client paymentSuccess/paid/amount/currency/tier.
 * Requires pending checkout session + provider retrieve SUCCESS +
 * fail-closed three-way amount/currency (provider == session == canonical) + user match.
 * @param {{ userId: string, body: object }} input
 */
export async function verifyClientPaymentClaim(input) {
  const userId = String(input.userId || '').trim();
  const bodyIn = input.body && typeof input.body === 'object' ? input.body : {};

  // Completely ignore client-claimed success / price / entitlement fields
  const body = { ...bodyIn };
  delete body.paymentSuccess;
  delete body.paid;
  delete body.success;
  delete body.amount;
  delete body.price;
  delete body.currency;
  delete body.tier;
  delete body.plan;
  delete body.premium;
  delete body.entitlement;
  delete body.entitlements;
  delete body.subscription;

  const token = String(body.token || '').trim();

  // Bare client success without token → reject
  if (!token && (bodyIn.paymentSuccess === true || bodyIn.paid === true)) {
    return {
      ok: false,
      paid: false,
      granted: false,
      error: BILLING_ERROR_CODES.VERIFICATION_FAILED,
      message: 'Ödeme doğrulanamadı. İstemci success bayrağı kabul edilmez.',
    };
  }

  if (!token) {
    return {
      ok: false,
      paid: false,
      granted: false,
      error: BILLING_ERROR_CODES.INVALID_INPUT,
      message: 'Checkout token gerekli.',
    };
  }

  const session = getCheckoutSession(token);
  if (!session) {
    return {
      ok: false,
      paid: false,
      granted: false,
      error: BILLING_ERROR_CODES.SESSION_MISMATCH,
      message: 'Checkout oturumu bulunamadı.',
    };
  }

  if (session.userId !== userId) {
    return {
      ok: false,
      paid: false,
      granted: false,
      error: BILLING_ERROR_CODES.SESSION_MISMATCH,
      message: 'Checkout oturumu kullanıcı ile eşleşmiyor.',
    };
  }

  const provider = getActiveBillingProvider();
  const verified = await provider.verifyPayment({
    token,
    paymentId: body.paymentId,
    raw: {
      ...body,
      userId,
      // Client amount/currency intentionally omitted — provider retrieve is authoritative.
    },
  });

  if (verified.pending || verified.status === 'pending') {
    return {
      ok: false,
      paid: false,
      granted: false,
      pending: true,
      error: verified.error || BILLING_ERROR_CODES.VERIFICATION_FAILED,
      message: 'Ödeme işleniyor.',
    };
  }

  if (!verified.ok || !verified.paid) {
    updateCheckoutSession(token, { status: 'failed' });
    return {
      ok: false,
      paid: false,
      granted: false,
      pending: false,
      error: verified.error || BILLING_ERROR_CODES.VERIFICATION_FAILED,
      message: 'Ödeme doğrulanamadı.',
    };
  }

  const verifiedUser = String(verified.userId || userId).trim();
  if (verifiedUser && verifiedUser !== userId && verifiedUser !== session.userId) {
    return {
      ok: false,
      paid: false,
      granted: false,
      error: BILLING_ERROR_CODES.UNAUTHORIZED,
      message: 'Ödeme kullanıcı eşleşmesi başarısız.',
    };
  }

  const cfg = getBillingConfig();
  const priceGate = assertCheckoutPriceInvariant({
    providerAmount: verified.amount,
    providerCurrency: verified.currency,
    sessionAmount: session.amount,
    sessionCurrency: session.currency,
    canonicalAmount: cfg.pricing.monthlyPrice,
    canonicalCurrency: cfg.pricing.currency || 'TRY',
  });

  if (!priceGate.ok) {
    updateCheckoutSession(token, { status: 'failed' });
    return {
      ok: false,
      paid: false,
      granted: false,
      error: priceGate.error,
      message: priceGate.message,
    };
  }

  const paymentId = String(verified.providerPaymentId || token).trim();
  const applied = applyVerifiedBillingEvent({
    userId,
    provider: verified.provider,
    status: verified.status || 'active',
    providerSubscriptionId: verified.providerSubscriptionId,
    providerPaymentId: paymentId,
    eventId: paymentId,
    kind: 'verify',
  });

  updateCheckoutSession(token, {
    status: 'completed',
    paymentId,
  });

  return {
    ok: true,
    paid: true,
    granted: true,
    duplicate: applied.duplicate,
    subscription: toPublicSubscription(applied.subscription),
    entitlements: applied.entitlements,
  };
}

/**
 * Iyzico Checkout Form return URL handler.
 * Does NOT grant Premium by itself — only triggers verifyClientPaymentClaim.
 * Redirect URL never contains token / secrets / provider payload.
 *
 * @param {{
 *   token?: string|null,
 *   authUserId?: string|null,
 *   cancelHint?: boolean,
 * }} input
 */
export async function handleIyzicoCheckoutCallback(input = {}) {
  const cfg = getBillingConfig();
  if (!cfg.sandboxGate.allowed) {
    return {
      ok: false,
      granted: false,
      status: 'failed',
      error: BILLING_ERROR_CODES.PRODUCTION_BLOCKED,
      redirectUrl: buildBillingResultRedirectUrl('failed', 'production_blocked'),
    };
  }

  const token = String(input.token || '').trim();
  if (!token) {
    return {
      ok: false,
      granted: false,
      status: 'invalid',
      error: BILLING_ERROR_CODES.INVALID_INPUT,
      redirectUrl: buildBillingResultRedirectUrl('invalid', 'missing_token'),
    };
  }

  const session = getCheckoutSession(token);
  if (!session) {
    return {
      ok: false,
      granted: false,
      status: 'invalid',
      error: BILLING_ERROR_CODES.SESSION_MISMATCH,
      redirectUrl: buildBillingResultRedirectUrl('invalid', 'unknown_token'),
    };
  }

  const authUserId = input.authUserId ? String(input.authUserId).trim() : '';
  if (authUserId && authUserId !== session.userId) {
    return {
      ok: false,
      granted: false,
      status: 'invalid',
      error: BILLING_ERROR_CODES.SESSION_MISMATCH,
      redirectUrl: buildBillingResultRedirectUrl('invalid', 'wrong_user'),
    };
  }

  // Callback arrival / cancel hint never grants by itself — retrieve SUCCESS only.
  // Forged cancel must not skip a successful payment retrieve.
  const verified = await verifyClientPaymentClaim({
    userId: session.userId,
    body: { token },
  });

  if (verified.ok && (verified.granted || verified.duplicate)) {
    return {
      ok: true,
      granted: Boolean(verified.granted || verified.duplicate),
      duplicate: Boolean(verified.duplicate),
      status: 'success',
      error: null,
      redirectUrl: buildBillingResultRedirectUrl(
        'success',
        verified.duplicate ? 'duplicate' : 'verified',
      ),
    };
  }

  if (verified.pending) {
    return {
      ok: false,
      granted: false,
      status: 'pending',
      error: verified.error || BILLING_ERROR_CODES.VERIFICATION_FAILED,
      redirectUrl: buildBillingResultRedirectUrl('pending', 'payment_pending'),
    };
  }

  if (input.cancelHint) {
    if (session.status !== 'completed') {
      updateCheckoutSession(token, { status: 'canceled' });
    }
    return {
      ok: false,
      granted: false,
      status: 'canceled',
      error: BILLING_ERROR_CODES.VERIFICATION_FAILED,
      redirectUrl: buildBillingResultRedirectUrl('canceled', 'payment_canceled'),
    };
  }

  const err = verified.error || BILLING_ERROR_CODES.VERIFICATION_FAILED;
  let status = 'failed';
  let code = 'verification_failed';
  if (err === BILLING_ERROR_CODES.AMOUNT_MISMATCH) code = 'amount_mismatch';
  else if (err === BILLING_ERROR_CODES.CURRENCY_MISMATCH) code = 'currency_mismatch';
  else if (err === BILLING_ERROR_CODES.SESSION_MISMATCH) {
    status = 'invalid';
    code = 'session_mismatch';
  } else if (err === BILLING_ERROR_CODES.PRODUCTION_BLOCKED) code = 'production_blocked';
  else if (err === BILLING_ERROR_CODES.DRY_RUN) code = 'dry_run';

  return {
    ok: false,
    granted: false,
    status,
    error: err,
    redirectUrl: buildBillingResultRedirectUrl(status, code),
  };
}

/**
 * @param {object} rawBody
 * @param {Record<string, string>} headers
 */
export async function processProviderWebhook(providerId, rawBody, headers) {
  const provider = createBillingProvider(providerId);
  const verified = await provider.handleWebhook(rawBody, headers);

  if (!verified.ok) {
    return {
      ok: false,
      statusCode: verified.error === BILLING_ERROR_CODES.WEBHOOK_INVALID ? 401 : 400,
      error: verified.error || BILLING_ERROR_CODES.WEBHOOK_INVALID,
    };
  }

  const eventId = String(
    verified.meta?.eventId || verified.providerPaymentId || '',
  ).trim();
  if (!eventId) {
    return {
      ok: false,
      statusCode: 400,
      error: BILLING_ERROR_CODES.INVALID_INPUT,
    };
  }

  if (!verified.paid) {
    recordBillingEvent({
      provider: verified.provider,
      eventId,
      userId: verified.userId || null,
      kind: 'payment_failed',
      status: 'failed',
    });
    return {
      ok: true,
      statusCode: 200,
      paid: false,
      granted: false,
    };
  }

  const userId = String(verified.userId || '').trim();
  if (!userId) {
    return {
      ok: false,
      statusCode: 400,
      error: BILLING_ERROR_CODES.INVALID_INPUT,
      message: 'user mapping missing',
    };
  }

  const raw = rawBody && typeof rawBody === 'object' ? rawBody : {};
  const token = String(verified.meta?.token || raw.token || '').trim();
  const session = token ? getCheckoutSession(token) : null;
  if (session && session.userId !== userId) {
    return {
      ok: false,
      statusCode: 403,
      error: BILLING_ERROR_CODES.UNAUTHORIZED,
      message: 'Webhook user does not match checkout session.',
    };
  }

  const cfg = getBillingConfig();
  const priceGate = assertCheckoutPriceInvariant({
    providerAmount: verified.amount,
    providerCurrency: verified.currency,
    sessionAmount: session ? session.amount : cfg.pricing.monthlyPrice,
    sessionCurrency: session ? session.currency : cfg.pricing.currency || 'TRY',
    canonicalAmount: cfg.pricing.monthlyPrice,
    canonicalCurrency: cfg.pricing.currency || 'TRY',
  });
  if (!priceGate.ok) {
    return {
      ok: false,
      statusCode: 400,
      error: priceGate.error,
      message: priceGate.message,
      paid: true,
      granted: false,
    };
  }

  try {
    const applied = applyVerifiedBillingEvent({
      userId,
      provider: verified.provider,
      status: verified.status || 'active',
      providerSubscriptionId: verified.providerSubscriptionId,
      providerPaymentId: verified.providerPaymentId,
      eventId,
      kind: String(verified.meta?.kind || 'webhook'),
    });

    if (session) {
      updateCheckoutSession(token, {
        status: 'completed',
        paymentId: String(verified.providerPaymentId || eventId),
      });
    }

    return {
      ok: true,
      statusCode: 200,
      paid: true,
      granted: !applied.duplicate,
      duplicate: applied.duplicate,
      subscription: toPublicSubscription(applied.subscription),
    };
  } catch (err) {
    const code = err && typeof err === 'object' ? err.code : null;
    if (code === BILLING_ERROR_CODES.UNAUTHORIZED) {
      return {
        ok: false,
        statusCode: 403,
        error: BILLING_ERROR_CODES.UNAUTHORIZED,
        granted: false,
      };
    }
    throw err;
  }
}

/**
 * @param {string} userId
 */
export async function cancelUserSubscription(userId) {
  const id = String(userId || '').trim();
  if (!id) {
    return { ok: false, error: BILLING_ERROR_CODES.UNAUTHORIZED };
  }

  const provider = getActiveBillingProvider();
  const remote = await provider.cancelSubscription?.(id);
  const sub = upsertSubscription({
    userId: id,
    plan: ATLAS_PLANS.FREE,
    status: 'canceled',
    cancelAtPeriodEnd: true,
    provider: getSubscription(id)?.provider || provider.id,
  });

  return {
    ok: true,
    providerCancel: remote || null,
    subscription: toPublicSubscription(sub),
    entitlements: buildEntitlementsResponse({
      authenticated: true,
      userId: id,
      isAnonymous: false,
    }),
  };
}

export function getBillingStatusForUser(userId) {
  const id = String(userId || '').trim();
  const sub = id ? getSubscription(id) : null;
  const publicCfg = getPublicBillingConfig();
  return {
    ...publicCfg,
    subscription: toPublicSubscription(sub),
    entitlements: id
      ? buildEntitlementsResponse({
          authenticated: true,
          userId: id,
          isAnonymous: false,
        })
      : null,
  };
}

/**
 * Future extension point — manual bank transfer is NOT active.
 */
export function getManualBankTransferExtensionPoint() {
  return {
    enabled: false,
    reason: 'manual_bank_transfer_not_activated',
  };
}
