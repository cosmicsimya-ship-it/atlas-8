#!/usr/bin/env node
/**
 * Billing / Iyzico sandbox tests — mock fetch only. NO real network charges.
 * Run: node scripts/test-billing.mjs
 */

import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const tmpStore = mkdtempSync(join(tmpdir(), 'atlas-billing-'));
const subPath = join(tmpStore, 'subscriptions.json');
const eventsPath = join(tmpStore, 'billing_events.json');
const sessionsPath = join(tmpStore, 'checkout_sessions.json');

process.env.NODE_ENV = 'test';
process.env.ATLAS_BILLING_PROVIDER = 'iyzico';
process.env.ATLAS_BILLING_DRY_RUN = 'true'; // default behavior — do not flip for "real" mode in this script globally
process.env.ATLAS_BILLING_LIVE_CHECKOUT = 'false';
process.env.ATLAS_BILLING_ALLOW_FIXTURES = 'true';
process.env.ATLAS_BILLING_WEBHOOK_SECRET = 'test-webhook-secret-not-real';
process.env.PREMIUM_MONTHLY_PRICE_TRY = '299';
process.env.PREMIUM_CURRENCY = 'TRY';
process.env.IYZICO_API_KEY = 'sandbox-key-not-real';
process.env.IYZICO_SECRET_KEY = 'sandbox-secret-not-real';
process.env.IYZICO_BASE_URL = 'https://sandbox-api.iyzipay.com';
process.env.PREMIUM_PAYOUT_IBAN = 'TR000000000000000000000000';
process.env.PREMIUM_PAYOUT_ACCOUNT_NAME = 'Test Account';
process.env.PREMIUM_PAYOUT_BANK_NAME = 'Test Bank';
process.env.PREMIUM_PAYOUT_CURRENCY = 'TRY';
delete process.env.ELEVENLABS_API_KEY;

import {
  configureSubscriptionStore,
  resetSubscriptionStoreForTests,
  getSubscription,
  upsertSubscription,
  ATLAS_PLANS,
  CAPABILITIES,
  resolveEntitlements,
} from '../server/entitlements/index.js';
import {
  configureBillingEventStore,
  resetBillingEventStoreForTests,
} from '../server/billing/webhook-store.js';
import {
  configureCheckoutSessionStore,
  resetCheckoutSessionStoreForTests,
  createCheckoutSession,
  getCheckoutSession,
} from '../server/billing/checkout-session-store.js';
import {
  createBillingRouter,
  createBillingWebhookRouter,
} from '../server/billing/index.js';
import {
  applyVerifiedBillingEvent,
  verifyClientPaymentClaim,
  processProviderWebhook,
  cancelUserSubscription,
  startCheckout,
  setBillingProviderForTests,
  handleIyzicoCheckoutCallback,
} from '../server/billing/service.js';
import {
  getPublicBillingConfig,
  assertIyzicoSandboxOnly,
  buildBillingResultRedirectUrl,
} from '../server/billing/config.js';
import {
  createIyzicoBillingProvider,
  signBillingWebhookBody,
} from '../server/billing/providers/iyzico.js';
import { getManualBankTransferOffer } from '../server/billing/manual-bank-transfer.js';
import { BILLING_ERROR_CODES } from '../server/billing/errors.js';

configureSubscriptionStore(subPath);
resetSubscriptionStoreForTests();
configureBillingEventStore(eventsPath);
resetBillingEventStoreForTests();
configureCheckoutSessionStore(sessionsPath);
resetCheckoutSessionStoreForTests();

let passed = 0;
let failed = 0;
/** @type {string[]} */
const networkUrls = [];

