/**
 * Quran verse lookup — zero-hallucination gate.
 * Verse text is never produced by the LLM.
 */

export {
  detectQuranVerseLookupIntent,
  isQuranContextActive,
  buildNoSpontaneousQuranDirective,
  buildQuranFailClosedDirective,
  buildGeneralScriptureCitationGuard,
  selectScriptureCitationDirective,
} from './intent.js';
export {
  parseQuranVerseLookup,
  describeBoundaryError,
} from './parse.js';
export {
  SURAH_NAMES_TR,
  getSurahName,
  getAyahCount,
  resolveSurahNumberByName,
  normalizeSurahToken,
  CANONICAL_SURAH_COUNT,
} from './surah-map.js';
export {
  QURAN_VERSE_LOOKUP_VERSION,
  QURAN_VERSE_TEXT_ENABLED,
  retrieveVerifiedVerse,
} from './retrieve.js';
export {
  tryDeterministicQuranVerseReply,
  tryQuranTopicReply,
  shouldShortCircuitQuranVerseLookup,
  buildQuranVerseLookupReply,
  MSG_SOURCE_UNAVAILABLE,
  MSG_INVALID_AYAH,
  MSG_INVALID_SURAH,
  MSG_UNPARSEABLE,
  MSG_TIMEOUT,
  MSG_MALFORMED,
  MSG_TOPIC_SOURCE_UNAVAILABLE,
  MSG_TOPIC_UNSUPPORTED,
} from './reply.js';
export {
  createVerseStore,
  createRemoteVerseStore,
  createAlQuranCloudVerseStore,
  composeVerseStore,
  loadQuranStoreConfig,
} from './store/index.js';

export {
  wantsQuranExplanation,
  buildGroundedQuranExplanationPrompt,
  sanitizeGroundedQuranExplanation,
  resolveContextualQuranReference,
} from './explanation.js';

export {
  detectQuranTopicIntent,
  TOPIC_VERSE_INDEX,
  TOPIC_DISPLAY_LABEL,
} from './topic-index.js';

export {
  extractExplicitQuranCitations,
  verifyQuranCitationsInReply,
  CITATION_UNVERIFIED_FALLBACK,
} from './citation-verify.js';

export {
  verifyQuranCitationSemantics,
  verifySemanticRelevance,
  findClaimSentenceForCitation,
  extractContentKeywords,
  computeKeywordOverlap,
  SEMANTIC_SUPPORT_UNVERIFIED_FALLBACK,
} from './semantic-verify.js';
