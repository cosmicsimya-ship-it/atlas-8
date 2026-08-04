/**
 * Deterministic Esma numeric matching from the verified abjad catalog.
 * LLM MUST NOT invent Esma names for exact matches when the catalog is empty.
 */

import { ABJAD_KABIR_CLASSICAL_V1 } from './calculate-abjad.js';
import {
  ESMA_ABJAD_CATALOG,
  ESMA_ABJAD_CATALOG_VERSION,
  lookupEsmaAbjadEntry,
} from './data/esma-abjad-catalog.js';

/** @typedef {'exact'|'near'|'reduced'|'traditional'|'none'} EsmaMatchType */

export const ESMA_MATCH_TYPES = Object.freeze({
  EXACT: 'exact',
  NEAR: 'near',
  REDUCED: 'reduced',
  TRADITIONAL: 'traditional',
  NONE: 'none',
});

export const ESMA_MATCH_METHODOLOGY = Object.freeze({
  exact: 'esma-match-abjad-exact-v1',
  near: 'esma-match-abjad-nearest-v1',
  reduced: 'esma-match-abjad-reduced-v1',
  traditional: 'esma-match-traditional-v1',
});

/**
 * Digital root / digit reduction (not classical primary).
 * @param {number} n
 */
export function reduceToDigit(n) {
  let x = Math.abs(Math.trunc(Number(n) || 0));
  while (x > 9) {
    x = String(x)
      .split('')
      .reduce((s, d) => s + Number(d), 0);
  }
  return x;
}

/**
 * @param {import('./data/esma-abjad-catalog.js').VerifiedEsmaAbjadEntry} entry
 * @param {'bare'|'definite'} form
 * @param {EsmaMatchType} matchType
 * @param {number} targetValue
 * @param {number} [delta]
 */
function toMatchHit(entry, form, matchType, targetValue, delta = 0) {
  const arabic = form === 'definite' ? entry.definiteArabic : entry.canonicalArabic;
  const value = form === 'definite' ? entry.definiteValue : entry.bareValue;
  const letters =
    form === 'definite' ? entry.definiteLetterBreakdown : entry.letterBreakdown;
  return {
    id: entry.id,
    displayNameTr: entry.displayNameTr,
    arabic,
    form,
    value,
    targetValue,
    delta,
    matchType,
    letterBreakdown: letters,
    includesDefiniteArticle: form === 'definite',
    calculationMethod: entry.calculationMethod,
  };
}

/**
 * Enumerate bare + definite value rows from the verified catalog.
 * @returns {Array<{ entry: import('./data/esma-abjad-catalog.js').VerifiedEsmaAbjadEntry, form: 'bare'|'definite', value: number }>}
 */
function catalogValueRows() {
  /** @type {Array<{ entry: typeof ESMA_ABJAD_CATALOG[number], form: 'bare'|'definite', value: number }>} */
  const rows = [];
  for (const entry of ESMA_ABJAD_CATALOG) {
    rows.push({ entry, form: 'bare', value: entry.bareValue });
    rows.push({ entry, form: 'definite', value: entry.definiteValue });
  }
  return rows;
}

/**
 * Find Esma matches for a target abjad value.
 *
 * @param {{
 *   value: number,
 *   matchType?: EsmaMatchType,
 *   methodologyId?: string,
 *   nearMaxDelta?: number,
 *   topK?: number,
 * }} options
 */
