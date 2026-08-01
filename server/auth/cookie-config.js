// ═══════════════════════════════════════════════════════════════════════
// Cookie configuration — HttpOnly sessions (never localStorage)
// ═══════════════════════════════════════════════════════════════════════

export const SESSION_COOKIE_NAME = 'atlas_sid';
export const CSRF_COOKIE_NAME = 'atlas_csrf';

/**
 * @param {{ isProduction?: boolean, maxAgeMs?: number }} [opts]
 */
export function getSessionCookieOptions(opts = {}) {
  const isProduction =
    opts.isProduction ?? (process.env.NODE_ENV === 'production' || process.env.ATLAS_SECURE_COOKIES === 'true');
  const maxAgeMs = opts.maxAgeMs ?? Number(process.env.ATLAS_SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: /** @type {'lax'} */ ('lax'),
    path: '/',
    maxAge: maxAgeMs,
  };
}

/**
 * CSRF cookie is readable by JS so the SPA can echo it in a header.
 * @param {{ isProduction?: boolean, maxAgeMs?: number }} [opts]
 */
export function getCsrfCookieOptions(opts = {}) {
  const base = getSessionCookieOptions(opts);
  return {
    ...base,
    httpOnly: false,
  };
}

/**
 * Allowed browser origins for credentialed CORS + CSRF Origin checks.
 * @returns {string[]}
 */
export function getAllowedOrigins() {
  const raw = process.env.ATLAS_CORS_ORIGINS ?? process.env.FRONTEND_ORIGIN ?? '';
  const defaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ];
  const fromEnv = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...fromEnv, ...defaults])];
}

/**
 * @param {string|undefined|null} origin
 */
export function isAllowedOrigin(origin) {
  if (!origin) return false;
  return getAllowedOrigins().includes(origin);
}
