/**
 * Card combination engine — pair readings from neighbors, element, arcana, number.
 */

import { numberMotif } from './meanings.js';

const ELEMENT_RELATION = {
  'fire|fire': { kind: 'amplify', note: 'çift ateş: tempo ve irade yükseliyor; yanma riski de artıyor' },
  'water|water': { kind: 'amplify', note: 'çift su: duygu yoğun; net sınır zorlaşıyor' },
  'air|air': { kind: 'amplify', note: 'çift hava: zihin hızlanıyor; bedenden kopma riski' },
  'earth|earth': { kind: 'amplify', note: 'çift toprak: somut güvenlik arayışı; katılık riski' },
  'fire|water': { kind: 'tension', note: 'ateş–su: görünür ısı ile iç duygu birbirini söndürebilir veya buhar üretir' },
  'water|fire': { kind: 'tension', note: 'su–ateş: duygu ile eylem ritmi çatışabilir' },
  'fire|air': { kind: 'support', note: 'ateş–hava: fikir harekete yakıt oluyor' },
  'air|fire': { kind: 'support', note: 'hava–ateş: anlatım ile irade birbirini besliyor' },
  'water|air': { kind: 'tension', note: 'su–hava: his ile analiz aynı anda çalışıyor; biri diğerini bastırabilir' },
  'air|water': { kind: 'tension', note: 'hava–su: zihin duyguyu çerçevelemeye çalışıyor' },
  'earth|water': { kind: 'support', note: 'toprak–su: duygu somut zemine oturabilir' },
  'water|earth': { kind: 'support', note: 'su–toprak: bakım ve güvenlik birlikte' },
  'earth|fire': { kind: 'tension', note: 'toprak–ateş: yapı ile dürtü gerilimde' },
  'fire|earth': { kind: 'tension', note: 'ateş–toprak: hız ile istikrar çekişiyor' },
  'air|earth': { kind: 'tension', note: 'hava–toprak: fikir ile uygulama mesafesi' },
  'earth|air': { kind: 'tension', note: 'toprak–hava: somutluk ile teorik çerçeve ayrışabilir' },
  'spirit|fire': { kind: 'support', note: 'büyük tema ateşi yönlendiriyor' },
  'spirit|water': { kind: 'support', note: 'büyük tema duygu alanını çerçeveliyor' },
  'spirit|air': { kind: 'support', note: 'büyük tema zihinsel netliği zorluyor' },
  'spirit|earth': { kind: 'support', note: 'büyük tema somut yapıya iniyor' },
  'fire|spirit': { kind: 'support', note: 'irade büyük arkanaya bağlanıyor' },
  'water|spirit': { kind: 'support', note: 'duygu büyük arkanaya bağlanıyor' },
  'air|spirit': { kind: 'support', note: 'zihin büyük arkanaya bağlanıyor' },
  'earth|spirit': { kind: 'support', note: 'somutluk büyük arkanaya bağlanıyor' },
  'spirit|spirit': { kind: 'amplify', note: 'çift büyük arkana: kişisel detaydan çok kader/ana tema baskın' },
};

/**
 * @param {Array<{
 *   card: import('./deck.js').TarotCard,
 *   position: import('./positions.js').SpreadPosition,
 *   positional?: object,
 * }>} placed
 * @param {{ intention?: string }} [ctx]
 */
export function analyzeCombinations(placed, ctx = {}) {
  /** @type {Array<{ pair: string, cards: string[], positions: string[], kind: string, reading: string }>} */
  const pairs = [];
  const intention = String(ctx.intention || '').trim();

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];
      const reading = buildPairReading(a, b, intention);
      pairs.push({
        pair: `${a.card.name}+${b.card.name}`,
        cards: [a.card.name, b.card.name],
        positions: [a.position.label, b.position.label],
        kind: reading.kind,
        reading: reading.text,
      });
    }
  }

  const theme = deriveCommonTheme(placed);
  const arcanaBalance = summarizeArcana(placed);
  const elementMix = summarizeElements(placed);
  const numberNotes = placed
    .map((p) => numberMotif(p.card.number))
    .filter(Boolean);

  return {
    pairs,
    commonTheme: theme,
    arcanaBalance,
    elementMix,
    numberNotes,
    neighborStory: buildNeighborStory(placed, intention),
  };
}

/**
 * @param {{ card: import('./deck.js').TarotCard, position: import('./positions.js').SpreadPosition }} a
 * @param {{ card: import('./deck.js').TarotCard, position: import('./positions.js').SpreadPosition }} b
 * @param {string} intention
 */
