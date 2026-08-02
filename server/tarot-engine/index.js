/**
 * Atlas Tarot Engine — Classic Tarot spread interpretation depth upgrade.
 * Card selection (select-cards.js) is intentionally separate from interpretation.
 */

export {
  ATLAS_CLASSIC_TAROT_METHODOLOGY,
  TAROT_ENGINE_VERSION,
  DEPTH_LEVEL,
  DEFAULT_CARD_COUNT,
} from './methodology.js';

export {
  CLASSIC_TAROT_DECK,
  getCardById,
  getCardByName,
  listDeck,
  SUIT_META,
} from './deck.js';

export {
  selectCards,
  buildSelectionSeed,
  hashSeed,
  mulberry32,
  seededShuffle,
} from './select-cards.js';

export {
  SPREAD_LAYOUTS,
  resolveSpreadKind,
  getPositionsForSpread,
  spreadKindLabel,
} from './positions.js';

export {
  interpretCardInPosition,
  numberMotif,
} from './meanings.js';

export { analyzeCombinations } from './combinations.js';
export { analyzeTarotContradictions } from './contradictions.js';
export {
  applyTarotDepthGuard,
  looksLikeCardDictionary,
  hasUncertaintyBoundary,
} from './depth-guard.js';
export {
  buildTarotReply,
  ensureUncertaintyBoundary,
  SYMBOLIC_UNCERTAINTY_LINE,
} from './reply-builder.js';

export {
  resolveTarotDepth,
  interpretSpread,
  runTarotAnalysis,
} from './orchestrator.js';

export {
  extractIntention,
  detectTarotEngineIntent,
  focusFromTarotIntent,
  TAROT_SESSION_REQUIRED_INTENTS,
} from './intent.js';

export {
  getTarotSession,
  touchTarotSession,
  clearTarotSession,
  tarotSessionKey,
  TAROT_SESSION_IDLE_MS,
  _resetAllTarotSessions,
} from './session.js';