function ok(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

function mockFetchFactory(handler) {
  return async (url, init) => {
    networkUrls.push(String(url));
    return handler(url, init);
  };
}

function jsonResponse(data, status = 200) {
  return {
    status,
    async json() {
      return data;
    },
  };
}

console.log('\n=== Billing / Iyzico sandbox (mock only, no real charges) ===\n');

// Production URL guard
{
  ok(
    'production URL guard',
    assertIyzicoSandboxOnly('https://api.iyzipay.com', 'test').allowed === false,
  );
  ok(
    'NODE_ENV=production guard',
    assertIyzicoSandboxOnly('https://sandbox-api.iyzipay.com', 'production').allowed ===
      false,
  );
  ok(
    'sandbox URL allowed',
    assertIyzicoSandboxOnly('https://sandbox-api.iyzipay.com', 'test').allowed === true,
  );
}

{
  const pub = getPublicBillingConfig();
  const json = JSON.stringify(pub);
  ok('public config has product', pub.product?.productId != null);
  ok('public config price from env', pub.product?.monthlyPrice === 299);
  ok('public config no IBAN', !json.includes('TR000000000000000000000000'));
  ok('public config no iyzico secret', !json.includes('sandbox-secret-not-real'));
  ok('live checkout disabled', pub.liveCheckoutEnabled === false);
  ok('dry run true', pub.dryRun === true);
}
ok('manual bank transfer disabled', getManualBankTransferOffer().enabled === false);

// Initialize mock success / failure (inject fetch; dryRun false only on provider override)
{
  const fetchOk = mockFetchFactory(async () =>
    jsonResponse({
      status: 'success',
      token: 'tok_init_ok',
      paymentPageUrl: 'https://sandbox-api.iyzipay.com/checkout/tok_init_ok',
    }),
  );
  const providerOk = createIyzicoBillingProvider({
    dryRun: false,
    liveCheckoutEnabled: true,
    apiKey: 'sandbox-key-not-real',
    secretKey: 'sandbox-secret-not-real',
    baseUrl: 'https://sandbox-api.iyzipay.com',
    nodeEnv: 'test',
    fetch: fetchOk,
  });
  const initOk = await providerOk.createCheckout({
    userId: 'web:init-1',
    email: 'a@b.co',
    amount: 299,
    currency: 'TRY',
  });
  ok('initialize mock success', initOk.ok && initOk.token === 'tok_init_ok');
  ok(
    'initialize used sandbox host',
    networkUrls.some((u) => u.includes('sandbox-api.iyzipay.com')),
  );

  const fetchFail = mockFetchFactory(async () =>
    jsonResponse({ status: 'failure', errorCode: '5001' }),
  );
  const providerFail = createIyzicoBillingProvider({
    dryRun: false,
    liveCheckoutEnabled: true,
    apiKey: 'sandbox-key-not-real',
    secretKey: 'sandbox-secret-not-real',
    baseUrl: 'https://sandbox-api.iyzipay.com',
    nodeEnv: 'test',
    fetch: fetchFail,
  });
  const initFail = await providerFail.createCheckout({
    userId: 'web:init-2',
    amount: 299,
    currency: 'TRY',
  });
  ok('initialize failure', !initFail.ok && initFail.error === BILLING_ERROR_CODES.PROVIDER_ERROR);

  const providerProd = createIyzicoBillingProvider({
    dryRun: false,
    liveCheckoutEnabled: true,
    apiKey: 'x',
    secretKey: 'y',
    baseUrl: 'https://api.iyzipay.com',
    nodeEnv: 'test',
    fetch: mockFetchFactory(async () => jsonResponse({ status: 'success', token: 'nope' })),
  });
  const blocked = await providerProd.createCheckout({
    userId: 'web:init-3',
    amount: 299,
    currency: 'TRY',
  });
  ok(
    'production URL blocked on initialize',
    !blocked.ok && blocked.error === BILLING_ERROR_CODES.PRODUCTION_BLOCKED,
  );
}

// Retrieve SUCCESS / FAILURE via verify + session
{
  resetCheckoutSessionStoreForTests();
  resetSubscriptionStoreForTests();
  resetBillingEventStoreForTests();

  createCheckoutSession({
    token: 'tok_ok',
    userId: 'web:retrieve-ok',
    amount: 299,
    currency: 'TRY',
  });

  const fetchRetrieveOk = mockFetchFactory(async () =>
    jsonResponse({
      status: 'success',
      paymentStatus: 'SUCCESS',
      paymentId: 'pay_100',
      paidPrice: '299.00',
      price: '299.00',
      currency: 'TRY',
      basketId: 'web:retrieve-ok',
      conversationId: 'web:retrieve-ok',
    }),
  );
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: false,
      liveCheckoutEnabled: true,
      apiKey: 'sandbox-key-not-real',
      secretKey: 'sandbox-secret-not-real',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
      fetch: fetchRetrieveOk,
    }),
  );

  const retrieveOk = await verifyClientPaymentClaim({
    userId: 'web:retrieve-ok',
    body: { token: 'tok_ok', paymentSuccess: true }, // must be ignored
  });
  ok('retrieve SUCCESS grants', retrieveOk.ok && retrieveOk.granted && retrieveOk.paid);
  ok(
    'entitlement after retrieve',
    resolveEntitlements({
      authenticated: true,
      userId: 'web:retrieve-ok',
      isAnonymous: false,
    }).entitlements[CAPABILITIES.VOICE_LARA] === true,
  );
  ok('session completed', getCheckoutSession('tok_ok')?.status === 'completed');

  // FAILURE
  createCheckoutSession({
    token: 'tok_fail',
    userId: 'web:retrieve-fail',
    amount: 299,
    currency: 'TRY',
  });
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: false,
      liveCheckoutEnabled: true,
      apiKey: 'sandbox-key-not-real',
      secretKey: 'sandbox-secret-not-real',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
      fetch: mockFetchFactory(async () =>
        jsonResponse({
          status: 'success',
          paymentStatus: 'FAILURE',
          paymentId: 'pay_fail',
          paidPrice: '299.00',
          currency: 'TRY',
          basketId: 'web:retrieve-fail',
        }),
      ),
    }),
  );
  const retrieveFail = await verifyClientPaymentClaim({
    userId: 'web:retrieve-fail',
    body: { token: 'tok_fail' },
  });
  ok('retrieve FAILURE no grant', !retrieveFail.granted && !retrieveFail.paid);
  ok(
    'failure user still free',
    resolveEntitlements({
      authenticated: true,
      userId: 'web:retrieve-fail',
      isAnonymous: false,
    }).plan === ATLAS_PLANS.FREE,
  );
}

