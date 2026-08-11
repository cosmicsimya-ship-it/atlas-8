/**
 * Billing HTTP routes.
 */

import { Router } from 'express';
import { BILLING_ERROR_CODES } from './errors.js';
import { getPublicBillingConfig, buildBillingResultRedirectUrl } from './config.js';
import {
  startCheckout,
  verifyClientPaymentClaim,
  processProviderWebhook,
  cancelUserSubscription,
  getBillingStatusForUser,
  getManualBankTransferExtensionPoint,
  handleIyzicoCheckoutCallback,
} from './service.js';
import { getManualBankTransferOffer } from './manual-bank-transfer.js';

function isRegisteredAccount(auth) {
  return Boolean(
    auth?.authenticated &&
      !auth?.isAnonymous &&
      typeof auth?.userId === 'string' &&
      auth.userId &&
      !String(auth.userId).startsWith('anonymous:'),
  );
}

function extractCallbackToken(req) {
  const fromBody = req.body && typeof req.body === 'object' ? req.body.token : null;
  const fromQuery = req.query?.token;
  return String(fromBody || fromQuery || '').trim();
}

function extractCancelHint(req) {
  const status = String(
    req.body?.status || req.body?.paymentStatus || req.query?.status || '',
  )
    .trim()
    .toLowerCase();
  return status === 'failure' || status === 'failed' || status === 'cancel' || status === 'canceled';
}

async function respondIyzicoCallback(req, res) {
  try {
    const result = await handleIyzicoCheckoutCallback({
      token: extractCallbackToken(req),
      authUserId: isRegisteredAccount(req.auth) ? req.auth.userId : null,
      cancelHint: extractCancelHint(req),
    });

    const wantsJson =
      String(req.query?.format || '').toLowerCase() === 'json' ||
      String(req.headers.accept || '').includes('application/json');

    if (wantsJson) {
      return res.status(200).json({
        ok: Boolean(result.ok),
        data: {
          status: result.status,
          granted: Boolean(result.granted),
          duplicate: Boolean(result.duplicate),
          redirectUrl: result.redirectUrl,
          // never echo token / secrets / provider raw
        },
        error: result.error
          ? { code: result.error, message: 'Billing callback processed.' }
          : null,
      });
    }

    return res.redirect(302, result.redirectUrl);
  } catch {
    return res.redirect(302, buildBillingResultRedirectUrl('failed', 'callback_error'));
  }
}

/**
 * @param {{
 *   requireAuth?: import('express').RequestHandler,
 *   requireCsrf?: import('express').RequestHandler,
 *   rateLimit?: import('express').RequestHandler,
 * }} [deps]
 */
