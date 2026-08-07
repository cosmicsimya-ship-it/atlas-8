/**
 * Dream reply builder — emotion-centered, multi-layer, probabilistic language.
 */

import { ATLAS_DREAM_METHODOLOGY, DEPTH_LEVEL } from './methodology.js';

/** Canonical symbolic / probabilistic boundary line. */
export const SYMBOLIC_UNCERTAINTY_LINE =
  'Bu yorum kesin değildir. Kesin kehanet, hastalık teşhisi veya kader iddiası taşımaz; sembolik ve olasılıksal bir okumadır.';

const UNCERTAINTY_RE =
  /sembolik|olas[ıi]l[ıi]k|yorumlay[ıi]c[ıi]|kesin\s+de[gğ]ildir|kesin\s+kehanet\s+de[gğ]il|bu\s+yorum\s+kesin\s+de[gğ]ildir/i;

/**
 * @param {string} reply
 */
export function hasUncertaintyBoundaryText(reply) {
  return UNCERTAINTY_RE.test(String(reply || ''));
}

/**
 * @param {string} reply
 */
export function ensureUncertaintyBoundary(reply) {
  const text = String(reply || '').trim();
  if (!text) return SYMBOLIC_UNCERTAINTY_LINE;
  if (hasUncertaintyBoundaryText(text)) return text;
  return `${text}\n\n${SYMBOLIC_UNCERTAINTY_LINE}`;
}

/** Clarifying questions before analysis when narrative is thin. */
export const DREAM_CLARIFY_REPLY = [
  'Tek sembolden hüküm çıkarmak istemem. Biraz daha anlatır mısın?',
  '',
  'Rüyada ne oldu, hangi imgeler kaldı, ve uyanınca ne hissettin?',
  'Tekrar eden bir rüyaysa onu da söyle.',
].join('\n');

/**
 * @param {object} analysis
 * @param {{
 *   depth?: number,
 *   focus?: string|null,
 *   exploreMore?: boolean,
 *   layersAlreadyCovered?: string[],
 * }} [opts]
 */
export function buildDreamReply(analysis, opts = {}) {
  const depth = opts.depth ?? DEPTH_LEVEL.SHORT;
  const focus = opts.focus || null;

  if (!analysis?.ok) {
    if (analysis?.needsClarify) return DREAM_CLARIFY_REPLY;
    return 'Rüya analizi için rüyanı anlatman gerekir.';
  }

  if (focus === 'clarify') return DREAM_CLARIFY_REPLY;
  if (focus === 'symbols') return buildSymbolsFocus(analysis);
  if (focus === 'emotion') return buildEmotionFocus(analysis);
  if (focus === 'jung') return buildJungFocus(analysis);
  if (focus === 'classical') return buildClassicalFocus(analysis);
  if (focus === 'psychological') return buildPsychFocus(analysis);
  if (focus === 'personal') return buildPersonalFocus(analysis);
  if (focus === 'blind_spot') return buildBlindSpotFocus(analysis);
  if (focus === 'explore' || opts.exploreMore) {
    return buildExploreReply(analysis, opts.layersAlreadyCovered || []);
  }

  if (depth <= DEPTH_LEVEL.SHORT) return buildShortReply(analysis);
  if (depth >= DEPTH_LEVEL.DEEP) return buildDeepReply(analysis);
  return buildStandardReply(analysis);
}

function buildShortReply(analysis) {
  const emotion = analysis.emotions?.[0]?.label || null;
  const symbols = (analysis.symbolReadings || [])
    .map((s) => s.name)
    .filter(Boolean)
    .slice(0, 3);
  const themeRaw = stripUncertaintyEcho(
    String(
      analysis.combinations?.commonTheme || analysis.synthesis || '',
    ).replace(/^Ortak tema:\s*/i, ''),
  );
  const tensionRaw = stripUncertaintyEcho(
    String(analysis.contradictions?.tensions?.[0]?.reading || ''),
  );
  const emphasisRaw = stripUncertaintyEcho(String(analysis.strongMessage || ''));

  const theme = clipWords(themeRaw, 40);
  const tension = clipWords(tensionRaw, 30);
  const emphasis = clipWords(emphasisRaw, 30);

  // Selective Atlas prose — no ## walls, no symbol catalog dump.
  const sentences = [];
  if (emotion) {
    sentences.push(`Burada öne çıkan duygu ${emotion}.`);
  }

  if (symbols.length === 1) {
    sentences.push(
      `Öne çıkan imge: ${symbols[0]}. Tek başına büyük sonuç vermez; bağlam ister.`,
    );
  } else if (symbols.length > 1) {
    sentences.push(
      `Öne çıkan imgeler — ${symbols.join(', ')} — birlikte bir yapı kuruyor.`,
    );
  }

  if (theme) {
    sentences.push(`Ortak çizgi: ${theme}${/[.!?…]$/.test(theme) ? '' : '.'}`);
  } else if (emphasis) {
    sentences.push(`Asıl vurgu: ${emphasis}${/[.!?…]$/.test(emphasis) ? '' : '.'}`);
  }

  if (tension && tension !== theme) {
    sentences.push(`Bir gerilim de var: ${tension}${/[.!?…]$/.test(tension) ? '' : '.'}`);
  } else if (emphasis && theme && emphasis !== theme) {
    sentences.push(`Asıl vurgu: ${emphasis}${/[.!?…]$/.test(emphasis) ? '' : '.'}`);
  }

  sentences.push('Tek imgeden kesin hüküm çıkmaz; bu okuma yön ve olasılık verir.');
  sentences.push('İstersen duygu, gerilim veya bir katmanı detaylı açabiliriz.');

  const body = sentences.filter(Boolean).join(' ');
  return `${body}\n\n${SYMBOLIC_UNCERTAINTY_LINE}`;
}

