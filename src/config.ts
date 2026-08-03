/**
 * API base URL.
 * - Explicit `VITE_BACKEND_URL` always wins (cross-origin API host).
 * - Otherwise same-origin (`''`): Vite proxy in dev, Express `/api` in production
 *   when `ATLAS_SERVE_FRONTEND` serves `dist/` from the same Node process.
 */
export const BACKEND_URL = (() => {
  const fromEnv = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return '';
})();

export const REQUEST_TIMEOUT_MS = 120_000;
