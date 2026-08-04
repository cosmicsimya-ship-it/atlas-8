/**
 * Classic Tarot deck — 78 cards with Turkish display names.
 * Metadata supports combination analysis (element, number, arcana, polarity).
 */

/** @typedef {'major'|'wands'|'cups'|'swords'|'pentacles'} TarotSuit */
/** @typedef {'fire'|'water'|'air'|'earth'|'spirit'} TarotElement */
/** @typedef {'active'|'passive'|'balanced'} TarotPolarity */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   suit: TarotSuit,
 *   arcana: 'major'|'minor',
 *   number: number|null,
 *   element: TarotElement,
 *   polarity: TarotPolarity,
 *   keywords: string[],
 *   theme: string,
 * }} TarotCard
 */

/** @type {Omit<TarotCard, 'arcana'>[]} */
const MAJORS = [
  { id: 'major-0', name: 'Deli', suit: 'major', number: 0, element: 'spirit', polarity: 'active', keywords: ['başlangıç', 'özgürlük', 'risk'], theme: 'bilinmeyene adım' },
  { id: 'major-1', name: 'Büyücü', suit: 'major', number: 1, element: 'spirit', polarity: 'active', keywords: ['irade', 'beceri', 'odak'], theme: 'kaynakları yönlendirme' },
  { id: 'major-2', name: 'Azize', suit: 'major', number: 2, element: 'water', polarity: 'passive', keywords: ['sezgi', 'giz', 'iç ses'], theme: 'görünmeyeni dinleme' },
  { id: 'major-3', name: 'İmparatoriçe', suit: 'major', number: 3, element: 'earth', polarity: 'passive', keywords: ['bereket', 'bakım', 'üretim'], theme: 'besleyen alan' },
  { id: 'major-4', name: 'İmparator', suit: 'major', number: 4, element: 'fire', polarity: 'active', keywords: ['yapı', 'sınır', 'otorite'], theme: 'düzen kurma' },
  { id: 'major-5', name: 'Aziz', suit: 'major', number: 5, element: 'earth', polarity: 'passive', keywords: ['öğreti', 'aidiyet', 'gelenek'], theme: 'ortak değer çerçevesi' },
  { id: 'major-6', name: 'Aşıklar', suit: 'major', number: 6, element: 'air', polarity: 'balanced', keywords: ['seçim', 'bağ', 'uyum'], theme: 'değer temelli seçim' },
  { id: 'major-7', name: 'Savaş Arabası', suit: 'major', number: 7, element: 'water', polarity: 'active', keywords: ['irade', 'yön', 'zafer'], theme: 'kararlı ilerleme' },
  { id: 'major-8', name: 'Güç', suit: 'major', number: 8, element: 'fire', polarity: 'balanced', keywords: ['cesaret', 'yumuşak güç', 'öfke yönetimi'], theme: 'içsel hâkimiyet' },
  { id: 'major-9', name: 'Ermiş', suit: 'major', number: 9, element: 'earth', polarity: 'passive', keywords: ['içgörü', 'geri çekilme', 'rehberlik'], theme: 'içeride arama' },
  { id: 'major-10', name: 'Kader Çarkı', suit: 'major', number: 10, element: 'spirit', polarity: 'active', keywords: ['döngü', 'şans', 'değişim'], theme: 'dönüm noktası' },
  { id: 'major-11', name: 'Adalet', suit: 'major', number: 11, element: 'air', polarity: 'balanced', keywords: ['denge', 'hesap', 'nesnellik'], theme: 'adil tartım' },
  { id: 'major-12', name: 'Asılan Adam', suit: 'major', number: 12, element: 'water', polarity: 'passive', keywords: ['askıya alma', 'perspektif', 'teslim'], theme: 'bekleyerek görme' },
  { id: 'major-13', name: 'Ölüm', suit: 'major', number: 13, element: 'water', polarity: 'active', keywords: ['bitiş', 'dönüşüm', 'bırakış'], theme: 'eski formu bırakma' },
  { id: 'major-14', name: 'Denge', suit: 'major', number: 14, element: 'fire', polarity: 'balanced', keywords: ['ölçü', 'karışım', 'sabır'], theme: 'orta yolu tutma' },
  { id: 'major-15', name: 'Şeytan', suit: 'major', number: 15, element: 'earth', polarity: 'passive', keywords: ['bağlanma', 'gölge', 'bağımlılık'], theme: 'görünmeyen bağ' },
  { id: 'major-16', name: 'Kule', suit: 'major', number: 16, element: 'fire', polarity: 'active', keywords: ['sarsıntı', 'yıkım', 'uyanış'], theme: 'ani yapı kırılması' },
  { id: 'major-17', name: 'Yıldız', suit: 'major', number: 17, element: 'air', polarity: 'passive', keywords: ['umut', 'şifa', 'yön'], theme: 'yenilenme ışığı' },
  { id: 'major-18', name: 'Ay', suit: 'major', number: 18, element: 'water', polarity: 'passive', keywords: ['bulanıklık', 'korku', 'rüya'], theme: 'belirsiz alan' },
  { id: 'major-19', name: 'Güneş', suit: 'major', number: 19, element: 'fire', polarity: 'active', keywords: ['netlik', 'canlılık', 'görünürlük'], theme: 'açığa çıkma' },
  { id: 'major-20', name: 'Mahkeme', suit: 'major', number: 20, element: 'fire', polarity: 'active', keywords: ['çağrı', 'hesaplaşma', 'uyanış'], theme: 'hesabı görme' },
  { id: 'major-21', name: 'Dünya', suit: 'major', number: 21, element: 'earth', polarity: 'balanced', keywords: ['tamamlanma', 'bütünlük', 'entegrasyon'], theme: 'çemberi kapatma' },
];

