// ═══════════════════════════════════════════════════════════════════════
// Atlas Analytics — client helper for POST /api/analytics/event.
//
// Most events (login, signup, google_login, message_sent,
// response_generated, quran_lookup, dream_interpretation,
// feedback_submitted, thumbs_up, thumbs_down) are tracked server-side,
// where identity and outcome are already known first-hand. This client
// helper covers only page-view / interaction events the server cannot
// observe on its own (prime_viewed, pricing_viewed).
//
// Fire-and-forget by design: analytics must never block or break the UI.
// No PII, no message content is ever sent from here.
// ═══════════════════════════════════════════════════════════════════════

import { apiRequest } from './api-client';

export type AnalyticsEventName = 'prime_viewed' | 'pricing_viewed';

export function trackEvent(name: AnalyticsEventName, props?: Record<string, unknown>): void {
  apiRequest('/api/analytics/event', {
    method: 'POST',
    body: JSON.stringify({ name, props }),
  }).catch(() => {
    /* best-effort — never surface analytics failures to the user */
  });
}
