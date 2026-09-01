/**
 * Semantic claim-to-verse verification — the second, narrower gate that
 * runs after structural citation verification (citation-verify.js confirms
 * the cited verse EXISTS; this confirms the cited verse is materially
 * relevant to the specific claim it's attached to).
 *
 * Deterministic-first: resolves the verified verse translation from the
 * same trusted retrieval path used everywhere else in this module
 * (retrieveVerifiedVerse / createVerseStore — network-backed, fail-closed
 * by default until an operator sets QURAN_VERSE_TEXT_ENABLED=true). No
 * generative model is ever asked to judge its own citation; the
 * "constrained comparison" step below is a fixed, non-generative
 * keyword-overlap check between the claim sentence and the verified
 * translation — never a second AI call.
 *
 * If the verse text cannot be resolved (store disabled/unavailable), or the
 * keyword overlap is empty, semantic support counts as UNVERIFIED and the
 * caller fails closed — the same posture every other verified-source
 * dependency in this codebase already takes when its source is offline.
 */

import { retrieveVerifiedVerse } from './retrieve.js';
import { createVerseStore } from './store/index.js';

const STOPWORDS_TR = new Set([
  've', 'bir', 'bu', 'şu', 'o', 'için', 'ile', 'gibi', 'çok', 'her', 'de', 'da',
  'ki', 'ise', 'ama', 'fakat', 'ancak', 'ne', 'mi', 'mı', 'mu', 'mü', 'ya', 'veya',
  'olarak', 'olan', 'olduğu', 'geçer', 'geçmektedir', 'ayetinde', 'ayeti', 'ayet',
  'ayetler', 'ayetin', 'sure', 'suresi', 'surede', 'surenin', 'kuran', 'kur’an',
  'kuranda', 'şüphesiz', 'sizin', 'siz', 'size', 'onu', 'ona', 'bunun', 'bunu',
  'göre', 'şeklinde', 'diye', 'ilgili', 'konusu', 'konuyla',
]);

/**
 * Find the sentence containing a citation's character index. Bounded by
 * '.', '!', '?', or a newline — same simple segmentation on both sides.
 * @param {string} text
 * @param {number} citationIndex
 */
export function findClaimSentenceForCitation(text, citationIndex) {
  const source = String(text ?? '');
  const before = source.slice(0, citationIndex);
  const after = source.slice(citationIndex);
  const priorBoundaries = [...before.matchAll(/[.!?\n]/g)];
  const start = priorBoundaries.length
    ? priorBoundaries[priorBoundaries.length - 1].index + 1
    : 0;
  const nextBoundary = after.match(/[.!?\n]/);
  const end = nextBoundary ? citationIndex + nextBoundary.index + 1 : source.length;
  return source.slice(start, end).trim();
}

/**
 * Fold + tokenize, dropping short/stop words — deliberately excludes
 * citation-mechanics words ("ayet", "sure", ...) so two unrelated sentences
 * don't "match" purely because both mention that they're citing something.
 * @param {string} text
 * @returns {Set<string>}
 */
export function extractContentKeywords(text) {
  const folded = String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\s]/gu, ' ');
  const words = folded.split(/\s+/).filter(Boolean);
  return new Set(words.filter((w) => w.length >= 4 && !STOPWORDS_TR.has(w)));
}

/**
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {number} count of shared keywords
 */
export function computeKeywordOverlap(a, b) {
  let count = 0;
  for (const word of a) {
    if (b.has(word)) count += 1;
  }
  return count;
}

export const SEMANTIC_SUPPORT_UNVERIFIED_FALLBACK =
  'Verdiğim ayetin bu iddiayı doğrudan desteklediğini güvenilir biçimde doğrulayamadım, ' +
  'bu yüzden bu haliyle paylaşmıyorum. Sure adını ve numarasını belirtirsen doğrulanmış ' +
  'kaynaktan tekrar kontrol ederim.';

/**
 * @param {{ verseKey: string, surahNumber: number, ayahNumber: number, index: number }} citation
 * @param {string} replyText full reply the citation was found in
 * @param {{ verseStore?: object|null, allowTestStore?: boolean }} [opts]
 * @returns {Promise<{ supported: boolean, reason: string|null, claimSentence: string, translation: string|null, overlap: number }>}
 */
export async function verifySemanticRelevance(citation, replyText, opts = {}) {
  const claimSentence = findClaimSentenceForCitation(replyText, citation.index);
  const verseStore = opts.verseStore !== undefined ? opts.verseStore : createVerseStore();

  const parsed = {
    parse_ok: true,
    validation_ok: true,
    verse_key: citation.verseKey,
    surah_number: citation.surahNumber,
    ayah_number: citation.ayahNumber,
    surah_name: null,
    error: null,
  };
  const retrieval = await retrieveVerifiedVerse(parsed, verseStore, {
    allowTestStore: opts.allowTestStore,
  });

  if (!retrieval.ok || !retrieval.translation) {
    return {
      supported: false,
      reason: 'verse_text_unavailable',
      claimSentence,
      translation: null,
      overlap: 0,
    };
  }

  const claimKeywords = extractContentKeywords(claimSentence);
  const verseKeywords = extractContentKeywords(retrieval.translation);
  const overlap = computeKeywordOverlap(claimKeywords, verseKeywords);

  return {
    supported: overlap >= 1,
    reason: overlap >= 1 ? null : 'no_keyword_overlap',
    claimSentence,
    translation: retrieval.translation,
    overlap,
  };
}

/**
 * Verify every structurally-valid citation's semantic relevance to its
 * claim sentence. Fails closed on the WHOLE reply if any one citation is
 * unsupported — same conservative policy as the structural gate, and what
 * makes "multiple citations, only one unsupported" block the full answer
 * rather than silently keeping the rest.
 * @param {string} reply
 * @param {Array<{ verseKey: string, surahNumber: number, ayahNumber: number, index: number, raw: string }>} citations structurally-valid citations only
 * @param {{ verseStore?: object|null, allowTestStore?: boolean }} [opts]
 */
export async function verifyQuranCitationSemantics(reply, citations, opts = {}) {
  const text = String(reply ?? '');
  const results = [];
  for (const citation of citations) {
    const verdict = await verifySemanticRelevance(citation, text, opts);
    results.push({ citation, ...verdict });
  }
  const unsupported = results.filter((r) => !r.supported);
  if (!unsupported.length) {
    return { ok: true, reply: text, results, unsupported: [] };
  }
  return { ok: false, reply: SEMANTIC_SUPPORT_UNVERIFIED_FALLBACK, results, unsupported };
}
