/**
 * Coarse knowledge-domain classifier (requirement A: determine the domain
 * BEFORE retrieval). Deterministic, keyword/pattern-based — consistent with
 * every other intent detector in this codebase (semantic-layers.js,
 * quran-verse-lookup/intent.js): no model call decides routing.
 *
 * This only classifies. It does not retrieve, verify, or answer anything —
 * see registry.js for what happens (or doesn't yet) once a domain is known.
 * Returning null is the safe default: "no confident domain match" must
 * leave the message to the existing pipeline, never force it somewhere.
 */

import { detectQuranVerseLookupIntent } from '../quran-verse-lookup/intent.js';
import { detectQuranTopicIntent } from '../quran-verse-lookup/topic-index.js';
import { wantsFreshness } from './web-search-provider.js';

/** @typedef {import('./source-policy.js').KnowledgeDomainId} KnowledgeDomainId */

const MYTHOLOGY_RE = /\bmitoloji\w*|\befsane\w*/iu;
const HERMETICISM_ALCHEMY_RE = /\bhermetizm\w*|\bhermetik\w*|\bsimya\w*|\bnigredo\b|\balbedo\b|\brubedo\b/iu;
const ESOTERICISM_RE = /\bezoterizm\w*|\bok[uü]lt\w*|\bgizli\s+[oö]ğreti\w*|\bkabala\w*/iu;
const ANCIENT_TRADITIONS_RE = /\bkadim\b|\bantik\s+gelenek\w*|\beski\s+uygarl[ıi]k\w*/iu;
/** "Mara hangi gelenekte", "X hangi dinde" — the comparative-religion grammar
 * shape from the reported Mara/Hindu-Buddhist incident, plus explicit terms. */
const COMPARATIVE_RELIGION_RE =
  /\bdinler\s+tarihi\b|\bkar[şs][ıi]la[şs]t[ıi]rmal[ıi]\s+din\w*|\bhangi\s+(?:din(?:de|in)?|gelenek(?:te|in)?)\b/iu;
/** Deliberately narrow — historical/systemic numerology-as-topic only, never
 * a personal birth-date reading request (that stays with the existing
 * numerology engine via semantic-layers.js). */
const NUMEROLOGY_SYMBOLIC_RE =
  /\bsay[ıi]\s+mistisizmi\b|\bkabala\w*\s+say[ıi]|\bpisagor\w*\s+say[ıi]/iu;
/** A factual-question shape — "nedir"/"kimdir"/"ne kadar"/"ne zaman"/"kaç".
 * Combined with wantsFreshness() (recency cue) to identify a general_web
 * query; freshness alone is too broad ("bugün" appears in all kinds of
 * unrelated casual messages, e.g. "bugün hava nasıl?", "bugün nasılsın?").
 * Deliberately does NOT fall back to a bare "?" — that alone plus "bugün"
 * would catch ordinary small talk, not just factual questions. */
const FACTUAL_QUESTION_RE = /\bne(?:dir|\s+kadar|\s+zaman)\b|\bkim(?:dir)?\b|\bkaç\b/iu;

/**
 * Ordered, most-specific-first. Qur'an is checked via the existing,
 * already-tested detectors rather than duplicating their regex logic.
 * @param {string} message
 * @returns {KnowledgeDomainId|null}
 */
export function detectKnowledgeDomain(message) {
  const text = String(message ?? '').trim();
  if (!text) return null;

  if (detectQuranVerseLookupIntent(text).active || detectQuranTopicIntent(text).active) {
    return 'quran';
  }
  if (HERMETICISM_ALCHEMY_RE.test(text)) return 'hermeticism_alchemy';
  if (ESOTERICISM_RE.test(text)) return 'esotericism';
  if (MYTHOLOGY_RE.test(text)) return 'mythology';
  if (ANCIENT_TRADITIONS_RE.test(text)) return 'ancient_traditions';
  if (COMPARATIVE_RELIGION_RE.test(text)) return 'comparative_religion';
  if (NUMEROLOGY_SYMBOLIC_RE.test(text)) return 'numerology_symbolic';
  // Checked last, and only when nothing more specific matched: a factual
  // question explicitly asking for current/recent information.
  if (wantsFreshness(text) && FACTUAL_QUESTION_RE.test(text)) return 'general_web';

  return null;
}
