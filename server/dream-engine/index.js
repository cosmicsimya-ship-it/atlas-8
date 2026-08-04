/**
 * Atlas Dream Engine — multi-layer symbolic dream interpretation.
 */

export {
  ATLAS_DREAM_METHODOLOGY,
  DREAM_ENGINE_VERSION,
  DEPTH_LEVEL,
} from './methodology.js';

export {
  DREAM_SYMBOL_CORPUS,
  getSymbolById,
  listSymbols,
} from './symbols.js';

export {
  extractSymbols,
  extractEmotions,
  extractNarrative,
  extractDreamLayers,
  extractDreamNarrative,
  hasDreamNarrative,
} from './extract.js';

export { matchJungArchetypes, JUNG_ARCHETYPES } from './archetypes.js';
export { analyzeSymbolCombinations } from './combinations.js';
export { analyzeDreamContradictions } from './contradictions.js';
export { resolvePersonalContext, collectPersonalEvidence } from './personal-context.js';
export {
  interpretSymbolInContext,
  buildPsychologicalLayer,
  buildClassicalLayer,
} from './meanings.js';
export {
  applyDreamDepthGuard,
  looksLikeSymbolDictionary,
  hasUncertaintyBoundary,
} from './depth-guard.js';
export {
  buildDreamReply,
  ensureUncertaintyBoundary,
  SYMBOLIC_UNCERTAINTY_LINE,
  DREAM_CLARIFY_REPLY,
} from './reply-builder.js';

export {
  resolveDreamDepth,
  interpretDream,
  runDreamAnalysis,
} from './orchestrator.js';

export {
  detectDreamEngineIntent,
  focusFromDreamIntent,
  extractRecurringHint,
  DREAM_SESSION_REQUIRED_INTENTS,
} from './intent.js';

export {
  getDreamSession,
  touchDreamSession,
  clearDreamSession,
  dreamSessionKey,
  DREAM_SESSION_IDLE_MS,
  _resetAllDreamSessions,
} from './session.js';
