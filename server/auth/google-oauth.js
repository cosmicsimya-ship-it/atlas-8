// ═══════════════════════════════════════════════════════════════════════
// Google OAuth 2.0 (authorization code + PKCE) — server-side only
// Client secret never leaves the server. Credentials come from env.
// ═══════════════════════════════════════════════════════════════════════

import { createHmac, randomBytes, createHash, timingSafeEqual } from 'crypto';
import {
  getSessionCookieOptions,
  getAllowedOrigins,
  normalizeOrigin,
} from './cookie-config.js';

export const OAUTH_STATE_COOKIE = 'atlas_oauth';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

/**
 * @returns {{
 *   configured: boolean,
 *   clientId: string|null,
 *   clientSecret: string|null,
 *   redirectUri: string|null,
 * }}
 */
export function getGoogleOAuthConfig() {
  const clientId = String(
    process.env.GOOGLE_CLIENT_ID || process.env.ATLAS_GOOGLE_CLIENT_ID || '',
  ).trim();
  const clientSecret = String(
    process.env.GOOGLE_CLIENT_SECRET || process.env.ATLAS_GOOGLE_CLIENT_SECRET || '',
  ).trim();
  const redirectUri = String(
    process.env.GOOGLE_REDIRECT_URI || process.env.ATLAS_GOOGLE_REDIRECT_URI || '',
  ).trim();

  return {
    configured: Boolean(clientId && clientSecret && redirectUri),
    clientId: clientId || null,
    clientSecret: clientSecret || null,
    redirectUri: redirectUri || null,
  };
}

function oauthSigningKey() {
  const cfg = getGoogleOAuthConfig();
  const explicit = String(process.env.ATLAS_OAUTH_STATE_SECRET || '').trim();
  if (explicit.length >= 16) return explicit;
  if (cfg.clientSecret) return `atlas-oauth:${cfg.clientSecret}`;
  return 'atlas-oauth-dev-unconfigured';
}

/**
 * @param {object} payload
 */
function sealOAuthState(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', oauthSigningKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/**
 * @param {string} sealed
 */
function openOAuthState(sealed) {
  if (!sealed || typeof sealed !== 'string' || !sealed.includes('.')) return null;
  const [body, sig] = sealed.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', oauthSigningKey()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function pkceVerifier() {
  return randomBytes(32).toString('base64url');
}

function pkceChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Prefer FRONTEND_ORIGIN / first allowed production origin for post-login return.
 * HashRouter: always land on `/#/...`.
 * @param {string|null|undefined} preferred
 */
export function resolveFrontendReturnOrigin(preferred) {
  const fromPreferred = normalizeOrigin(preferred);
  if (fromPreferred && getAllowedOrigins().includes(fromPreferred)) {
    return fromPreferred;
  }
  const fromEnv = normalizeOrigin(process.env.FRONTEND_ORIGIN);
  if (fromEnv && getAllowedOrigins().includes(fromEnv)) {
    return fromEnv;
  }
  const allowed = getAllowedOrigins();
  const prod = allowed.find((o) => o.includes('cosmicsimya.com'));
  if (prod) return prod;
  return allowed[0] || 'http://localhost:5173';
}

/**
 * @param {string} origin
 * @param {{ ok: boolean, code?: string }} result
 */
export function buildOAuthReturnUrl(origin, result) {
  const base = origin.replace(/\/$/, '');
  if (result.ok) {
    return `${base}/#/?auth=ok`;
  }
  const code = encodeURIComponent(result.code || 'oauth_failed');
  return `${base}/#/?auth=error&code=${code}`;
}

/**
 * @param {import('express').Response} res
 * @param {string} sealed
 */
export function setOAuthStateCookie(res, sealed) {
  const opts = getSessionCookieOptions();
  res.cookie(OAUTH_STATE_COOKIE, sealed, {
    ...opts,
    maxAge: 10 * 60 * 1000,
    sameSite: 'lax',
  });
}

/**
 * @param {import('express').Response} res
 */
export function clearOAuthStateCookie(res) {
  res.clearCookie(OAUTH_STATE_COOKIE, {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
}

/**
 * Build Google authorization redirect URL and sealed state cookie value.
 * @param {{ returnOrigin?: string|null }} [opts]
 */
export function beginGoogleOAuth(opts = {}) {
  const cfg = getGoogleOAuthConfig();
  if (!cfg.configured) {
    return { ok: false, code: 'google_not_configured' };
  }

  const state = randomBytes(24).toString('base64url');
  const codeVerifier = pkceVerifier();
  const returnOrigin = resolveFrontendReturnOrigin(opts.returnOrigin);
  const sealed = sealOAuthState({
    state,
    codeVerifier,
    returnOrigin,
    exp: Date.now() + 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: pkceChallenge(codeVerifier),
    code_challenge_method: 'S256',
    access_type: 'online',
    prompt: 'select_account',
  });

  return {
    ok: true,
    authUrl: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    sealedState: sealed,
  };
}

/**
 * @param {{
 *   code?: string|null,
 *   state?: string|null,
 *   error?: string|null,
 *   sealedCookie?: string|null,
 * }} input
 */
export async function completeGoogleOAuth(input) {
  const sealed = openOAuthState(input.sealedCookie || '');
  if (!sealed) {
    return { ok: false, code: 'oauth_state_invalid', returnOrigin: resolveFrontendReturnOrigin(null) };
  }

  const returnOrigin = resolveFrontendReturnOrigin(sealed.returnOrigin);

  if (input.error) {
    const code =
      String(input.error) === 'access_denied' ? 'google_cancelled' : 'oauth_provider_error';
    return { ok: false, code, returnOrigin };
  }

  if (!input.code || !input.state || input.state !== sealed.state) {
    return { ok: false, code: 'oauth_state_mismatch', returnOrigin };
  }

  const cfg = getGoogleOAuthConfig();
  if (!cfg.configured) {
    return { ok: false, code: 'google_not_configured', returnOrigin };
  }

  let tokenJson;
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code: String(input.code),
        code_verifier: sealed.codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: cfg.redirectUri,
      }),
    });
    tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      return { ok: false, code: 'oauth_token_exchange_failed', returnOrigin };
    }
  } catch {
    return { ok: false, code: 'oauth_token_exchange_failed', returnOrigin };
  }

  let profile;
  try {
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    profile = await userRes.json();
    if (!userRes.ok || !profile?.sub) {
      return { ok: false, code: 'oauth_profile_failed', returnOrigin };
    }
  } catch {
    return { ok: false, code: 'oauth_profile_failed', returnOrigin };
  }

  return {
    ok: true,
    returnOrigin,
    google: {
      googleSub: String(profile.sub),
      email: String(profile.email || ''),
      emailVerified: Boolean(profile.email_verified),
      displayName: profile.name ? String(profile.name) : null,
      avatarUrl: profile.picture ? String(profile.picture) : null,
    },
  };
}

/**
 * Safe public status — never includes secrets.
 */
export function getGoogleOAuthPublicStatus() {
  const cfg = getGoogleOAuthConfig();
  return {
    configured: cfg.configured,
    redirectUriConfigured: Boolean(cfg.redirectUri),
  };
}
