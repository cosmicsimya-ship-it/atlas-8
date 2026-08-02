/**
 * Atlas Classic Tarot interpretation methodology identity.
 * Card selection is separate from interpretation (see select-cards.js).
 */

export const ATLAS_CLASSIC_TAROT_METHODOLOGY = Object.freeze({
  methodologyId: 'atlas-classic-tarot-v1',
  methodologyVersion: '1.0.0',
  rulesetVersion: 'atlas-classic-tarot-rules-1.0.0',
  displayName: 'Atlas Classic Tarot Açılım Yorumu',
  category: 'tarot-spread',
  school: 'Classic / Rider–Waite–Smith symbolic pattern reading',
  disclaimer:
    'Classic Tarot sembolik örüntü okumasıdır; kesin kehanet veya zihin okuma iddiası taşımaz. ' +
    'Kart seçimi tarafsızdır; yorum niyet, pozisyon ve kart kombinasyonuna göre üretilir. ' +
    'Sonuç olasılıksal ve yorumlayıcıdır.',
  disputedAreas: Object.freeze([
    'Kart anlamları ekoller ve okuyucular arası değişebilir.',
    'Ters (reversed) kartlar Atlas v1’de varsayılan olarak kullanılmaz.',
    'Element ve sayı ilişkileri destekleyici katmandır; tek başına hüküm değildir.',
  ]),
  limitations: Object.freeze([
    'Gelecek kesinliği üretilmez.',
    'Kart sözlüğü sıralaması yerine niyet merkezli kombinasyon okuması önceliklidir.',
    'Fiziksel deste prosedürü anlatılmaz; okuma doğrudan sunulur.',
  ]),
});

export const TAROT_ENGINE_VERSION = 'atlas-tarot-engine-v1';

/** Depth levels — default is standard (2). */
export const DEPTH_LEVEL = Object.freeze({
  SHORT: 1,
  STANDARD: 2,
  DEEP: 3,
});

export const DEFAULT_CARD_COUNT = 3;