// wrong user / amount / currency
{
  createCheckoutSession({
    token: 'tok_user',
    userId: 'web:owner',
    amount: 299,
    currency: 'TRY',
  });
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: false,
      liveCheckoutEnabled: true,
      allowFixtures: true,
      apiKey: 'k',
      secretKey: 's',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
      fetch: mockFetchFactory(async () =>
        jsonResponse({
          status: 'success',
          paymentStatus: 'SUCCESS',
          paymentId: 'pay_user',
          paidPrice: '299.00',
          currency: 'TRY',
          basketId: 'web:owner',
        }),
      ),
    }),
  );
  const wrongUser = await verifyClientPaymentClaim({
    userId: 'web:attacker',
    body: { token: 'tok_user' },
  });
  ok(
    'wrong user token rejected',
    !wrongUser.granted && wrongUser.error === BILLING_ERROR_CODES.SESSION_MISMATCH,
  );

  createCheckoutSession({
    token: 'tok_amt',
    userId: 'web:amt',
    amount: 299,
    currency: 'TRY',
  });
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: false,
      liveCheckoutEnabled: true,
      apiKey: 'k',
      secretKey: 's',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
      fetch: mockFetchFactory(async () =>
        jsonResponse({
          status: 'success',
          paymentStatus: 'SUCCESS',
          paymentId: 'pay_amt',
          paidPrice: '1.00',
          currency: 'TRY',
          basketId: 'web:amt',
        }),
      ),
    }),
  );
  const wrongAmt = await verifyClientPaymentClaim({
    userId: 'web:amt',
    body: { token: 'tok_amt' },
  });
  ok(
    'wrong amount rejected',
    !wrongAmt.granted && wrongAmt.error === BILLING_ERROR_CODES.AMOUNT_MISMATCH,
  );

  createCheckoutSession({
    token: 'tok_cur',
    userId: 'web:cur',
    amount: 299,
    currency: 'TRY',
  });
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: false,
      liveCheckoutEnabled: true,
      apiKey: 'k',
      secretKey: 's',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
      fetch: mockFetchFactory(async () =>
        jsonResponse({
          status: 'success',
          paymentStatus: 'SUCCESS',
          paymentId: 'pay_cur',
          paidPrice: '299.00',
          currency: 'USD',
          basketId: 'web:cur',
        }),
      ),
    }),
  );
  const wrongCur = await verifyClientPaymentClaim({
    userId: 'web:cur',
    body: { token: 'tok_cur' },
  });
  ok(
    'wrong currency rejected',
    !wrongCur.granted && wrongCur.error === BILLING_ERROR_CODES.CURRENCY_MISMATCH,
  );
}

