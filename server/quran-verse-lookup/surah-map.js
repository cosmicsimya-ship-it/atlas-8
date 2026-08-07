/**
 * Canonical Hafs surah number ↔ Turkish name map.
 * LLM must never invent surah numbers; all name resolution is deterministic here.
 */

import { SURAH_AYAH_COUNTS } from '../cross-layer-synthesis/quran-safety.js';

/** Display names (canonical TR orthography for ATLAS replies). */
export const SURAH_NAMES_TR = Object.freeze([
  'Fâtiha',
  'Bakara',
  'Âl-i İmrân',
  'Nisâ',
  'Mâide',
  'En‘âm',
  'A‘râf',
  'Enfâl',
  'Tevbe',
  'Yûnus',
  'Hûd',
  'Yûsuf',
  'Ra‘d',
  'İbrâhîm',
  'Hicr',
  'Nahl',
  'İsrâ',
  'Kehf',
  'Meryem',
  'Tâhâ',
  'Enbiyâ',
  'Hac',
  'Mü’minûn',
  'Nûr',
  'Furkân',
  'Şuarâ',
  'Neml',
  'Kasas',
  'Ankebût',
  'Rûm',
  'Lokmân',
  'Secde',
  'Ahzâb',
  'Sebe’',
  'Fâtır',
  'Yâsîn',
  'Sâffât',
  'Sâd',
  'Zümer',
  'Mü’min',
  'Fussilet',
  'Şûrâ',
  'Zuhruf',
  'Duhân',
  'Câsiye',
  'Ahkâf',
  'Muhammed',
  'Fetih',
  'Hucurât',
  'Kâf',
  'Zâriyât',
  'Tûr',
  'Necm',
  'Kamer',
  'Rahmân',
  'Vâkıa',
  'Hadîd',
  'Mücâdele',
  'Haşr',
  'Mümtehine',
  'Saff',
  'Cuma',
  'Münâfikûn',
  'Tegâbün',
  'Talâk',
  'Tahrîm',
  'Mülk',
  'Kalem',
  'Hâkka',
  'Meâric',
  'Nûh',
  'Cin',
  'Müzzemmil',
  'Müddessir',
  'Kıyâme',
  'İnsân',
  'Mürselât',
  'Nebe’',
  'Nâziât',
  'Abese',
  'Tekvîr',
  'İnfitâr',
  'Mutaffifîn',
  'İnşikâk',
  'Bürûc',
  'Târık',
  'A‘lâ',
  'Gâşiye',
  'Fecr',
  'Beled',
  'Şems',
  'Leyl',
  'Duhâ',
  'İnşirâh',
  'Tîn',
  'Alak',
  'Kadr',
  'Beyyine',
  'Zilzâl',
  'Âdiyât',
  'Kâria',
  'Tekâsür',
  'Asr',
  'Hümeze',
  'Fîl',
  'Kureyş',
  'Mâûn',
  'Kevser',
  'Kâfirûn',
  'Nasr',
  'Tebbet',
  'İhlâs',
  'Felak',
  'Nâs',
]);

/**
 * Fold Turkish orthography for alias matching.
 * @param {string} s
 */
