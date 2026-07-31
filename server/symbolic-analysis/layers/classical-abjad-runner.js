/**
 * Classical Abjad runner — abjad-kabir-classical-v1 / classical-kabir-rules-1.0.0
 *
 * Computes letter-sum totals from user-confirmed selectedSpelling only.
 * Does NOT use LATIN_ABJAD, DIGIT_MOTIFS, digit reduction, or Esma matching.
 * Does NOT use production ARABIC_ABJAD آ=1 mapping.
 */

import {
  ALIF_MADDA,
  ALIF_MADDA_USER_MESSAGE,
  CLASSICAL_CARRIER_FOLDS,
  CLASSICAL_HARAKAT,
  CLASSICAL_KABIR_VALUES,
  CLASSICAL_LAM_ALIF_LIGATURES,
  CLASSICAL_SHADDA,
  CLASSICAL_TATWIL,
  STANDALONE_HAMZA_POLICY,
} from '../data/classical-kabir-table.js';
import {
  CLASSICAL_ABJAD_METHODOLOGY,
  CLASSICAL_ABJAD_INTERPRETATION_LIMITATIONS,
} from '../methodology-ids.js';

export const CLASSICAL_ERROR_CODES = Object.freeze({
  CONFIRMATION_REQUIRED: 'TRANSLITERATION_CONFIRMATION_REQUIRED',
  UNSUPPORTED_CHAR: 'CLASSICAL_UNSUPPORTED_CHAR',
  TRANSLITERATION_UNSUPPORTED_CHAR: 'TRANSLITERATION_UNSUPPORTED_CHAR',
  EMPTY: 'CLASSICAL_ABJAD_EMPTY',
  MISSING_SPELLING: 'CLASSICAL_MISSING_SELECTED_SPELLING',
});

/**
 * @typedef {{
 *   originalCharacter: string,
 *   normalizedCharacter: string|null,
 *   expandedFrom: string|null,
 *   value: number|null,
 *   ruleApplied: string,
 *   traced: true,
 *   status?: 'counted'|'ignored'|'removed'|'unsupported',
 * }} ClassicalLetterTrace
 */

/**
 * @param {string} ch
 * @param {Partial<ClassicalLetterTrace>} extra
 * @returns {ClassicalLetterTrace}
 */
function traceEntry(ch, extra = {}) {
  return {
    originalCharacter: ch,
    normalizedCharacter: extra.normalizedCharacter ?? null,
    expandedFrom: extra.expandedFrom ?? null,
    value: extra.value ?? null,
    ruleApplied: extra.ruleApplied ?? 'none',
    traced: true,
    status: extra.status ?? 'counted',
  };
}

/**
 * Tokenize + score one confirmed Arabic spelling under ADR-005 order:
 * NFC → hareke ignore → tatwil remove → shadda expand → hemze/folds → ligature → sum
 *
 * @param {string} selectedSpelling
 * @returns {{
 *   ok: boolean,
 *   letters: ClassicalLetterTrace[],
 *   ignored: ClassicalLetterTrace[],
 *   normalizedSpelling: string,
 *   total: number|null,
 *   unsupportedCharacters: string[],
 *   errorCode: string|null,
 *   hadAlifMadda: boolean,
 *   hadStandaloneHamza: boolean,
 * }}
 */
