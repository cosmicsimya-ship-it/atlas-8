/**
 * atlas-ebced-v1 — the Ebced engine's stable public API.
 *
 * This is the ONLY module Atlas's intelligence/routing layer should import
 * from to get an Ebced result. It composes the existing deterministic
 * primitives in this directory (calculateAbjad, resolveArabicSpelling,
 * findEsmaMatches, tokenizeClassicalSpelling) plus this task's additions
 * (classifications, compatibility, verse-abjad) into one coherent surface,
 * WITHOUT re-implementing or duplicating any of their calculation logic —
 * see docs/ebced/PHASE3-ENGINE-DESIGN.md for why composition over a second
 * engine was the right call.
 *
 * Every exported function is deterministic and synchronous (network- and
 * LLM-free): same input + same options + same ENGINE_VERSION always
 * produces the same output. Nothing in this module invents a number, a
 * spelling, or an Esma name — a missing/ambiguous/unsupported case always
 * returns `ok: false` with a warning, never a guess.
 *
 * Explicitly OUT of scope, structurally, not just by convention: illness/
 * disease diagnosis, sihir/büyü/nazar (magic/evil-eye) detection, and
 * rızık (sustenance) efficacy claims. No function in this file accepts an
 * option that turns any of those on — see
 * docs/ebced/PHASE1-PHASE2-WORKBOOK-DISCOVERY.md §2.8 for what was found
 * and deliberately left out.
 *
 * This module does NOT decide conversation intent, domain routing, or
 * WHEN it should be called — that's the Atlas Intelligence Layer's job
 * (see docs/ebced/PHASE20-INTEGRATION-PLAN.md for the intended interface).
 */

import {
  calculateAbjad,
  formatAbjadBreakdown,
  ABJAD_KABIR_CLASSICAL_V1,
} from './calculate-abjad.js';
import { resolveArabicSpelling } from './resolve-arabic-spelling.js';
import {
  transliterateLatinToArabicDefault,
  DEFAULT_LATIN_TRANSLITERATION_METHOD,
} from './data/default-latin-arabic-map.js';
import { tokenizeClassicalSpelling } from './layers/classical-abjad-runner.js';
import { classifyArabicText, CLASSIFICATION_METHODOLOGY_ID } from './classifications.js';
import {
  findEsmaMatches,
  ESMA_MATCH_TYPES,
  ESMA_MATCH_METHODOLOGY,
  reduceToDigit,
} from './esma-abjad-match.js';
import { ESMA_ABJAD_CATALOG_VERSION } from './data/esma-abjad-catalog.js';
import { calculateCompatibility as calculateCompatibilityCore } from './compatibility.js';
import {
  calculateVerseAbjad as calculateVerseAbjadCore,
  calculateArabicTextAbjad,
  VERSE_ABJAD_METHODOLOGY_ID,
} from './verse-abjad.js';

/** Engine identity — bump only when calculation SEMANTICS change (Phase 16). */
export const ENGINE_VERSION = 'atlas-ebced-v1';

export const ENGINE_COMPONENT_VERSIONS = Object.freeze({
  engine: ENGINE_VERSION,
  classicalAbjad: ABJAD_KABIR_CLASSICAL_V1,
  latinTransliteration: DEFAULT_LATIN_TRANSLITERATION_METHOD,
  classification: CLASSIFICATION_METHODOLOGY_ID,
  esmaCatalog: ESMA_ABJAD_CATALOG_VERSION,
  verseAbjad: VERSE_ABJAD_METHODOLOGY_ID,
});

// ---------------------------------------------------------------------------
// normalizeArabic / transliterateLatinName — Phase 4/5/18
// ---------------------------------------------------------------------------

/**
 * Normalize an already-Arabic string the way the classical engine will read
 * it (NFC, harakat/tatweel stripped, hamza-carrier/ligature folds applied) —
 * without computing a value. Useful for previewing what a spelling will
 * reduce to before committing to a calculation.
 *
 * @param {string} arabicText
 * @returns {{ ok: boolean, normalized: string, unsupportedCharacters: string[], errorCode: string|null }}
 */
export function normalizeArabic(arabicText) {
  const tokenized = tokenizeClassicalSpelling(arabicText);
  return {
    ok: tokenized.ok,
    normalized: tokenized.normalizedSpelling || '',
    unsupportedCharacters: tokenized.unsupportedCharacters || [],
    errorCode: tokenized.ok ? null : tokenized.errorCode,
  };
}

/**
 * Deterministic Latin/Turkish → Arabic transliteration (ADR-010 default
 * method). This is an approximation, not a claim of the one true spelling —
 * always surface `disclosures`-equivalent messaging to the user (see
 * calculateName's `disclosures` field for the pre-built version of this).
 *
 * @param {string} latinName
 * @returns {{ ok: boolean, arabicText: string, breakdown: Array<{latinChar: string, arabicChar: string, value: number}>, unmappedChars: string[], method: string }}
 */
