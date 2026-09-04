/**
 * Resolve Latin/Arabic name input into a classical-abjad spelling contract.
 * User objections are NOT auto-accepted as truth — only confirmed Arabic is calculated.
 *
 * Latin-only names with no gazetteer match are resolved via a deterministic
 * default transliteration (see ADR-010) rather than blocked on a question —
 * the result is disclosed via `disclosures`, not silently presented as the
 * one true spelling.
 */

import { ABJAD_KABIR_CLASSICAL_V1 } from './calculate-abjad.js';
import {
  classifyArabicNameVariant,
  lookupNameSpelling,
  normalizeLatinNameKey,
  stripArabicMarks,
} from './data/arabic-name-spellings.js';
import {
  DEFAULT_LATIN_TRANSLITERATION_METHOD,
  transliterateLatinToArabicDefault,
} from './data/default-latin-arabic-map.js';

const ARABIC_LETTER_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u;

/**
 * @param {string} text
 */
export function extractArabicSpans(text) {
  const src = String(text || '');
  const spans = [];
  const re = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/gu;
  let m;
  while ((m = re.exec(src))) {
    const raw = m[0];
    const bare = stripArabicMarks(raw);
    if (bare.length >= 2) spans.push(bare);
  }
  return [...new Set(spans)];
}

/**
 * @param {string} text
 */
export function hasArabicLetters(text) {
  return ARABIC_LETTER_RE.test(String(text || ''));
}

/**
 * @typedef {{ latinChar: string, arabicChar: string, value: number }} TransliterationBreakdownEntry
 */

/**
 * @typedef {{
 *   originalInput: string,
 *   normalizedArabic: string|null,
 *   transliterationMethod: string|null,
 *   spellingConfirmed: boolean,
 *   calculationMethod: string,
 *   status: 'confirmed'|'proposed'|'rejected_variant'|'needs_confirmation'|'unsupported',
 *   warnings: string[],
 *   disclosures: string[],
 *   displayLatin: string|null,
 *   rejectedVariant: string|null,
 *   standardArabic: string|null,
 *   autoTransliterated: boolean,
 *   transliterationBreakdown: TransliterationBreakdownEntry[]|null,
 * }} SpellingResolution
 */

/**
 * Build the spelling contract required before classical totals are trusted.
 *
 * @param {{
 *   originalInput?: string|null,
 *   arabicText?: string|null,
 *   spellingConfirmed?: boolean,
 *   latinHint?: string|null,
 * }} input
 * @returns {SpellingResolution}
 */
