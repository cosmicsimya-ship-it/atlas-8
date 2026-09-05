/**
 * Disagreement Analysis (P0 intelligence foundation, Part E).
 *
 * Categorizes why the legacy (real, live) routing outcome and the Shadow
 * Arbiter's proposal differ, so ATLAS LAB traces are inspectable rather
 * than just "they disagreed." Pure classification — no side effects, and
 * it never decides which side was "right"; that judgment is the eval
 * corpus's job (scripts/test-intelligence-corpus.mjs), not this module's.
 */

import { DOMAIN_ENGINE } from './shadow-arbiter.js';

export const DISAGREEMENT_VERSION = 'atlas-disagreement-v1';

export const DISAGREEMENT_CATEGORIES = /** @type {const} */ ([
  'stale-domain-overreach',
  'explicit-signal-missed',
  'false-positive-specialized-domain',
  'referent-continuation',
  'ambiguous-low-confidence',
  'engine-selection-disagreement',
  'topic-shift-disagreement',
]);

const SPECIALIZED_DOMAINS = new Set([
  'tarot',
  'dream',
  'ebced',
  'astrology',
  'quran',
  'numerology',
  'symbol',
  'choice',
]);

/**
 * A candidate is "stale-only" when every evidence tag backing it traces
 * back to symbolic-context's own persisted/secondary domain reading (no
 * current-message detector independently supports it).
 * @param {{domain:string, score:number, evidence:string[]}|undefined} candidate
 */
function isStaleOnlyCandidate(candidate) {
  if (!candidate) return false;
  return candidate.evidence.every(
    (e) => e === 'symbolic_context_primary' || e === 'symbolic_context_secondary',
  );
}

/**
 * @param {{
 *   legacyDomain: string|null,
 *   legacyEngine?: string|null,
 *   legacyTopicShift?: boolean|null,
 *   shadow: ReturnType<typeof import('./shadow-arbiter.js').runShadowArbiter>|null,
 * }} input
 * @returns {typeof DISAGREEMENT_CATEGORIES[number]|null} null = no disagreement worth flagging
 */
export function classifyDisagreement({ legacyDomain, legacyEngine, legacyTopicShift, shadow }) {
  if (!shadow) return null;
  const normLegacy = legacyDomain || null;
  const normShadow = shadow.selectedDomain || null;

  const domainAgreement = normLegacy === normShadow;
  const expectedEngine = normShadow ? DOMAIN_ENGINE[normShadow] || null : null;
  const engineAgreement = !legacyEngine || !expectedEngine || legacyEngine === expectedEngine;

  if (domainAgreement && engineAgreement) {
    if (typeof legacyTopicShift === 'boolean' && legacyTopicShift !== shadow.topicShiftDetected) {
      return 'topic-shift-disagreement';
    }
    return null;
  }

  if (domainAgreement && !engineAgreement) return 'engine-selection-disagreement';

  // Shadow recommended asking, legacy just picked one silently.
  if (shadow.action === 'clarify') return 'ambiguous-low-confidence';

  // Legacy specialized into a domain the shadow gate declined to route to.
  if (normLegacy && SPECIALIZED_DOMAINS.has(normLegacy) && shadow.action !== 'route') {
    const legacyCandidate = (shadow.candidateDomains || []).find((c) => c.domain === normLegacy);
    if (isStaleOnlyCandidate(legacyCandidate)) return 'stale-domain-overreach';
    return 'false-positive-specialized-domain';
  }

  // Shadow found a confident specialized route legacy didn't take.
  if (normShadow && SPECIALIZED_DOMAINS.has(normShadow) && shadow.action === 'route') {
    if (shadow.reason === 'active_operation_continuation') return 'referent-continuation';
    return 'explicit-signal-missed';
  }

  return 'ambiguous-low-confidence';
}
