/**
 * Ebced layer runner — deterministic letter→number calculation.
 * Separates calculatedData from interpretation. No LLM. No fate claims.
 *
 * Faz 1–2: calculation unchanged; source/methodology labels depend on
 * ATLAS_SYMBOLIC_METADATA_V2 (see methodology-ids.js).
 */

import { ARABIC_ABJAD, LATIN_ABJAD, DIGIT_MOTIFS } from '../data/ebced-table.js';
import {
  ATLAS_LATIN_MOTIF_METHODOLOGY,
  ATLAS_LATIN_MOTIF_METHODOLOGY_V1,
  EBCED_METHOD,
  LATIN_MOTIF_INTERPRETATION_LIMITATIONS,
  isSymbolicMetadataV2Enabled,
} from '../methodology-ids.js';

/** @deprecated Prefer resolveEbcedSource(); kept for importers. */
export const EBCED_SOURCE = ATLAS_LATIN_MOTIF_METHODOLOGY_V1.methodologyId;
export { EBCED_METHOD };

function resolveEbcedSource() {
  return isSymbolicMetadataV2Enabled()
    ? ATLAS_LATIN_MOTIF_METHODOLOGY.methodologyId
    : ATLAS_LATIN_MOTIF_METHODOLOGY_V1.methodologyId;
}

/**
 * @param {number} n
 * @returns {{ value: number, steps: string[] }}
 */
function reduceToDigit(n) {
  const steps = [];
  let current = Math.abs(Math.floor(n));
  while (current > 9) {
    const next = String(current)
      .split('')
      .reduce((s, d) => s + Number(d), 0);
    steps.push(`${current}→${next}`);
    current = next;
  }
  return { value: current, steps };
}

/**
 * @param {string} text
 */
function tokenizeLetters(text) {
  const normalized = String(text || '')
    .normalize('NFC')
    .trim();
  const letters = [];
  for (const ch of normalized) {
    const lower = ch.toLocaleLowerCase('tr-TR');
    if (ARABIC_ABJAD[ch] != null) {
      letters.push({ char: ch, value: ARABIC_ABJAD[ch], script: 'arabic' });
    } else if (LATIN_ABJAD[lower] != null) {
      letters.push({ char: ch, value: LATIN_ABJAD[lower], script: 'latin' });
    }
  }
  return letters;
}

/**
 * @param {import('../capability.js').SymbolicInput} input
 * @returns {{
 *   layerId: string,
 *   source: string,
 *   method: string,
 *   calculatedData: object,
 *   interpretation: string,
 *   themes: string[],
 *   cautions: string[],
 *   confidence: 'high'|'medium'|'low'|'none',
 *   limitations: string[],
 * }}
 */
export function runEbcedLayer(input = {}) {
  const primary = String(input.fullName || input.name || '').trim();
  if (!primary) {
    const err = new Error('EBCED_MISSING_NAME');
    err.code = 'EBCED_MISSING_NAME';
    throw err;
  }

  const parts = [{ label: 'primary', text: primary }];
  if (input.motherName && String(input.motherName).trim()) {
    parts.push({ label: 'motherName', text: String(input.motherName).trim() });
  }

  const breakdown = parts.map((part) => {
    const letters = tokenizeLetters(part.text);
    const sum = letters.reduce((s, l) => s + l.value, 0);
    const reduced = reduceToDigit(sum);
    return {
      label: part.label,
      text: part.text,
      letters: letters.map((l) => ({ char: l.char, value: l.value, script: l.script })),
      sum,
      reduced: reduced.value,
      reductionSteps: reduced.steps,
    };
  });

  const totalSum = breakdown.reduce((s, b) => s + b.sum, 0);
  const totalReduced = reduceToDigit(totalSum);
  const digit = totalReduced.value;
  const motif = DIGIT_MOTIFS[digit] ?? {
    themes: ['düşünme'],
    motif: 'açık bir düşünme alanı',
  };

  const calculatedData = {
    nameUsed: primary,
    usedMotherName: Boolean(input.motherName && String(input.motherName).trim()),
    parts: breakdown,
    totalSum,
    reducedDigit: digit,
    reductionSteps: totalReduced.steps,
    letterCount: breakdown.reduce((s, b) => s + b.letters.length, 0),
  };

  const v2 = isSymbolicMetadataV2Enabled();
  const interpretation = v2
    ? [
        `Atlas Latin Harf-Sayı Motifi içinde isim harflerinin sayısal toplamı ${totalSum} olarak hesaplandı; sembolik motif değeri ${digit}.`,
        `Eldeki verilerle bu sayı, “${motif.motif}” motifine bir düşünme alanı açabilir.`,
        ATLAS_LATIN_MOTIF_METHODOLOGY.disclaimer,
        'Bu sonuç kesin hüküm veya gelecek tahmini değildir.',
      ].join(' ')
    : [
        `Bu yöntem içinde isim harflerinin sayısal toplamı ${totalSum} olarak hesaplandı; sembolik olarak tek haneye indirgenmiş değer ${digit}.`,
        `Eldeki verilerle bu sayı, “${motif.motif}” motifine bir düşünme alanı açabilir.`,
        'Bu sonuç kesin hüküm veya gelecek tahmini değildir.',
      ].join(' ');

  const limitations = v2
    ? [...LATIN_MOTIF_INTERPRETATION_LIMITATIONS]
    : [
        'Latin/Türkçe isimler için transliterasyon tablosu kullanılır; klasik Arapça metinlerden farklı sonuçlar verebilir.',
        'Yorum, sayısal motiften türetilmiş sembolik bir çerçevedir.',
      ];

  return {
    layerId: 'ebced',
    source: resolveEbcedSource(),
    method: EBCED_METHOD,
    calculatedData,
    interpretation,
    themes: [...motif.themes],
    cautions: [
      'Harf-sayı motifi kesin gerçek veya kader iddiası değildir.',
      'Kritik kararların yerine geçmez.',
    ],
    // LEGACY_CONFIDENCE_STILL_PRESENT — retained for envelope compat; new clients use assessment.
    confidence: calculatedData.letterCount >= 2 ? 'medium' : 'low',
    limitations,
  };
}
