/**
 * Tarot reply builder — intention-centered, combination-first structure.
 * Depth L1 short / L2 standard / L3 full analysis.
 */

import { ATLAS_CLASSIC_TAROT_METHODOLOGY, DEPTH_LEVEL } from './methodology.js';
import { spreadKindLabel } from './positions.js';
import { numberMotif } from './meanings.js';

/** Canonical symbolic / probabilistic boundary line for all non-list replies. */
export const SYMBOLIC_UNCERTAINTY_LINE =
  'Bu, kesin kehanet veya zihin okuma değil; sembolik ve olasılıksal bir yorumdur.';

const UNCERTAINTY_RE =
  /sembolik|olas[ıi]l[ıi]k|yorumlay[ıi]c[ıi]|kesin\s+kehanet\s+de[gğ]il|zihin\s+okuma\s+de[gğ]il/i;

/**
 * @param {string} reply
 */
export function hasUncertaintyBoundaryText(reply) {
  return UNCERTAINTY_RE.test(String(reply || ''));
}

/**
 * Append symbolic boundary if missing (guard remediation — does not rebuild).
 * @param {string} reply
 */
export function ensureUncertaintyBoundary(reply) {
  const text = String(reply || '').trim();
  if (!text) return SYMBOLIC_UNCERTAINTY_LINE;
  if (hasUncertaintyBoundaryText(text)) return text;
  return `${text}\n\n${SYMBOLIC_UNCERTAINTY_LINE}`;
}

/**
 * @param {object} analysis
 * @param {{
 *   depth?: number,
 *   focus?: string|null,
 *   exploreMore?: boolean,
 *   layersAlreadyCovered?: string[],
 * }} [opts]
 */
export function buildTarotReply(analysis, opts = {}) {
  const depth = opts.depth ?? DEPTH_LEVEL.STANDARD;
  const focus = opts.focus || null;

  if (!analysis?.ok) {
    return 'Tarot açılımı için net bir niyet veya komut gerekli.';
  }

  if (focus === 'reveal') {
    return buildRevealReply(analysis);
  }
  if (focus === 'blind_spot') {
    return buildBlindSpotFocus(analysis);
  }
  if (focus === 'combination') {
    return buildCombinationFocus(analysis);
  }
  if (focus === 'why_card') {
    return buildWhyCardFocus(analysis);
  }
  if (focus === 'explore' || opts.exploreMore) {
    return buildExploreReply(analysis, opts.layersAlreadyCovered || []);
  }

  if (depth <= DEPTH_LEVEL.SHORT) {
    return buildShortReply(analysis);
  }
  if (depth >= DEPTH_LEVEL.DEEP) {
    return buildDeepReply(analysis);
  }
  return buildStandardReply(analysis);
}

function buildRevealReply(analysis) {
  const out = ['Son açılımda gelen kartlar:'];
  analysis.placed.forEach((p, i) => {
    out.push(`${i + 1}. ${p.card.name} — ${p.position.label}`);
  });
  return out.join('\n');
}

function buildShortReply(analysis) {
  const parts = [];
  parts.push(
    `Bu dinamikte öne çıkan üç katman: ${analysis.placed.map((p) => p.card.name).join(', ')}.`,
  );
  parts.push(analysis.combinations.commonTheme);
  if (analysis.contradictions.tensions[0]) {
    parts.push(analysis.contradictions.tensions[0].reading);
  }
  parts.push(`Ana mesaj: ${analysis.strongMessage}`);
  parts.push(SYMBOLIC_UNCERTAINTY_LINE);
  return parts.join('\n\n');
}

function buildStandardReply(analysis) {
  const parts = [];

  parts.push('## Açılım');
  parts.push(
    `Amaç: ${analysis.intention || 'genel okuma'}. ` +
      `Tip: ${spreadKindLabel(analysis.spreadKind)}.`,
  );

  parts.push('');
  parts.push('## Kartlar');
  analysis.placed.forEach((p, i) => {
    const pos = p.positional?.shortReading || `${p.card.name} — ${p.position.label}`;
    parts.push(`${i + 1}. ${pos}`);
  });
  parts.push('');
  parts.push('Pozisyona göre:');
  for (const p of analysis.placed) {
    parts.push(`• ${p.positional?.reading || p.card.name}`);
  }

  parts.push('');
  parts.push('## Kartların Birbirine Etkisi');
  for (const pair of analysis.combinations.pairs.slice(0, 3)) {
    parts.push(`• ${pair.reading}`);
  }
  if (analysis.combinations.neighborStory) {
    parts.push(analysis.combinations.neighborStory);
  }

  parts.push('');
  parts.push('## Gizli Dinamik');
  parts.push(analysis.hiddenDynamic);

  if (analysis.contradictions.tensions.length) {
    parts.push('');
    parts.push('## Çelişki');
    for (const t of analysis.contradictions.tensions.slice(0, 2)) {
      parts.push(`• ${t.question} → ${t.reading}`);
    }
  }

  parts.push('');
  parts.push('## Kör Nokta');
  parts.push(analysis.blindSpot);

  parts.push('');
  parts.push('## Ana Mesaj');
  parts.push(analysis.strongMessage);
  parts.push(`Ortak tema: ${analysis.combinations.commonTheme}`);

  parts.push('');
  parts.push('## Gelişim Alanı');
  parts.push(analysis.growthDirection);

  parts.push('');
  parts.push('## Sonuç');
  parts.push(analysis.synthesis);
  parts.push('');
  parts.push(
    `${SYMBOLIC_UNCERTAINTY_LINE} (${ATLAS_CLASSIC_TAROT_METHODOLOGY.methodologyId})`,
  );

  return parts.join('\n');
}

