// ═══════════════════════════════════════════════════════════════════════
// Analytics tracking — ergonomic wrapper over server/analytics/store.js
// for call sites scattered across the server (auth routes, chat handler,
// feedback routes). Never throws; a tracking failure never blocks the
// real request that triggered it.
// ═══════════════════════════════════════════════════════════════════════

import { recordAnalyticsEvent, EVENT_NAMES } from './store.js';

export { EVENT_NAMES };

/**
 * @param {string} name - one of EVENT_NAMES
 * @param {{ userId?: string|null, source?: string, props?: Record<string, unknown> }} [opts]
 * @returns {{ ok: boolean, error?: string }}
 */
export function trackEvent(name, opts = {}) {
  return recordAnalyticsEvent({
    name,
    userId: opts.userId ?? null,
    source: opts.source ?? 'server',
    props: opts.props ?? {},
  });
}
