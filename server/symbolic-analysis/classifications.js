/**
 * Per-letter traditional classification (Nurânî/Zulmânî, gender, element)
 * over a confirmed Arabic spelling. Reuses tokenizeClassicalSpelling for
 * normalization so classification always sees the same canonical letters
 * calculateAbjad summed — no separate/divergent normalization path.
 *
 * TRADITIONAL/INTERPRETIVE (Category B) — never a fact claim. Callers must
 * not present these counts as diagnosis, personality fact, or destiny;
 * scanSymbolicCertainty/sanitizeSymbolicProse (safety.js) still applies to
 * any prose built from this data.
 */

import { tokenizeClassicalSpelling } from './layers/classical-abjad-runner.js';
import {
  HAMZA_CLASSIFICATION,
  LETTER_CLASSIFICATIONS,
  LETTER_CLASSIFICATION_SOURCE,
} from './data/letter-classifications.js';

export const CLASSIFICATION_METHODOLOGY_ID = 'ebced-letter-classification-v1';

/**
 * @typedef {{
 *   letter: string,
 *   value: number,
 *   nuraniZulmani: 'Nurani'|'Zulmani'|null,
 *   gender: 'Erkek'|'Disi'|null,
 *   element: 'Ates'|'Su'|'Toprak'|'Hava'|null,
 * }} ClassifiedLetter
 *
 * @typedef {{
 *   ok: boolean,
 *   normalizedText: string,
 *   letters: ClassifiedLetter[],
 *   counts: {
 *     nuraniZulmani: { Nurani: number, Zulmani: number },
 *     gender: { Erkek: number, Disi: number },
 *     element: { Ates: number, Su: number, Toprak: number, Hava: number },
 *   },
 *   dominant: { nuraniZulmani: string|null, gender: string|null, element: string|null },
 *   methodologyId: string,
 *   source: string,
 *   errorCode: string|null,
 * }} ClassificationResult
 */

function emptyCounts() {
  return {
    nuraniZulmani: { Nurani: 0, Zulmani: 0 },
    gender: { Erkek: 0, Disi: 0 },
    element: { Ates: 0, Su: 0, Toprak: 0, Hava: 0 },
  };
}

function dominantOf(bucket) {
  let best = null;
  let bestCount = 0;
  for (const [key, count] of Object.entries(bucket)) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Classify every counted letter of a confirmed Arabic spelling.
 * @param {string} arabicText
 * @returns {ClassificationResult}
 */
export function classifyArabicText(arabicText) {
  const tokenized = tokenizeClassicalSpelling(arabicText);
  if (!tokenized.ok) {
    return {
      ok: false,
      normalizedText: tokenized.normalizedSpelling || '',
      letters: [],
      counts: emptyCounts(),
      dominant: { nuraniZulmani: null, gender: null, element: null },
      methodologyId: CLASSIFICATION_METHODOLOGY_ID,
      source: LETTER_CLASSIFICATION_SOURCE,
      errorCode: tokenized.errorCode || 'CLASSICAL_ABJAD_EMPTY',
    };
  }

  const counts = emptyCounts();
  const letters = tokenized.letters.map((l) => {
    const classification =
      l.normalizedCharacter === 'ء'
        ? HAMZA_CLASSIFICATION
        : LETTER_CLASSIFICATIONS[l.normalizedCharacter] || null;
    if (classification) {
      counts.nuraniZulmani[classification.nuraniZulmani] += 1;
      counts.gender[classification.gender] += 1;
      counts.element[classification.element] += 1;
    }
    return {
      letter: l.normalizedCharacter,
      value: l.value ?? 0,
      nuraniZulmani: classification?.nuraniZulmani ?? null,
      gender: classification?.gender ?? null,
      element: classification?.element ?? null,
    };
  });

  return {
    ok: true,
    normalizedText: tokenized.normalizedSpelling,
    letters,
    counts,
    dominant: {
      nuraniZulmani: dominantOf(counts.nuraniZulmani),
      gender: dominantOf(counts.gender),
      element: dominantOf(counts.element),
    },
    methodologyId: CLASSIFICATION_METHODOLOGY_ID,
    source: LETTER_CLASSIFICATION_SOURCE,
    errorCode: null,
  };
}