function buildPairReading(a, b, intention) {
  const key = `${a.card.element}|${b.card.element}`;
  const rel = ELEMENT_RELATION[key] || {
    kind: 'neutral',
    note: 'elementler yan yana farklı katmanları gösteriyor',
  };

  const socialCue =
    /kupa|birlik|paylaş|sosyal/i.test(`${a.card.name} ${a.card.theme}`) &&
    /yedili|savun|direnç|mücadele/i.test(`${b.card.name} ${b.card.theme}`);
  const reverseSocial =
    /yedili|savun|direnç|mücadele/i.test(`${a.card.name} ${a.card.theme}`) &&
    /kupa|birlik|paylaş|sosyal/i.test(`${b.card.name} ${b.card.theme}`);

  let special = '';
  if (socialCue || reverseSocial) {
    special =
      ' Sosyal görünüm ile savunma aynı anda çalışıyor; sıcaklık dış katman, mesafe ise koruma refleksi olabilir.';
  }
  if (
    /adalet/i.test(a.card.name + b.card.name) &&
    /yedili|savun|mücadele|direnç/i.test(a.card.theme + b.card.theme + a.card.name + b.card.name)
  ) {
    special += ' Adalet + savunma: haklı çıkma veya hesabı temizleme ihtiyacı güçlenebilir.';
  }
  if (
    /adalet/i.test(a.card.name + b.card.name) &&
    /kupa|birlik|bağ/i.test(a.card.theme + b.card.theme + a.card.name + b.card.name)
  ) {
    special += ' Bağ korunurken denge aranıyor; ilişkiyi bozmadan adil çizgi çekme çabası.';
  }

  const intentBit = intention
    ? ` Bu çift, «${intention.slice(0, 50)}» sorusuna şöyle oturuyor:`
    : '';

  return {
    kind: rel.kind,
    text:
      `${a.card.name} (${a.position.label}) + ${b.card.name} (${b.position.label}): ` +
      `${rel.note}.${special}${intentBit} ` +
      `${a.card.theme} ile ${b.card.theme} birlikte okunmalı; tekil sözlük yeterli değil.`,
  };
}

/**
 * @param {Array<{ card: import('./deck.js').TarotCard, position: import('./positions.js').SpreadPosition }>} placed
 */
function deriveCommonTheme(placed) {
  const majors = placed.filter((p) => p.card.arcana === 'major');
  const elements = [...new Set(placed.map((p) => p.card.element))];
  if (majors.length >= 2) {
    return `Açılımda büyük arkana ağırlığı var: ana tema «${majors.map((m) => m.card.theme).join(' / ')}» hattında.`;
  }
  if (elements.length === 1) {
    return `Tek element baskını (${elements[0]}): mesaj tek kanaldan yoğunlaşıyor.`;
  }
  if (elements.includes('water') && elements.includes('fire')) {
    return 'Ortak tema: duygu ile eylem ritmi — yakınlık ve mesafe aynı anda.';
  }
  if (elements.includes('air') && elements.includes('water')) {
    return 'Ortak tema: hissedilen ile düşünülen arasında salınım.';
  }
  return `Ortak tema: ${placed.map((p) => p.card.theme).join(' → ')}.`;
}

function summarizeArcana(placed) {
  const major = placed.filter((p) => p.card.arcana === 'major').length;
  const minor = placed.length - major;
  return {
    major,
    minor,
    note:
      major > minor
        ? 'Büyük arkana baskın: kişisel detaydan çok yapısal/ana dinamik öne çıkıyor.'
        : major === 0
          ? 'Yalnızca küçük arkana: günlük işleyiş ve somut davranış katmanı.'
          : 'Büyük ve küçük arkana karışık: ana tema ile günlük uygulama birlikte.',
  };
}

function summarizeElements(placed) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const p of placed) {
    counts[p.card.element] = (counts[p.card.element] || 0) + 1;
  }
  return counts;
}

/**
 * @param {Array<{ card: import('./deck.js').TarotCard, position: import('./positions.js').SpreadPosition }>} placed
 * @param {string} intention
 */
function buildNeighborStory(placed, intention) {
  if (placed.length < 2) return '';
  const flow = placed
    .map((p) => `${p.position.label}→${p.card.name}`)
    .join(' | ');
  const tip = intention
    ? `Niyet merkeze alındığında hikâye şöyle akıyor: ${flow}.`
    : `Kartlar sırayla şöyle konuşuyor: ${flow}.`;
  return tip;
}