const SUIT_META = {
  wands: { label: 'Asa', plural: 'Asalar', element: 'fire', polarity: 'active' },
  cups: { label: 'Kupa', plural: 'Kupalar', element: 'water', polarity: 'passive' },
  swords: { label: 'Kılıç', plural: 'Kılıçlar', element: 'air', polarity: 'active' },
  pentacles: { label: 'Tılsım', plural: 'Tılsımlar', element: 'earth', polarity: 'passive' },
};

const PIP_NAMES = {
  1: 'Ası',
  2: 'İkili',
  3: 'Üçlü',
  4: 'Dörtlü',
  5: 'Beşli',
  6: 'Altılı',
  7: 'Yedili',
  8: 'Sekizli',
  9: 'Dokuzlu',
  10: 'Onlu',
};

const PIP_THEMES = {
  1: 'tohum / başlangıç',
  2: 'ikilik / seçim',
  3: 'çoğalma / paylaşım',
  4: 'yapı / istikrar',
  5: 'gerilim / kayıp',
  6: 'geçiş / uyum',
  7: 'sınama / savunma',
  8: 'hareket / ustalık',
  9: 'zirve / yalnızlık',
  10: 'yük / tamamlanma',
};

const PIP_KEYWORDS = {
  wands: {
    1: ['ilham', 'kıvılcım'],
    2: ['plan', 'ufuk'],
    3: ['genişleme', 'öngörü'],
    4: ['kutlama', 'temel'],
    5: ['rekabet', 'sürtüşme'],
    6: ['tanınma', 'ilerleme'],
    7: ['savunma', 'direnç'],
    8: ['hız', 'haber'],
    9: ['dayanıklılık', 'yorgunluk'],
    10: ['yük', 'sorumluluk'],
  },
  cups: {
    1: ['duygu', 'açılış'],
    2: ['karşılıklılık', 'bağ'],
    3: ['birliktelik', 'paylaşım'],
    4: ['doygunluk', 'kayıtsızlık'],
    5: ['kayıp', 'yas'],
    6: ['nostalji', 'yumuşaklık'],
    7: ['seçenek', 'hayal'],
    8: ['ayrılış', 'arayış'],
    9: ['doyum', 'istek'],
    10: ['aile', 'tamlık'],
  },
  swords: {
    1: ['netlik', 'keskinlik'],
    2: ['ikilem', 'erteleme'],
    3: ['kalp kırığı', 'acı'],
    4: ['dinlenme', 'ara'],
    5: ['çatışma', 'ego'],
    6: ['geçiş', 'uzaklaşma'],
    7: ['strateji', 'sakınma'],
    8: ['sıkışma', 'kısıt'],
    9: ['kaygı', 'zihin yükü'],
    10: ['bitiş', 'dibine vuruş'],
  },
  pentacles: {
    1: ['fırsat', 'somut tohum'],
    2: ['denge', 'esneklik'],
    3: ['işbirliği', 'zanaat'],
    4: ['tutma', 'güvenlik'],
    5: ['yoksunluk', 'dışarıda kalma'],
    6: ['paylaşım', 'destek'],
    7: ['sabır', 'bekleyiş'],
    8: ['emek', 'ustalık'],
    9: ['bağımsızlık', 'öz yeterlilik'],
    10: ['miras', 'kalıcı yapı'],
  },
};