// duplicate paymentId
{
  createCheckoutSession({
    token: 'tok_dup_a',
    userId: 'web:dup',
    amount: 299,
    currency: 'TRY',
  });
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: false,
      liveCheckoutEnabled: true,
      apiKey: 'k',
      secretKey: 's',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
      fetch: mockFetchFactory(async () =>
        jsonResponse({
          status: 'success',
          paymentStatus: 'SUCCESS',
          paymentId: 'pay_dup_same',
          paidPrice: '299.00',
          currency: 'TRY',
          basketId: 'web:dup',
        }),
      ),
    }),
  );
  const first = await verifyClientPaymentClaim({
    userId: 'web:dup',
    body: { token: 'tok_dup_a' },
  });
  ok('first payment grants', first.ok && first.granted);

  createCheckoutSession({
    token: 'tok_dup_b',
    userId: 'web:dup',
    amount: 299,
    currency: 'TRY',
  });
  const second = await verifyClientPaymentClaim({
    userId: 'web:dup',
    body: { token: 'tok_dup_b' },
  });
  ok('duplicate paymentId idempotent', second.ok && second.duplicate === true);
}

// client fake paymentSuccess rejected
{
  setBillingProviderForTests(null);
  const fake = await verifyClientPaymentClaim({
    userId: 'web:fake',
    body: { paymentSuccess: true, paid: true },
  });
  ok('client fake paymentSuccess rejected', !fake.granted && fake.ok === false);
}

// HTTP guest checkout 401 + dry-run checkout creates session without premium
{
  setBillingProviderForTests(null); // default dry-run provider from env
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = req.headers['x-test-auth']
      ? JSON.parse(String(req.headers['x-test-auth']))
      : { authenticated: false, isAnonymous: true };
    next();
  });
  app.use(
    '/api/billing',
    createBillingRouter({
      requireAuth: (req, res, next) => {
        if (!req.auth?.authenticated || req.auth?.isAnonymous) {
          return res.status(401).json({
            ok: false,
            data: null,
            error: { code: 'billing_unauthorized', message: 'Giriş gerekli.' },
          });
        }
        return next();
      },
      requireCsrf: (_req, _res, next) => next(),
    }),
  );
  app.use('/api/billing/webhook', createBillingWebhookRouter());

  function dispatch(method, path, opts = {}) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ status: 599, json: { error: 'dispatch_timeout' } });
      }, 5000);
      const u = new URL(path, 'http://127.0.0.1');
      const req = {
        method,
        url: path,
        path: u.pathname,
        headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
        body: opts.body || {},
        query: Object.fromEntries(u.searchParams.entries()),
        auth: opts.auth,
        ip: '127.0.0.1',
      };
      if (opts.auth) {
        req.headers['x-test-auth'] = JSON.stringify(opts.auth);
        req.auth = opts.auth;
      }
      /** @type {any} */
      const res = {
        statusCode: 200,
        body: null,
        redirectUrl: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        setHeader() {},
        json(payload) {
          this.body = payload;
          clearTimeout(timer);
          resolve({ status: this.statusCode, json: payload, redirectUrl: null });
          return this;
        },
        redirect(codeOrUrl, maybeUrl) {
          if (typeof codeOrUrl === 'string') {
            this.statusCode = 302;
            this.redirectUrl = codeOrUrl;
          } else {
            this.statusCode = codeOrUrl || 302;
            this.redirectUrl = maybeUrl;
          }
          clearTimeout(timer);
          resolve({
            status: this.statusCode,
            json: null,
            redirectUrl: this.redirectUrl,
          });
          return this;
        },
      };
      app.handle(req, res, (err) => {
        if (err) {
          clearTimeout(timer);
          resolve({ status: 500, json: { error: String(err.message || err) } });
        }
      });
    });
  }

  const guestCheckout = await dispatch('POST', '/api/billing/checkout', {
    auth: { authenticated: false, isAnonymous: true, userId: 'anonymous:x' },
  });
  ok('guest checkout 401', guestCheckout.status === 401);

  const freeCheckout = await startCheckout({ userId: 'web:billing-free-1' });
  ok('authenticated dry-run checkout ok', freeCheckout.ok === true);
  ok('checkout does not grant premium', getSubscription('web:billing-free-1') == null);
  ok('pending session stored', Boolean(getCheckoutSession(freeCheckout.token)));

  // webhook still works
  const webhookBody = {
    eventId: 'evt_wh_1',
    paymentId: 'pay_wh_1',
    status: 'SUCCESS',
    userId: 'web:billing-wh-1',
    subscriptionId: 'sub_wh_1',
  };
  const sig = signBillingWebhookBody(webhookBody, process.env.ATLAS_BILLING_WEBHOOK_SECRET);
  const goodWh = await processProviderWebhook('iyzico', webhookBody, {
    'x-atlas-billing-signature': sig,
  });
  ok('good webhook grants', goodWh.ok && goodWh.granted && goodWh.paid);
  const dupWh = await processProviderWebhook('iyzico', webhookBody, {
    'x-atlas-billing-signature': sig,
  });
  ok('duplicate webhook idempotent', dupWh.ok && dupWh.duplicate === true);

  upsertSubscription({
    userId: 'web:billing-cancel-1',
    plan: ATLAS_PLANS.PREMIUM,
    status: 'active',
    provider: 'iyzico',
  });
  const canceled = await cancelUserSubscription('web:billing-cancel-1');
  ok('cancel sets canceled', canceled.subscription.status === 'canceled');
}