export function tokenizeClassicalSpelling(selectedSpelling) {
  const source = String(selectedSpelling || '').normalize('NFC');
  /** @type {ClassicalLetterTrace[]} */
  const letters = [];
  /** @type {ClassicalLetterTrace[]} */
  const ignored = [];
  /** @type {string[]} */
  const unsupportedCharacters = [];
  let hadAlifMadda = false;
  let hadStandaloneHamza = false;

  /** @type {ClassicalLetterTrace|null} */
  let lastCounted = null;

  /**
   * @param {ClassicalLetterTrace} entry
   */
  function pushCounted(entry) {
    letters.push(entry);
    lastCounted = entry;
  }

  /**
   * Emit a countable base letter (already folded to kabir key).
   * @param {string} original
   * @param {string} normalized
   * @param {string} rule
   * @param {string|null} expandedFrom
   */
  function emitBase(original, normalized, rule, expandedFrom = null) {
    if (normalized === 'ء') {
      hadStandaloneHamza = true;
      pushCounted(
        traceEntry(original, {
          normalizedCharacter: 'ء',
          expandedFrom,
          value: 0,
          ruleApplied: rule || 'hamza-standalone-zero-value-but-traced',
          status: 'counted',
        }),
      );
      return;
    }
    const value = CLASSICAL_KABIR_VALUES[normalized];
    if (value == null) {
      unsupportedCharacters.push(original);
      ignored.push(
        traceEntry(original, {
          normalizedCharacter: normalized,
          expandedFrom,
          value: null,
          ruleApplied: 'unsupported',
          status: 'unsupported',
        }),
      );
      return;
    }
    pushCounted(
      traceEntry(original, {
        normalizedCharacter: normalized,
        expandedFrom,
        value,
        ruleApplied: rule,
        status: 'counted',
      }),
    );
  }

  /**
   * Apply carrier/fold then emit. آ expands to ا+ا.
   * @param {string} original
   * @param {string|null} expandedFromOuter
   */
  function emitOrthographic(original, expandedFromOuter = null) {
    if (original === ALIF_MADDA) {
      hadAlifMadda = true;
      emitBase(original, 'ا', 'hamza-carrier-madd-alif', ALIF_MADDA);
      emitBase(original, 'ا', 'hamza-carrier-madd-alif', ALIF_MADDA);
      return;
    }

    const fold = CLASSICAL_CARRIER_FOLDS[original];
    if (fold) {
      emitBase(original, fold.to, fold.rule, expandedFromOuter ?? original);
      return;
    }

    if (original === 'ء') {
      emitBase(original, 'ء', 'hamza-standalone-zero-value-but-traced', expandedFromOuter);
      return;
    }

    emitBase(original, original, expandedFromOuter ? 'ligature-decompose' : 'base-letter', expandedFromOuter);
  }

  for (const ch of source) {
    if (/\s/u.test(ch)) {
      ignored.push(
        traceEntry(ch, {
          ruleApplied: 'whitespace-ignore',
          status: 'ignored',
        }),
      );
      continue;
    }

    if (CLASSICAL_HARAKAT.has(ch)) {
      ignored.push(
        traceEntry(ch, {
          ruleApplied: 'harakat-ignore',
          status: 'ignored',
        }),
      );
      continue;
    }

    if (ch === CLASSICAL_TATWIL) {
      ignored.push(
        traceEntry(ch, {
          ruleApplied: 'tatwil-remove',
          status: 'removed',
        }),
      );
      continue;
    }

    if (ch === CLASSICAL_SHADDA) {
      if (!lastCounted || lastCounted.normalizedCharacter == null || lastCounted.value == null) {
        unsupportedCharacters.push(ch);
        ignored.push(
          traceEntry(ch, {
            ruleApplied: 'shadda-without-base',
            status: 'unsupported',
          }),
        );
        continue;
      }
      pushCounted(
        traceEntry(ch, {
          normalizedCharacter: lastCounted.normalizedCharacter,
          expandedFrom: lastCounted.normalizedCharacter,
          value: lastCounted.value,
          ruleApplied: 'shadda-expand-and-count',
          status: 'counted',
        }),
      );
      continue;
    }

    const ligature = CLASSICAL_LAM_ALIF_LIGATURES[ch];
    if (ligature) {
      for (const part of ligature) {
        emitOrthographic(part, ch);
      }
      continue;
    }

    // Arabic letters / known folds / hamza
    if (
      ch === ALIF_MADDA ||
      ch === 'ء' ||
      CLASSICAL_CARRIER_FOLDS[ch] ||
      CLASSICAL_KABIR_VALUES[ch] != null ||
      /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u.test(ch)
    ) {
      emitOrthographic(ch);
      continue;
    }

    // Anything else (Latin, symbols, ★, …) — structured unsupported
    unsupportedCharacters.push(ch);
    ignored.push(
      traceEntry(ch, {
        ruleApplied: 'unsupported',
        status: 'unsupported',
      }),
    );
  }

  if (unsupportedCharacters.length) {
    return {
      ok: false,
      letters: [],
      ignored,
      normalizedSpelling: '',
      total: null,
      unsupportedCharacters: [...new Set(unsupportedCharacters)],
      errorCode: CLASSICAL_ERROR_CODES.TRANSLITERATION_UNSUPPORTED_CHAR,
      hadAlifMadda,
      hadStandaloneHamza,
    };
  }

  const countable = letters.filter((l) => l.status === 'counted');
  const normalizedSpelling = countable.map((l) => l.normalizedCharacter).join('');
  const total = countable.reduce((s, l) => s + (l.value || 0), 0);

  if (!source.trim()) {
    return {
      ok: false,
      letters: countable,
      ignored,
      normalizedSpelling: '',
      total: null,
      unsupportedCharacters: [],
      errorCode: CLASSICAL_ERROR_CODES.EMPTY,
      hadAlifMadda,
      hadStandaloneHamza,
    };
  }

  if (countable.length === 0) {
    return {
      ok: false,
      letters: [],
      ignored,
      normalizedSpelling: '',
      total: null,
      unsupportedCharacters: [],
      errorCode: CLASSICAL_ERROR_CODES.EMPTY,
      hadAlifMadda,
      hadStandaloneHamza,
    };
  }

  return {
    ok: true,
    letters: countable,
    ignored,
    normalizedSpelling,
    total,
    unsupportedCharacters: [],
    errorCode: null,
    hadAlifMadda,
    hadStandaloneHamza,
  };
}