const COURT = [
  { rank: 'page', name: 'Uşağı', polarity: 'passive', keywords: ['haber', 'öğrenme'], theme: 'yeni mesaj / acemilik' },
  { rank: 'knight', name: 'Şövalyesi', polarity: 'active', keywords: ['hareket', 'arayış'], theme: 'yönelme / tempo' },
  { rank: 'queen', name: 'Kraliçesi', polarity: 'passive', keywords: ['olgunluk', 'hâkimiyet'], theme: 'alanı tutma' },
  { rank: 'king', name: 'Kralı', polarity: 'active', keywords: ['ustalık', 'yönetim'], theme: 'sorumlu yönlendirme' },
];

/**
 * @param {keyof typeof SUIT_META} suit
 * @param {number} n
 */
function pipName(suit, n) {
  const meta = SUIT_META[suit];
  if (n === 1) return `${meta.label} Ası`;
  // Match protocol examples: "Kupa Üçlüsü", "Asaların Yedilisi"
  const numLabel =
    n === 3 ? 'Üçlüsü' : n === 7 ? 'Yedilisi' : PIP_NAMES[n];
  if (suit === 'cups' || suit === 'swords') {
    return `${meta.label} ${numLabel}`;
  }
  return `${meta.plural}ın ${numLabel}`;
}

function buildMinors() {
  /** @type {TarotCard[]} */
  const cards = [];
  for (const suit of /** @type {(keyof typeof SUIT_META)[]} */ (['wands', 'cups', 'swords', 'pentacles'])) {
    const meta = SUIT_META[suit];
    for (let n = 1; n <= 10; n++) {
      cards.push({
        id: `${suit}-${n}`,
        name: pipName(suit, n),
        suit,
        arcana: 'minor',
        number: n,
        element: /** @type {TarotElement} */ (meta.element),
        polarity: /** @type {TarotPolarity} */ (meta.polarity),
        keywords: PIP_KEYWORDS[suit][n],
        theme: `${meta.label} alanında ${PIP_THEMES[n]}`,
      });
    }
    for (const c of COURT) {
      cards.push({
        id: `${suit}-${c.rank}`,
        name: `${meta.label} ${c.name}`,
        suit,
        arcana: 'minor',
        number: null,
        element: /** @type {TarotElement} */ (meta.element),
        polarity: /** @type {TarotPolarity} */ (c.polarity),
        keywords: c.keywords,
        theme: `${meta.label} ${c.theme}`,
      });
    }
  }
  return cards;
}

/** @type {TarotCard[]} */
export const CLASSIC_TAROT_DECK = Object.freeze([
  ...MAJORS.map((c) => Object.freeze({ ...c, arcana: /** @type {'major'} */ ('major') })),
  ...buildMinors().map((c) => Object.freeze(c)),
]);

/** @type {Map<string, TarotCard>} */
const BY_ID = new Map(CLASSIC_TAROT_DECK.map((c) => [c.id, c]));
/** @type {Map<string, TarotCard>} */
const BY_NAME = new Map(
  CLASSIC_TAROT_DECK.map((c) => [c.name.toLocaleLowerCase('tr-TR'), c]),
);

export function getCardById(id) {
  return BY_ID.get(String(id)) || null;
}

export function getCardByName(name) {
  if (!name) return null;
  return BY_NAME.get(String(name).toLocaleLowerCase('tr-TR').trim()) || null;
}

export function listDeck() {
  return [...CLASSIC_TAROT_DECK];
}

export { SUIT_META };
