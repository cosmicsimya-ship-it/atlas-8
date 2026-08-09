/**
 * Iyzico Checkout Form adapter — sandbox only in this phase.
 * Keys: process.env.IYZICO_API_KEY / IYZICO_SECRET_KEY only.
 * Network calls happen only when dryRun=false and sandbox gate allows;
 * tests inject fetch mocks (no real charges in CI).
 */

import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import {
  getBillingConfig,
  envFlag,
  assertIyzicoSandboxOnly,
  SANDBOX_BASE_URL,
} from '../config.js';
import { BILLING_ERROR_CODES } from '../errors.js';
import {
  SANDBOX_TEST_IDENTITY_NUMBER,
  SANDBOX_TEST_ADDRESS,
  buildOfficialPythonCfSampleRequest,
} from './iyzico-sandbox-fixtures.js';

const INIT_PATH = '/payment/iyzipos/checkoutform/initialize/auth/ecom';
const RETRIEVE_PATH = '/payment/iyzipos/checkoutform/auth/ecom/detail';

/** Iyzico sample-compatible sandbox fallback IP (not loopback). Never use in production. */
const SANDBOX_TEST_BUYER_IP = '85.34.78.112';
/** Synthetic sandbox buyer email — valid public TLD, not a real person record. */
const SANDBOX_TEST_BUYER_EMAIL = 'atlas.sandbox.checkout@gmail.com';
/** Forbidden placeholder — never send to Iyzico. */
const FORBIDDEN_IDENTITY_PLACEHOLDER = '11111111111';

/**
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizeClientIp(raw) {
  if (raw == null) return null;
  let ip = String(raw).trim();
  if (!ip) return null;
  // Take first X-Forwarded-For hop
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);
  // Strip port from IPv4 host:port
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.split(':')[0];
  return ip || null;
}

/**
 * @param {string|null|undefined} ip
 */
export function isLoopbackIp(ip) {
  const v = String(ip || '');
  return v === '127.0.0.1' || v === '::1' || v === '0:0:0:0:0:0:0:1' || v.startsWith('127.');
}

/**
 * @param {string|null|undefined} ip
 */