/**
 * Compact letter list matching fixture shape { letter, value }.
 * @param {ClassicalLetterTrace[]} letters
 */
export function toFixtureLetters(letters) {
  return letters.map((l) => ({
    letter: l.normalizedCharacter,
    value: l.value,
  }));
}

/**
 * @param {{
 *   selectedSpelling?: string|null,
 *   spellingConfirmed?: boolean,
 *   motherNameSelectedSpelling?: string|null,
 *   motherSpellingConfirmed?: boolean,
 *   includeMotherName?: boolean,
 *   parts?: Array<{ type: 'primary'|'motherName', selectedSpelling: string, confirmed?: boolean }>,
 *   originalInput?: string|null,
 *   forceConfirmationRequired?: boolean,
 * }} [input]
 */
export function runClassicalAbjad(input = {}) {
  const meta = CLASSICAL_ABJAD_METHODOLOGY;
  const includeMotherName = input.includeMotherName === true;

  /** @type {Array<{ type: 'primary'|'motherName', selectedSpelling: string, confirmed: boolean }>} */
  let partSpecs = [];

  if (Array.isArray(input.parts) && input.parts.length) {
    partSpecs = input.parts.map((p) => ({
      type: p.type === 'motherName' ? 'motherName' : 'primary',
      selectedSpelling: String(p.selectedSpelling || ''),
      confirmed: p.confirmed === true,
    }));
  } else {
    const primarySpelling = input.selectedSpelling != null ? String(input.selectedSpelling) : '';
    partSpecs.push({
      type: 'primary',
      selectedSpelling: primarySpelling,
      confirmed: input.spellingConfirmed === true,
    });
    if (includeMotherName) {
      partSpecs.push({
        type: 'motherName',
        selectedSpelling:
          input.motherNameSelectedSpelling != null
            ? String(input.motherNameSelectedSpelling)
            : '',
        confirmed: input.motherSpellingConfirmed === true,
      });
    }
  }

  if (!includeMotherName) {
    partSpecs = partSpecs.filter((p) => p.type === 'primary');
  }

  const needsConfirm =
    input.forceConfirmationRequired === true ||
    partSpecs.some((p) => !p.confirmed) ||
    partSpecs.some((p) => !String(p.selectedSpelling || '').trim());

  if (needsConfirm) {
    const missingSpelling = partSpecs.some((p) => !String(p.selectedSpelling || '').trim());
    return {
      status: 'pending_confirmation',
      ok: false,
      complete: false,
      errorCode: CLASSICAL_ERROR_CODES.CONFIRMATION_REQUIRED,
      methodologyId: meta.methodologyId,
      methodologyVersion: meta.methodologyVersion,
      rulesetVersion: meta.rulesetVersion,
      transliterationLayerId: meta.transliterationLayerId,
      deprecatedAlias: meta.deprecatedAlias,
      selectedSpelling: partSpecs.find((p) => p.type === 'primary')?.selectedSpelling || null,
      normalizedSpelling: null,
      letters: [],
      parts: [],
      total: null,
      combinedTotal: null,
      includeMotherName,
      optionalReductions: [],
      digitReductionApplied: false,
      assessment: {
        transliterationCertainty: null,
        orthographicDisputeLevel: missingSpelling ? 'high' : 'medium',
        matchStrength: null,
        interpretationLimitations: [
          ...CLASSICAL_ABJAD_INTERPRETATION_LIMITATIONS,
          'Klasik ebced hesabı kullanıcı onaylı selectedSpelling olmadan tamamlanmaz.',
        ],
      },
      metadata: {
        autoAcceptHighCertainty: false,
        pendingReason: missingSpelling
          ? 'missing_selected_spelling'
          : 'user_confirmation_required',
        standaloneHamzaPolicy: STANDALONE_HAMZA_POLICY,
      },
    };
  }

  /** @type {Array<object>} */
  const partsOut = [];
  let hadAlifMadda = false;
  let hadStandaloneHamza = false;
  /** @type {string[]} */
  const allUnsupported = [];
  /** @type {ClassicalLetterTrace[]} */
  const allIgnored = [];

  for (const spec of partSpecs) {
    const tokenized = tokenizeClassicalSpelling(spec.selectedSpelling);
    if (tokenized.hadAlifMadda) hadAlifMadda = true;
    if (tokenized.hadStandaloneHamza) hadStandaloneHamza = true;
    if (Array.isArray(tokenized.ignored) && tokenized.ignored.length) {
      allIgnored.push(...tokenized.ignored);
    }

    if (!tokenized.ok) {
      allUnsupported.push(...tokenized.unsupportedCharacters);
      return {
        status: 'error',
        ok: false,
        complete: false,
        errorCode: tokenized.errorCode || CLASSICAL_ERROR_CODES.UNSUPPORTED_CHAR,
        methodologyId: meta.methodologyId,
        methodologyVersion: meta.methodologyVersion,
        rulesetVersion: meta.rulesetVersion,
        transliterationLayerId: meta.transliterationLayerId,
        deprecatedAlias: meta.deprecatedAlias,
        selectedSpelling: spec.selectedSpelling,
        normalizedSpelling: null,
        letters: [],
        parts: partsOut,
        total: null,
        combinedTotal: null,
        includeMotherName,
        unsupportedCharacters: [...new Set(allUnsupported)],
        ignoredTrace: tokenized.ignored,
        optionalReductions: [],
        digitReductionApplied: false,
        assessment: {
          transliterationCertainty: null,
          orthographicDisputeLevel: 'high',
          matchStrength: null,
          interpretationLimitations: [
            ...CLASSICAL_ABJAD_INTERPRETATION_LIMITATIONS,
            'Desteklenmeyen karakterler sessizce atılmaz; toplam üretilmez.',
          ],
        },
        metadata: {
          autoAcceptHighCertainty: false,
          standaloneHamzaPolicy: STANDALONE_HAMZA_POLICY,
          ignoredTrace: tokenized.ignored,
        },
      };
    }

    partsOut.push({
      type: spec.type,
      selectedSpelling: spec.selectedSpelling,
      normalizedSpelling: tokenized.normalizedSpelling,
      letters: tokenized.letters,
      fixtureLetters: toFixtureLetters(tokenized.letters),
      subtotal: tokenized.total,
      ignored: tokenized.ignored,
    });
  }

  const primary = partsOut.find((p) => p.type === 'primary') || partsOut[0];
  const combinedTotal =
    includeMotherName && partsOut.length >= 2 && partsOut.every((p) => typeof p.subtotal === 'number')
      ? partsOut.reduce((s, p) => s + p.subtotal, 0)
      : null;

  const total = includeMotherName && combinedTotal != null ? combinedTotal : primary?.subtotal ?? null;

  const interpretationLimitations = [...CLASSICAL_ABJAD_INTERPRETATION_LIMITATIONS];
  if (hadStandaloneHamza) {
    interpretationLimitations.push(
      'Bağımsız ء değeri 0 olarak izlenir (zero-value-but-traced); Atlas v1 ruleset kararıdır, evrensel klasik konsensüs değildir.',
    );
  }
  if (hadAlifMadda) {
    interpretationLimitations.push(ALIF_MADDA_USER_MESSAGE);
  }

  return {
    status: 'complete',
    ok: true,
    complete: true,
    errorCode: null,
    methodologyId: meta.methodologyId,
    methodologyVersion: meta.methodologyVersion,
    rulesetVersion: meta.rulesetVersion,
    transliterationLayerId: meta.transliterationLayerId,
    deprecatedAlias: meta.deprecatedAlias,
    selectedSpelling: primary?.selectedSpelling ?? null,
    normalizedSpelling: primary?.normalizedSpelling ?? null,
    letters: includeMotherName ? [] : primary?.letters ?? [],
    fixtureLetters: includeMotherName ? [] : primary?.fixtureLetters ?? [],
    ignoredTrace: allIgnored,
    parts: partsOut.map((p) => ({
      type: p.type,
      selectedSpelling: p.selectedSpelling,
      normalizedSpelling: p.normalizedSpelling,
      letters: p.letters,
      fixtureLetters: p.fixtureLetters,
      subtotal: p.subtotal,
      ignored: p.ignored,
    })),
    total,
    combinedTotal: includeMotherName ? combinedTotal : null,
    includeMotherName,
    optionalReductions: [],
    digitReductionApplied: false,
    assessment: {
      transliterationCertainty: null,
      orthographicDisputeLevel: hadAlifMadda || hadStandaloneHamza ? 'low' : 'none',
      matchStrength: null,
      interpretationLimitations,
    },
    metadata: {
      autoAcceptHighCertainty: false,
      hadAlifMadda,
      hadStandaloneHamza,
      alifMaddaPolicy: hadAlifMadda
        ? {
            classicalPath: 'آ→ا+ا',
            productionTableBehavior: 'آ=1 (legacy ARABIC_ABJAD; not classical ruleset)',
            userMessage: ALIF_MADDA_USER_MESSAGE,
            atlasProductDecision: true,
          }
        : null,
      standaloneHamzaPolicy: STANDALONE_HAMZA_POLICY,
      digitMotifsUsed: false,
      latinTableUsed: false,
      esmaSelectionPerformed: false,
      ignoredTraceCount: allIgnored.length,
    },
  };
}

