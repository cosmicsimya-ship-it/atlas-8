/**
 * Curated Turkish → Arabic personal-name spellings for classical abjad.
 * Not a full transliterator: Latin names are never silently converted.
 *
 * Atlas MUST NOT treat حوسين as the standard spelling of Hüseyin.
 *
 * `autoConfirm` (Intelligence Layer / Ebced integration, see
 * docs/ebced/PHASE20-INTEGRATION-PLAN.md): most entries here name a
 * religiously-weighted figure (Hüseyin, Muhammed, Ali) where a wrong
 * spelling carries real weight and RFC-009 deliberately gates them behind
 * a confirmation round-trip. A small second class of entry — a common
 * Turkish name whose Arabic-origin word has exactly one standard,
 * uncontested spelling, no competing convention, and no religious-figure
 * sensitivity — can instead be marked `autoConfirm: true` to skip that
 * gate and compute immediately, on the same epistemic footing ADR-010
 * already uses for its default transliteration (disclosed, not silently
 * presented as the one true spelling — see resolveArabicSpelling's
 * disclosures for this path). Existing confirm-gated entries are
 * unchanged; this is additive only.
 */

/** @typedef {{
 *   latinKeys: string[],
 *   standardArabic: string,
 *   displayLatin: string,
 *   transliterationMethod: string,
 *   rejectedVariants?: string[],
 *   notes?: string,
 *   autoConfirm?: boolean,
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
  {
    latinKeys: ['furkan', 'furqan'],
    standardArabic: 'فرقان',
    displayLatin: 'Furkan',
    transliterationMethod: 'gazetteer-tr-ar-v1',
    rejectedVariants: [],
    autoConfirm: true,
    notes:
      'Furkan, Kur\'an kökenli tek ve tartışmasız yazımı olan bir isimdir (فرقان); ADR-010 varsayılan harf-harf çevirisi (فوركان) bu ismin bilinen Arapça kökenini yansıtmaz, bu yüzden gazetteer üzerinden onaysız hesaplanır.',
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
