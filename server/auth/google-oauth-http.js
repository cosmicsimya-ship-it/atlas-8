/**
 * Google OAuth HTTP routes.
 *
 * LiteSpeed / ModSecurity on some shared hosts returns empty HTML 503 for paths
 * containing "/google/". Register both legacy `/api/auth/google*` and safe
 * `/api/auth/oauth*` aliases. Frontend should prefer the oauth* paths.
 */
import {
  getGoogleOAuthPublicStatus,
  beginGoogleOAuth,
  completeGoogleOAuth,
  buildOAuthReturnUrl,
  resolveFrontendReturnOrigin,
  setOAuthStateCookie,
  clearOAuthStateCookie,
  OAUTH_STATE_COOKIE,
} from './google-oauth.js';
import {
  readSessionToken,
  setSessionCookie,
  ensureCsrfCookie,
} from './auth-middleware.js';
import { loginWithGoogleIdentity } from './session-service.js';

/**
 * @param {import('express').Express} app
 * @param {{ rateLimit?: import('express').RequestHandler }} [opts]
 */
export function mountGoogleOAuthRoutes(app, opts = {}) {
  const rateLimit = opts.rateLimit || ((_req, _res, next) => next());

  /** @type {import('express').RequestHandler} */
  const sendStatus = (_req, res) => {
    try {
      const body = getGoogleOAuthPublicStatus();
      return res.status(200).type('application/json').json(body);
    } catch (err) {
      console.error('[ATLAS] oauth status error:', err?.stack || err?.message || err);
      return res.status(200).type('application/json').json({
        configured: false,
        redirectUriConfigured: false,
        redirectUri: null,
        error: 'google_status_failed',
      });
    }
  };

  /** @type {import('express').RequestHandler} */
  const startOAuth = (req, res) => {
    try {
      const returnOrigin =
        typeof req.query.returnOrigin === 'string' ? req.query.returnOrigin : req.get('origin');
      const started = beginGoogleOAuth({ returnOrigin });
      if (!started.ok) {
        // Prefer JSON for XHR/clients; browsers navigating may get redirect back.
        const wantsJson = String(req.get('accept') || '').includes('application/json');
        if (wantsJson || req.xhr) {
          return res.status(503).json({
            error: 'Google authentication is not configured',
            code: 'google_not_configured',
          });
        }
        if (req.accepts(['html', 'json']) === 'json') {
          return res.status(503).json({
            error: 'Google authentication is not configured',
            code: 'google_not_configured',
          });
        }
        return res.redirect(
          302,
          buildOAuthReturnUrl(resolveFrontendReturnOrigin(returnOrigin), {
            ok: false,
            code: started.code || 'google_not_configured',
          }),
        );
      }
      setOAuthStateCookie(res, started.sealedState);
      return res.redirect(302, started.authUrl);
    } catch (err) {
      console.error('[ATLAS] oauth start error:', err?.stack || err?.message || err);
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }
  };

  /** @type {import('express').RequestHandler} */
  const callbackOAuth = async (req, res) => {
    const sealedCookie = req.cookies?.[OAUTH_STATE_COOKIE];
    try {
      const completed = await completeGoogleOAuth({
        code: typeof req.query.code === 'string' ? req.query.code : null,
        state: typeof req.query.state === 'string' ? req.query.state : null,
        error: typeof req.query.error === 'string' ? req.query.error : null,
        sealedCookie,
      });
      clearOAuthStateCookie(res);

      if (!completed.ok) {
        return res.redirect(
          302,
          buildOAuthReturnUrl(completed.returnOrigin, {
            ok: false,
            code: completed.code || 'oauth_failed',
          }),
        );
      }

      const previous = readSessionToken(req);
      const result = await loginWithGoogleIdentity({
        ...completed.google,
        previousRawToken: previous,
      });

      if (!result.ok) {
        return res.redirect(
          302,
          buildOAuthReturnUrl(completed.returnOrigin, {
            ok: false,
            code: result.code || 'google_auth_failed',
          }),
        );
      }

      setSessionCookie(res, result.rawToken);
      ensureCsrfCookie(res, req);
      return res.redirect(302, buildOAuthReturnUrl(completed.returnOrigin, { ok: true }));
    } catch (err) {
      console.error('[ATLAS] oauth callback error:', err?.stack || err?.message || err);
      clearOAuthStateCookie(res);
      return res.redirect(
        302,
        buildOAuthReturnUrl(process.env.FRONTEND_ORIGIN || 'https://cosmicsimya.com', {
          ok: false,
          code: 'oauth_failed',
        }),
      );
    }
  };

  // Prefer these on LiteSpeed / ModSecurity hosts (no "/google/" segment).
  app.get('/api/auth/oauth/status', sendStatus);
  app.get('/api/auth/oauth/start', rateLimit, startOAuth);
  app.get('/api/auth/oauth/callback', rateLimit, callbackOAuth);

  // Legacy paths (Google Console may still use /api/auth/google/callback).
  app.get('/api/auth/google/status', sendStatus);
  app.get('/api/auth/google', rateLimit, startOAuth);
  app.get('/api/auth/google/callback', rateLimit, callbackOAuth);
}
