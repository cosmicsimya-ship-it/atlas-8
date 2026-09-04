/**
 * Name-pair ("couple") compatibility — reverse-engineered from
 * Çift Uyumu!G27:S27 in EBCED HESAPLAMA TABLOSU.xlsx (see
 * docs/ebced/PHASE1-PHASE2-WORKBOOK-DISCOVERY.md §2.5).
 *
 * total = ebcedSum(nameA) + ebcedSum(nameB); remainder = MOD(total + 7, 9);
 * verdict = fixed lookup table keyed by remainder. The arithmetic is fully
 * deterministic and reproducible; the verdict TEXT is a traditional/
 * numerological claim about relationship compatibility (Category B) — it is
 * never phrased as fact, and is returned as `traditionalInterpretation`, not
 * as `result`, so callers can't accidentally present it as the calculation's
 * primary output.
 */

import { calculateAbjad, ABJAD_KABIR_CLASSICAL_V1 } from './calculate-abjad.js';

export const COMPATIBILITY_METHODOLOGY_ID = 'ebced-name-pair-compatibility-v1';
const CONSTANT_OFFSET = 7;
const MODULUS = 9;

/** Verbatim from the workbook — see PHASE1-PHASE2-WORKBOOK-DISCOVERY.md §2.5. */
const VERDICT_TABLE = Object.freeze({
  0: 'Birbirlerini yıpratabilirler o nedenle önerilmiyor!',
  1: 'Orta uyumlu',
  2: 'Orta uyumlu',
  3: 'İlk başta gayet güzel giden sonrası problemli olabilir. Dikkat!',
  4: 'Ayrılma ihtimalleri düşük olsa da stresli geçen evlilik süreci',
  5: 'Gayet uyumlu bir çift',
  6: 'Birbirlerini yıpratabilirler o nedenle önerilmiyor!',
  7: 'Gayet uyumlu bir çift',
  8: 'Orta uyumlu',
  9: 'Birbirlerini yıpratabilirler o nedenle önerilmiyor!',
});

export const COMPATIBILITY_ERROR_CODES = Object.freeze({
  INVALID_A: 'COMPATIBILITY_INVALID_NAME_A',
  INVALID_B: 'COMPATIBILITY_INVALID_NAME_B',
});

/**
 * @typedef {{
 *   ok: boolean,
 *   nameATotal: number|null,
 *   nameBTotal: number|null,
 *   combinedTotal: number|null,
 *   remainder: number|null,
 *   traditionalInterpretation: string|null,
 *   methodologyId: string,
 *   errorCode: string|null,
 * }} CompatibilityResult
 */

/**
 * @param {string} arabicNameA — confirmed Arabic spelling
 * @param {string} arabicNameB — confirmed Arabic spelling
 * @returns {CompatibilityResult}
 */
export function calculateCompatibility(arabicNameA, arabicNameB) {
  const a = calculateAbjad(arabicNameA, ABJAD_KABIR_CLASSICAL_V1);
  if (!a.ok) {
    return {
      ok: false,
      nameATotal: null,
      nameBTotal: null,
      combinedTotal: null,
      remainder: null,
      traditionalInterpretation: null,
      methodologyId: COMPATIBILITY_METHODOLOGY_ID,
      errorCode: COMPATIBILITY_ERROR_CODES.INVALID_A,
    };
  }
  const b = calculateAbjad(arabicNameB, ABJAD_KABIR_CLASSICAL_V1);
  if (!b.ok) {
    return {
      ok: false,
      nameATotal: a.total,
      nameBTotal: null,
      combinedTotal: null,
      remainder: null,
      traditionalInterpretation: null,
      methodologyId: COMPATIBILITY_METHODOLOGY_ID,
      errorCode: COMPATIBILITY_ERROR_CODES.INVALID_B,
    };
  }

  const combinedTotal = a.total + b.total;
  const remainder = ((combinedTotal + CONSTANT_OFFSET) % MODULUS + MODULUS) % MODULUS;

  return {
    ok: true,
    nameATotal: a.total,
    nameBTotal: b.total,
    combinedTotal,
    remainder,
    traditionalInterpretation: VERDICT_TABLE[remainder],
    methodologyId: COMPATIBILITY_METHODOLOGY_ID,
    errorCode: null,
  };
}
