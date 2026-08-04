/**
 * Resolve Latin/Arabic name input into a classical-abjad spelling contract.
 * User objections are NOT auto-accepted as truth — only confirmed Arabic is calculated.
 */

import { ABJAD_KABIR_CLASSICAL_V1 } from './calculate-abjad.js';
import {
  classifyArabicNameVariant,
  lookupNameSpelling,
  normalizeLatinNameKey,
  stripArabicMarks,
} from './data/arabic-name-spellings.js';

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
 * @typedef {{
 *   originalInput: string,
 *   normalizedArabic: string|null,
 *   transliterationMethod: string|null,
 *   spellingConfirmed: boolean,
 *   calculationMethod: string,
 *   status: 'confirmed'|'proposed'|'rejected_variant'|'needs_confirmation'|'unsupported',
 *   warnings: string[],
 *   displayLatin: string|null,
 *   rejectedVariant: string|null,
 *   standardArabic: string|null,
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
        displayLatin: classified.entry.displayLatin,
        rejectedVariant: stripArabicMarks(arabicFromInput),
        standardArabic: classified.entry.standardArabic,
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
      displayLatin: classified?.entry.displayLatin ?? null,
      rejectedVariant: null,
      standardArabic: classified?.entry.standardArabic ?? stripArabicMarks(arabicFromInput),
    };
  }

  // Latin-only: gazetteer proposal — never silent invent.
  const latinKey = normalizeLatinNameKey(input.latinHint || originalInput);
  const entry = lookupNameSpelling(latinKey);
  if (entry) {
    if (confirmedFlag) {
      return {
        originalInput,
        normalizedArabic: entry.standardArabic,
        transliterationMethod: entry.transliterationMethod,
        spellingConfirmed: true,
        calculationMethod,
        status: 'confirmed',
        warnings,
        displayLatin: entry.displayLatin,
        rejectedVariant: null,
        standardArabic: entry.standardArabic,
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
      displayLatin: entry.displayLatin,
      rejectedVariant: null,
      standardArabic: entry.standardArabic,
    };
  }

  if (latinKey) {
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
      displayLatin: null,
      rejectedVariant: null,
      standardArabic: null,
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
    displayLatin: null,
    rejectedVariant: null,
    standardArabic: null,
  };
}