/**
 * Layer-shaped wrapper for orchestrator integration (additive; not Latin replacement).
 * @param {object} input
 */
export function runClassicalAbjadLayer(input = {}) {
  const result = runClassicalAbjad(input);
  return {
    layerId: 'classical-abjad',
    source: CLASSICAL_ABJAD_METHODOLOGY.methodologyId,
    method: 'classical-letter-sum',
    status: result.status,
    calculatedData: result,
    interpretation: result.complete
      ? `Klasik Ebced-i Kebîr (ruleset ${CLASSICAL_ABJAD_METHODOLOGY.rulesetVersion}) harf toplamı ${result.total}.`
      : null,
    themes: [],
    cautions: [
      'Klasik ebced kesin hüküm veya kader iddiası değildir.',
      'Sonuç onaylanan Arapça yazıma göredir.',
    ],
    confidence: null,
    limitations: result.assessment?.interpretationLimitations || [],
    assessment: result.assessment,
  };
}

/**
 * Letter count for shadow metadata — never throws; never embeds spellings.
 * Prefer top-level letters when non-empty; otherwise sum parts[].letters
 * (mother-name path sets top-level letters to []).
 * @param {object|null|undefined} result
 */
export function resolveClassicalShadowLetterCount(result) {
  try {
    const top = result && Array.isArray(result.letters) ? result.letters : null;
    if (top && top.length > 0) return top.length;

    const parts = result && Array.isArray(result.parts) ? result.parts : [];
    if (parts.length > 0) {
      return parts.reduce((sum, part) => {
        if (!part || typeof part !== 'object') return sum;
        const letters = Array.isArray(part.letters) ? part.letters : [];
        return sum + letters.length;
      }, 0);
    }

    return top ? top.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Privacy-safe shadow summary — no full names / spellings.
 * @param {ReturnType<typeof runClassicalAbjad>} result
 * @param {{ productionAlifMaddaValue?: number|null }} [compare]
 */
export function buildClassicalShadowSummary(result, compare = {}) {
  const safe = result && typeof result === 'object' ? result : {};
  const letterCount = resolveClassicalShadowLetterCount(safe);

  const summary = {
    methodologyId: safe.methodologyId ?? CLASSICAL_ABJAD_METHODOLOGY.methodologyId,
    methodologyVersion: safe.methodologyVersion ?? CLASSICAL_ABJAD_METHODOLOGY.methodologyVersion,
    rulesetVersion: safe.rulesetVersion ?? CLASSICAL_ABJAD_METHODOLOGY.rulesetVersion,
    status: safe.status ?? 'unavailable',
    complete: Boolean(safe.complete),
    errorCode: safe.errorCode || null,
    total: typeof safe.total === 'number' ? safe.total : null,
    combinedTotal: safe.combinedTotal ?? null,
    includeMotherName: Boolean(safe.includeMotherName),
    letterCount,
    digitReductionApplied: false,
    hadAlifMadda: Boolean(safe.metadata?.hadAlifMadda),
    hadStandaloneHamza: Boolean(safe.metadata?.hadStandaloneHamza),
    productionAlifMaddaValue:
      compare.productionAlifMaddaValue != null ? compare.productionAlifMaddaValue : null,
    alifMaddaDivergence:
      Boolean(safe.metadata?.hadAlifMadda) &&
      compare.productionAlifMaddaValue != null &&
      compare.productionAlifMaddaValue !== 2,
  };

  return summary;
}
