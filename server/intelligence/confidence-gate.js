/**
 * Confidence Gate (P0 intelligence foundation, Part A).
 *
 * Decides what to DO with a routing confidence score — route, ask a
 * targeted clarification, or fall back to a generic/neutral answer. It
 * does not compute confidence itself: Atlas already computes real
 * confidence-like scores in several places (most notably
 * server/symbolic-context.js's EVIDENCE_CONFIDENCE table). This module is
 * deliberately a second, separate step so that score-computation and
 * gating-behavior can be reasoned about (and tested) independently.
 *
 * Pure and side-effect-free. Consumed today only by the Shadow Arbiter
 * (./shadow-arbiter.js) in shadow/test mode — see that file's header for
 * why this is not yet wired into live production routing decisions.
 */

export const CONFIDENCE_GATE_VERSION = 'atlas-confidence-gate-v1';

/** Below this, a top candidate is not confident enough to route on its own. */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.65;

// If the top two candidates are within this margin of each other, and the
// second is itself non-trivial, naming both real options beats a single
// generic "what do you mean?" ask (task spec Part A4).
const CLARIFY_MARGIN = 0.15;
const CLARIFY_SECOND_MIN = 0.2;

/** @typedef {{ domain: string, score: number, evidence?: string[] }} CandidateDomain */

/**
 * @typedef {{
 *   action: 'route'|'clarify'|'generic'|'explicit-switch',
 *   selectedDomain: string|null,
 *   selectionConfidence: number,
 *   threshold: number,
 *   clarificationRecommended: boolean,
 *   clarificationCandidates: string[],
 *   reason: string,
 * }} ConfidenceGateDecision
 */

/**
 * @param {CandidateDomain[]} candidates
 * @param {{
 *   threshold?: number,
 *   explicitDomain?: string|null,
 *   activeOperationDomain?: string|null,
 *   hasResolvedReferent?: boolean,
 * }} [opts]
 * @returns {ConfidenceGateDecision}
 */
export function applyConfidenceGate(candidates, opts = {}) {
  const threshold = Number.isFinite(opts.threshold) ? opts.threshold : DEFAULT_CONFIDENCE_THRESHOLD;
  const sorted = [...(Array.isArray(candidates) ? candidates : [])]
    .filter((c) => c && c.domain && Number.isFinite(c.score))
    .sort((a, b) => b.score - a.score);
  const top = sorted[0] || null;
  const second = sorted[1] || null;

  // A3 — an explicit user request ("Tarot aç.", "Furkan'ın ebcedini
  // hesapla.") bypasses ambiguity gating outright; intent is unambiguous
  // regardless of what the scored candidates say.
  if (opts.explicitDomain) {
    const matched = sorted.find((c) => c.domain === opts.explicitDomain);
    return {
      action: 'explicit-switch',
      selectedDomain: opts.explicitDomain,
      selectionConfidence: matched ? matched.score : 0.95,
      threshold,
      clarificationRecommended: false,
      clarificationCandidates: [],
      reason: 'explicit_domain_request',
    };
  }

  // A2 — a valid continuation of an active operation, backed by a resolved
  // referent this turn, is unambiguous even when its raw score sits under
  // threshold (e.g. "Esması?" continuing an Ebced conversation).
  if (
    opts.activeOperationDomain &&
    opts.hasResolvedReferent &&
    (!top || top.domain === opts.activeOperationDomain)
  ) {
    return {
      action: 'route',
      selectedDomain: opts.activeOperationDomain,
      selectionConfidence: top?.score ?? 0.6,
      threshold,
      clarificationRecommended: false,
      clarificationCandidates: [],
      reason: 'active_operation_continuation',
    };
  }

  if (!top || top.score <= 0) {
    return {
      action: 'generic',
      selectedDomain: null,
      selectionConfidence: 0,
      threshold,
      clarificationRecommended: false,
      clarificationCandidates: [],
      reason: 'no_candidate',
    };
  }

  if (top.score >= threshold) {
    return {
      action: 'route',
      selectedDomain: top.domain,
      selectionConfidence: top.score,
      threshold,
      clarificationRecommended: false,
      clarificationCandidates: [],
      reason: 'confident_top_candidate',
    };
  }

  // A4 — below threshold: a targeted clarification naming the real
  // competing candidates, never a generic "ne demek istediniz?" — but only
  // when a genuine second contender exists; otherwise a plain neutral
  // answer beats forcing a choice between one real and one noise candidate.
  if (second && top.score - second.score < CLARIFY_MARGIN && second.score >= CLARIFY_SECOND_MIN) {
    return {
      action: 'clarify',
      selectedDomain: null,
      selectionConfidence: top.score,
      threshold,
      clarificationRecommended: true,
      clarificationCandidates: [top.domain, second.domain],
      reason: 'ambiguous_between_candidates',
    };
  }

  return {
    action: 'generic',
    selectedDomain: null,
    selectionConfidence: top.score,
    threshold,
    clarificationRecommended: false,
    clarificationCandidates: [],
    reason: 'low_confidence_below_threshold',
  };
}

/**
 * Turkish label for each arbiter-level domain id, used to build a targeted
 * clarification (A4) that names the actual competing candidates instead of
 * asking a generic question.
 */
const DOMAIN_LABEL_TR = {
  date: 'günlük tema',
  numerology: 'numeroloji',
  tarot: 'tarot',
  dream: 'rüya yorumu',
  astrology: 'astroloji',
  ebced: 'ebced',
  quran: 'ayet açıklaması',
  identity: 'kendin hakkında bilgi',
  symbol: 'sembol yorumu',
  choice: 'seçim yorumu',
};

/**
 * @param {string[]} candidates domain ids, most confident first
 */
export function buildTargetedClarification(candidates) {
  const [a, b] = candidates || [];
  const la = a ? DOMAIN_LABEL_TR[a] || a : null;
  const lb = b ? DOMAIN_LABEL_TR[b] || b : null;
  if (la && lb) return `Bu tarih için ${la} mı, ${lb} mı bakayım?`;
  if (la) return `${la} için mi bakayım, yoksa başka bir şey mi demek istedin?`;
  return 'Hangi konuda bakmamı istersin?';
}
