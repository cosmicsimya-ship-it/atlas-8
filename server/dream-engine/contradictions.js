/**
 * Dream contradictions / tensions — dual meanings that must not collapse.
 */

/**
 * @param {import('./extract.js').ExtractedSymbol[]} symbols
 * @param {{ emotions?: { label: string, id: string }[], narrative?: { motifs: string[] } }} [ctx]
 */
export function analyzeDreamContradictions(symbols, ctx = {}) {
  const ids = new Set((symbols || []).map((s) => s.id));
  const emotions = (ctx.emotions || []).map((e) => e.id || e.label);
  const motifs = new Set(ctx.narrative?.motifs || []);
  /** @type {{ id: string, question: string, reading: string }[]} */
  const tensions = [];

  if (ids.has('white') && ids.has('black')) {
    tensions.push({
      id: 'light-dark',
      question: 'Neden hem berraklık hem bilinmeyen?',
      reading:
        'Beyaz ve siyah aynı rüyada: arınma arzusu ile henüz bilinçleşmemiş alan birlikte duruyor olabilir. Biri diğerini iptal etmez.',
    });
  }

  if (
    (ids.has('sun') || ids.has('star')) &&
    (ids.has('moon') || ids.has('black') || ids.has('death'))
  ) {
    tensions.push({
      id: 'clarity-shadow',
      question: 'Neden hem netlik/umut hem gölge?',
      reading:
        'Aydınlık semboller ile gölge/ay/ölüm motifi: bilinç ile bilinçaltı aynı anda konuşuyor olabilir.',
    });
  }

  if (
    (emotions.includes('korku') || emotions.includes('kaygi')) &&
    (emotions.includes('huzur') || emotions.includes('umut') || emotions.includes('mutluluk'))
  ) {
    tensions.push({
      id: 'fear-hope',
      question: 'Neden hem korku/kaygı hem umut/huzur?',
      reading:
        'Duygu katmanı çelişkili görünebilir; bu bazen geçiş sürecinin doğal gerilimidir — tek duyguya indirgemek rüyayı zayıflatır.',
    });
  }

  if (motifs.has('chase') && motifs.has('finding')) {
    tensions.push({
      id: 'flee-find',
      question: 'Neden hem kaçıyor hem bir şey buluyor?',
      reading:
        'Kaçış ve bulma aynı anlatıda: kaçılan şey bazen aranan şeyin gölgesidir.',
    });
  }

  if (motifs.has('closed_space') && motifs.has('open_space')) {
    tensions.push({
      id: 'closed-open',
      question: 'Neden hem kapalı hem açık alan?',
      reading:
        'Sıkışma ve genişleme: içerde sıkışmış his ile dışarıda ferahlama ihtiyacı birlikte işliyor olabilir.',
    });
  }

  if (ids.has('death') && (ids.has('baby') || ids.has('child') || ids.has('wedding') || ids.has('sun'))) {
    tensions.push({
      id: 'end-begin',
      question: 'Neden bitiş ile başlangıç yan yana?',
      reading:
        'Ölüm sembolü burada fiziksel kehanet değil; bir dönemin kapanışı ile yeninin doğuşu aynı psyche içinde co-exist edebilir.',
    });
  }

  if (ids.has('fire') && (ids.has('water') || ids.has('sea') || ids.has('rain'))) {
    tensions.push({
      id: 'fire-water',
      question: 'Neden ateş ile su birlikte?',
      reading:
        'Ateş (yoğun duygu) ve su (duygusal akış): bastırma ile boşalma arasında bir müzakere olabilir.',
    });
  }

  if (!tensions.length && symbols.length >= 2) {
    tensions.push({
      id: 'multi-meaning',
      question: 'Neden tek sembole indirgenmiyor?',
      reading:
        'Birden fazla sembol var; her biri bağımsız analiz edilir ama hüküm bütün üzerinden kurulur. Bu yorum kesin değildir.',
    });
  }

  return { tensions };
}