export function isValidIpFormat(ip) {
  const v = String(ip || '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
    return v.split('.').every((p) => {
      const n = Number(p);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }
  // Basic IPv6
  return /^[0-9a-fA-F:]+$/.test(v) && v.includes(':') && v.length >= 3;
}

/**
 * @param {string|null|undefined} email
 */
export function isPublicFormatEmail(email) {
  const e = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  const host = e.split('@')[1]?.toLowerCase() || '';
  if (!host || host.endsWith('.local') || host === 'localhost' || host.endsWith('.test')) {
    return false;
  }
  return true;
}

/**
 * @param {string|null|undefined} rawEmail
 * @param {{ sandboxAllowed: boolean }} opts
 */
export function resolveCheckoutBuyerEmail(rawEmail, opts) {
  const email = String(rawEmail || '').trim();
  if (isPublicFormatEmail(email)) return email.slice(0, 120);
  if (opts.sandboxAllowed) return SANDBOX_TEST_BUYER_EMAIL;
  return null;
}

/**
 * @param {string|null|undefined} clientIp
 * @param {{ sandboxAllowed: boolean, nodeEnv?: string }} opts
 */
export function resolveCheckoutBuyerIp(clientIp, opts) {
  const normalized = normalizeClientIp(clientIp);
  if (normalized && isValidIpFormat(normalized) && !isLoopbackIp(normalized)) {
    return normalized;
  }
  const env = String(opts.nodeEnv || process.env.NODE_ENV || '')
    .trim()
    .toLowerCase();
  if (env === 'production' || !opts.sandboxAllowed) {
    // Production: never invent a test IP
    return null;
  }
  return SANDBOX_TEST_BUYER_IP;
}

/**
 * Identity number shape for Iyzico (11 digits). Official sample IDs are used as-is
 * in sandbox docs and may not pass national checksum — do not require checksum here.
 * @param {string|null|undefined} raw
 */
export function isValidIdentityNumberFormat(raw) {
  const id = String(raw || '').trim();
  if (!/^[1-9]\d{10}$/.test(id)) return false;
  if (id === FORBIDDEN_IDENTITY_PLACEHOLDER) return false;
  return true;
}

/**
 * Resolve buyer.identityNumber. Sandbox may fall back to official sample fixture.
 * Production / non-sandbox: never uses test identity fallback.
 * @param {string|null|undefined} raw
 * @param {{ sandboxAllowed: boolean, nodeEnv?: string }} opts
 * @returns {string|null}
 */
export function resolveCheckoutBuyerIdentityNumber(raw, opts) {
  const env = String(opts.nodeEnv || process.env.NODE_ENV || '')
    .trim()
    .toLowerCase();
  const candidate = String(raw || '').trim();
  if (candidate && isValidIdentityNumberFormat(candidate)) {
    return candidate;
  }
  if (env === 'production' || !opts.sandboxAllowed) {
    return null;
  }
  return isValidIdentityNumberFormat(SANDBOX_TEST_IDENTITY_NUMBER)
    ? SANDBOX_TEST_IDENTITY_NUMBER
    : null;
}

/**
 * Sandbox-only realistic TR address fixtures for buyer/billing.
 * Production / non-sandbox: never invents test addresses.
 * @param {{ sandboxAllowed: boolean, nodeEnv?: string }} opts
 * @returns {typeof SANDBOX_TEST_ADDRESS | null}
 */
export function resolveCheckoutSandboxAddress(opts) {
  const env = String(opts.nodeEnv || process.env.NODE_ENV || '')
    .trim()
    .toLowerCase();
  if (env === 'production' || !opts.sandboxAllowed) {
    return null;
  }
  return SANDBOX_TEST_ADDRESS;
}

/**
 * Shape checks for CF address fields (no PII logging).
 * @param {object|null|undefined} addr
 * @param {'buyer'|'billing'} kind
 */
export function isValidCheckoutAddressShape(addr, kind) {
  if (!addr || typeof addr !== 'object') return false;
  const city = String(addr.city || '').trim();
  const country = String(addr.country || '').trim();
  const zip = String(addr.zipCode || '').trim();
  if (!city || city.toLowerCase() === 'atlas') return false;
  if (!country || country.toLowerCase() === 'atlas') return false;
  if (!/^\d{5}$/.test(zip)) return false;
  if (kind === 'buyer') {
    const reg = String(addr.registrationAddress || '').trim();
    if (reg.length < 12 || reg.toLowerCase() === 'atlas') return false;
    return true;
  }
  const contact = String(addr.contactName || '').trim();
  const address = String(addr.address || '').trim();
  if (!contact || contact.toLowerCase() === 'atlas') return false;
  if (address.length < 12 || address.toLowerCase() === 'atlas') return false;
  return true;
}

/** Aligns with official iyzipay-node client version header. */
export const IYZICO_CLIENT_VERSION_HEADER = 'iyzipay-node-2.0.69';

/**
 * Signature path = pathname only (query/hash stripped). Official SDK behavior.
 * @param {string} uriPathOrUrl
 */
export function canonicalizeIyzicoSignedPath(uriPathOrUrl) {
  let raw = String(uriPathOrUrl || '').trim();
  if (!raw) return '/';
  try {
    if (/^https?:\/\//i.test(raw)) {
      raw = new URL(raw).pathname || '/';
    }
  } catch {
    // keep raw
  }
  const q = raw.indexOf('?');
  if (q >= 0) raw = raw.slice(0, q);
  const h = raw.indexOf('#');
  if (h >= 0) raw = raw.slice(0, h);
  if (!raw.startsWith('/')) raw = `/${raw}`;
  return raw || '/';
}

/**
 * Body string used inside IYZWSv2 HMAC. Empty/missing → "{}".
 * Objects are JSON.stringify'd once (same as iyzipay-node).
 * @param {string|object|null|undefined} body
 */
export function canonicalizeIyzicoSignedBody(body) {
  if (body == null) return '{}';
  if (typeof body === 'string') {
    const t = body.trim();
    return t === '' ? '{}' : body;
  }
  if (typeof body === 'object') {
    return JSON.stringify(body);
  }
  return '{}';
}

/**
 * Official iyzipay-node IYZWSv2 auth (hex HMAC + apiKey&randomKey&signature base64).
 * @param {string} apiKey
 * @param {string} secretKey
 * @param {string} uriPath
 * @param {string|object|null|undefined} body
 * @param {{ randomKey?: string, clientVersion?: string }} [options]
 * @returns {{
 *   authorization: string,
 *   randomKey: string,
 *   signedPath: string,
 *   canonicalBody: string,
 *   signature: string,
 *   headers: Record<string, string>,
 * }}
 */
export function buildIyzicoV2Auth(apiKey, secretKey, uriPath, body, options = {}) {
  const randomKey =
    options.randomKey != null && String(options.randomKey) !== ''
      ? String(options.randomKey)
      : randomBytes(8).toString('hex');
  const signedPath = canonicalizeIyzicoSignedPath(uriPath);
  const canonicalBody = canonicalizeIyzicoSignedBody(body);
  const signature = createHmac('sha256', secretKey)
    .update(`${randomKey}${signedPath}${canonicalBody}`)
    .digest('hex');
  const authorizationParams = [
    `apiKey:${apiKey}`,
    `randomKey:${randomKey}`,
    `signature:${signature}`,
  ].join('&');
  const authorization = `IYZWSv2 ${Buffer.from(authorizationParams).toString('base64')}`;
  const clientVersion = options.clientVersion || IYZICO_CLIENT_VERSION_HEADER;
  return {
    authorization,
    randomKey,
    signedPath,
    canonicalBody,
    signature,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
      'x-iyzi-rnd': randomKey,
      'x-iyzi-client-version': clientVersion,
    },
  };
}

/**
 * @param {string} apiKey
 * @param {string} secretKey
 * @param {string} uriPath
 * @param {string|object|null|undefined} body
 * @param {string} [randomKey]
 * @returns {string} Authorization header value
 */
export function buildIyzicoAuthorizationHeader(apiKey, secretKey, uriPath, body, randomKey) {
  return buildIyzicoV2Auth(apiKey, secretKey, uriPath, body, { randomKey }).authorization;
}

/**
 * @param {object} [overrides]
 * @returns {import('../errors.js').BillingProvider}
 */
export function createIyzicoBillingProvider(overrides = {}) {
  const cfg = { ...getBillingConfig(), ...overrides };
  const apiKey = overrides.apiKey ?? cfg.iyzico.apiKey;
  const secretKey = overrides.secretKey ?? cfg.iyzico.secretKey;
  const baseUrl = String(overrides.baseUrl ?? cfg.iyzico.baseUrl ?? SANDBOX_BASE_URL)
    .trim()
    .replace(/\/$/, '');
  const dryRun = overrides.dryRun ?? cfg.dryRun;
  const liveCheckoutEnabled = overrides.liveCheckoutEnabled ?? cfg.liveCheckoutEnabled;
  const webhookSecret = overrides.webhookSecret ?? cfg.webhookSecret;
  const callbackUrl = overrides.callbackUrl ?? cfg.iyzico.callbackUrl;
  const fetchFn = overrides.fetch ?? globalThis.fetch;
  const nodeEnv = overrides.nodeEnv ?? process.env.NODE_ENV;

  function sandboxGuard() {
    return assertIyzicoSandboxOnly(baseUrl, nodeEnv);
  }

  /**
   * @param {string} path pathname only preferred; query allowed on URL but stripped for signing
   * @param {object} payload
   */
  async function iyzicoPost(path, payload) {
    const gate = sandboxGuard();
    if (!gate.allowed) {
      return {
        ok: false,
        error: BILLING_ERROR_CODES.PRODUCTION_BLOCKED,
        meta: { reason: gate.reason },
      };
    }
    if (!apiKey || !secretKey) {
      return { ok: false, error: BILLING_ERROR_CODES.NOT_CONFIGURED };
    }
    if (typeof fetchFn !== 'function') {
      return {
        ok: false,
        error: BILLING_ERROR_CODES.PROVIDER_ERROR,
        meta: { reason: 'fetch_unavailable' },
      };
    }

    const auth = buildIyzicoV2Auth(apiKey, secretKey, path, payload ?? {});
    const url = `${baseUrl}${canonicalizeIyzicoSignedPath(path)}`;

    let response;
    try {
      response = await fetchFn(url, {
        method: 'POST',
        headers: auth.headers,
        body: auth.canonicalBody,
      });
    } catch (err) {
      return {
        ok: false,
        error: BILLING_ERROR_CODES.PROVIDER_ERROR,
        meta: { reason: 'network_error', message: String(err?.message || err) },
      };
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      return {
        ok: false,
        error: BILLING_ERROR_CODES.PROVIDER_ERROR,
        meta: { reason: 'invalid_json', status: response.status },
      };
    }

    return { ok: true, httpStatus: response.status, data };
  }

  function formatMoney(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return null;
    return n.toFixed(2);
  }

  return {
    id: 'iyzico',
    label: 'Iyzico',

    async healthCheck() {
      const gate = sandboxGuard();
      if (!gate.allowed) {
        return { ok: false, detail: gate.reason || 'sandbox_required' };
      }
      if (!apiKey || !secretKey) {
        return { ok: false, detail: 'IYZICO_API_KEY/SECRET missing' };
      }
      if (dryRun || !liveCheckoutEnabled) {
        return { ok: true, detail: 'credentials_present_dry_run_or_live_disabled' };
      }
      return { ok: true, detail: 'sandbox_ready' };
    },

    async createCheckout(req) {
      if (!req?.userId) {
        return {
          ok: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.INVALID_INPUT,
          meta: { reason: 'user_id_required' },
        };
      }

      const gate = sandboxGuard();
      if (!gate.allowed) {
        return {
          ok: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.PRODUCTION_BLOCKED,
          meta: { reason: gate.reason },
        };
      }

      const amount = Number(req.amount ?? cfg.pricing.monthlyPrice);
      const currency = String(req.currency || cfg.pricing.currency || 'TRY')
        .trim()
        .toUpperCase();
      const price = formatMoney(amount);
      if (!price) {
        return {
          ok: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.INVALID_INPUT,
          meta: { reason: 'price_missing' },
        };
      }

      // Dry-run: no network. Still returns a local token for session wiring/tests.
      if (dryRun || !liveCheckoutEnabled) {
        const checkoutId = `dry_${randomBytes(8).toString('hex')}`;
        return {
          ok: true,
          provider: 'iyzico',
          checkoutId,
          token: checkoutId,
          paymentPageUrl: null,
          meta: {
            dryRun: true,
            liveCheckoutEnabled: false,
            credentialsPresent: Boolean(apiKey && secretKey),
            amount: Number(price),
            currency,
            productId: cfg.pricing.productId,
            message: 'Checkout scaffold ready; dry-run active (no Iyzico network call).',
          },
        };
      }

      if (!apiKey || !secretKey) {
        return {
          ok: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.NOT_CONFIGURED,
        };
      }

      const sandboxAllowed = sandboxGuard().allowed;
      const envName = String(nodeEnv || process.env.NODE_ENV || '')
        .trim()
        .toLowerCase();

      // Sandbox-only A/B: official Python CF sample parity (never production).
      if (req.officialSampleParity) {
        if (envName === 'production' || !sandboxAllowed) {
          return {
            ok: false,
            provider: 'iyzico',
            error: BILLING_ERROR_CODES.PRODUCTION_BLOCKED,
            meta: { reason: 'sample_parity_sandbox_only' },
          };
        }
        if (!callbackUrl) {
          return {
            ok: false,
            provider: 'iyzico',
            error: BILLING_ERROR_CODES.INVALID_INPUT,
            meta: { reason: 'callback_url_required' },
          };
        }

        const payload =
          req.parityPayload && typeof req.parityPayload === 'object'
            ? req.parityPayload
            : buildOfficialPythonCfSampleRequest({ callbackUrl });

        const result = await iyzicoPost(INIT_PATH, payload);
        if (!result.ok) {
          return {
            ok: false,
            provider: 'iyzico',
            error: result.error || BILLING_ERROR_CODES.PROVIDER_ERROR,
            meta: { ...(result.meta || null), officialSampleParity: true },
          };
        }

        const data = result.data || {};
        if (String(data.status || '').toLowerCase() !== 'success' || !data.token) {
          return {
            ok: false,
            provider: 'iyzico',
            error: BILLING_ERROR_CODES.PROVIDER_ERROR,
            meta: {
              reason: 'initialize_failed',
              iyzicoStatus: data.status || null,
              errorCode: data.errorCode || null,
              errorMessage: data.errorMessage
                ? String(data.errorMessage).slice(0, 200)
                : null,
              officialSampleParity: true,
              checkoutFormContent: data.checkoutFormContent ? '[present]' : null,
            },
          };
        }

        return {
          ok: true,
          provider: 'iyzico',
          checkoutId: String(data.token),
          token: String(data.token),
          paymentPageUrl: data.paymentPageUrl ? String(data.paymentPageUrl) : null,
          meta: {
            dryRun: false,
            amount: Number(payload.paidPrice ?? payload.price),
            currency: String(payload.currency || 'TRY').toUpperCase(),
            conversationId: payload.conversationId || null,
            officialSampleParity: true,
            checkoutFormContent: data.checkoutFormContent ? '[omitted]' : null,
          },
        };
      }

      const conversationId = String(req.conversationId || req.userId).slice(0, 120);
      const buyerName = String(req.displayName || 'Atlas').slice(0, 64);
      const email = resolveCheckoutBuyerEmail(req.email, { sandboxAllowed });
      const buyerIp = resolveCheckoutBuyerIp(req.clientIp, {
        sandboxAllowed,
        nodeEnv,
      });
      const identityNumber = resolveCheckoutBuyerIdentityNumber(req.identityNumber, {
        sandboxAllowed,
        nodeEnv,
      });

      if (!email) {
        return {
          ok: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.INVALID_INPUT,
          meta: { reason: 'buyer_email_invalid' },
        };
      }
      if (!buyerIp) {
        return {
          ok: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.INVALID_INPUT,
          meta: { reason: 'buyer_ip_invalid' },
        };
      }
      if (!identityNumber) {
        return {
          ok: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.INVALID_INPUT,
          meta: { reason: 'buyer_identity_invalid' },
        };
      }

      // Official CF schema: shippingAddress required only when any item is PHYSICAL.
      // All basket items are VIRTUAL — keep existing shipping object unchanged this round.
      const sandboxAddress = resolveCheckoutSandboxAddress({
        sandboxAllowed,
        nodeEnv,
      });
      if (!sandboxAddress) {
        return {
          ok: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.INVALID_INPUT,
          meta: { reason: 'buyer_address_invalid' },
        };
      }

      const payload = {
        locale: 'tr',
        conversationId,
        price,
        paidPrice: price,
        currency,
        basketId: String(req.userId).slice(0, 120),
        paymentGroup: 'PRODUCT',
        callbackUrl: callbackUrl || undefined,
        enabledInstallments: [1],
        buyer: {
          id: String(req.userId).slice(0, 64),
          name: buyerName,
          surname: 'User',
          gsmNumber: '+905350000000',
          email,
          identityNumber,
          registrationAddress: sandboxAddress.registrationAddress,
          ip: buyerIp,
          city: sandboxAddress.city,
          country: sandboxAddress.country,
          zipCode: sandboxAddress.zipCode,
        },
        shippingAddress: {
          contactName: buyerName,
          city: 'Istanbul',
          country: 'Turkey',
          address: 'Atlas',
        },
        billingAddress: {
          contactName: sandboxAddress.contactName,
          city: sandboxAddress.city,
          country: sandboxAddress.country,
          address: sandboxAddress.address,
          zipCode: sandboxAddress.zipCode,
        },
        basketItems: [
          {
            id: String(cfg.pricing.productId || 'atlas_premium_monthly').slice(0, 64),
            name: String(cfg.pricing.productName || 'Atlas Premium').slice(0, 64),
            category1: 'Subscription',
            itemType: 'VIRTUAL',
            price,
          },
        ],
      };

      const result = await iyzicoPost(INIT_PATH, payload);
      if (!result.ok) {
        return {
          ok: false,
          provider: 'iyzico',
          error: result.error || BILLING_ERROR_CODES.PROVIDER_ERROR,
          meta: result.meta || null,
        };
      }

      const data = result.data || {};
      if (String(data.status || '').toLowerCase() !== 'success' || !data.token) {
        return {
          ok: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.PROVIDER_ERROR,
          meta: {
            reason: 'initialize_failed',
            iyzicoStatus: data.status || null,
            errorCode: data.errorCode || null,
            errorMessage: data.errorMessage
              ? String(data.errorMessage).slice(0, 200)
              : null,
            // never echo secrets / tokens / full payload
          },
        };
      }

      return {
        ok: true,
        provider: 'iyzico',
        checkoutId: String(data.token),
        token: String(data.token),
        paymentPageUrl: data.paymentPageUrl ? String(data.paymentPageUrl) : null,
        meta: {
          dryRun: false,
          amount: Number(price),
          currency,
          conversationId,
          checkoutFormContent: data.checkoutFormContent ? '[omitted]' : null,
        },
      };
    },

    async verifyPayment(req) {
      // Client success flags are never trusted (even if present).
      const raw = { ...(req?.raw || {}) };
      delete raw.paymentSuccess;
      delete raw.paid;
      delete raw.success;

      const gate = sandboxGuard();
      if (!gate.allowed) {
        return {
          ok: false,
          paid: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.PRODUCTION_BLOCKED,
          meta: { reason: gate.reason },
        };
      }

      // Test fixture path only when explicitly allowed
      const fixturesAllowed =
        envFlag(process.env.ATLAS_BILLING_ALLOW_FIXTURES, false) ||
        process.env.NODE_ENV === 'test' ||
        Boolean(overrides.allowFixtures);
      if (fixturesAllowed && raw.providerVerified === true && raw.fixture === true) {
        return {
          ok: true,
          paid: true,
          provider: 'iyzico',
          userId: raw.userId || null,
          providerPaymentId: String(raw.paymentId || req.token || ''),
          providerSubscriptionId: String(raw.subscriptionId || `sub_${raw.userId || 'x'}`),
          status: 'active',
          amount: raw.amount != null ? Number(raw.amount) : null,
          currency: raw.currency ? String(raw.currency).toUpperCase() : null,
          meta: { fixture: true },
        };
      }

      const token = String(req?.token || raw.token || '').trim();
      if (!token) {
        return {
          ok: false,
          paid: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.INVALID_INPUT,
          meta: { reason: 'token_required' },
        };
      }

      if (dryRun || !liveCheckoutEnabled) {
        return {
          ok: false,
          paid: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.DRY_RUN,
          meta: { reason: 'verify_requires_sandbox_retrieve' },
        };
      }

      const result = await iyzicoPost(RETRIEVE_PATH, {
        locale: 'tr',
        token,
      });

      if (!result.ok) {
        return {
          ok: false,
          paid: false,
          provider: 'iyzico',
          error: result.error || BILLING_ERROR_CODES.PROVIDER_ERROR,
          meta: result.meta || null,
        };
      }

      const data = result.data || {};
      const paymentStatus = String(data.paymentStatus || data.status || '').toUpperCase();
      const paid =
        paymentStatus === 'SUCCESS' ||
        (String(data.status || '').toLowerCase() === 'success' &&
          String(data.paymentStatus || '').toUpperCase() === 'SUCCESS');

      if (!paid) {
        return {
          ok: false,
          paid: false,
          provider: 'iyzico',
          userId: data.basketId || data.conversationId || null,
          providerPaymentId: data.paymentId != null ? String(data.paymentId) : null,
          status: 'failed',
          amount: data.paidPrice != null ? Number(data.paidPrice) : null,
          currency: data.currency ? String(data.currency).toUpperCase() : null,
          error: BILLING_ERROR_CODES.VERIFICATION_FAILED,
          meta: {
            reason: 'retrieve_not_success',
            paymentStatus,
            iyzicoStatus: data.status || null,
          },
        };
      }

      return {
        ok: true,
        paid: true,
        provider: 'iyzico',
        userId: data.basketId || data.conversationId || null,
        providerPaymentId: data.paymentId != null ? String(data.paymentId) : String(token),
        providerSubscriptionId: data.paymentId != null ? `sub_${data.paymentId}` : null,
        status: 'active',
        amount: data.paidPrice != null ? Number(data.paidPrice) : Number(data.price),
        currency: data.currency ? String(data.currency).toUpperCase() : null,
        meta: {
          token,
          conversationId: data.conversationId || null,
        },
      };
    },

    async handleWebhook(raw, headers = {}) {
      const signature = String(
        headers['x-atlas-billing-signature'] ||
          headers['x-iyzico-signature'] ||
          headers['x-iyzisignature'] ||
          '',
      ).trim();

      if (!webhookSecret) {
        return {
          ok: false,
          paid: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.NOT_CONFIGURED,
          meta: { reason: 'webhook_secret_missing' },
        };
      }

      const body = typeof raw === 'string' ? raw : JSON.stringify(raw || {});
      const expected = createHmac('sha256', webhookSecret).update(body).digest('hex');
      const valid = equalHexTimingSafe(signature, expected);
      if (!valid) {
        return {
          ok: false,
          paid: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.WEBHOOK_INVALID,
          meta: { reason: 'bad_signature' },
        };
      }

      const event = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
      const status = String(event.status || event.paymentStatus || '').toUpperCase();
      const paid = status === 'SUCCESS' || status === 'PAID' || status === 'ACTIVE';
      const eventId = String(event.eventId || event.paymentId || event.token || '').trim();
      if (!eventId) {
        return {
          ok: false,
          paid: false,
          provider: 'iyzico',
          error: BILLING_ERROR_CODES.INVALID_INPUT,
          meta: { reason: 'event_id_missing' },
        };
      }

      return {
        ok: true,
        paid,
        provider: 'iyzico',
        userId: event.userId || event.basketId || null,
        providerPaymentId: String(event.paymentId || eventId),
        providerSubscriptionId: event.subscriptionId
          ? String(event.subscriptionId)
          : null,
        status: paid ? 'active' : 'failed',
        meta: {
          eventId,
          kind: event.eventType || 'payment',
        },
      };
    },

    async getSubscription() {
      return null;
    },

    async cancelSubscription() {
      if (dryRun || !liveCheckoutEnabled) {
        return { ok: true, meta: { dryRun: true, localOnly: true } };
      }
      return { ok: false, error: BILLING_ERROR_CODES.LIVE_DISABLED };
    },
  };
}

/**
 * @param {string} a
 * @param {string} b
 */
function equalHexTimingSafe(a, b) {
  try {
    const ba = Buffer.from(String(a), 'utf8');
    const bb = Buffer.from(String(b), 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function signBillingWebhookBody(body, secret) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return createHmac('sha256', secret).update(payload).digest('hex');
}
