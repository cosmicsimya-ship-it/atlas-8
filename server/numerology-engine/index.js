/**
 * Atlas Numerology Engine — personal birth/name chart analysis.
 * Daily calendar digit-sum remains in atlas-numerology.js (unchanged).
 */

export {
  ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY,
  NUMEROLOGY_ENGINE_VERSION,
  DEPTH_LEVEL,
  KARMIC_DEBT_NUMBERS,
  MASTER_NUMBERS,
} from './methodology.js';

export { reduceDigits, reduceWithTrace, sumDigitsOf, challengeDiff } from './reduce.js';

export {
  computeLifePath,
  computeBirthdayNumber,
  computeMonthVibration,
  computeYearVibration,
  computeLifeCycles,
  computePinnacles,
  computeChallenges,
  computePersonalYear,
  detectRepeatingMotifs,
  detectMissingVibrations,
  computeBirthNumerologyChart,
} from './birth-calculations.js';

export {
  normalizeNameForNumerology,
  computeNameNumerologyChart,
  analyzeNameBirthHarmony,
} from './name-calculations.js';

export {
  NUMBER_PROFILES,
  getNumberProfile,
  getMasterAnalysis,
  getKarmicDebtNote,
  getPersonalYearTheme,
} from './meanings.js';

export { analyzeContradictions } from './contradictions.js';
export { applyNumerologyDepthGuard } from './depth-guard.js';
export { buildNumerologyReply } from './reply-builder.js';

export {
  resolveNumerologyDepth,
  runNumerologyAnalysis,
  listAvailableLayers,
  formatVerifiedNumerologyPersonalBlock,
} from './orchestrator.js';

export {
  extractBirthDateFromMessage,
  extractNameFromMessage,
  hasNumerologyContext,
  detectNumerologyIntent,
  focusFromIntent,
} from './intent.js';

export {
  getNumerologySession,
  touchNumerologySession,
  clearNumerologySession,
  numerologySessionKey,
  NUMEROLOGY_SESSION_IDLE_MS,
  _resetAllNumerologySessions,
} from './session.js';
