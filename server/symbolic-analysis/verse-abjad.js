/**
 * Verse Ebced — deterministic Abjad total over Qur'an verse text.
 *
 * This module does NOT own, fetch, or embed any Qur'an text. It is a thin
 * consumer of the existing `server/quran-verse-lookup/` module's
 * VerseRetrievalResult shape (see retrieve.js#VerseRetrievalResult) and
 * MUST NOT be used to attach a verse identity to text that source hasn't
 * verified — that's the exact failure mode Phase 8 of the Ebced engine spec
 * calls out: never claim "this is verse X" unless the verification layer
 * confirms it.
 *
 * Reverse-engineered algorithm (Ayet Hesaplama! in EBCED HESAPLAMA
 * TABLOSU.xlsx — see docs/ebced/PHASE1-PHASE2-WORKBOOK-DISCOVERY.md §2.6):
 * find a verse whose own Arabic-text Abjad sum exactly equals a target
 * total (typically a person's name-Ebced total). That "find the governing
 * verse for a target value" reverse-search is NOT implemented here — it
 * needs a per-verse precomputed value index across all 6236 ayat, which
 * `quran-verse-lookup` does not currently expose (it looks up by
 * surah:ayah reference, not by value). Documented as a Phase 20 integration
 * gap, not guessed at.
 */

import { calculateAbjad, ABJAD_KABIR_CLASSICAL_V1 } from './calculate-abjad.js';

export const VERSE_ABJAD_METHODOLOGY_ID = 'ebced-verse-abjad-v1';

export const VERSE_ABJAD_ERROR_CODES = Object.freeze({
  UNVERIFIED_SOURCE: 'VERSE_ABJAD_UNVERIFIED_SOURCE',
  NO_ARABIC_TEXT: 'VERSE_ABJAD_NO_ARABIC_TEXT',
  CALCULATION_FAILED: 'VERSE_ABJAD_CALCULATION_FAILED',
});

/**
 * @typedef {{
 *   ok: boolean,
 *   verified: boolean,
 *   verseKey: string|null,
 *   surahNumber: number|null,
 *   ayahNumber: number|null,
 *   total: number|null,
 *   letters: Array<{letter: string, value: number}>,
 *   methodologyId: string,
 *   errorCode: string|null,
 * }} VerseAbjadResult
 */

/**
 * @param {import('../quran-verse-lookup/retrieve.js').VerseRetrievalResult} verseResult
 *   Output of retrieveVerifiedVerse() — passed through unmodified by the
 *   caller. This function refuses to calculate unless verified === true and
 *   arabic is a non-empty string.
 * @returns {VerseAbjadResult}
 */
export function calculateVerseAbjad(verseResult) {
  const verified = Boolean(verseResult?.verified);
  const arabic = verseResult?.arabic ? String(verseResult.arabic) : null;

  if (!verified || !arabic) {
    return {
      ok: false,
      verified,
      verseKey: verseResult?.verse_key ?? null,
      surahNumber: verseResult?.surah_number ?? null,
      ayahNumber: verseResult?.ayah_number ?? null,
      total: null,
      letters: [],
      methodologyId: VERSE_ABJAD_METHODOLOGY_ID,
      errorCode: VERSE_ABJAD_ERROR_CODES.UNVERIFIED_SOURCE,
    };
  }

  const calc = calculateAbjad(arabic, ABJAD_KABIR_CLASSICAL_V1);
  if (!calc.ok) {
    return {
      ok: false,
      verified: true,
      verseKey: verseResult.verse_key ?? null,
      surahNumber: verseResult.surah_number ?? null,
      ayahNumber: verseResult.ayah_number ?? null,
      total: null,
      letters: [],
      methodologyId: VERSE_ABJAD_METHODOLOGY_ID,
      errorCode: VERSE_ABJAD_ERROR_CODES.CALCULATION_FAILED,
    };
  }

  return {
    ok: true,
    verified: true,
    verseKey: verseResult.verse_key ?? null,
    surahNumber: verseResult.surah_number ?? null,
    ayahNumber: verseResult.ayah_number ?? null,
    total: calc.total,
    letters: calc.letters,
    methodologyId: VERSE_ABJAD_METHODOLOGY_ID,
    errorCode: null,
  };
}

/**
 * Calculate Abjad over arbitrary Arabic text with NO verse-identity claim —
 * for text the caller supplies directly (not sourced from the Qur'an lookup
 * layer). The result carries no surah/ayah attribution; callers must not
 * describe it as "verse X" or as verified Qur'an text.
 *
 * @param {string} arabicText
 * @returns {VerseAbjadResult}
 */
export function calculateArabicTextAbjad(arabicText) {
  if (!String(arabicText || '').trim()) {
    return {
      ok: false,
      verified: false,
      verseKey: null,
      surahNumber: null,
      ayahNumber: null,
      total: null,
      letters: [],
      methodologyId: VERSE_ABJAD_METHODOLOGY_ID,
      errorCode: VERSE_ABJAD_ERROR_CODES.NO_ARABIC_TEXT,
    };
  }
  const calc = calculateAbjad(arabicText, ABJAD_KABIR_CLASSICAL_V1);
  return {
    ok: calc.ok,
    verified: false,
    verseKey: null,
    surahNumber: null,
    ayahNumber: null,
    total: calc.ok ? calc.total : null,
    letters: calc.ok ? calc.letters : [],
    methodologyId: VERSE_ABJAD_METHODOLOGY_ID,
    errorCode: calc.ok ? null : VERSE_ABJAD_ERROR_CODES.CALCULATION_FAILED,
  };
}