export function transliterateLatinName(latinName) {
  const result = transliterateLatinToArabicDefault(latinName);
  return { ...result, method: DEFAULT_LATIN_TRANSLITERATION_METHOD };
}

// ---------------------------------------------------------------------------
// calculateArabicText / calculateName — Phase 6/18
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   ok: boolean,
 *   input: string,
 *   normalized: string,
 *   letters: Array<{letter: string, value: number}>,
 *   total: number|null,
 *   methodVersion: string,
 *   warnings: string[],
 *   errorCode: string|null,
 * }} ArabicTextCalculation
 */

/**
 * Calculate Abjad over Arabic text the caller already has — no
 * transliteration, no spelling resolution. This is the lowest-level entry
 * point; calculateName() is almost always the better fit for user-facing
 * "what's the Ebced value of name X" requests.
 *
 * @param {string} arabicText
 * @returns {ArabicTextCalculation}
 */
export function calculateArabicText(arabicText) {
  const calc = calculateAbjad(arabicText, ABJAD_KABIR_CLASSICAL_V1);
  return {
    ok: calc.ok,
    input: String(arabicText ?? ''),
    normalized: calc.normalizedText || '',
    letters: calc.ok ? calc.letters : [],
    total: calc.ok ? calc.total : null,
    methodVersion: ENGINE_VERSION,
    warnings: calc.ok
      ? []
      : ['Arapça metin hesaplanamadı: ' + (calc.errorCode || 'unknown')],
    errorCode: calc.ok ? null : calc.errorCode,
  };
}

/**
 * @typedef {{
 *   ok: boolean,
 *   input: string,
 *   normalizedArabic: string|null,
 *   spellingStatus: 'confirmed'|'proposed'|'rejected_variant'|'needs_confirmation'|'unsupported',
 *   spellingConfirmed: boolean,
 *   autoTransliterated: boolean,
 *   transliterationBreakdown: Array<{latinChar: string, arabicChar: string, value: number}>|null,
 *   letters: Array<{letter: string, value: number}>,
 *   total: number|null,
 *   warnings: string[],
 *   disclosures: string[],
 *   methodVersion: string,
 * }} NameCalculation
 */

/**
 * Calculate a person's/name's Ebced total from Latin, Turkish, or Arabic
 * input. This is the function chat-facing "isminin ebced değeri kaç"
 * requests should call.
 *
 * Resolution order (unchanged from resolveArabicSpelling / ADR-010):
 * explicit `options.arabicText` > Arabic substring already in `name` >
 * curated gazetteer whole-name match (asks for confirmation unless
 * `options.spellingConfirmed`) > deterministic default Latin→Arabic
 * transliteration (auto-computed, disclosed, no confirmation round-trip).
 *
 * @param {string} name — Latin, Turkish, or Arabic name text
 * @param {{ arabicText?: string, spellingConfirmed?: boolean }} [options]
 * @returns {NameCalculation}
 */
export function calculateName(name, options = {}) {
  const resolution = resolveArabicSpelling({
    originalInput: name,
    latinHint: name,
    arabicText: options.arabicText ?? null,
    spellingConfirmed: options.spellingConfirmed === true,
  });

  const base = {
    input: String(name ?? ''),
    normalizedArabic: resolution.normalizedArabic,
    spellingStatus: resolution.status,
    spellingConfirmed: resolution.spellingConfirmed,
    autoTransliterated: resolution.autoTransliterated,
    transliterationBreakdown: resolution.transliterationBreakdown,
    warnings: resolution.warnings,
    disclosures: resolution.disclosures,
    methodVersion: ENGINE_VERSION,
  };

  if (!resolution.normalizedArabic || !resolution.spellingConfirmed) {
    return { ok: false, ...base, letters: [], total: null };
  }

  const calc = calculateAbjad(resolution.normalizedArabic, ABJAD_KABIR_CLASSICAL_V1);
  if (!calc.ok) {
    return {
      ok: false,
      ...base,
      letters: [],
      total: null,
      warnings: [...base.warnings, 'Onaylı yazım hesaplanamadı: ' + (calc.errorCode || 'unknown')],
    };
  }

  return { ok: true, ...base, letters: calc.letters, total: calc.total };
}

// ---------------------------------------------------------------------------
// analyzeName — Phase 7/18 (calculateName + classification, no Category C)
// ---------------------------------------------------------------------------

/**
 * calculateName() plus per-letter traditional classification
 * (Nurânî/Zulmânî, gender, element) and, optionally, a digit-reduction
 * secondary metric. Never returns illness, magic/evil-eye, or sustenance
 * content — those categories have no option to enable here; see
 * docs/ebced/PHASE1-PHASE2-WORKBOOK-DISCOVERY.md §2.8.
 *
 * @param {string} name
 * @param {{ arabicText?: string, spellingConfirmed?: boolean, includeDigitReduction?: boolean }} [options]
 */
