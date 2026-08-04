/**
 * Birth-date Pythagorean numerology methodology identity.
 * Separate from daily digit-sum day numbers and letter-number motifs.
 */

export const ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY = Object.freeze({
  methodologyId: 'atlas-pythagorean-birth-v1',
  methodologyVersion: '1.0.0',
  rulesetVersion: 'atlas-pythagorean-birth-rules-1.0.0',
  displayName: 'Atlas Pythagorean Doğum Numerolojisi',
  category: 'numerology-birth',
  school: 'Western Pythagorean (digit-sum, master 11/22/33)',
  isClassicalAbjad: false,
  disclaimer:
    'Western Pythagorean digit-sum ekolü (usta sayılar 11/22/33 korunur). ' +
    'Farklı numeroloji ekolleri farklı sonuç verebilir; tek mutlak doğru değildir. ' +
    'Sembolik yorum alanıdır; bilimsel geçmiş yaşam kanıtı iddiası taşımaz.',
  disputedAreas: Object.freeze([
    'Bazı ekoller usta sayıları (11/22/33) korumaz.',
    'Yaşam döngüsü yaş aralıkları ekoller arası değişir; Atlas 36−LP / 27 / kalan formülünü kullanır.',
    'Karmik borç sayıları (13/14/16/19) spiritüel yorum geleneğidir; tarihsel kanıt değildir.',
  ]),
  limitations: Object.freeze([
    'İsim tabanlı katmanlar (İfade, Ruh Arzusu, Kişilik) ad soyad olmadan hesaplanmaz.',
    'Geçmiş yaşam iddiaları üretilmez; karmik temalar yalnızca sembolik çerçevede sunulur.',
    'Günlük takvim numerolojisi (gregorian-numerology katmanı) bu metodolojiden ayrıdır.',
  ]),
});

export const NUMEROLOGY_ENGINE_VERSION = 'atlas-numerology-engine-v1';

/** Depth levels — default is standard (2). */
export const DEPTH_LEVEL = Object.freeze({
  SHORT: 1,
  STANDARD: 2,
  DEEP: 3,
});

export const KARMIC_DEBT_NUMBERS = Object.freeze([13, 14, 16, 19]);

export const MASTER_NUMBERS = Object.freeze([11, 22, 33]);
