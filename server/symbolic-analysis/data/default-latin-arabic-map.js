/**
 * Default deterministic Latin/Turkish → Arabic transliteration, used only
 * when the user has not supplied Arabic spelling and no gazetteer whole-name
 * match exists (see docs/adr/ADR-010-DEFAULT-LATIN-ABJAD-TRANSLITERATION.md).
 *
 * This is an approximation, not a claim of the single correct Arabic
 * spelling of a name — callers must disclose that an alternate spelling
 * could change the Abjad total.
 *
 * Letter values are looked up from ARABIC_ABJAD (ebced-table.js) rather than
 * duplicated here, so classical letter values stay single-sourced.
 */

import { ARABIC_ABJAD } from './ebced-table.js';

export const DEFAULT_LATIN_TRANSLITERATION_METHOD = 'default-latin-ar-v1';

/**
 * Latin/Turkish character → Arabic letter (or short digraph) used for the
 * default transliteration. Classical Arabic has no distinct letters for a
 * few Turkish sounds (e, ç, g/ğ, p, v/w, x) — those map to the closest
 * classical letter, documented inline.
 */
const LATIN_TO_ARABIC_CHAR = Object.freeze({
  a: 'ا',
  e: 'ا', // no distinct short-e letter in classical Arabic; grouped with a
  b: 'ب',
  p: 'ب', // no /p/ in classical Arabic; approximated with ب
  c: 'ج',
  j: 'ج', // Turkish c (/dʒ/) and j (/ʒ/) both approximated with ج
  ç: 'ش', // /tʃ/ approximated with ش
  d: 'د',
  f: 'ف',
  g: 'غ',
  ğ: 'غ', // hard g / soft g both approximated with غ
  h: 'ه',
  ı: 'ي',
  i: 'ي',
  î: 'ي',
  y: 'ي',
  k: 'ك',
  q: 'ق',
  l: 'ل',
  m: 'م',
  n: 'ن',
  o: 'و',
  ö: 'و',
  u: 'و',
  ü: 'و',
  û: 'و',
  v: 'و', // no /v/ in classical Arabic; approximated with و
  w: 'و',
  r: 'ر',
  s: 'س',
  ş: 'ش',
  t: 'ت',
  x: 'كس', // /ks/ digraph
  z: 'ز',
});

const MAPPABLE_LATIN_CHAR_RE = /[a-zçşğıöü]/;

/**
 * @param {string} arabicChars
 */
function arabicCharsValue(arabicChars) {
  let total = 0;
  for (const ch of arabicChars) {
    total += ARABIC_ABJAD[ch] ?? 0;
  }
  return total;
}

/**
 * @typedef {{ latinChar: string, arabicChar: string, value: number }} TransliterationBreakdownEntry
 */

/**
 * Deterministic, single-pass Latin/Turkish → Arabic transliteration.
 * Punctuation and digits are ignored (not treated as unmapped failures);
 * a genuinely unmappable letter (e.g. a non-Latin/Turkish character) is
 * reported in `unmappedChars` and the result is not `ok`.
 *
 * @param {string} latinName
 * @returns {{ ok: boolean, arabicText: string, breakdown: TransliterationBreakdownEntry[], unmappedChars: string[] }}
 */
export function transliterateLatinToArabicDefault(latinName) {
  const src = String(latinName ?? '').normalize('NFC').trim();
  if (!src) {
    return { ok: false, arabicText: '', breakdown: [], unmappedChars: [] };
  }

  /** @type {TransliterationBreakdownEntry[]} */
  const breakdown = [];
  /** @type {string[]} */
  const unmappedChars = [];
  let arabicText = '';

  for (const rawChar of src) {
    if (/\s/.test(rawChar)) {
      arabicText += ' ';
      continue;
    }
    const lower = rawChar.toLocaleLowerCase('tr-TR');
    if (!MAPPABLE_LATIN_CHAR_RE.test(lower)) {
      // Punctuation / digits / other symbols — ignored, not an unmapped failure.
      continue;
    }
    const arabicChar = LATIN_TO_ARABIC_CHAR[lower];
    if (!arabicChar) {
      unmappedChars.push(rawChar);
      continue;
    }
    breakdown.push({ latinChar: rawChar, arabicChar, value: arabicCharsValue(arabicChar) });
    arabicText += arabicChar;
  }

  const ok = breakdown.length > 0 && unmappedChars.length === 0;
  return { ok, arabicText, breakdown, unmappedChars };
}
