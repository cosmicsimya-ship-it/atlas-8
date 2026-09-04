/**
 * Per-letter traditional classifications (Nurânî/Zulmânî, gender, element)
 * for the 28 classical Abjad letters, reverse-engineered from
 * EBCED HESAPLAMA TABLOSU.xlsx ('Ebced Ana Sayfa'!D4:BY9 master letter
 * table — see docs/ebced/PHASE1-PHASE2-WORKBOOK-DISCOVERY.md §2.1).
 *
 * TRADITIONAL/INTERPRETIVE DATA (Category B) — not arithmetic. Keys match
 * CLASSICAL_KABIR_VALUES (classical-kabir-table.js) exactly, so any text
 * already normalized/folded to a canonical letter via
 * tokenizeClassicalSpelling() can be classified directly with no further
 * lookup.
 *
 * The workbook stores 73 rows (one per Unicode letter-form variant, e.g.
 * ye has 4 glyph variants); this file folds them to the 28 canonical
 * letters because within every variant group the N/Z, gender, and element
 * flags were identical (verified programmatically at extraction time — no
 * variant group disagreed with itself).
 *
 * The element cycle (Ateş→Su→Toprak→Hava, repeating every 4 letters in
 * classical Abjad order) is exactly regular — confirmed by re-deriving it
 * independently from the extracted table — so ELEMENT_CYCLE below is
 * offered as a cross-check, not a second source of truth; the literal table
 * is what's actually used.
 */

/** @typedef {'Nurani'|'Zulmani'} NuraniZulmani */
/** @typedef {'Erkek'|'Disi'} LetterGender */
/** @typedef {'Ates'|'Su'|'Toprak'|'Hava'} LetterElement */

export const LETTER_CLASSIFICATION_SOURCE =
  'workbook:Ebced Ana Sayfa!D4:BY9 (EBCED HESAPLAMA TABLOSU.xlsx)';

/**
 * @type {Readonly<Record<string, { nuraniZulmani: NuraniZulmani, gender: LetterGender, element: LetterElement, reading: string }>>}
 */
export const LETTER_CLASSIFICATIONS = Object.freeze({
  ا: { nuraniZulmani: 'Nurani', gender: 'Erkek', element: 'Ates', reading: 'elif' },
  ب: { nuraniZulmani: 'Zulmani', gender: 'Disi', element: 'Su', reading: 'be' },
  ج: { nuraniZulmani: 'Zulmani', gender: 'Erkek', element: 'Toprak', reading: 'cim' },
  د: { nuraniZulmani: 'Zulmani', gender: 'Disi', element: 'Hava', reading: 'dal' },
  ه: { nuraniZulmani: 'Nurani', gender: 'Erkek', element: 'Ates', reading: 'he' },
  و: { nuraniZulmani: 'Zulmani', gender: 'Disi', element: 'Su', reading: 'vav' },
  ز: { nuraniZulmani: 'Zulmani', gender: 'Erkek', element: 'Toprak', reading: 'ze' },
  ح: { nuraniZulmani: 'Nurani', gender: 'Disi', element: 'Hava', reading: 'ha' },
  ط: { nuraniZulmani: 'Nurani', gender: 'Erkek', element: 'Ates', reading: 'ti' },
  ي: { nuraniZulmani: 'Nurani', gender: 'Erkek', element: 'Su', reading: 'ye' },
  ك: { nuraniZulmani: 'Nurani', gender: 'Disi', element: 'Toprak', reading: 'kef' },
  ل: { nuraniZulmani: 'Nurani', gender: 'Erkek', element: 'Hava', reading: 'lam' },
  م: { nuraniZulmani: 'Nurani', gender: 'Disi', element: 'Ates', reading: 'mim' },
  ن: { nuraniZulmani: 'Nurani', gender: 'Erkek', element: 'Su', reading: 'nun' },
  س: { nuraniZulmani: 'Nurani', gender: 'Disi', element: 'Toprak', reading: 'sin' },
  ع: { nuraniZulmani: 'Nurani', gender: 'Erkek', element: 'Hava', reading: 'ayn' },
  ف: { nuraniZulmani: 'Zulmani', gender: 'Disi', element: 'Ates', reading: 'fe' },
  ص: { nuraniZulmani: 'Nurani', gender: 'Erkek', element: 'Su', reading: 'sad' },
  ق: { nuraniZulmani: 'Nurani', gender: 'Erkek', element: 'Toprak', reading: 'kaf' },
  ر: { nuraniZulmani: 'Nurani', gender: 'Disi', element: 'Hava', reading: 'ri' },
  ش: { nuraniZulmani: 'Zulmani', gender: 'Erkek', element: 'Ates', reading: 'sin_sin' },
  ت: { nuraniZulmani: 'Zulmani', gender: 'Disi', element: 'Su', reading: 'te' },
  ث: { nuraniZulmani: 'Zulmani', gender: 'Erkek', element: 'Toprak', reading: 'se' },
  خ: { nuraniZulmani: 'Zulmani', gender: 'Disi', element: 'Hava', reading: 'hi' },
  ذ: { nuraniZulmani: 'Zulmani', gender: 'Erkek', element: 'Ates', reading: 'zel' },
  ض: { nuraniZulmani: 'Zulmani', gender: 'Disi', element: 'Su', reading: 'dad' },
  ظ: { nuraniZulmani: 'Zulmani', gender: 'Erkek', element: 'Toprak', reading: 'zi' },
  غ: { nuraniZulmani: 'Zulmani', gender: 'Erkek', element: 'Hava', reading: 'gayn' },
});

/**
 * Standalone hamza (ء) has no dedicated row in the workbook's master table —
 * every elif-family form (ا آ أ إ ٱ ء) is grouped under elif's classification
 * there. Atlas's own classical ruleset gives standalone hamza value 0
 * (STANDALONE_HAMZA_POLICY in classical-kabir-table.js, a documented Atlas
 * product decision, unchanged here); its classification is inherited from
 * elif for the same reason the workbook groups it there, not independently
 * sourced.
 */
export const HAMZA_CLASSIFICATION = Object.freeze({ ...LETTER_CLASSIFICATIONS['ا'] });

/**
 * Cross-check only — see file header. Order matches classical Abjad
 * (elif..gayn); index into this array with (abjadOrderIndex % 4).
 * @type {readonly LetterElement[]}
 */
export const ELEMENT_CYCLE = Object.freeze(['Ates', 'Su', 'Toprak', 'Hava']);
