/**
 * Shadow Intent/Domain Arbiter (P0 intelligence foundation, Part C).
 *
 * Computes a single, comparable routing proposal — candidate domains,
 * scores, evidence, a confidence-gated action — WITHOUT changing what the
 * live pipeline actually does. It is wired into
 * server/atlas-message-service.js as a read-only, try/catch-wrapped call
 * (see the comment there) that writes its output onto
 * pipelineDebug.shadowArbiter for ATLAS LAB telemetry only.
 *
 * This module does not re-implement domain detection. It normalizes and
 * compares evidence that already exists, reusing the same detectors real
 * production routing calls (server/symbolic-context.js,
 * server/topic-shift.js, and the per-engine intent detectors for
 * numerology, tarot, dream, ebced/abjad, astrology, and Qur'an). Nothing
 * in this file performs a deterministic calculation, draws a tarot card,
 * or calls a model — it only asks each existing detector "would you claim
 * this message?" and scores the answers.
 *
 * SAFETY: every call here must be side-effect-free from the caller's point
 * of view. It intentionally avoids the "try*Reply"/"run*" engine-execution
 * functions (those perform real work — chart calculation, card draws,
 * verified Ebced totals) in favor of each engine's separate, lighter-weight
 * *intent* detector, several of which (detectTarotSpreadIntent,
 * detectKnowledgeDomain) are already called more than once in the real
 * pipeline today, confirming they are safe to call an additional time.
 */

