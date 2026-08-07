/**
 * Per-symbol contextual interpretation — never dictionary-only dump.
 */

/**
 * @param {import('./extract.js').ExtractedSymbol} symbol
 * @param {{
 *   emotions?: { label: string }[],
 *   narrative?: { motifs: string[], labels: string[] },
 *   recurring?: boolean|null,
 * }} ctx
 */
export function interpretSymbolInContext(symbol, ctx = {}) {
  const emotion = ctx.emotions?.[0]?.label;
  const narr = ctx.narrative?.labels?.[0];
  const recurringBit = ctx.recurring
    ? ' Tekrarlayan rüya olması, bu motifin psyche’de henüz tamamlanmamış bir döngü olabileceğine işaret edebilir.'
    : '';

  const shortReading = `${symbol.name} — ${symbol.themes.slice(0, 2).join(', ')}`;

  let reading =
    `«${symbol.name}» — ${symbol.themes.slice(0, 3).join(', ')}. ` +
    `${symbol.psychological}`;

  if (emotion) {
    reading += ` Duygu merkezi «${emotion}» iken bu imge bazen o hissin taşıyıcısı olur.`;
  }
  if (narr) {
    reading += ` Olay örgüsünde «${narr}» ile birlikte okununca anlamı genişler.`;
  }
  reading += recurringBit;
  reading += ' Tek başına hüküm değildir.';

  return {
    symbolId: symbol.id,
    name: symbol.name,
    shortReading,
    reading,
    psychological: symbol.psychological,
    classical: symbol.classical,
    themes: symbol.themes,
  };
}

/**
 * Psychological layer synthesis.
 * @param {object} layers
 */
export function buildPsychologicalLayer(layers) {
  const emotion = layers.emotions?.[0]?.label;
  const motifs = layers.narrativeAnalysis?.motifs || [];
  const symbols = layers.symbols || [];

  /** @type {string[]} */
  const threads = [];

  if (emotion === 'korku' || emotion === 'kaygı' || emotion === 'baskı') {
    threads.push('bastırılmış kaygı veya çözülmemiş bir baskı');
  }
  if (emotion === 'özlem' || emotion === 'pişmanlık') {
    threads.push('tamamlanmamış bir bağ veya yas/özlem süreci');
  }
  if (emotion === 'umut' || emotion === 'özgürlük' || emotion === 'mutluluk') {
    threads.push('açılma / yenilenme arzusu');
  }
  if (motifs.includes('chase') || motifs.includes('escape')) {
    threads.push('yüzleşilmeyen bir konudan kaçış dinamiği');
  }
  if (motifs.includes('loss')) {
    threads.push('kayıp veya kontrol kaybı teması');
  }
  if (motifs.includes('finding') || motifs.includes('ascent')) {
    threads.push('keşif veya kimlik yükseltme süreci');
  }
  if (symbols.some((s) => s.id === 'death' || s.id === 'snake' || s.id === 'fire')) {
    threads.push('değişim / kimlik dönüşümü potansiyeli');
  }
  if (symbols.some((s) => s.id === 'mirror' || s.id === 'house')) {
    threads.push('öz-yansıma ve benlik düzeni');
  }
  if (layers.recurring) {
    threads.push('tekrarlayan rüya — henüz entegre edilmemiş bir iç mesaj');
  }

  if (!threads.length) {
    threads.push('stres veya geçiş sürecinin sembolik bir yankısı olabilir');
  }

  return (
    `Psikolojik katman: Bu rüya, bilinçaltında ${threads.slice(0, 3).join('; ')} ` +
    'temalarını işliyor olabilir. Bu bir teşhis değil; olası iç dinamiklerin haritasıdır.'
  );
}

/**
 * Classical layer — aggregate probabilistic classical notes.
 * @param {import('./extract.js').ExtractedSymbol[]} symbols
 */
export function buildClassicalLayer(symbols) {
  if (!symbols?.length) {
    return 'Klasik sembolik katman: Yeterli sembol çıkarılamadı; İbn Sîrîn vb. geleneklere atıf için sembol netliği gerekir.';
  }
  const lines = symbols.slice(0, 5).map((s) => `• ${s.name}: ${s.classical}`);
  return (
    'Klasik sembolik katman (geleneksel motifler — kesin hüküm değil):\n' +
    lines.join('\n') +
    '\nBu kaynaklar ilham niteliğindedir; “şu olacak” demez.'
  );
}
