/**
 * Contradiction / tension analysis across placed cards.
 */

const POLARITY_CONFLICT = {
  active: 'yaklaşma / harekete geçme',
  passive: 'geri çekilme / tutma',
  balanced: 'ölçülü tutum',
};

/**
 * @param {Array<{
 *   card: import('./deck.js').TarotCard,
 *   position: import('./positions.js').SpreadPosition,
 * }>} placed
 * @param {{ intention?: string }} [ctx]
 */
export function analyzeTarotContradictions(placed, ctx = {}) {
  /** @type {Array<{ id: string, cards: string[], question: string, reading: string }>} */
  const tensions = [];
  /** @type {Array<{ id: string, cards: string[], note: string }>} */
  const alignments = [];

  if (!placed?.length) return { tensions, alignments };

  // Active vs passive polarities
  const actives = placed.filter((p) => p.card.polarity === 'active');
  const passives = placed.filter((p) => p.card.polarity === 'passive');
  if (actives.length && passives.length) {
    tensions.push({
      id: 'active-passive',
      cards: [...actives, ...passives].map((p) => p.card.name),
      question: 'Neden hem yaklaşma hem tutma var?',
      reading:
        `${actives.map((p) => p.card.name).join(', ')} ${POLARITY_CONFLICT.active} sinyali verirken; ` +
        `${passives.map((p) => p.card.name).join(', ')} ${POLARITY_CONFLICT.passive} katmanını açıyor. ` +
        `Bu çelişki tutarsızlık değil: görünür hareket ile iç koruma aynı anda çalışıyor olabilir.`,
    });
  }

  // Surface warmth vs defense (cups/social vs wands-7 / swords conflict)
  const warm = placed.filter((p) =>
    /kupa|aşık|güneş|yıldız|birlik|paylaş/i.test(`${p.card.name} ${p.card.theme}`),
  );
  const guard = placed.filter((p) =>
    /yedili|kılıç|kule|şeytan|savun|direnç|kaygı|sıkış/i.test(
      `${p.card.name} ${p.card.theme} ${(p.card.keywords || []).join(' ')}`,
    ),
  );
  if (warm.length && guard.length) {
    tensions.push({
      id: 'warmth-defense',
      cards: [...warm, ...guard].map((p) => p.card.name),
      question: 'Neden hem yakınlık hem mesafe/savunma var?',
      reading:
        `${warm.map((p) => p.card.name).join(' + ')} yakınlık veya sosyal sıcaklık katmanını gösterirken, ` +
        `${guard.map((p) => p.card.name).join(' + ')} mesafe veya savunmayı işaret ediyor. ` +
        `Yüzeydeki açıklık, altta hesaplanmamış bir koruma refleksiyle birlikte okunmalı.`,
    });
  }

  // Clarity vs fog
  const clear = placed.filter((p) =>
    /adalet|güneş|büyücü|ası|netlik/i.test(`${p.card.name} ${p.card.theme}`),
  );
  const fog = placed.filter((p) =>
    /ay|asılan|ikili|bulanık|erteleme|giz/i.test(`${p.card.name} ${p.card.theme}`),
  );
  if (clear.length && fog.length) {
    tensions.push({
      id: 'clarity-fog',
      cards: [...clear, ...fog].map((p) => p.card.name),
      question: 'Neden hem netlik arayışı hem bulanıklık var?',
      reading:
        `Netlik kartları (${clear.map((p) => p.card.name).join(', ')}) ile bulanıklık kartları ` +
        `(${fog.map((p) => p.card.name).join(', ')}) birlikte: karar isteği var ama bilgi veya cesaret henüz tam değil.`,
    });
  }

  // Major outcome vs minor surface
  const surfaceMinor = placed.filter(
    (p) => (p.position.role === 'surface' || p.position.role === 'self') && p.card.arcana === 'minor',
  );
  const deepMajor = placed.filter(
    (p) =>
      (p.position.role === 'hidden' || p.position.role === 'outcome' || p.position.role === 'bond') &&
      p.card.arcana === 'major',
  );
  if (surfaceMinor.length && deepMajor.length) {
    tensions.push({
      id: 'surface-minor-deep-major',
      cards: [...surfaceMinor, ...deepMajor].map((p) => p.card.name),
      question: 'Görünen ile asıl dinamik neden farklı ölçekte?',
      reading:
        `Yüzey küçük arkana ile günlük görünümü verirken, derin katmanda büyük arkana ana çerçeveyi kuruyor. ` +
        `Sadece görünen karta bakmak niyeti kaçırır.`,
    });
  }

  // Alignments: same element
  const byEl = new Map();
  for (const p of placed) {
    const list = byEl.get(p.card.element) || [];
    list.push(p);
    byEl.set(p.card.element, list);
  }
  for (const [el, list] of byEl) {
    if (list.length >= 2) {
      alignments.push({
        id: `element-${el}`,
        cards: list.map((p) => p.card.name),
        note: `${el} elementi tekrar ediyor; mesaj bu kanalda pekişiyor.`,
      });
    }
  }

  // Intention-specific framing
  const intention = String(ctx.intention || '');
  if (/g[oö]r[uü]nmeyen|gizli|niyet/i.test(intention) && tensions.length) {
    tensions[0] = {
      ...tensions[0],
      reading:
        tensions[0].reading +
        ' Görünmeyen niyet sorusunda bu gerilim çoğu zaman asıl cevaptır: dış katman ile iç motivasyon ayrışır.',
    };
  }

  if (!tensions.length) {
    alignments.push({
      id: 'coherent-flow',
      cards: placed.map((p) => p.card.name),
      note: 'Kartlar arasında sert kutuplaşma yok; mesaj daha çok tek yönde akıyor. Yine de kör nokta katmanı atlanmamalı.',
    });
  }

  return { tensions, alignments };
}
