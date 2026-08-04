// ═══════════════════════════════════════════════════════════════════════
// In-memory rate limiting — fail-safe, no private content logged
// ═══════════════════════════════════════════════════════════════════════

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map();

/**
 * @param {string} key
 * @param {{ windowMs: number, max: number }} opts
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function checkRateLimit(key, opts) {
  try {
    const windowMs = opts.windowMs ?? 60_000;
    const max = opts.max ?? 20;
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;
    const allowed = entry.count <= max;
    return {
      allowed,
      remaining: Math.max(0, max - entry.count),
      retryAfterMs: Math.max(0, entry.resetAt - now),
    };
  } catch {
    return { allowed: true, remaining: 0, retryAfterMs: 0 };
  }
}

/**
 * @param {{
 *   windowMs?: number,
 *   max?: number,
 *   keyFn?: (req: import('express').Request) => string,
 *   failClosed?: boolean,
 *   message?: string,
 * }} opts
 */
export function rateLimitMiddleware(opts = {}) {
  const windowMs = opts.windowMs ?? 15 * 60 * 1000;
  const max = opts.max ?? 30;
  const failClosed = opts.failClosed === true;
  const message = opts.message ?? 'Too many requests';

  return function rateLimit(req, res, next) {
    try {
      const key = opts.keyFn ? opts.keyFn(req) : `${req.ip || 'unknown'}:${req.path}`;
      const result = checkRateLimit(key, { windowMs, max });
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      if (!result.allowed) {
        res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
        return res.status(429).json({ error: message });
      }
      return next();
    } catch {
      if (failClosed) {
        return res.status(503).json({ error: 'Rate limiter unavailable' });
      }
      return next();
    }
  };
}

export function resetRateLimitBucketsForTests() {
  buckets.clear();
}