export function createBillingRouter(deps = {}) {
  const router = Router();
  const requireAuth = deps.requireAuth || ((_req, _res, next) => next());
  const requireCsrf = deps.requireCsrf || ((_req, _res, next) => next());
  const rateLimit = deps.rateLimit || ((_req, _res, next) => next());

  /** GET /api/billing/config — public product pricing (no secrets / no IBAN) */
  router.get('/config', rateLimit, (_req, res) => {
    return res.status(200).json({
      ok: true,
      data: {
        ...getPublicBillingConfig(),
        manualBankTransfer: getManualBankTransferOffer(),
      },
      error: null,
    });
  });

  /** GET /api/billing/subscription */
  router.get('/subscription', rateLimit, requireAuth, (req, res) => {
    if (!isRegisteredAccount(req.auth)) {
      return res.status(401).json({
        ok: false,
        data: null,
        error: { code: BILLING_ERROR_CODES.UNAUTHORIZED, message: 'Giriş gerekli.' },
      });
    }
    const data = getBillingStatusForUser(req.auth.userId);
    return res.status(200).json({ ok: true, data, error: null });
  });

  /** POST /api/billing/checkout */
  router.post('/checkout', rateLimit, requireAuth, requireCsrf, async (req, res) => {
    try {
      if (!isRegisteredAccount(req.auth)) {
        return res.status(401).json({
          ok: false,
          data: null,
          error: { code: BILLING_ERROR_CODES.UNAUTHORIZED, message: 'Giriş gerekli.' },
        });
      }

      // Ignore client amount/price/currency/plan/entitlement/paymentSuccess tampering.
      // Canonical premium price comes only from server pricing config.
      const forwarded = req.headers?.['x-forwarded-for'];
      const clientIp =
        (typeof forwarded === 'string' && forwarded) ||
        (typeof req.ip === 'string' && req.ip) ||
        (typeof req.socket?.remoteAddress === 'string' && req.socket.remoteAddress) ||
        null;
      const result = await startCheckout({
        userId: req.auth.userId,
        email: req.auth.email || null,
        displayName: req.auth.displayName || null,
        clientIp,
      });

      if (!result.ok) {
        const status =
          result.error === BILLING_ERROR_CODES.UNAUTHORIZED
            ? 401
            : result.error === BILLING_ERROR_CODES.NOT_CONFIGURED
              ? 503
              : 400;
        return res.status(status).json({
          ok: false,
          data: {
            dryRun: result.dryRun,
            liveCheckoutEnabled: result.liveCheckoutEnabled,
            product: result.product,
            features: result.features,
          },
          error: {
            code: result.error || BILLING_ERROR_CODES.PROVIDER_ERROR,
            message: result.message || 'Checkout başarısız.',
          },
        });
      }

      return res.status(200).json({
        ok: true,
        data: result,
        error: null,
      });
    } catch {
      return res.status(500).json({
        ok: false,
        data: null,
        error: { code: 'billing_error', message: 'Checkout hatası.' },
      });
    }
  });

  /**
   * POST /api/billing/verify
   * Client paymentSuccess alone MUST NOT grant Premium.
   */
  router.post('/verify', rateLimit, requireAuth, requireCsrf, async (req, res) => {
    try {
      if (!isRegisteredAccount(req.auth)) {
        return res.status(401).json({
          ok: false,
          data: null,
          error: { code: BILLING_ERROR_CODES.UNAUTHORIZED, message: 'Giriş gerekli.' },
        });
      }

      const result = await verifyClientPaymentClaim({
        userId: req.auth.userId,
        body: req.body || {},
      });

      if (!result.ok || !result.granted) {
        return res.status(403).json({
          ok: false,
          data: { paid: false, granted: false },
          error: {
            code: result.error || BILLING_ERROR_CODES.VERIFICATION_FAILED,
            message: result.message || 'Ödeme doğrulanamadı.',
          },
        });
      }

      return res.status(200).json({
        ok: true,
        data: result,
        error: null,
      });
    } catch {
      return res.status(500).json({
        ok: false,
        data: null,
        error: { code: 'billing_error', message: 'Doğrulama hatası.' },
      });
    }
  });

  /** POST /api/billing/cancel */
  router.post('/cancel', rateLimit, requireAuth, requireCsrf, async (req, res) => {
    try {
      if (!isRegisteredAccount(req.auth)) {
        return res.status(401).json({
          ok: false,
          data: null,
          error: { code: BILLING_ERROR_CODES.UNAUTHORIZED, message: 'Giriş gerekli.' },
        });
      }
      const result = await cancelUserSubscription(req.auth.userId);
      return res.status(200).json({ ok: true, data: result, error: null });
    } catch {
      return res.status(500).json({
        ok: false,
        data: null,
        error: { code: 'billing_error', message: 'İptal hatası.' },
      });
    }
  });

  /** GET /api/billing/manual-transfer — future only; always disabled */
  router.get('/manual-transfer', rateLimit, (_req, res) => {
    return res.status(200).json({
      ok: true,
      data: {
        ...getManualBankTransferOffer(),
        extension: getManualBankTransferExtensionPoint(),
      },
      error: null,
    });
  });

  router.post('/manual-transfer', rateLimit, requireAuth, requireCsrf, (_req, res) => {
    return res.status(403).json({
      ok: false,
      data: getManualBankTransferOffer(),
      error: {
        code: 'manual_bank_transfer_disabled',
        message: 'Manuel banka transferi henüz aktif değil.',
      },
    });
  });

  /**
   * Iyzico Checkout Form callback — no CSRF (provider POST).
   * Grants Premium only via verify → retrieve SUCCESS path.
   */
  router.get('/callback/iyzico', rateLimit, respondIyzicoCallback);
  router.post('/callback/iyzico', rateLimit, respondIyzicoCallback);

  return router;
}

/**
 * Webhook router — no session auth; signature verification inside provider.
 * Mount at /api/billing/webhook
 */
export function createBillingWebhookRouter(deps = {}) {
  const router = Router();
  const rateLimit = deps.rateLimit || ((_req, _res, next) => next());

  router.post('/iyzico', rateLimit, async (req, res) => {
    try {
      const headers = {};
      for (const [k, v] of Object.entries(req.headers || {})) {
        if (typeof v === 'string') headers[k.toLowerCase()] = v;
      }
      const result = await processProviderWebhook('iyzico', req.body, headers);
      if (!result.ok) {
        return res.status(result.statusCode || 400).json({
          ok: false,
          data: null,
          error: { code: result.error, message: 'Webhook rejected.' },
        });
      }
      return res.status(200).json({
        ok: true,
        data: {
          paid: result.paid,
          granted: result.granted,
          duplicate: Boolean(result.duplicate),
        },
        error: null,
      });
    } catch {
      return res.status(500).json({
        ok: false,
        data: null,
        error: { code: 'billing_webhook_error', message: 'Webhook error.' },
      });
    }
  });

  return router;
}
