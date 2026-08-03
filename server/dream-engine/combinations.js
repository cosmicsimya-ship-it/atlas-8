/**
 * Symbol combination / relationship layer.
 */

/**
 * @param {import('./extract.js').ExtractedSymbol[]} symbols
 * @param {{ emotions?: { label: string }[], narrative?: { motifs: string[] } }} [ctx]
 */
export function analyzeSymbolCombinations(symbols, ctx = {}) {
  const list = Array.isArray(symbols) ? symbols : [];
  /** @type {{ a: string, b: string, reading: string }[]} */
  const pairs = [];

  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      pairs.push({
        a: a.name,
        b: b.name,
        reading: pairReading(a, b, ctx),
      });
    }
  }

  const commonTheme = buildCommonTheme(list, ctx);
  const neighborStory =
    pairs.length > 0
      ? `Semboller birlikte okunduğunda: ${pairs
          .slice(0, 2)
          .map((p) => `${p.a} + ${p.b}`)
          .join('; ')} — tek başına anlamları genişler.`
      : 'Tek sembol öne çıkıyor; bütünü duygu ve olay örgüsüyle tamamlamak gerekir.';

  return {
    pairs: pairs.slice(0, 6),
    commonTheme,
    neighborStory,
  };
}

/**
 * @param {import('./extract.js').ExtractedSymbol} a
 * @param {import('./extract.js').ExtractedSymbol} b
 * @param {object} ctx
 */
function pairReading(a, b, ctx) {
  const emotion = ctx.emotions?.[0]?.label;
  const emoBit = emotion ? ` «${emotion}» duygusu içinde` : '';

  // Known thematic pairs
  if (
    (a.id === 'water' || a.id === 'sea') &&
    (b.id === 'house' || a.id === 'house' || b.id === 'house')
  ) {
    return `Su/deniz + ev${emoBit}: iç dünyanın duygusal taşması veya “benlik evi”nde birikmiş hisler. Tek sembolden hüküm çıkmaz.`;
  }
  if (
    (a.id === 'door' || b.id === 'door') &&
    (a.id === 'key' || b.id === 'key')
  ) {
    return `Kapı + anahtar${emoBit}: geçiş ve erişim birlikte; çözüm yakın olabilir ama eşiği kim açıyor sorusu kalır.`;
  }
  if (
    (a.id === 'snake' || b.id === 'snake') &&
    (a.id === 'water' || b.id === 'water' || a.id === 'sea' || b.id === 'sea')
  ) {
    return `Yılan + su${emoBit}: dönüşüm korkusu duygusal derinlikte yüzebilir; iyileşme ile tehdit aynı imgede bir arada durabilir.`;
  }
  if (
    (a.id === 'chase' || b.id === 'chase' || a.id === 'falling' || b.id === 'falling') &&
    (a.id === 'house' || b.id === 'house' || a.id === 'door' || b.id === 'door')
  ) {
    return `${a.name} + ${b.name}${emoBit}: güven alanı ile kaçış/düşüş gerilimi; “güvende hissetmek” ile “kaçmak” aynı rüyada konuşuyor olabilir.`;
  }
  if (
    (a.id === 'death' || b.id === 'death') &&
    (a.id === 'wedding' || b.id === 'wedding' || a.id === 'baby' || b.id === 'baby' || a.id === 'child' || b.id === 'child')
  ) {
    return `${a.name} + ${b.name}${emoBit}: bitiş ve başlangıç aynı anda — kimlik dönüşümü motifi; fiziksel kehanet değildir.`;
  }
  if (
    (a.id === 'car' || b.id === 'car' || a.id === 'train' || b.id === 'train' || a.id === 'plane' || b.id === 'plane') &&
    (a.id === 'stairs' || b.id === 'stairs' || a.id === 'bridge' || b.id === 'bridge')
  ) {
    return `${a.name} + ${b.name}${emoBit}: yön/seyahat ile aşama/geçiş; hayat rotasında bir eşik vurgusu.`;
  }

  const shared = a.themes.filter((t) => b.themes.includes(t));
  if (shared.length) {
    return (
      `${a.name} + ${b.name}${emoBit}: ortak tema «${shared.join(', ')}». ` +
      'Bu sembol tek başına tek bir anlam taşımaz; birlikte okunduğunda örüntü güçlenir.'
    );
  }

  return (
    `${a.name} + ${b.name}${emoBit}: farklı katmanlar — biri ${a.themes[0] || 'yüzey'}, ` +
    `diğeri ${b.themes[0] || 'derinlik'} vurgusu taşıyor olabilir. Zorla tek anlama indirgenmez.`
  );
}

/**
 * @param {import('./extract.js').ExtractedSymbol[]} list
 * @param {object} ctx
 */
function buildCommonTheme(list, ctx) {
  if (!list.length) {
    return 'Ortak tema henüz sembollerden kurulamadı; duygu ve olay örgüsü merkeze alınmalı.';
  }
  /** @type {Map<string, number>} */
  const themeCount = new Map();
  for (const s of list) {
    for (const t of s.themes) {
      themeCount.set(t, (themeCount.get(t) || 0) + 1);
    }
  }
  const ranked = [...themeCount.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, 3).map(([t]) => t);
  const emotion = ctx.emotions?.[0]?.label;
  const narr = ctx.narrative?.labels?.[0];

  let line = `Ortak tema: ${top.join(' · ') || 'çok katmanlı geçiş'}.`;
  if (emotion) line += ` Duygu merkezi: ${emotion}.`;
  if (narr) line += ` Anlatı motifi: ${narr}.`;
  line +=
    ' Bu sembol bazen tek başına okunsa da, rüyanın bütünü değerlendirildiğinde anlamı genişler.';
  return line;
}