import {
  resolveSymbolicContext,
  extractSymbolicReferents,
} from '../symbolic-context.js';
import {
  detectDateSignal,
  detectCorrectionSignal,
  detectExplicitDomainMentions,
} from '../topic-shift.js';
import { detectTarotSpreadIntent } from '../symbolic-synthesis.js';
import { detectDreamEngineIntent } from '../dream-engine/intent.js';
import { detectNumerologyIntent } from '../numerology-engine/intent.js';
import { detectAbjadEsmaIntent } from '../abjad-verification.js';
import { detectAstrologyFlowIntent } from '../atlas-astrology-flow.js';
import { detectQuranVerseLookupIntent } from '../quran-verse-lookup/intent.js';
import { detectQuranTopicIntent } from '../quran-verse-lookup/topic-index.js';
import {
  applyConfidenceGate,
  buildTargetedClarification,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from './confidence-gate.js';

export const SHADOW_ARBITER_VERSION = 'atlas-shadow-arbiter-v1';

const SUMMARY_MAX_CHARS = 200;

function truncate(text, max = SUMMARY_MAX_CHARS) {
  const str = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!str) return null;
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

/**
 * Which deterministic engine a given arbiter-level domain maps to. Purely
 * descriptive/telemetry — the shadow arbiter never invokes an engine.
 */
export const DOMAIN_ENGINE = {
  tarot: 'tarot-engine',
  dream: 'dream-engine',
  numerology: 'numerology-engine',
  ebced: 'abjad-verification',
  astrology: 'atlas-astrology-flow',
  quran: 'quran-verse-lookup',
  date: 'daily-synthesis',
  symbol: 'symbolic-context',
  choice: 'symbolic-context',
  identity: 'self-profile-resolver',
};

/** Maps symbolic-context.js's internal domain vocabulary onto the arbiter's. */
function mapSymbolicDomain(symbolicDomainId, evidenceKeys) {
  if (!symbolicDomainId) return null;
  if (symbolicDomainId === 'date_pattern') {
    // date_pattern is overloaded in symbolic-context.js: it fires both for
    // a bare date/"bugün" ask AND for a repeating-number/numerology-digit
    // pattern. Disambiguate using which evidence actually fired instead of
    // inventing a third parallel detector.
    const dateDriven = evidenceKeys.some((e) => e === 'message_date_signal');
    return dateDriven ? 'date' : 'numerology';
  }
  if (symbolicDomainId === 'person') return 'identity';
  return symbolicDomainId; // tarot, dream, symbol, choice, astrology, quran, pattern->handled above
}

/**
 * Merge a new (domain, score, evidenceTag) observation into a candidate
 * map, keeping the max score per domain and the union of evidence tags —
 * several independent detectors can support the same domain (e.g.
 * symbolic-context's own astrology cue AND detectAstrologyFlowIntent).
 * @param {Map<string, {domain:string, score:number, evidence:string[]}>} map
 */
function addCandidate(map, domain, score, evidenceTag) {
  if (!domain || !Number.isFinite(score) || score <= 0) return;
  const existing = map.get(domain);
  if (!existing) {
    map.set(domain, { domain, score, evidence: [evidenceTag] });
    return;
  }
  existing.score = Math.max(existing.score, score);
  if (!existing.evidence.includes(evidenceTag)) existing.evidence.push(evidenceTag);
}

const NUMEROLOGY_INTENT_CONFIDENCE = {
  full_analysis: 0.85,
  ask_birth_date: 0.55,
  followup_deeper: 0.7,
  followup_cycles: 0.7,
  followup_master: 0.7,
  followup_karmic: 0.7,
  followup_period: 0.7,
  followup_explore: 0.65,
};

const ABJAD_KIND_CONFIDENCE = {
  calculate: 0.92,
  esma_match: 0.88,
  user_value_claim: 0.85,
};

const DREAM_INTENT_CONFIDENCE_DEFAULT = 0.8;
const TAROT_INTENT_CONFIDENCE_DEFAULT = 0.85;
const ASTROLOGY_FLOW_CONFIDENCE_DEFAULT = 0.8;
const QURAN_VERSE_CONFIDENCE = 0.95;
const QURAN_TOPIC_CONFIDENCE = 0.75;

/**
 * @param {{
 *   message: string,
 *   history?: { role?: string, content?: string }[],
 *   conversationId?: string,
 *   userId?: string|null,
 *   symbolicContext?: ReturnType<typeof resolveSymbolicContext>,
 *   threshold?: number,
 * }} input
 */
export function runShadowArbiter(input) {
  const message = String(input?.message || '').trim();
  const history = Array.isArray(input?.history) ? input.history : [];
  const conversationId = input?.conversationId || 'default';
  const userId = input?.userId ?? null;
  const threshold = Number.isFinite(input?.threshold) ? input.threshold : DEFAULT_CONFIDENCE_THRESHOLD;

  // Reuse the caller's already-computed symbolic context when available
  // (the live pipeline computes it once, right before this runs) —
  // otherwise compute it fresh (corpus/unit-test standalone use).
  const symbolicContext =
    input?.symbolicContext ||
    resolveSymbolicContext({ message, history, conversationId, userId });

  const dateSignal = detectDateSignal(message);
  const correctionSignal = detectCorrectionSignal(message);
  const explicitMentions = detectExplicitDomainMentions(message);
  const referents = extractSymbolicReferents(message);

  /** @type {Map<string, {domain:string, score:number, evidence:string[]}>} */
  const candidates = new Map();

  // ── Reuse symbolic-context's own primary/secondary domain + confidence ──
  const mappedPrimary = mapSymbolicDomain(symbolicContext.selectedDomain, symbolicContext.evidence || []);
  if (mappedPrimary) {
    addCandidate(candidates, mappedPrimary, symbolicContext.selectionConfidence, 'symbolic_context_primary');
  }
  for (const sec of symbolicContext.secondaryDomains || []) {
    const mapped = mapSymbolicDomain(sec, []);
    if (mapped) addCandidate(candidates, mapped, 0.35, 'symbolic_context_secondary');
  }

  // ── Independent per-engine intent probes (reused, not reimplemented) ──
  const numerologyIntent = detectNumerologyIntent(message, history, {
    sessionActive: (symbolicContext.liveSessions || []).includes('numerology'),
  });
  if (numerologyIntent.active) {
    addCandidate(
      candidates,
      'numerology',
      NUMEROLOGY_INTENT_CONFIDENCE[numerologyIntent.intent] ?? 0.6,
      'numerology_intent',
    );
  }

  const abjadIntent = detectAbjadEsmaIntent(message, history);
  if (abjadIntent.active) {
    addCandidate(candidates, 'ebced', ABJAD_KIND_CONFIDENCE[abjadIntent.kind] ?? 0.75, 'abjad_intent');
  }

  const quranVerseIntent = detectQuranVerseLookupIntent(message);
  if (quranVerseIntent.active) {
    addCandidate(candidates, 'quran', QURAN_VERSE_CONFIDENCE, 'quran_verse_intent');
  }
  const quranTopicIntent = detectQuranTopicIntent(message);
  if (quranTopicIntent.active) {
    addCandidate(candidates, 'quran', QURAN_TOPIC_CONFIDENCE, 'quran_topic_intent');
  }

  const astrologyFlowIntent = detectAstrologyFlowIntent(message, history, { conversationId });
  if (astrologyFlowIntent) {
    addCandidate(candidates, 'astrology', ASTROLOGY_FLOW_CONFIDENCE_DEFAULT, `astrology_flow:${astrologyFlowIntent}`);
  }

  const tarotSpreadIntent = detectTarotSpreadIntent(message, history);
  if (tarotSpreadIntent.active) {
    addCandidate(candidates, 'tarot', TAROT_INTENT_CONFIDENCE_DEFAULT, `tarot_spread_intent:${tarotSpreadIntent.intent}`);
  }

  const dreamEngineIntent = detectDreamEngineIntent(message, history, {
    sessionActive: (symbolicContext.liveSessions || []).includes('dream'),
  });
  if (dreamEngineIntent.active) {
    addCandidate(candidates, 'dream', DREAM_INTENT_CONFIDENCE_DEFAULT, `dream_intent:${dreamEngineIntent.intent}`);
  }

  // A bare date/"bugün" ask with no other domain cue — same signal
  // symbolic-context.js's RULE 5 already uses to veto stale-domain
  // inheritance; surfaced here as its own scored candidate so the gate can
  // compare it directly against a stale symbolic candidate.
  if (dateSignal.active && !explicitMentions.length) {
    addCandidate(candidates, 'date', 0.9, 'bare_date_signal');
  }

  // ── C3.6 — stale-domain penalty ──
  // A candidate whose ONLY evidence is inherited/persisted state (no
  // current-message cue, no resolved referent this turn) is exactly the
  // "stale-domain-overreach" failure class from the gap audit. Halve such
  // a candidate's score rather than let it compete at face value with a
  // fresh current-message signal — current-message evidence must dominate
  // stale context (C3, task spec).
  const STALE_ONLY_EVIDENCE = new Set(['symbolic_context_secondary']);
  const PERSISTENCE_EVIDENCE_REASONS = new Set([
    'freshest_session',
    'stored_domain',
    'soft_freshest',
    'tarot_history',
    'dream_history',
    'pattern_history',
    'astrology_history',
  ]);
  if (
    mappedPrimary &&
    PERSISTENCE_EVIDENCE_REASONS.has(symbolicContext.domainPersistenceReason) &&
    !referents.length &&
    !correctionSignal.active
  ) {
    const c = candidates.get(mappedPrimary);
    if (c && c.evidence.every((e) => e === 'symbolic_context_primary' || STALE_ONLY_EVIDENCE.has(e))) {
      c.score = Math.round(c.score * 0.5 * 100) / 100;
    }
  }

  // ── C1 self-correction: never let the domain the user just rejected win ──
  if (correctionSignal.active && symbolicContext.domainRejected) {
    const rejected = mapSymbolicDomain(symbolicContext.domainRejected, []);
    if (rejected) candidates.delete(rejected);
  }

  const candidateDomains = [...candidates.values()].sort((a, b) => b.score - a.score);

  // ── A3 — explicit current-message domain request overrides gating ──
  // Reuse symbolic-context's own explicitSwitch flag (same EXPLICIT_DOMAIN_SWITCH
  // signal already used to decide stale-domain persistence) rather than a
  // second keyword scan; only trust it when exactly one domain is named,
  // so a message naming two domains still goes through normal scoring.
  let explicitDomain = null;
  if (symbolicContext.currentMessageSignals?.explicitSwitch && explicitMentions.length === 1) {
    const KEYWORD_TO_ARBITER_DOMAIN = {
      tarot: 'tarot',
      ebced: 'ebced',
      numerology: 'numerology',
      astrology: 'astrology',
      quran: 'quran',
      dream: 'dream',
    };
    explicitDomain = KEYWORD_TO_ARBITER_DOMAIN[explicitMentions[0]] || null;
  }

  // ── A2 — active-operation continuation ──
  const activeOperationDomain = !symbolicContext.topicShiftDetected
    ? mapSymbolicDomain(symbolicContext.previousDomain, []) || (abjadIntent.active ? 'ebced' : null)
    : null;
  const hasResolvedReferent = referents.length > 0 || abjadIntent.kind === 'esma_match';

  const gate = applyConfidenceGate(candidateDomains, {
    threshold,
    explicitDomain,
    activeOperationDomain,
    hasResolvedReferent,
  });

  const clarificationPrompt = gate.clarificationRecommended
    ? buildTargetedClarification(gate.clarificationCandidates)
    : null;

  return {
    version: SHADOW_ARBITER_VERSION,
    currentMessage: truncate(message),
    candidateDomains,
    selectedDomain: gate.selectedDomain,
    selectionConfidence: gate.selectionConfidence,
    threshold: gate.threshold,
    action: gate.action,
    reason: gate.reason,
    proposedEngine: gate.selectedDomain ? DOMAIN_ENGINE[gate.selectedDomain] || null : null,
    topicShiftDetected: Boolean(symbolicContext.topicShiftDetected || (dateSignal.active && activeOperationDomain && activeOperationDomain !== 'date')),
    clarificationRecommended: gate.clarificationRecommended,
    clarificationCandidates: gate.clarificationCandidates,
    clarificationPrompt,
  };
}
