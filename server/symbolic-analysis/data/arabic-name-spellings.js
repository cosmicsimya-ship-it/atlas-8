/**
 * Curated Turkish → Arabic personal-name spellings for classical abjad.
 * Not a full transliterator: Latin names are never silently converted.
 *
 * Atlas MUST NOT treat حوسين as the standard spelling of Hüseyin.
 */

/** @typedef {{
 *   latinKeys: string[],
 *   standardArabic: string,
 *   displayLatin: string,
 *   transliterationMethod: string,
 *   rejectedVariants?: string[],
 *   notes?: string,
 * }} NameSpellingEntry */

/** @type {readonly NameSpellingEntry[]} */
export const ARABIC_NAME_SPELLINGS = Object.freeze([
  {
    latinKeys: ['hüseyin', 'huseyin', 'husein', 'husayn', 'hussain', 'hosein'],
    standardArabic: 'حسين',
    displayLatin: 'Hüseyin',
    transliterationMethod: 'gazetteer-tr-ar-v1',
    rejectedVariants: ['حوسين'],
    notes: 'Standart yazım حسين; vav ekli حوسين Atlas standart yazımı değildir.',
  },
  {
    latinKeys: ['muhammed', 'muhammad', 'mohammad', 'mehmet'],
    standardArabic: 'محمد',
    displayLatin: 'Muhammed',
    transliterationMethod: 'gazetteer-tr-ar-v1',
    rejectedVariants: [],
  },
  {
    latinKeys: ['ali'],
    standardArabic: 'علي',
    displayLatin: 'Ali',
    transliterationMethod: 'gazetteer-tr-ar-v1',
    rejectedVariants: [],
  },
]);

/**
 * Strip Arabic harakat / tatwil for orthography compare.
 * @param {string} text
 */
export function stripArabicMarks(text) {
  return String(text || '')
    .normalize('NFC')
    .replace(/[\u064B-\u065F\u0670\u0640]/gu, '');
}

/**
 * @param {string} latin
 */
export function normalizeLatinNameKey(latin) {
  return String(latin || '')
    .normalize('NFC')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/['’`]/g, '');
}

/**
 * @param {string} latinOrKey
 * @returns {NameSpellingEntry|null}
 */
export function lookupNameSpelling(latinOrKey) {
  const key = normalizeLatinNameKey(latinOrKey);
  if (!key) return null;
  return ARABIC_NAME_SPELLINGS.find((e) => e.latinKeys.includes(key)) ?? null;
}

/**
 * @param {string} arabic
 * @returns {{ entry: NameSpellingEntry, kind: 'standard'|'rejected' }|null}
 */
export function classifyArabicNameVariant(arabic) {
  const bare = stripArabicMarks(arabic);
  if (!bare) return null;
  for (const entry of ARABIC_NAME_SPELLINGS) {
    if (stripArabicMarks(entry.standardArabic) === bare) {
      return { entry, kind: 'standard' };
    }
    for (const rejected of entry.rejectedVariants || []) {
      if (stripArabicMarks(rejected) === bare) {
        return { entry, kind: 'rejected' };
      }
    }
  }
  return null;
}