function stripUncertaintyEcho(text) {
  return String(text || '')
    .replace(SYMBOLIC_UNCERTAINTY_LINE, ' ')
    .replace(/bu\s+yorum\s+kesin\s+de[gğ]ildir[^.]*\.?/gi, ' ')
    .replace(/kesin\s+kehanet[^.]*\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clipWords(text, maxWords) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ').replace(/[.,;:]+$/u, '')}…`;
}

function buildStandardReply(analysis) {
  const parts = [];

  parts.push('## Rüya Analizi');
  parts.push(
    'Tek işaret karar vermez. Aşağıda yalnızca en anlamlı yapıyı tutuyorum; her sembol sözlüğü değil.',
  );

  parts.push('');
  parts.push('## Duygu Katmanı');
  parts.push(analysis.emotionReading);

  parts.push('');
  parts.push('## Sembol Katmanı');
  for (const s of (analysis.symbolReadings || []).slice(0, 6)) {
    parts.push(`• ${s.reading}`);
  }
  if (!(analysis.symbolReadings || []).length) {
    parts.push('• Net sembol çıkarılamadı; duygu ve olay örgüsü merkeze alındı.');
  }

  parts.push('');
  parts.push('## Olay Örgüsü');
  parts.push(analysis.narrativeReading);

  parts.push('');
  parts.push('## Sembollerin Birbirine Etkisi');
  for (const pair of (analysis.combinations?.pairs || []).slice(0, 3)) {
    parts.push(`• ${pair.reading}`);
  }
  if (analysis.combinations?.commonTheme) {
    parts.push(analysis.combinations.commonTheme);
  }

  if (analysis.contradictions?.tensions?.length) {
    parts.push('');
    parts.push('## Gerilim / Çift Anlam');
    for (const t of analysis.contradictions.tensions.slice(0, 2)) {
      parts.push(`• ${t.question} → ${t.reading}`);
    }
  }

  if (analysis.jungArchetypes?.length) {
    parts.push('');
    parts.push('## Jung Arketip Katmanı');
    for (const a of analysis.jungArchetypes) {
      parts.push(`• ${a.name}: ${a.reading} (gerekçe: ${a.reason})`);
    }
  } else {
    parts.push('');
    parts.push('## Jung Arketip Katmanı');
    parts.push(
      'Bu rüyada zorla arketip eşlemesi yapılmadı; uyum eşiği düşük kaldı.',
    );
  }

  parts.push('');
  parts.push('## Klasik Sembolik Katman');
  parts.push(analysis.classicalReading);

  parts.push('');
  parts.push('## Psikolojik Katman');
  parts.push(analysis.psychologicalReading);

  parts.push('');
  parts.push('## Gizli Dinamik');
  parts.push(analysis.hiddenDynamic);

  parts.push('');
  parts.push('## Kör Nokta');
  parts.push(analysis.blindSpot);

  parts.push('');
  parts.push('## Kişisel Bağlam');
  if (analysis.personalContext?.links?.length) {
    for (const l of analysis.personalContext.links) {
      parts.push(`• ${l.reading}`);
    }
  } else {
    parts.push(analysis.personalContext?.note || 'Kişisel bağ kurulmadı.');
  }

  parts.push('');
  parts.push('## Ana Mesaj');
  parts.push(analysis.strongMessage);

  parts.push('');
  parts.push('## Gelişim / Uyanık Hayat Daveti');
  parts.push(analysis.growthDirection);

  parts.push('');
  parts.push('## Sonuç');
  parts.push(analysis.synthesis);
  parts.push('');
  parts.push(
    `${SYMBOLIC_UNCERTAINTY_LINE} (${ATLAS_DREAM_METHODOLOGY.methodologyId})`,
  );

  return parts.join('\n');
}

function buildDeepReply(analysis) {
  const base = buildStandardReply(analysis);
  const extra = [];

  extra.push('');
  extra.push('## Alternatif Okuma');
  extra.push(analysis.alternativeReading);

  extra.push('');
  extra.push('## Belirsizlik Notu');
  extra.push(ATLAS_DREAM_METHODOLOGY.disclaimer);

  const marker = '## Sonuç';
  const idx = base.lastIndexOf(marker);
  if (idx === -1) return `${base}\n${extra.join('\n')}`;
  const head = base.slice(0, idx);
  const tail = base.slice(idx);
  return `${head}${extra.join('\n')}\n\n${tail}`;
}

function buildSymbolsFocus(analysis) {
  const lines = ['## Sembol Odaklı Okuma'];
  for (const s of analysis.symbolReadings || []) {
    lines.push(`• ${s.reading}`);
  }
  lines.push('');
  lines.push(analysis.combinations?.commonTheme || '');
  lines.push('');
  lines.push(SYMBOLIC_UNCERTAINTY_LINE);
  return lines.filter(Boolean).join('\n');
}

function buildEmotionFocus(analysis) {
  return [
    '## Duygu Merkezli Okuma',
    analysis.emotionReading,
    '',
    `Gizli dinamik: ${analysis.hiddenDynamic}`,
    '',
    SYMBOLIC_UNCERTAINTY_LINE,
  ].join('\n');
}

function buildJungFocus(analysis) {
  const lines = ['## Jung Arketipleri'];
  if (!analysis.jungArchetypes?.length) {
    lines.push('Bu oturumda güvenilir arketip eşlemesi yok; zorla ilişki kurulmadı.');
  } else {
    for (const a of analysis.jungArchetypes) {
      lines.push(`• ${a.name}: ${a.reading}`);
      lines.push(`  Gerekçe: ${a.reason}`);
    }
  }
  lines.push('');
  lines.push(SYMBOLIC_UNCERTAINTY_LINE);
  return lines.join('\n');
}

function buildClassicalFocus(analysis) {
  return [
    '## Klasik Sembolik Yorumlar',
    analysis.classicalReading,
    '',
    SYMBOLIC_UNCERTAINTY_LINE,
  ].join('\n');
}

function buildPsychFocus(analysis) {
  return [
    '## Psikolojik Katman',
    analysis.psychologicalReading,
    '',
    analysis.growthDirection,
    '',
    SYMBOLIC_UNCERTAINTY_LINE,
  ].join('\n');
}

function buildPersonalFocus(analysis) {
  const lines = ['## Kişisel Bağlam'];
  if (analysis.personalContext?.links?.length) {
    for (const l of analysis.personalContext.links) {
      lines.push(`• ${l.reading}`);
      lines.push(`  Kanıt özeti: ${l.evidence}`);
    }
  } else {
    lines.push(analysis.personalContext?.note || 'Kanıtlı bağ yok.');
  }
  lines.push('');
  lines.push(SYMBOLIC_UNCERTAINTY_LINE);
  return lines.join('\n');
}

function buildBlindSpotFocus(analysis) {
  return [
    '## Kör Nokta',
    analysis.blindSpot,
    '',
    `Gizli dinamik: ${analysis.hiddenDynamic}`,
    '',
    SYMBOLIC_UNCERTAINTY_LINE,
  ].join('\n');
}

function buildExploreReply(analysis, covered) {
  const set = new Set(covered);
  const parts = ['## Daha derinde görünenler'];
  if (!set.has('jung') && analysis.jungArchetypes?.[0]) {
    parts.push(`Arketip: ${analysis.jungArchetypes[0].name} — ${analysis.jungArchetypes[0].reading}`);
  }
  if (!set.has('classical')) {
    parts.push('');
    parts.push(analysis.classicalReading);
  }
  if (!set.has('psych')) {
    parts.push('');
    parts.push(analysis.psychologicalReading);
  }
  if (!set.has('personal') && analysis.personalContext?.links?.[0]) {
    parts.push('');
    parts.push(analysis.personalContext.links[0].reading);
  }
  if (!set.has('blind')) {
    parts.push('');
    parts.push(`Kör nokta: ${analysis.blindSpot}`);
  }
  if (!set.has('alt')) {
    parts.push('');
    parts.push(`Alternatif: ${analysis.alternativeReading}`);
  }
  parts.push('');
  parts.push('Mevcut oturum rüyası korunuyor.');
  parts.push(SYMBOLIC_UNCERTAINTY_LINE);
  return parts.join('\n');
}