// Callback flow tests
{
  resetCheckoutSessionStoreForTests();
  resetSubscriptionStoreForTests();
  resetBillingEventStoreForTests();

  const missing = await handleIyzicoCheckoutCallback({ token: '' });
  ok('callback missing token', missing.status === 'invalid' && !missing.granted);
  ok(
    'callback missing token safe redirect',
    missing.redirectUrl.includes('status=invalid') && !missing.redirectUrl.includes('token='),
  );

  const unknown = await handleIyzicoCheckoutCallback({ token: 'tok_unknown_xyz' });
  ok('callback unknown token', unknown.status === 'invalid' && !unknown.granted);

  createCheckoutSession({
    token: 'tok_cb_ok',
    userId: 'web:cb-ok',
    amount: 299,
    currency: 'TRY',
  });
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: false,
      liveCheckoutEnabled: true,
      apiKey: 'k',
      secretKey: 's',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
      fetch: mockFetchFactory(async () =>
        jsonResponse({
          status: 'success',
          paymentStatus: 'SUCCESS',
          paymentId: 'pay_cb_ok',
          paidPrice: '299.00',
          currency: 'TRY',
          basketId: 'web:cb-ok',
        }),
      ),
    }),
  );
  const cbOk = await handleIyzicoCheckoutCallback({ token: 'tok_cb_ok' });
  ok('callback valid token + retrieve SUCCESS', cbOk.ok && cbOk.status === 'success' && cbOk.granted);
  ok(
    'callback success redirects safely',
    cbOk.redirectUrl.includes('status=success') &&
      !cbOk.redirectUrl.includes('tok_cb_ok') &&
      !cbOk.redirectUrl.toLowerCase().includes('secret'),
  );
  ok(
    'callback SUCCESS grants entitlement',
    resolveEntitlements({
      authenticated: true,
      userId: 'web:cb-ok',
      isAnonymous: false,
    }).entitlements[CAPABILITIES.VOICE_LARA] === true,
  );

  const cbDup = await handleIyzicoCheckoutCallback({ token: 'tok_cb_ok' });
  ok(
    'duplicate callback idempotent',
    cbDup.ok && cbDup.status === 'success' && (cbDup.duplicate === true || cbDup.granted === true),
  );

  createCheckoutSession({
    token: 'tok_cb_fail',
    userId: 'web:cb-fail',
    amount: 299,
    currency: 'TRY',
  });
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: false,
      liveCheckoutEnabled: true,
      apiKey: 'k',
      secretKey: 's',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
      fetch: mockFetchFactory(async () =>
        jsonResponse({
          status: 'success',
          paymentStatus: 'FAILURE',
          paymentId: 'pay_cb_fail',
          paidPrice: '299.00',
          currency: 'TRY',
          basketId: 'web:cb-fail',
        }),
      ),
    }),
  );
  const cbFail = await handleIyzicoCheckoutCallback({ token: 'tok_cb_fail' });
  ok('callback retrieve FAILURE', cbFail.status === 'failed' && !cbFail.granted);
  ok(
    'callback FAILURE no premium',
    resolveEntitlements({
      authenticated: true,
      userId: 'web:cb-fail',
      isAnonymous: false,
    }).plan === ATLAS_PLANS.FREE,
  );

  createCheckoutSession({
    token: 'tok_cb_amt',
    userId: 'web:cb-amt',
    amount: 299,
    currency: 'TRY',
  });
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: false,
      liveCheckoutEnabled: true,
      apiKey: 'k',
      secretKey: 's',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
      fetch: mockFetchFactory(async () =>
        jsonResponse({
          status: 'success',
          paymentStatus: 'SUCCESS',
          paymentId: 'pay_cb_amt',
          paidPrice: '50.00',
          currency: 'TRY',
          basketId: 'web:cb-amt',
        }),
      ),
    }),
  );
  const cbAmt = await handleIyzicoCheckoutCallback({ token: 'tok_cb_amt' });
  ok(
    'callback amount mismatch',
    !cbAmt.granted && cbAmt.error === BILLING_ERROR_CODES.AMOUNT_MISMATCH,
  );

  createCheckoutSession({
    token: 'tok_cb_cur',
    userId: 'web:cb-cur',
    amount: 299,
    currency: 'TRY',
  });
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: false,
      liveCheckoutEnabled: true,
      apiKey: 'k',
      secretKey: 's',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
      fetch: mockFetchFactory(async () =>
        jsonResponse({
          status: 'success',
          paymentStatus: 'SUCCESS',
          paymentId: 'pay_cb_cur',
          paidPrice: '299.00',
          currency: 'EUR',
          basketId: 'web:cb-cur',
        }),
      ),
    }),
  );
  const cbCur = await handleIyzicoCheckoutCallback({ token: 'tok_cb_cur' });
  ok(
    'callback currency mismatch',
    !cbCur.granted && cbCur.error === BILLING_ERROR_CODES.CURRENCY_MISMATCH,
  );

  createCheckoutSession({
    token: 'tok_cb_user',
    userId: 'web:cb-owner',
    amount: 299,
    currency: 'TRY',
  });
  const cbWrong = await handleIyzicoCheckoutCallback({
    token: 'tok_cb_user',
    authUserId: 'web:cb-attacker',
  });
  ok('callback wrong user/session', cbWrong.status === 'invalid' && !cbWrong.granted);

  const prevBase = process.env.IYZICO_BASE_URL;
  process.env.IYZICO_BASE_URL = 'https://api.iyzipay.com';
  const cbProd = await handleIyzicoCheckoutCallback({ token: 'tok_any' });
  process.env.IYZICO_BASE_URL = prevBase || 'https://sandbox-api.iyzipay.com';
  ok(
    'callback production guard',
    cbProd.error === BILLING_ERROR_CODES.PRODUCTION_BLOCKED && !cbProd.granted,
  );

  const safeUrl = buildBillingResultRedirectUrl('success', 'verified');
  ok(
    'result url has no token/secret leak',
    safeUrl.includes('/#/billing/result') &&
      !safeUrl.includes('token=') &&
      !/IYZICO|SECRET|TR\d{24}/i.test(safeUrl),
  );

  setBillingProviderForTests(null);
}

