/**
 * API base URL.
 * - Explicit `VITE_BACKEND_URL` always wins.
 * - In Vite dev/preview, default to same-origin (`''`) so `/api/*` goes through the
 *   Vite proxy (see vite.config.ts) and never trips cross-origin CORS "Failed to fetch".
 * - Production builds without an env override still target the local backend.
 */
export const BACKEND_URL = (() => {
  const fromEnv = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return '';
  return 'http://localhost:3001';
})();

export const REQUEST_TIMEOUT_MS = 120_000;