export function normalizeSurahToken(s) {
  return String(s ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`‘´]/g, '')
    .replace(/[âáàä]/g, 'a')
    .replace(/[êéèë]/g, 'e')
    .replace(/[îíìï]/g, 'i')
    .replace(/[ôóòö]/g, 'o')
    .replace(/[ûúùü]/g, 'u')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/** Extra aliases → surah number (1..114). Keys must already be normalizeSurahToken form. */
const EXTRA_ALIASES = Object.freeze({
  fatiha: 1,
  hamd: 1,
  bakara: 2,
  baqara: 2,
  alibakara: 2,
  alimran: 3,
  aliimran: 3,
  imran: 3,
  nisa: 4,
  maide: 5,
  enam: 6,
  enaam: 6,
  araf: 7,
  enfal: 8,
  anfal: 8,
  tevbe: 9,
  tevbei: 9,
  barae: 9,
  yunus: 10,
  hud: 11,
  yusuf: 12,
  rad: 13,
  ibrahim: 14,
  hicr: 15,
  nahl: 16,
  isra: 17,
  beniisrail: 17,
  kehf: 18,
  meryem: 19,
  taha: 20,
  enbiya: 21,
  hac: 22,
  muminun: 23,
  muminoon: 23,
  nur: 24,
  furkan: 25,
  suara: 26,
  neml: 27,
  kasas: 28,
  ankebut: 29,
  rum: 30,
  lokman: 31,
  secde: 32,
  ahzab: 33,
  sebe: 34,
  saba: 34,
  fatir: 35,
  yasin: 36,
  yaseen: 36,
  saffat: 37,
  sad: 38,
  zumer: 39,
  zumar: 39,
  mumin: 40,
  gafir: 40,
  fussilet: 41,
  sura: 42,
  zuhruf: 43,
  duhan: 44,
  casiye: 45,
  ahkaf: 46,
  muhammed: 47,
  fetih: 48,
  hucurat: 49,
  kaf: 50,
  zariyat: 51,
  tur: 52,
  necm: 53,
  kamer: 54,
  rahman: 55,
  vakia: 56,
  hadid: 57,
  mucadele: 58,
  hasr: 59,
  mumtehine: 60,
  saff: 61,
  cuma: 62,
  cumua: 62,
  munafikun: 63,
  tegabun: 64,
  talak: 65,
  tahrim: 66,
  mulk: 67,
  kalem: 68,
  hakka: 69,
  mearic: 70,
  nuh: 71,
  cin: 72,
  muzemmil: 73,
  muddessir: 74,
  kiyame: 75,
  insan: 76,
  dehr: 76,
  murselat: 77,
  nebe: 78,
  naziat: 79,
  abese: 80,
  tekvir: 81,
  infitar: 82,
  mutaffifin: 83,
  insikak: 84,
  buruc: 85,
  tarik: 86,
  ala: 87,
  gasiye: 88,
  fecr: 89,
  beled: 90,
  sems: 91,
  leyl: 92,
  duha: 93,
  insirah: 94,
  serh: 94,
  tin: 95,
  alak: 96,
  kadr: 97,
  beyyine: 98,
  zilzal: 99,
  adiyat: 100,
  karia: 101,
  tekasur: 102,
  asr: 103,
  humeze: 104,
  fil: 105,
  kureys: 106,
  maun: 107,
  kevser: 108,
  kafirun: 109,
  nasr: 110,
  tebbet: 111,
  mesed: 111,
  ihlas: 112,
  ihlaas: 112,
  felak: 113,
  nas: 114,
});

/** @type {Map<string, number>} */
const ALIAS_TO_NUMBER = (() => {
  const map = new Map();
  for (let i = 0; i < SURAH_NAMES_TR.length; i += 1) {
    const n = i + 1;
    const canon = normalizeSurahToken(SURAH_NAMES_TR[i]);
    if (canon) map.set(canon, n);
  }
  for (const [alias, n] of Object.entries(EXTRA_ALIASES)) {
    map.set(alias, n);
  }
  return map;
})();

/**
 * @param {number} surahNumber
 * @returns {string|null}
 */
export function getSurahName(surahNumber) {
  const n = Number(surahNumber);
  if (!Number.isInteger(n) || n < 1 || n > 114) return null;
  return SURAH_NAMES_TR[n - 1];
}

/**
 * @param {number} surahNumber
 * @returns {number|null}
 */
export function getAyahCount(surahNumber) {
  const n = Number(surahNumber);
  if (!Number.isInteger(n) || n < 1 || n > 114) return null;
  return SURAH_AYAH_COUNTS[n - 1];
}

/**
 * Resolve Turkish / Latin surah name token to number.
 * @param {string} name
 * @returns {number|null}
 */
export function resolveSurahNumberByName(name) {
  const key = normalizeSurahToken(name);
  if (!key) return null;
  return ALIAS_TO_NUMBER.get(key) ?? null;
}

/**
 * Sorted alias keys longest-first for greedy name matching in free text.
 * @returns {string[]}
 */
export function getSurahAliasKeysLongestFirst() {
  return [...ALIAS_TO_NUMBER.keys()].sort((a, b) => b.length - a.length);
}

/**
 * @param {string} aliasKey normalized
 * @returns {number|null}
 */
export function surahNumberFromAliasKey(aliasKey) {
  return ALIAS_TO_NUMBER.get(aliasKey) ?? null;
}

export const CANONICAL_SURAH_COUNT = 114;
