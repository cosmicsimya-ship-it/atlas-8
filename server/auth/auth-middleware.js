// ═══════════════════════════════════════════════════════════════════════
// Auth middleware — only place that attaches req.auth
// ═══════════════════════════════════════════════════════════════════════

import { randomBytes, timingSafeEqual } from 'crypto';
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  getSessionCookieOptions,
  getCsrfCookieOptions,
  isAllowedOrigin,
} from './cookie-config.js';
import {
  createAnonymousSession,
  resolveSessionIdentity,
  buildTelegramAuthIdentity,
  createUnauthenticatedIdentity,
  authToRequesterContext,
} from './session-service.js';
import { logPrivacyEvent } from '../privacy/privacy-logger.js';

/**
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function readSessionToken(req) {
  const cookies = req.cookies ?? {};
  const fromCookie = cookies[SESSION_COOKIE_NAME];
  if (typeof fromCookie === 'string' && fromCookie.trim()) return fromCookie.trim();
  return null;
}

/**
 * @param {import('express').Response} res
 * @param {string} rawToken
 */
export function setSessionCookie(res, rawToken) {
  res.cookie(SESSION_COOKIE_NAME, rawToken, getSessionCookieOptions());
}

/**
 * @param {import('express').Response} res
 */
export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, { ...getSessionCookieOptions(), maxAge: 0 });
}

/**
 * @param {import('express').Response} res
 * @param {import('express').Request} req
 * @returns {string}
 */
export function ensureCsrfCookie(res, req) {
  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  if (typeof existing === 'string' && existing.length >= 16) {
    return existing;
  }
  const token = randomBytes(24).toString('base64url');
  res.cookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());
  return token;
}

/**
 * Attach req.auth from session cookie; create anonymous session if missing (web).
 */
export function attachAuthFromSession(options = {}) {
  const createAnonymous = options.createAnonymous !== false;

  return function attachAuthMiddleware(req, res, next) {
    try {
      req.auth = createUnauthenticatedIdentity();

      if (req.atlasBotVerified) {
        return next();
      }

      const rawToken = readSessionToken(req);
      if (rawToken) {
        const { identity, reason } = resolveSessionIdentity(rawToken);
        if (identity.authenticated) {
          req.auth = identity;
          req.atlasSessionToken = rawToken;
          ensureCsrfCookie(res, req);
          return next();
        }
        if (reason === 'store_unavailable') {
          return res.status(503).json({ error: 'Authentication service unavailable' });
        }
        clearSessionCookie(res);
      }

      if (createAnonymous) {
        try {
          const anon = createAnonymousSession();
          setSessionCookie(res, anon.rawToken);
          req.auth = anon.identity;
          req.atlasSessionToken = anon.rawToken;
          ensureCsrfCookie(res, req);
        } catch {
          return res.status(503).json({ error: 'Authentication service unavailable' });
        }
      }

      return next();
    } catch (err) {
      try {
        logPrivacyEvent({
          channel: 'auth',
          eventType: 'auth_middleware_error',
          action: 'fail_closed',
          reason: String(err?.message ?? 'error').slice(0, 120),
        });
      } catch {
        /* ignore */
      }
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }
  };
}

/**
 * Verify shared secret from Telegram bot process.
 */
export function requireTelegramBotSecret(req, res, next) {
  const expected = process.env.ATLAS_INTERNAL_BOT_SECRET || '';
  const provided =
    (typeof req.headers['x-atlas-bot-secret'] === 'string'
      ? req.headers['x-atlas-bot-secret']
      : '') || '';

  if (!expected || expected.length < 16) {
    if (req.body?.channel === 'telegram') {
      return res.status(503).json({ error: 'Telegram auth not configured' });
    }
    return next();
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && a.length > 0 && timingSafeEqual(a, b);

  if (!ok) {
    if (req.body?.channel === 'telegram') {
      try {
        logPrivacyEvent({
          channel: 'telegram',
          eventType: 'telegram_bot_secret_rejected',
          action: 'blocked',
          reason: 'invalid_bot_secret',
        });
      } catch {
        /* ignore */
      }
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  }

  req.atlasBotVerified = true;

  const fromId =
    req.body?.metadata?.telegramFromId ??
    (typeof req.body?.userId === 'string' && req.body.userId.startsWith('telegram:')
      ? req.body.userId.slice('telegram:'.length)
      : null);

  if (!fromId) {
    return res.status(400).json({ error: 'Missing Telegram sender id' });
  }

  req.auth = buildTelegramAuthIdentity({
    telegramFromId: fromId,
    displayName: req.body?.displayName ?? null,
  });

  req.body = {
    ...(req.body ?? {}),
    channel: 'telegram',
    userId: req.auth.userId,
  };

  return next();
}

/**
 * CSRF + Origin protection for unsafe methods with cookie auth.
 */
export function requireCsrfProtection(req, res, next) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  if (req.atlasBotVerified) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    if (!isAllowedOrigin(origin)) {
      try {
        logPrivacyEvent({
          channel: 'auth',
          eventType: 'csrf_origin_rejected',
          action: 'blocked',
          reason: 'invalid_origin',
        });
      } catch {
        /* ignore */
      }
      return res.status(403).json({ error: 'Origin not allowed' });
    }
  } else if (referer) {
    try {
      const refOrigin = new URL(String(referer)).origin;
      if (!isAllowedOrigin(refOrigin)) {
        return res.status(403).json({ error: 'Origin not allowed' });
      }
    } catch {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Origin required' });
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken =
    (typeof req.headers['x-atlas-csrf'] === 'string' ? req.headers['x-atlas-csrf'] : null) ||
    (typeof req.headers['x-csrf-token'] === 'string' ? req.headers['x-csrf-token'] : null);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    try {
      logPrivacyEvent({
        channel: 'auth',
        requesterId: req.auth?.userId ?? null,
        eventType: 'csrf_token_rejected',
        action: 'blocked',
        reason: 'csrf_mismatch',
      });
    } catch {
      /* ignore */
    }
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  return next();
}

export function requireAuthenticated(req, res, next) {
  if (!req.auth?.authenticated || !req.auth?.userId) {
    try {
      logPrivacyEvent({
        channel: 'api',
        eventType: 'unauthorized_route_access',
        action: 'blocked',
        reason: 'not_authenticated',
      });
    } catch {
      /* ignore */
    }
    return res.status(401).json({ error: 'Authentication required' });
  }
  return next();
}

export function requireFounder(req, res, next) {
  if (!req.auth?.authenticated || !req.auth?.roles?.includes('founder')) {
    try {
      logPrivacyEvent({
        channel: 'api',
        requesterId: req.auth?.userId ?? null,
        eventType: 'founder_privilege_denial',
        action: 'blocked',
        reason: 'founder_role_required',
      });
    } catch {
      /* ignore */
    }
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

/**
 * @param {import('express').Request} req
 */
export function requesterContextFromRequest(req) {
  return authToRequesterContext(req.auth ?? createUnauthenticatedIdentity(), {
    channel: req.atlasBotVerified ? 'telegram' : 'web',
    displayName: req.body?.displayName ?? null,
  });
}

export { authToRequesterContext };
