// ═══════════════════════════════════════════════════════════════════════
// Cookie configuration — HttpOnly sessions (never localStorage)
// ═══════════════════════════════════════════════════════════════════════

export const SESSION_COOKIE_NAME = 'atlas_sid';
export const CSRF_COOKIE_NAME = 'atlas_csrf';

/** Local Vite / preview origins — development only (not used when NODE_ENV=production). */
const DEV_BROWSER_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];

/** Known production browser origins — HTTPS only, exact host match. */
const PRODUCTION_BROWSER_ORIGINS = [
  'https://cosmicsimya.com',
  'https://www.cosmicsimya.com',
];

/**
 * Normalize a browser Origin (or origin-like string) to `protocol://host[:port]`.
 * Rejects wildcards, non-http(s), credentials, and invalid URLs.
 * Trailing slashes do not affect the result (`URL.origin`).
 *
 * @param {string|undefined|null} value
 * @returns {string|null}
 */
export function normalizeOrigin(value) {
  if (value == null || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '*') return null;

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;

  // Exact allowlist key: scheme + hostname + non-default port only.
  return url.origin;
}

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
 * Exact protocol+host(+port) strings only — never `*` or suffix matches.
 * @returns {string[]}
 */
export function getAllowedOrigins() {
  const raw = process.env.ATLAS_CORS_ORIGINS ?? process.env.FRONTEND_ORIGIN ?? '';
  const fromEnv = raw
    .split(',')
    .map((s) => normalizeOrigin(s.trim()))
    .filter(Boolean);

  const isProduction = process.env.NODE_ENV === 'production';
  const defaults = isProduction
    ? PRODUCTION_BROWSER_ORIGINS
    : [...PRODUCTION_BROWSER_ORIGINS, ...DEV_BROWSER_ORIGINS];

  const normalizedDefaults = defaults.map((o) => normalizeOrigin(o)).filter(Boolean);
  let merged = [...new Set([...fromEnv, ...normalizedDefaults])];

  // Production acceptlist: HTTPS only (no localhost / http leftovers from env).
  if (isProduction) {
    merged = merged.filter((o) => o.startsWith('https://'));
  }

  return merged;
}

/**
 * Exact allowlist check after normalization.
 * Missing / invalid origins are never allowed (callers decide no-Origin policy).
 * @param {string|undefined|null} origin
 */
export function isAllowedOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return getAllowedOrigins().includes(normalized);
}
