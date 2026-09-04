export {
  SYMBOLIC_ANALYSIS_VERSION,
  SYMBOLIC_LAYER_IDS,
  USER_SECTION_IDS,
  USER_SECTION_TITLES,
  makeLayerOutcome,
  makeUserSection,
} from './schema.js';

export {
  INPUT_CONTRACT,
  LAYER_READINESS,
  LAYER_REQUIREMENTS,
  PHOTO_CAPABILITY,
  resolveCapabilities,
  resolveConsents,
} from './capability.js';

export { buildSymbolicAnalysis, __setClassicalAbjadShadowTestHooks } from './orchestrator.js';
export { runEbcedLayer } from './layers/ebced-runner.js';
export { runEsmaLayer } from './layers/esma-runner.js';
export { scanSymbolicCertainty, sanitizeSymbolicProse } from './safety.js';
export {
  ATLAS_LATIN_MOTIF_METHODOLOGY,
  ATLAS_LATIN_MOTIF_METHODOLOGY_V1,
  CLASSICAL_ABJAD_METHODOLOGY,
  isSymbolicMetadataV2Enabled,
  isClassicalAbjadV1Enabled,
  isClassicalAbjadShadowEnabled,
  getClassicalAbjadFlagMode,
} from './methodology-ids.js';
export { buildLatinMotifCharacterTrace } from './methodology-metadata.js';
export {
  runClassicalAbjad,
  runClassicalAbjadLayer,
  tokenizeClassicalSpelling,
  buildClassicalShadowSummary,
  resolveClassicalShadowLetterCount,
  CLASSICAL_ERROR_CODES,
} from './layers/classical-abjad-runner.js';

export {
  calculateAbjad,
  formatAbjadBreakdown,
  ABJAD_KABIR_CLASSICAL_V1,
} from './calculate-abjad.js';

export {
  resolveArabicSpelling,
  extractArabicSpans,
  hasArabicLetters,
} from './resolve-arabic-spelling.js';

export {
  findEsmaMatches,
  verifyEsmaValueClaim,
  reduceToDigit,
  ESMA_MATCH_TYPES,
  ESMA_MATCH_TYPE_LABELS,
  ESMA_MATCH_METHODOLOGY,
} from './esma-abjad-match.js';

export {
  ESMA_ABJAD_CATALOG,
  ESMA_ABJAD_CATALOG_VERSION,
  lookupEsmaAbjadEntry,
} from './data/esma-abjad-catalog.js';

export {
  ARABIC_NAME_SPELLINGS,
  lookupNameSpelling,
  classifyArabicNameVariant,
} from './data/arabic-name-spellings.js';

export { classifyArabicText, CLASSIFICATION_METHODOLOGY_ID } from './classifications.js';
export {
  LETTER_CLASSIFICATIONS,
  HAMZA_CLASSIFICATION,
  LETTER_CLASSIFICATION_SOURCE,
} from './data/letter-classifications.js';

export {
  calculateCompatibility as calculateNamePairCompatibility,
  COMPATIBILITY_METHODOLOGY_ID,
  COMPATIBILITY_ERROR_CODES,
} from './compatibility.js';

export {
  calculateVerseAbjad,
  calculateArabicTextAbjad,
  VERSE_ABJAD_METHODOLOGY_ID,
  VERSE_ABJAD_ERROR_CODES,
} from './verse-abjad.js';

/**
 * atlas-ebced-v1 — the stable public API surface. Prefer importing from
 * here over any of the lower-level modules above when building a new
 * caller (chat routing, admin tools, tests) — see atlas-ebced-v1.js for
 * why this composition exists instead of a second engine.
 */
export * as atlasEbced from './atlas-ebced-v1.js';
