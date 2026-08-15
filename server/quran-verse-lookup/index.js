/**
 * Quran verse lookup — zero-hallucination gate.
 * Verse text is never produced by the LLM.
 */

export {
  detectQuranVerseLookupIntent,
  isQuranContextActive,
  buildNoSpontaneousQuranDirective,
  buildQuranFailClosedDirective,
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
  shouldShortCircuitQuranVerseLookup,
  buildQuranVerseLookupReply,
  MSG_SOURCE_UNAVAILABLE,
  MSG_INVALID_AYAH,
  MSG_INVALID_SURAH,
  MSG_UNPARSEABLE,
  MSG_TIMEOUT,
  MSG_MALFORMED,
} from './reply.js';