export function resolveArabicSpelling(input = {}) {
  const originalInput = String(input.originalInput ?? input.latinHint ?? input.arabicText ?? '').trim();
  const explicitArabic = input.arabicText != null ? String(input.arabicText).trim() : '';
  const confirmedFlag = input.spellingConfirmed === true;
  const calculationMethod = ABJAD_KABIR_CLASSICAL_V1;
  /** @type {string[]} */
  const warnings = [];

  // Prefer explicit Arabic argument, else Arabic spans inside original input.
  const arabicFromInput = explicitArabic || extractArabicSpans(originalInput)[0] || '';

  if (arabicFromInput) {
    const classified = classifyArabicNameVariant(arabicFromInput);
    if (classified?.kind === 'rejected') {
      warnings.push(
        `«${arabicFromInput}» Atlas standart yazımı değildir. Standart: ${classified.entry.standardArabic} (${classified.entry.displayLatin}).`,
      );
      return {
        originalInput: originalInput || arabicFromInput,
        normalizedArabic: stripArabicMarks(arabicFromInput),
        transliterationMethod: classified.entry.transliterationMethod,
        spellingConfirmed: false,
        calculationMethod,
        status: 'rejected_variant',
        warnings,
        disclosures: [],
        displayLatin: classified.entry.displayLatin,
        rejectedVariant: stripArabicMarks(arabicFromInput),
        standardArabic: classified.entry.standardArabic,
        autoTransliterated: false,
        transliterationBreakdown: null,
      };
    }

    // User-supplied Arabic orthography is treated as confirmed for that spelling.
    const confirmed = confirmedFlag || Boolean(explicitArabic) || hasArabicLetters(originalInput);
    return {
      originalInput: originalInput || arabicFromInput,
      normalizedArabic: stripArabicMarks(arabicFromInput),
      transliterationMethod: classified?.entry.transliterationMethod ?? 'user-provided-arabic',
      spellingConfirmed: confirmed,
      calculationMethod,
      status: confirmed ? 'confirmed' : 'needs_confirmation',
      warnings,
      disclosures: [],
      displayLatin: classified?.entry.displayLatin ?? null,
      rejectedVariant: null,
      standardArabic: classified?.entry.standardArabic ?? stripArabicMarks(arabicFromInput),
      autoTransliterated: false,
      transliterationBreakdown: null,
    };
  }

  // Latin-only: gazetteer proposal — never silent invent.
  const latinKey = normalizeLatinNameKey(input.latinHint || originalInput);
  const entry = lookupNameSpelling(latinKey);
  if (entry) {
    if (confirmedFlag || entry.autoConfirm === true) {
      return {
        originalInput,
        normalizedArabic: entry.standardArabic,
        transliterationMethod: entry.transliterationMethod,
        spellingConfirmed: true,
        calculationMethod,
        status: 'confirmed',
        warnings,
        // autoConfirm entries disclose (like ADR-010's default transliteration)
        // rather than silently presenting one spelling as the only one.
        disclosures:
          entry.autoConfirm === true && !confirmedFlag
            ? [
                `Bu, "${entry.displayLatin}" adının bilinen tek standart Arapça yazımıyla (${entry.standardArabic}) hesaplanmıştır.`,
              ]
            : [],
        displayLatin: entry.displayLatin,
        rejectedVariant: null,
        standardArabic: entry.standardArabic,
        autoTransliterated: false,
        transliterationBreakdown: null,
      };
    }
    warnings.push(
      `${entry.displayLatin} adını Arapça «${entry.standardArabic}» yazımıyla mı hesaplayalım?`,
    );
    return {
      originalInput,
      normalizedArabic: entry.standardArabic,
      transliterationMethod: entry.transliterationMethod,
      spellingConfirmed: false,
      calculationMethod,
      status: 'proposed',
      warnings,
      disclosures: [],
      displayLatin: entry.displayLatin,
      rejectedVariant: null,
      standardArabic: entry.standardArabic,
      autoTransliterated: false,
      transliterationBreakdown: null,
    };
  }

  // Only auto-transliterate when a specific name was actually captured
  // (input.latinHint) — never for a bare fallback to the whole raw message
  // (e.g. "ebced hesapla" with no name), which has no name to compute from.
  const hasExplicitLatinHint = Boolean(input.latinHint && String(input.latinHint).trim());

  if (latinKey) {
    if (hasExplicitLatinHint) {
      // No explicit Arabic, no gazetteer hit: apply the deterministic default
      // transliteration and compute immediately (ADR-010) instead of blocking
      // on a question. The result is disclosed, not presented as the one true
      // spelling, and user-supplied Arabic / gazetteer hits above still win.
      const translit = transliterateLatinToArabicDefault(input.latinHint);
      if (translit.ok) {
        const displayLatin = input.latinHint || originalInput || latinKey;
        const breakdownText = translit.breakdown
          .map((b) => `${b.latinChar}→${b.arabicChar}`)
          .join(', ');
        return {
          originalInput,
          normalizedArabic: translit.arabicText,
          transliterationMethod: DEFAULT_LATIN_TRANSLITERATION_METHOD,
          spellingConfirmed: true,
          calculationMethod,
          status: 'confirmed',
          warnings,
          disclosures: [
            `Bu, "${displayLatin}" adının varsayılan Latin→Arapça harf çevirisiyle (${breakdownText}) hesaplanmıştır.`,
            'Öneriler kutsal/resmî imla belgesi değildir; hesap sonucu farklı bir yazıma göre değişebilir.',
          ],
          displayLatin,
          rejectedVariant: null,
          standardArabic: null,
          autoTransliterated: true,
          transliterationBreakdown: translit.breakdown,
        };
      }
    }

    warnings.push(
      'Latin harfli isim doğrudan tahmini Arapça harflere çevrilerek hesaplanmaz. Lütfen Arapça yazımı belirtin.',
    );
    return {
      originalInput,
      normalizedArabic: null,
      transliterationMethod: null,
      spellingConfirmed: false,
      calculationMethod,
      status: 'needs_confirmation',
      warnings,
      disclosures: [],
      displayLatin: null,
      rejectedVariant: null,
      standardArabic: null,
      autoTransliterated: false,
      transliterationBreakdown: null,
    };
  }

  return {
    originalInput,
    normalizedArabic: null,
    transliterationMethod: null,
    spellingConfirmed: false,
    calculationMethod,
    status: 'unsupported',
    warnings: ['Hesaplanacak Arapça yazım bulunamadı.'],
    disclosures: [],
    displayLatin: null,
    rejectedVariant: null,
    standardArabic: null,
    autoTransliterated: false,
    transliterationBreakdown: null,
  };
}