export function findEsmaMatches(options = {}) {
  const value = Number(options.value);
  const matchType = options.matchType || ESMA_MATCH_TYPES.EXACT;
  const methodologyId = options.methodologyId || ABJAD_KABIR_CLASSICAL_V1;
  const nearMaxDelta = Number.isFinite(options.nearMaxDelta) ? Number(options.nearMaxDelta) : 5;
  const topK = Math.min(Math.max(Number(options.topK) || 5, 1), 10);

  const baseMeta = {
    catalogVersion: ESMA_ABJAD_CATALOG_VERSION,
    methodologyId,
    matchMethodologyId: ESMA_MATCH_METHODOLOGY[matchType] || null,
    targetValue: Number.isFinite(value) ? value : null,
    matchType,
    invented: false,
  };

  if (methodologyId !== ABJAD_KABIR_CLASSICAL_V1) {
    return {
      ...baseMeta,
      ok: false,
      matches: [],
      emptyReason: 'UNSUPPORTED_METHODOLOGY',
      userMessage:
        'Bu eşleştirme yalnızca abjad-kabir-classical-v1 doğrulanmış veri setiyle yapılır.',
    };
  }

  if (!Number.isFinite(value)) {
    return {
      ...baseMeta,
      ok: false,
      matches: [],
      emptyReason: 'INVALID_VALUE',
      userMessage: 'Geçerli bir hedef sayı gerekli.',
    };
  }

  if (matchType === ESMA_MATCH_TYPES.TRADITIONAL) {
    return {
      ...baseMeta,
      ok: true,
      matches: [],
      emptyReason: 'TRADITIONAL_NOT_IN_NUMERIC_CATALOG',
      userMessage:
        'Geleneksel ilişkilendirme sayısal eşitlik değildir; bu doğrulanmış ebced veri setinde geleneksel eşleme satırı yok.',
    };
  }

  const rows = catalogValueRows();

  if (matchType === ESMA_MATCH_TYPES.EXACT) {
    const matches = rows
      .filter((r) => r.value === value)
      .map((r) => toMatchHit(r.entry, r.form, ESMA_MATCH_TYPES.EXACT, value, 0));
    if (!matches.length) {
      return {
        ...baseMeta,
        ok: true,
        matches: [],
        emptyReason: 'NO_EXACT_MATCH',
        userMessage:
          'Doğrulanmış veri setinde tam sayısal eşleşme bulamadım. Yaklaşık veya doğrulanmamış bir isim uydurmam.',
      };
    }
    return { ...baseMeta, ok: true, matches, emptyReason: null, userMessage: null };
  }

  if (matchType === ESMA_MATCH_TYPES.NEAR) {
    const scored = rows
      .map((r) => ({ ...r, delta: Math.abs(r.value - value) }))
      .filter((r) => r.delta > 0 && r.delta <= nearMaxDelta)
      .sort((a, b) => a.delta - b.delta || a.value - b.value)
      .slice(0, topK)
      .map((r) => toMatchHit(r.entry, r.form, ESMA_MATCH_TYPES.NEAR, value, r.delta));
    if (!scored.length) {
      return {
        ...baseMeta,
        ok: true,
        matches: [],
        emptyReason: 'NO_NEAR_MATCH',
        userMessage: `Doğrulanmış veri setinde ±${nearMaxDelta} içinde yakın eşleşme bulamadım.`,
      };
    }
    return {
      ...baseMeta,
      ok: true,
      matches: scored,
      emptyReason: null,
      userMessage:
        'Bunlar yakın değerlerdir; tam sayısal eşleşme olarak sunulamaz.',
    };
  }

  if (matchType === ESMA_MATCH_TYPES.REDUCED) {
    const targetRoot = reduceToDigit(value);
    const matches = rows
      .filter((r) => reduceToDigit(r.value) === targetRoot)
      .slice(0, topK)
      .map((r) => ({
        ...toMatchHit(r.entry, r.form, ESMA_MATCH_TYPES.REDUCED, value, Math.abs(r.value - value)),
        reducedTarget: targetRoot,
        reducedEntry: reduceToDigit(r.value),
        reductionMethod: 'digital-root',
      }));
    return {
      ...baseMeta,
      ok: true,
      matches,
      emptyReason: matches.length ? null : 'NO_REDUCED_MATCH',
      userMessage: matches.length
        ? `İndirgenmiş eşleşme (rakam kökü ${targetRoot}). Bu, klasik tam ebced eşitliği değildir; yöntem açıkça belirtilmelidir.`
        : `İndirgenmiş eşleşme (rakam kökü ${targetRoot}) bulunamadı. Bu yöntem klasik tam ebced eşitliği değildir.`,
    };
  }

  return {
    ...baseMeta,
    ok: true,
    matches: [],
    emptyReason: 'UNKNOWN_MATCH_TYPE',
    userMessage: 'Bilinmeyen eşleşme türü.',
  };
}

/**
 * Resolve a user Esma name claim (e.g. "Latif 128") against verified values.
 *
 * @param {{ nameQuery: string, claimedValue?: number|null }} input
 */
export function verifyEsmaValueClaim(input = {}) {
  const entry = lookupEsmaAbjadEntry(input.nameQuery);
  const claimed =
    input.claimedValue == null || input.claimedValue === ''
      ? null
      : Number(input.claimedValue);

  if (!entry) {
    return {
      ok: false,
      found: false,
      entry: null,
      claimAccepted: false,
      userMessage:
        'Bu Esma adı doğrulanmış ebced veri setinde yok; değer uyduramam. Arapça yazımı (لطيف / اللطيف gibi) paylaşır mısın?',
    };
  }

  const bareOk = claimed != null && claimed === entry.bareValue;
  const defOk = claimed != null && claimed === entry.definiteValue;
  const claimAccepted = bareOk || defOk;

  return {
    ok: true,
    found: true,
    entry,
    claimedValue: Number.isFinite(claimed) ? claimed : null,
    claimAccepted,
    matchedForm: bareOk ? 'bare' : defOk ? 'definite' : null,
    userMessage: claimAccepted
      ? null
      : claimed == null
        ? null
        : `Kullanıcı iddiası (${claimed}) doğrulanmış hesapla uyuşmuyor. ${entry.canonicalArabic} = ${entry.bareValue}; ${entry.definiteArabic} = ${entry.definiteValue} (${entry.calculationMethod}).`,
  };
}

/**
 * Human-readable labels for match types (TR).
 */
export const ESMA_MATCH_TYPE_LABELS = Object.freeze({
  exact: 'Tam sayısal eşleşme',
  near: 'Yakın değer',
  reduced: 'İndirgenmiş eşleşme',
  traditional: 'Geleneksel ilişkilendirme',
  none: 'Belirsiz / eşleşme bulunamadı',
});