export function analyzeName(name, options = {}) {
  const calculation = calculateName(name, options);
  const classification = calculation.normalizedArabic
    ? classifyArabicText(calculation.normalizedArabic)
    : null;

  const result = {
    ...calculation,
    classification: classification
      ? {
          ok: classification.ok,
          counts: classification.counts,
          dominant: classification.dominant,
          letters: classification.letters,
          methodologyId: classification.methodologyId,
          source: classification.source,
        }
      : null,
    digitReduction: null,
  };

  if (options.includeDigitReduction && calculation.ok && calculation.total != null) {
    result.digitReduction = {
      value: reduceToDigit(calculation.total),
      note: 'Klasik ebced-i kebîrin birincil sonucu değildir; ek/ikincil bir bakış açısıdır.',
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// calculateVerse — Phase 8/18
// ---------------------------------------------------------------------------

/**
 * Calculate Abjad over a Qur'an verse. Pass the VerseRetrievalResult from
 * `server/quran-verse-lookup` unmodified as `verseResult` to get a
 * verse-attributed result; the function refuses to attach surah/ayah
 * identity to unverified text. Pass raw Arabic as `arabicText` instead for
 * an unattributed calculation (no verse-identity claim).
 *
 * @param {{ verseResult?: object, arabicText?: string }} input
 */
export function calculateVerse({ verseResult, arabicText } = {}) {
  if (verseResult) return calculateVerseAbjadCore(verseResult);
  return calculateArabicTextAbjad(arabicText);
}

// ---------------------------------------------------------------------------
// matchEsma — Phase 10/18
// ---------------------------------------------------------------------------

/**
 * Find Esma whose Ebced value matches (exact) or is close to (near) a
 * target total, against Atlas's own recomputed 99-entry catalog (see
 * data/esma-abjad-catalog.js). `matchType: 'traditional'` always returns
 * no matches — the workbook has no deterministic traditional-association
 * algorithm (see PHASE1-PHASE2-WORKBOOK-DISCOVERY.md §2.3), so Atlas does
 * not invent one.
 *
 * `includeWorkbookBand: true` additionally searches target±12 (the
 * workbook's own manual "find the nearest Esma" band — see §2.3) and
 * labels those results distinctly; it is opt-in and off by default because
 * it's a workbook heuristic, not a verified matching rule.
 *
 * @param {number} value
 * @param {{ matchType?: 'exact'|'near'|'reduced'|'traditional', nearMaxDelta?: number, topK?: number, includeWorkbookBand?: boolean }} [options]
 */
export function matchEsma(value, options = {}) {
  const primary = findEsmaMatches({
    value,
    matchType: options.matchType || ESMA_MATCH_TYPES.EXACT,
    nearMaxDelta: options.nearMaxDelta,
    topK: options.topK,
  });

  if (!options.includeWorkbookBand || !Number.isFinite(value)) {
    return { ...primary, workbookBandMatches: null };
  }

  const bandTargets = [value + 12, value - 12].filter((v) => v !== value);
  const workbookBandMatches = bandTargets.flatMap((target) => {
    const r = findEsmaMatches({ value: target, matchType: ESMA_MATCH_TYPES.EXACT, topK: options.topK });
    return r.matches.map((m) => ({ ...m, bandTarget: target, bandOffset: target - value }));
  });

  return { ...primary, workbookBandMatches };
}

// ---------------------------------------------------------------------------
// calculateCompatibility — Phase 12/18
// ---------------------------------------------------------------------------

/**
 * Name-pair compatibility (see compatibility.js). Accepts Latin, Turkish,
 * or Arabic input for both names — each is resolved the same way
 * calculateName() resolves a single name.
 *
 * @param {string} nameA
 * @param {string} nameB
 * @param {{ arabicTextA?: string, arabicTextB?: string, spellingConfirmed?: boolean }} [options]
 */
export function calculateCompatibility(nameA, nameB, options = {}) {
  const a = calculateName(nameA, { arabicText: options.arabicTextA, spellingConfirmed: options.spellingConfirmed });
  const b = calculateName(nameB, { arabicText: options.arabicTextB, spellingConfirmed: options.spellingConfirmed });

  if (!a.ok || !b.ok) {
    return {
      ok: false,
      nameA: a,
      nameB: b,
      compatibility: null,
      warnings: [...a.warnings, ...b.warnings].filter(Boolean),
    };
  }

  const compatibility = calculateCompatibilityCore(a.normalizedArabic, b.normalizedArabic);
  return {
    ok: compatibility.ok,
    nameA: a,
    nameB: b,
    compatibility,
    warnings: [...a.warnings, ...b.warnings].filter(Boolean),
  };
}

export { formatAbjadBreakdown };
