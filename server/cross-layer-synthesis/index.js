/**
 * Cross-Layer Synthesis Engine — public API.
 *
 * Deterministic, explainable synthesis across independent analysis layers.
 * Does not rewrite daily-analysis / astrology / numerology engines.
 * Does not invent Quran text. Does not write Persistent Memory directly.
 */

export {
  CROSS_LAYER_SYNTHESIS_VERSION,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_LABELS_TR,
  makeNormalizedLayer,
  validateNormalizedLayer,
} from './schema.js';

export {
  fromDailyLayerResult,
  fromSymbolicFinding,
  ensureNormalizedLayer,
} from './normalize.js';

export {
  SURAH_AYAH_COUNTS,
  validateVerseReference,
  parseVerseRef,
  buildQuranLayer,
} from './quran-safety.js';

export {
  classifyPairRelationship,
  classifyAllPairs,
} from './relationship.js';

export {
  scanCertaintyLanguage,
  sanitizeCertaintyLanguage,
  evaluateSynthesisClaim,
} from './certainty-filter.js';

export {
  evaluateFaithSafety,
  softenFearLanguage,
} from './safety.js';

export {
  analyzeUserSynthesisExample,
  recordUserSynthesisExample,
  getSessionSynthesisHints,
  clearSessionSynthesisExamples,
  inferRelationshipTypeFromExample,
  _resetAllSessionExamplesForTests,
} from './user-example.js';

export {
  composeSynthesis,
  formatSynthesisProse,
  exampleSafeSynthesisSentence,
} from './composer.js';

export { extractThemeIds, THEME_TOKENS } from './theme-lexicon.js';

export {
  MESSAGE_SYNTHESIS_BRIDGE_VERSION,
  detectCrossLayerSynthesisIntent,
  extractVerseReferences,
  collectSynthesisLayers,
  buildSynthesisPromptBlock,
  runMessageCrossLayerSynthesis,
  guardSynthesisReply,
  validateMessageVerseRef,
} from './message-integration.js';

import { composeSynthesis } from './composer.js';
import { buildQuranLayer } from './quran-safety.js';
import { fromSymbolicFinding, fromDailyLayerResult, ensureNormalizedLayer } from './normalize.js';
import { evaluateSynthesisClaim } from './certainty-filter.js';

/**
 * High-level entry: normalize inputs and compose synthesis.
 * @param {{
 *   layers?: unknown[],
 *   userMessage?: string,
 *   sessionId?: string,
 *   userAskedToCombine?: boolean,
 * }} input
 */
export function synthesizeLayers(input) {
  const layers = (input?.layers ?? []).map(ensureNormalizedLayer);
  return composeSynthesis({
    layers,
    userMessage: input?.userMessage,
    sessionId: input?.sessionId,
    userAskedToCombine: Boolean(input?.userAskedToCombine),
  });
}

/**
 * Reject unsafe free-text claims before they enter a reply.
 * @param {string} claim
 */
export function rejectUnsafeSynthesisClaim(claim) {
  return evaluateSynthesisClaim(claim);
}

export const adapters = {
  buildQuranLayer,
  fromSymbolicFinding,
  fromDailyLayerResult,
};
