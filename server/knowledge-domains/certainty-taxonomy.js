/**
 * Certainty taxonomy bridge — reconciles two independent claim-type
 * vocabularies that grew separately in this codebase:
 *
 *  - domain-core's `certainty` (schemas.js CERTAINTY_LEVELS): 4 coarse
 *    values, used by the (flagged-off-by-default) StructuredAnalysisOutput
 *    for calculation-engine domains (numerology, astrology, ...).
 *  - knowledge-domains' `FACT_LAYER_LABELS` (source-policy.js): 12
 *    fine-grained values, used live by every citation/retrieval domain
 *    (religion, mythology, history, esotericism, general web...).
 *
 * This is deliberately an ADDITIVE bridge, not a merge: neither vocabulary
 * is renamed, removed, or changed, and no existing call site is touched.
 * It exists so anything that needs to compare confidence ACROSS the two
 * subsystems (a future cross-domain contradiction checker, an admin
 * dashboard, a shared test) has one place to ask "how certain is this
 * claim, on a coarse 4-value scale" without re-deriving the mapping.
 *
 * See docs/atlas-domain-platform/SECURITY_AND_EPISTEMIC_POLICY.md §7 for
 * the full policy this implements, including why "methodological" has no
 * FACT_LAYER_LABELS counterpart (source-policy.js covers retrieval/citation
 * domains only, not deterministic-calculation domains).
 */

import { CERTAINTY_LEVELS } from '../domain-core/schemas.js';
import { FACT_LAYER_LABELS } from './source-policy.js';

/** @typedef {import('../domain-core/schemas.js').CERTAINTY_LEVELS[number]} CertaintyLevel */
/** @typedef {import('./source-policy.js').FactLayerKey} FactLayerKey */

/**
 * Every FACT_LAYER_LABELS key mapped to its coarse certainty level.
 * Adding a new fact layer to source-policy.js without adding it here is a
 * drift bug — see scripts/test-certainty-taxonomy.mjs, which fails closed
 * on any unmapped key.
 * @type {Record<FactLayerKey, CertaintyLevel>}
 */
export const FACT_LAYER_TO_CERTAINTY = Object.freeze({
  primary_text: 'factual',
  primary_source: 'factual',
  scholarly_consensus: 'factual',
  historical_doctrine: 'factual',
  web_source: 'factual',
  tradition_belief: 'interpretive',
  later_interpretation: 'interpretive',
  symbolic_interpretation: 'interpretive',
  atlas_synthesis: 'interpretive',
  modern_claim: 'speculative',
  speculative_hypothesis: 'speculative',
  disputed_uncertain: 'speculative',
});

/**
 * Coarse confidence tier per certainty level — for UI/label purposes only,
 * never a substitute for the fact-layer label itself.
 * @type {Record<CertaintyLevel, 'high'|'medium'|'low'>}
 */
export const CERTAINTY_TO_CONFIDENCE = Object.freeze({
  factual: 'high',
  methodological: 'high',
  interpretive: 'medium',
  speculative: 'low',
});

/**
 * @param {FactLayerKey} factLayer
 * @returns {CertaintyLevel|null}
 */
export function certaintyForFactLayer(factLayer) {
  return FACT_LAYER_TO_CERTAINTY[factLayer] ?? null;
}

/**
 * @param {FactLayerKey} factLayer
 * @returns {'high'|'medium'|'low'|null}
 */
export function confidenceForFactLayer(factLayer) {
  const certainty = certaintyForFactLayer(factLayer);
  return certainty ? CERTAINTY_TO_CONFIDENCE[certainty] : null;
}

/**
 * Every FACT_LAYER_LABELS key that has no entry in FACT_LAYER_TO_CERTAINTY.
 * Should always be empty — this is the drift check the acceptance-criteria
 * test runs.
 * @returns {string[]}
 */
export function getUnmappedFactLayers() {
  return Object.keys(FACT_LAYER_LABELS).filter((key) => !(key in FACT_LAYER_TO_CERTAINTY));
}

/**
 * Every FACT_LAYER_TO_CERTAINTY value that isn't a real CERTAINTY_LEVELS
 * entry. Should always be empty.
 * @returns {string[]}
 */
export function getInvalidCertaintyValues() {
  const valid = new Set(CERTAINTY_LEVELS);
  return Object.entries(FACT_LAYER_TO_CERTAINTY)
    .filter(([, certainty]) => !valid.has(certainty))
    .map(([key]) => key);
}
