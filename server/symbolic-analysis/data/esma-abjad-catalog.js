/**
 * Verified Esma abjad values for classical kebîr matching.
 * Bare (without ال) and definite (with ال) forms are stored separately.
 * Values are computed via calculateAbjad at module load — never LLM totals.
 *
 * Theme-motif catalog (esma-catalog.js) remains separate; this file is for
 * numeric exact/near/reduced match only.
 */

import { calculateAbjad, ABJAD_KABIR_CLASSICAL_V1 } from '../calculate-abjad.js';

/**
 * @typedef {{
 *   letter: string,
 *   value: number,
 * }} EsmaLetterBreakdown
 *
 * @typedef {{
 *   id: string,
 *   canonicalArabic: string,
 *   definiteArabic: string,
 *   displayNameTr: string,
 *   bareValue: number,
 *   definiteValue: number,
 *   calculationMethod: string,
 *   letterBreakdown: EsmaLetterBreakdown[],
 *   definiteLetterBreakdown: EsmaLetterBreakdown[],
 *   latinAliases: string[],
 * }} VerifiedEsmaAbjadEntry
 */

/**
 * Seed orthographies — totals filled by buildVerifiedEsmaEntry.
 * @type {readonly { id: string, canonicalArabic: string, definiteArabic: string, displayNameTr: string, latinAliases: string[] }[]}
 */
const ESMA_ABJAD_SEEDS = Object.freeze([
  {
    id: 'latif',
    canonicalArabic: 'لطيف',
    definiteArabic: 'اللطيف',
    displayNameTr: 'El-Latîf',
    latinAliases: ['latif', 'latîf', 'el-latif', 'el-latîf', 'el latif', 'اللطيف', 'لطيف'],
  },
  {
    id: 'melik',
    canonicalArabic: 'ملك',
    definiteArabic: 'الملك',
    displayNameTr: 'El-Melik',
    latinAliases: ['melik', 'malik', 'el-melik', 'el-malik', 'el melik', 'الملك', 'ملك'],
  },
  {
    id: 'rahman',
    canonicalArabic: 'رحمن',
    definiteArabic: 'الرحمن',
    displayNameTr: 'Er-Rahmân',
    latinAliases: ['rahman', 'rahmân', 'er-rahman', 'er-rahmân'],
  },
  {
    id: 'rahim',
    canonicalArabic: 'رحيم',
    definiteArabic: 'الرحيم',
    displayNameTr: 'Er-Rahîm',
    latinAliases: ['rahim', 'rahîm', 'er-rahim', 'er-rahîm'],
  },
  {
    id: 'hakim',
    canonicalArabic: 'حكيم',
    definiteArabic: 'الحكيم',
    displayNameTr: 'El-Hakîm',
    latinAliases: ['hakim', 'hakîm', 'el-hakim', 'el-hakîm'],
  },
  {
    id: 'selam',
    canonicalArabic: 'سلام',
    definiteArabic: 'السلام',
    displayNameTr: 'Es-Selâm',
    latinAliases: ['selam', 'salam', 'es-selam', 'es-selâm'],
  },
]);

/**
 * @param {{ id: string, canonicalArabic: string, definiteArabic: string, displayNameTr: string, latinAliases: string[] }} seed
 * @returns {VerifiedEsmaAbjadEntry}
 */
function buildVerifiedEsmaEntry(seed) {
  const bare = calculateAbjad(seed.canonicalArabic, ABJAD_KABIR_CLASSICAL_V1);
  const definite = calculateAbjad(seed.definiteArabic, ABJAD_KABIR_CLASSICAL_V1);
  if (!bare.ok || !definite.ok) {
    throw new Error(
      `ESMA_ABJAD_SEED_INVALID:${seed.id}:bare=${bare.errorCode ?? 'ok'}:def=${definite.errorCode ?? 'ok'}`,
    );
  }
  return Object.freeze({
    id: seed.id,
    canonicalArabic: seed.canonicalArabic,
    definiteArabic: seed.definiteArabic,
    displayNameTr: seed.displayNameTr,
    bareValue: bare.total,
    definiteValue: definite.total,
    calculationMethod: ABJAD_KABIR_CLASSICAL_V1,
    letterBreakdown: Object.freeze(bare.letters.map((l) => Object.freeze({ ...l }))),
    definiteLetterBreakdown: Object.freeze(definite.letters.map((l) => Object.freeze({ ...l }))),
    latinAliases: Object.freeze([...seed.latinAliases]),
  });
}

/** @type {readonly VerifiedEsmaAbjadEntry[]} */
export const ESMA_ABJAD_CATALOG = Object.freeze(ESMA_ABJAD_SEEDS.map(buildVerifiedEsmaEntry));

export const ESMA_ABJAD_CATALOG_VERSION = 'esma-abjad-verified-v1';
export const ESMA_ABJAD_CATALOG_SOURCE = 'server/symbolic-analysis/data/esma-abjad-catalog.js';

/**
 * @param {string} query
 * @returns {VerifiedEsmaAbjadEntry|null}
 */
export function lookupEsmaAbjadEntry(query) {
  const raw = String(query || '').trim();
  if (!raw) return null;
  const lower = raw.toLocaleLowerCase('tr-TR');
  for (const entry of ESMA_ABJAD_CATALOG) {
    if (entry.canonicalArabic === raw || entry.definiteArabic === raw) return entry;
    if (entry.id === lower) return entry;
    if (entry.displayNameTr.toLocaleLowerCase('tr-TR') === lower) return entry;
    if (entry.latinAliases.some((a) => a.toLocaleLowerCase('tr-TR') === lower)) return entry;
  }
  return null;
}