function buildDeepReply(analysis) {
  const base = buildStandardReply(analysis);
  const extra = [];

  extra.push('');
  extra.push('## Element ve Arkana');
  extra.push(analysis.combinations.arcanaBalance.note);
  const mix = analysis.combinations.elementMix;
  extra.push(
    `Element dağılımı: ${Object.entries(mix)
      .map(([k, v]) => `${k}×${v}`)
      .join(', ') || '—'}.`,
  );

  if (analysis.combinations.numberNotes?.length) {
    extra.push('');
    extra.push('## Sayı Motifleri');
    for (const n of analysis.combinations.numberNotes.slice(0, 4)) {
      extra.push(`• ${n}`);
    }
  }

  extra.push('');
  extra.push('## Psikolojik Okuma');
  extra.push(analysis.psychologicalReading);

  extra.push('');
  extra.push('## Alternatif Yorum');
  extra.push(analysis.alternativeReading);

  extra.push('');
  extra.push('## Belirsizlik Notu');
  extra.push(ATLAS_CLASSIC_TAROT_METHODOLOGY.disclaimer);

  // Insert extras before final methodology line of standard
  const marker = '## Sonuç';
  const idx = base.lastIndexOf(marker);
  if (idx === -1) return `${base}\n${extra.join('\n')}`;
  const head = base.slice(0, idx);
  const tail = base.slice(idx);
  return `${head}${extra.join('\n')}\n\n${tail}`;
}

function buildBlindSpotFocus(analysis) {
  return [
    '## Kör Nokta',
    analysis.blindSpot,
    '',
    `Gizli dinamik: ${analysis.hiddenDynamic}`,
    '',
    analysis.contradictions.tensions[0]
      ? `İlgili gerilim: ${analysis.contradictions.tensions[0].reading}`
      : 'Bu açılımda sert kutup yok; kör nokta daha çok atlanan nüansta.',
    '',
    SYMBOLIC_UNCERTAINTY_LINE,
  ].join('\n');
}

function buildCombinationFocus(analysis) {
  const lines = ['## Kart Kombinasyonları'];
  for (const pair of analysis.combinations.pairs) {
    lines.push(`• ${pair.reading}`);
  }
  lines.push('');
  lines.push(analysis.combinations.commonTheme);
  lines.push(analysis.combinations.neighborStory || '');
  lines.push('');
  lines.push(SYMBOLIC_UNCERTAINTY_LINE);
  return lines.filter(Boolean).join('\n');
}

function buildWhyCardFocus(analysis) {
  const lines = [
    '## Bu kartlar neden geldi? (sembolik çerçeve)',
    'Kart seçimi tarafsız çekimle yapıldı; “istenilen cevap” için seçilmedi. Yorum ise niyet + pozisyon + komşuluk üzerinden kuruldu.',
    '',
  ];
  for (const p of analysis.placed) {
    lines.push(
      `• ${p.card.name}: ${p.position.label} rolünde «${p.card.theme}» niyete bağlanıyor.` +
        (p.card.number != null ? ` ${numberMotif(p.card.number) || ''}` : ''),
    );
  }
  lines.push('');
  lines.push(analysis.strongMessage);
  lines.push('');
  lines.push(SYMBOLIC_UNCERTAINTY_LINE);
  return lines.join('\n');
}

function buildExploreReply(analysis, covered) {
  const set = new Set(covered);
  const parts = ['## Daha derinde görünenler'];
  if (!set.has('combinations')) {
    parts.push('Kombinasyon:');
    for (const pair of analysis.combinations.pairs.slice(0, 2)) {
      parts.push(`• ${pair.reading}`);
    }
  }
  if (!set.has('contradictions') && analysis.contradictions.tensions[0]) {
    parts.push('');
    parts.push(`Gerilim: ${analysis.contradictions.tensions[0].reading}`);
  }
  if (!set.has('blind')) {
    parts.push('');
    parts.push(`Kör nokta: ${analysis.blindSpot}`);
  }
  if (!set.has('alt')) {
    parts.push('');
    parts.push(`Alternatif: ${analysis.alternativeReading}`);
  }
  if (!set.has('growth')) {
    parts.push('');
    parts.push(`Gelişim: ${analysis.growthDirection}`);
  }
  parts.push('');
  parts.push('Mevcut oturum kartları korunuyor; yeni çekim yok.');
  parts.push(SYMBOLIC_UNCERTAINTY_LINE);
  return parts.join('\n');
}
