/**
 * Output-side Qur'an citation verification.
 *
 * Runs on the FINAL generated reply, after the model has already produced
 * it — the model never decides whether its own citation is valid. Every
 * explicit surah:ayah reference found in the text is checked against the
 * same deterministic surah/ayah bounds table the verse-lookup parser uses
 * (`validateVerseReference`, backed by the static SURAH_AYAH_COUNTS table).
 * That check has zero network/env dependency, so this can never fail-open
 * just because a remote verse-text store is unconfigured, and it never
 * fails closed on a correct citation just because that store is offline.
 *
 * This is structural existence verification only ("does surah:ayah exist"),
 * not semantic content verification ("does this verse actually say what the
 * model claims"). Catching the latter would require the verified verse-text
 * store to be enabled and comparing meaning, which is a larger, separate
 * layer — out of scope for this fail-closed gate.
 */

import { resolveSurahNumberByName } from './surah-map.js';
import { validateVerseReference } from '../cross-layer-synthesis/quran-safety.js';

const QURAN_CONTEXT_CUE = /(kur[’'`]?an|kuran|\bâyet\b|\bayet\b|\bsûre\b|\bsure\b|\bmeal\b|\btefsir\b)/i;

/**
 * Named surah + "N:N" / "N/N", e.g. "Fâtır 35:6", "Bakara 2:255",
 * "Enfal suresi 8:8". The surah is resolved from the NAME (authoritative);
 * the number immediately before the name is not trusted on its own.
 */
const NAMED_CITATION_RE =
  /([A-Za-zÂÎÛÔÊâîûôêĞğÜüŞşİıÖöÇç'’‘]{2,24})[\s,]+(?:s[uû]resi\s+)?(\d{1,3})\s*[:\/]\s*(\d{1,3})\b/gu;

/**
 * Bare "N:N" — only counted as a citation candidate when the surrounding
 * reply already carries a Qur'an-context cue word elsewhere. Without that
 * gate, a clock time or unrelated ratio in normal prose would false-positive.
 */
const BARE_CITATION_RE = /\b(\d{1,3})\s*:\s*(\d{1,3})\b/g;

/**
 * @typedef {{
 *   raw: string,
 *   surahNumber: number,
 *   ayahNumber: number,
 *   index: number,
 *   length: number,
 *   ok: boolean,
 *   verseKey: string|null,
 *   error: string|null,
 * }} CitationCandidate
 */

/**
 * @param {string} text
 * @returns {CitationCandidate[]}
 */
export function extractExplicitQuranCitations(text) {
  const source = String(text ?? '');
  if (!source) return [];

  /** @type {CitationCandidate[]} */
  const found = [];
  /** @type {[number, number][]} */
  const claimedSpans = [];

  for (const m of source.matchAll(NAMED_CITATION_RE)) {
    const raw = m[0];
    const namePart = m[1];
    const ayahDigits = m[3];
    const surahNumber = resolveSurahNumberByName(namePart);
    if (surahNumber == null) continue;
    const ayahNumber = Number(ayahDigits);
    const validation = validateVerseReference(surahNumber, ayahNumber);
    const start = m.index ?? 0;
    found.push({
      raw,
      surahNumber,
      ayahNumber,
      index: start,
      length: raw.length,
      ok: validation.ok,
      verseKey: validation.verseKey,
      error: validation.error,
    });
    claimedSpans.push([start, start + raw.length]);
  }

  if (QURAN_CONTEXT_CUE.test(source)) {
    for (const m of source.matchAll(BARE_CITATION_RE)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      const overlapsNamedMatch = claimedSpans.some(([s, e]) => start < e && end > s);
      if (overlapsNamedMatch) continue;
      const surahNumber = Number(m[1]);
      const ayahNumber = Number(m[2]);
      const validation = validateVerseReference(surahNumber, ayahNumber);
      found.push({
        raw: m[0],
        surahNumber,
        ayahNumber,
        index: start,
        length: m[0].length,
        ok: validation.ok,
        verseKey: validation.verseKey,
        error: validation.error,
      });
    }
  }

  return found;
}

export const CITATION_UNVERIFIED_FALLBACK =
  'Verdiğim ayet referansını güvenilir biçimde doğrulayamadım, bu yüzden paylaşmıyorum. ' +
  'Sure adını ve numarasını belirtirsen doğrulanmış kaynaktan tekrar kontrol ederim.';

/**
 * Verify every explicit Qur'an citation already present in a generated
 * reply. Fail closed on the whole reply if any citation cannot be verified
 * — the model's own confidence in its citation is never the deciding
 * factor. Channel-independent: called once, in the single shared
 * finalization path both web and Telegram go through.
 * @param {string} reply
 * @returns {{ ok: boolean, reply: string, citations: CitationCandidate[], invalid: CitationCandidate[] }}
 */
export function verifyQuranCitationsInReply(reply) {
  const text = String(reply ?? '');
  const citations = extractExplicitQuranCitations(text);
  const invalid = citations.filter((c) => !c.ok);
  if (!invalid.length) {
    return { ok: true, reply: text, citations, invalid: [] };
  }
  return { ok: false, reply: CITATION_UNVERIFIED_FALLBACK, citations, invalid };
}