// Fail-closed amount/currency + three-way canonical + client tamper ignore
{
  resetCheckoutSessionStoreForTests();
  resetSubscriptionStoreForTests();
  resetBillingEventStoreForTests();

  const missingAmtSession = createCheckoutSession({
    token: 'tok_miss_amt',
    userId: 'web:miss-amt',
    amount: 299,
    currency: 'TRY',
  });
  void missingAmtSession;
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: false,
      liveCheckoutEnabled: true,
      apiKey: 'k',
      secretKey: 's',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
      fetch: mockFetchFactory(async () =>
        jsonResponse({
          status: 'success',
          paymentStatus: 'SUCCESS',
          paymentId: 'pay_miss_amt',
          // paidPrice intentionally omitted
          currency: 'TRY',
          basketId: 'web:miss-amt',
        }),
      ),
    }),
  );
  const missAmt = await verifyClientPaymentClaim({
    userId: 'web:miss-amt',
    body: { token: 'tok_miss_amt', amount: 299 },
  });
  ok(
    'missing provider amount rejected',
    !missAmt.granted && missAmt.error === BILLING_ERROR_CODES.AMOUNT_MISMATCH,
  );
  ok(
    'missing amount user still free',
    resolveEntitlements({
      authenticated: true,
      userId: 'web:miss-amt',
      isAnonymous: false,
    }).plan === ATLAS_PLANS.FREE,
  );

  createCheckoutSession({
    token: 'tok_miss_cur',
    userId: 'web:miss-cur',
    amount: 299,
    currency: 'TRY',
  });
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: false,
      liveCheckoutEnabled: true,
      apiKey: 'k',
      secretKey: 's',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
      fetch: mockFetchFactory(async () =>
        jsonResponse({
          status: 'success',
          paymentStatus: 'SUCCESS',
          paymentId: 'pay_miss_cur',
          paidPrice: '299.00',
          // currency omitted
          basketId: 'web:miss-cur',
        }),
      ),
    }),
  );
  const missCur = await verifyClientPaymentClaim({
    userId: 'web:miss-cur',
    body: { token: 'tok_miss_cur', currency: 'TRY' },
  });
  ok(
    'missing provider currency rejected',
    !missCur.granted && missCur.error === BILLING_ERROR_CODES.CURRENCY_MISMATCH,
  );

  createCheckoutSession({
    token: 'tok_stale_session',
    userId: 'web:stale',
    amount: 100,
    currency: 'TRY',
  });
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: false,
      liveCheckoutEnabled: true,
      apiKey: 'k',
      secretKey: 's',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
      fetch: mockFetchFactory(async () =>
        jsonResponse({
          status: 'success',
          paymentStatus: 'SUCCESS',
          paymentId: 'pay_stale',
          paidPrice: '100.00',
          currency: 'TRY',
          basketId: 'web:stale',
        }),
      ),
    }),
  );
  const stale = await verifyClientPaymentClaim({
    userId: 'web:stale',
    body: { token: 'tok_stale_session' },
  });
  ok(
    'session vs canonical amount mismatch rejected',
    !stale.granted && stale.error === BILLING_ERROR_CODES.AMOUNT_MISMATCH,
  );

  // Client amount/currency/tier on checkout body ignored — session stores canonical 299 TRY
  setBillingProviderForTests(
    createIyzicoBillingProvider({
      dryRun: true,
      liveCheckoutEnabled: false,
      apiKey: 'k',
      secretKey: 's',
      baseUrl: 'https://sandbox-api.iyzipay.com',
      nodeEnv: 'test',
    }),
  );
  const checkoutTamper = await startCheckout({
    userId: 'web:price-tamper',
    email: 'tamper@example.com',
    // @ts-expect-error intentional tamper fields (ignored by service)
    amount: 1,
    currency: 'USD',
    tier: 'premium',
    premium: true,
  });
  ok('checkout ok despite client amount tamper', checkoutTamper.ok === true);
  const tamperSession = getCheckoutSession(checkoutTamper.token);
  ok(
    'checkout session amount remains canonical 299',
    tamperSession && Number(tamperSession.amount) === 299,
  );
  ok(
    'checkout session currency remains TRY',
    tamperSession && String(tamperSession.currency).toUpperCase() === 'TRY',
  );
  ok(
    'checkout does not grant via tamper fields',
    resolveEntitlements({
      authenticated: true,
      userId: 'web:price-tamper',
      isAnonymous: false,
    }).plan === ATLAS_PLANS.FREE,
  );

  // HTTP: client amount/currency/tier in JSON body still ignored
  {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.auth = {
        authenticated: true,
        isAnonymous: false,
        userId: 'web:http-price',
        email: 'http-price@example.com',
      };
      next();
    });
    app.use(
      '/api/billing',
      createBillingRouter({
        requireAuth: (_req, _res, next) => next(),
        requireCsrf: (_req, _res, next) => next(),
      }),
    );
    const server = app.listen(0);
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 1,
        price: 1,
        currency: 'USD',
        tier: 'premium',
        entitlement: true,
        plan: 'premium',
      }),
    });
    const json = await res.json();
    server.close();
    ok('http checkout ignores client price fields', res.status === 200 && json.ok === true);
    const httpSession = getCheckoutSession(json.data?.token);
    ok(
      'http checkout session canonical 299 TRY',
      httpSession &&
        Number(httpSession.amount) === 299 &&
        String(httpSession.currency).toUpperCase() === 'TRY',
    );
  }

  // Cancelled callback path
  createCheckoutSession({
    token: 'tok_cancel_hint',
    userId: 'web:cancel-hint',
    amount: 299,
    currency: 'TRY',
  });
  const canceled = await handleIyzicoCheckoutCallback({
    token: 'tok_cancel_hint',
    cancelHint: true,
  });
  ok('cancelled callback no grant', canceled.status === 'canceled' && !canceled.granted);
  ok(
    'cancelled user still free',
    resolveEntitlements({
      authenticated: true,
      userId: 'web:cancel-hint',
      isAnonymous: false,
    }).plan === ATLAS_PLANS.FREE,
  );

  // Fake result URL status alone never creates premium
  ok(
    'fake result success query does not imply store premium',
    resolveEntitlements({
      authenticated: true,
      userId: 'web:never-paid',
      isAnonymous: false,
    }).plan === ATLAS_PLANS.FREE,
  );

  // Client source contracts (no FE runner): paymentPageUrl + entitlement authority
  {
    const panelSrc = readFileSync(
      join(root, 'src/components/cosmic/PremiumPlanPanel.tsx'),
      'utf8',
    );
    const billingSrc = readFileSync(join(root, 'src/services/atlas-billing.ts'), 'utf8');
    const resultSrc = readFileSync(join(root, 'src/pages/BillingResultPage.tsx'), 'utf8');
    const entSrc = readFileSync(join(root, 'src/services/atlas-entitlements.ts'), 'utf8');
    ok(
      'sandbox paymentPageUrl consumed in panel',
      panelSrc.includes('paymentPageUrl') && panelSrc.includes('location.assign'),
    );
    ok(
      'live missing paymentPageUrl fails visibly',
      panelSrc.includes('paymentPageUrl') && panelSrc.includes('Ödeme sayfası alınamadı'),
    );
    ok(
      'dry-run path does not assign payment url',
      panelSrc.includes('dry-run') &&
        panelSrc.includes('liveCheckoutEnabled') &&
        /dryRun[\s\S]*liveCheckoutEnabled[\s\S]*setPanelState\('dry-run'\)/.test(panelSrc),
    );
    ok(
      'double-click checkout guard present',
      panelSrc.includes('checkoutLock') && panelSrc.includes('disabled={busy}'),
    );
    ok(
      'checkout client sends empty body',
      billingSrc.includes('JSON.stringify({})') && billingSrc.includes('paymentPageUrl'),
    );
    ok(
      'result page entitlement refresh',
      resultSrc.includes('fetchEntitlementsWithRetry') && resultSrc.includes('isPremiumPlan'),
    );
    ok(
      'fake result success not authority',
      resultSrc.includes('status === \'success\'') &&
        resultSrc.includes('pending') &&
        resultSrc.includes('isPremiumPlan'),
    );
    ok(
      'return retry bounded',
      entSrc.includes('fetchEntitlementsWithRetry') &&
        entSrc.includes('attempts') &&
        /Math\.min\(opts\?\.attempts \?\? 3, 5\)/.test(entSrc),
    );
    ok(
      'no automatic renewal copy in panel',
      !/otomatik yenilen|kendiliğinden yenilen|Subscription active/i.test(panelSrc),
    );
  }

  // Production gate still enforced on checkout
  {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const blocked = await startCheckout({ userId: 'web:prod-block' });
    process.env.NODE_ENV = prevEnv;
    ok(
      'production gate preserved on checkout',
      !blocked.ok && blocked.error === BILLING_ERROR_CODES.PRODUCTION_BLOCKED && !blocked.granted,
    );
  }

  setBillingProviderForTests(null);
}

