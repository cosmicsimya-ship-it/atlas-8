/**
 * Position-aware card meaning layer — not a flat dictionary dump.
 * Same card reads differently by position role + intention.
 */

/**
 * @param {import('./deck.js').TarotCard} card
 * @param {import('./positions.js').SpreadPosition} position
 * @param {{ intention?: string, spreadKind?: string }} [ctx]
 */
export function interpretCardInPosition(card, position, ctx = {}) {
  const role = position?.role || 'surface';
  const intention = String(ctx.intention || '').trim();
  const base = card.theme;
  const kw = (card.keywords || []).slice(0, 2).join(' / ');

  const roleLens = ROLE_LENSES[role] || ROLE_LENSES.surface;
  const arcanaHint =
    card.arcana === 'major'
      ? 'Bu büyük arkana katmanı, kişisel detaydan çok ana dinamiği vurgular.'
      : `Küçük arkana (${elementLabel(card.element)}) günlük işleyişe işaret eder.`;

  const intentHook = intention
    ? `Niyet («${truncate(intention, 60)}») açısından:`
    : 'Bu pozisyonda:';

  return {
    cardId: card.id,
    cardName: card.name,
    positionId: position.id,
    positionLabel: position.label,
    role,
    element: card.element,
    arcana: card.arcana,
    number: card.number,
    reading: [
      intentHook,
      `${position.label} katmanında ${card.name}, ${roleLens(base, kw)}.`,
      arcanaHint,
    ].join(' '),
    shortReading: `${card.name} @ ${position.label}: ${roleLens(base, kw)}`,
  };
}

/**
 * @type {Record<string, (theme: string, kw: string) => string>}
 */
const ROLE_LENSES = {
  surface: (theme, kw) =>
    `görünürde «${theme}» çalışıyor${kw ? ` (${kw})` : ''} — ilk izlenim buradan kuruluyor`,
  hidden: (theme, kw) =>
    `perde arkasında «${theme}» duruyor${kw ? ` (${kw})` : ''} — henüz açıkça sahiplenilmemiş katman`,
  outcome: (theme, kw) =>
    `yön / sonuç hattında «${theme}» olasılığını sembolize ediyor${kw ? ` (${kw})` : ''}`,
  self: (theme, kw) =>
    `senin alanında «${theme}» baskın${kw ? ` (${kw})` : ''}`,
  other: (theme, kw) =>
    `karşı tarafta «${theme}» okunuyor${kw ? ` (${kw})` : ''} — kesin zihin okuma değil, sembolik alan`,
  bond: (theme, kw) =>
    `ortak alanda «${theme}» bağın ritmini belirliyor${kw ? ` (${kw})` : ''}`,
  extra: (theme, kw) =>
    `ek katmanda «${theme}»${kw ? ` (${kw})` : ''}`,
};

function elementLabel(el) {
  switch (el) {
    case 'fire':
      return 'ateş / irade';
    case 'water':
      return 'su / duygu';
    case 'air':
      return 'hava / zihin';
    case 'earth':
      return 'toprak / somutluk';
    default:
      return 'ruh / büyük arkana';
  }
}

function truncate(s, n) {
  const t = String(s);
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

/**
 * Number-band motif (1–10) for combination / deep layers.
 * @param {number|null|undefined} n
 */
export function numberMotif(n) {
  if (n == null || Number.isNaN(n)) return null;
  if (n === 0) return 'sıfır: boş sayfa / potansiyel';
  if (n === 1) return 'bir: tohum ve irade';
  if (n === 2) return 'iki: ikilik ve seçim gerilimi';
  if (n === 3) return 'üç: çoğalma ve görünür paylaşım';
  if (n === 4) return 'dört: yapı ve sınır';
  if (n === 5) return 'beş: sürtünme ve bozulma';
  if (n === 6) return 'altı: uyum arayışı ve geçiş';
  if (n === 7) return 'yedi: sınama ve savunma';
  if (n === 8) return 'sekiz: hız / güç / emek';
  if (n === 9) return 'dokuz: olgunlaşma ve yalnız zirve';
  if (n === 10) return 'on: yük veya tamamlanma eşiği';
  if (n === 11) return 'on bir: adil tartım / eşik';
  if (n === 13) return 'on üç: bırakış ve biçim değişimi';
  return `sayı ${n}: ritmik vurgu`;
}