// Secret / IBAN client scan
{
  function walk(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.name === 'node_modules' || name.name === 'dist') continue;
      const p = join(dir, name.name);
      if (name.isDirectory()) walk(p, out);
      else if (/\.(js|mjs|ts|tsx|json|css|html)$/i.test(name.name)) out.push(p);
    }
    return out;
  }
  let ibanHardcoded = false;
  for (const file of walk(join(root, 'src')).concat(walk(join(root, 'server')))) {
    if (file.includes('test-billing')) continue;
    let text = '';
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (/\bTR\d{24}\b/.test(text)) ibanHardcoded = true;
  }
  ok('IBAN not hardcoded in server/src', !ibanHardcoded);

  let clientSecretRef = false;
  for (const file of walk(join(root, 'src'))) {
    const text = readFileSync(file, 'utf8');
    if (/PREMIUM_PAYOUT_IBAN|IYZICO_SECRET_KEY|IYZICO_API_KEY/.test(text)) {
      clientSecretRef = true;
    }
  }
  ok('client src has no billing secret/IBAN env refs', !clientSecretRef);
}

ok(
  'no production iyzico host called',
  networkUrls.every((u) => !u.includes('://api.iyzipay.com') || u.includes('sandbox')),
);

// Note: mock fetch URLs are recorded — real global fetch was never used for payments.
console.log(`\n  (mock network calls recorded: ${networkUrls.length}; real charge: NO)\n`);

try {
  rmSync(tmpStore, { recursive: true, force: true });
} catch {
  /* ignore */
}

setBillingProviderForTests(null);
console.log(`\nBilling result: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
