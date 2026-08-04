/**
 * Jung archetype layer — soft association only; never forced.
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   aliases: string[],
 *   reading: string,
 * }} JungArchetype
 */

/** @type {Record<string, JungArchetype>} */
export const JUNG_ARCHETYPES = Object.freeze({
  Shadow: {
    id: 'Shadow',
    name: 'Gölge (Shadow)',
    aliases: ['shadow', 'gölge'],
    reading:
      'Gölge, bilinçdışına itilen yönleri taşır. Rüyada korkutucu veya itici figürler bazen “öteki” değil, sahiplenemediğimiz yanımızdır.',
  },
  Anima: {
    id: 'Anima',
    name: 'Anima',
    aliases: ['anima'],
    reading:
      'Anima, içsel dişil/ilişkisel katmanı temsil eder; yumuşaklık, sezgi veya ilişki ihtiyacı öne çıkabilir.',
  },
  Animus: {
    id: 'Animus',
    name: 'Animus',
    aliases: ['animus'],
    reading:
      'Animus, içsel eril/yön verici katmanı temsil eder; karar, sınır veya söz üretme ihtiyacı öne çıkabilir.',
  },
  'Wise Old Man': {
    id: 'Wise Old Man',
    name: 'Bilge Yaşlı (Wise Old Man)',
    aliases: ['wise old man', 'bilge', 'yaşlı bilge'],
    reading:
      'Bilge figür, iç rehberliği veya henüz bilinçleşmemiş bir içgörüyü simgeleyebilir.',
  },
  'Great Mother': {
    id: 'Great Mother',
    name: 'Büyük Ana (Great Mother)',
    aliases: ['great mother', 'büyük ana'],
    reading:
      'Büyük Ana, besleyen/koruyan veya yutan/boğan anne arketipinin iki yüzünü taşıyabilir — bağlam duyguya bağlıdır.',
  },
  Child: {
    id: 'Child',
    name: 'Çocuk (Child)',
    aliases: ['child', 'ilahi çocuk'],
    reading:
      'Çocuk arketipi yenilenme, potansiyel ve kırılgan umudu taşır; “yeniden başlamak” çağrısı olabilir.',
  },
  Hero: {
    id: 'Hero',
    name: 'Kahraman (Hero)',
    aliases: ['hero', 'kahraman'],
    reading:
      'Kahraman, engeli aşma ve bilinçli eyleme geçme çağrısıdır; zafer değil, yolun kendisi öne çıkar.',
  },
});

/**
 * Soft-match archetypes from symbols + emotions + narrative cues.
 * Returns only confident matches (threshold).
 *
 * @param {{
 *   symbols: { id: string, jungHint?: string|null }[],
 *   emotions: string[],
 *   narrative: { motifs: string[] },
 * }} ctx
 * @returns {{ id: string, name: string, reading: string, reason: string }[]}
 */
export function matchJungArchetypes(ctx) {
  /** @type {Map<string, { score: number, reasons: string[] }>} */
  const scores = new Map();

  const bump = (id, reason, w = 1) => {
    if (!JUNG_ARCHETYPES[id]) return;
    const prev = scores.get(id) || { score: 0, reasons: [] };
    prev.score += w;
    if (reason && !prev.reasons.includes(reason)) prev.reasons.push(reason);
    scores.set(id, prev);
  };

  for (const s of ctx.symbols || []) {
    if (s.jungHint) bump(s.jungHint, `${s.id || 'sembol'} ipucu`, 2);
  }

  const emotions = new Set((ctx.emotions || []).map((e) => e.toLowerCase()));
  if (emotions.has('korku') || emotions.has('kaygı')) {
    bump('Shadow', 'korku/kaygı duygusu', 1.5);
  }
  if (emotions.has('özlem') || emotions.has('huzur')) {
    bump('Anima', 'özlem/huzur tonu', 1);
  }
  if (emotions.has('umut') || emotions.has('özgürlük')) {
    bump('Hero', 'umut/özgürlük tonu', 1);
    bump('Child', 'umut/yenilenme tonu', 0.8);
  }
  if (emotions.has('pişmanlık') || emotions.has('baskı')) {
    bump('Shadow', 'pişmanlık/baskı', 1.2);
  }

  const motifs = new Set(ctx.narrative?.motifs || []);
  if (motifs.has('chase') || motifs.has('escape')) bump('Shadow', 'kovalanma/kaçış anlatısı', 1.5);
  if (motifs.has('finding') || motifs.has('ascent')) bump('Hero', 'bulma/yükseliş anlatısı', 1.2);
  if (motifs.has('loss') || motifs.has('closed_space')) bump('Shadow', 'kayıp/kapalı alan', 1);
  if (motifs.has('talking')) bump('Animus', 'diyalog/söz üretme', 0.8);
  if (motifs.has('open_space') || motifs.has('sea_like')) bump('Great Mother', 'geniş/kuşatıcı alan', 1);

  /** @type {{ id: string, name: string, reading: string, reason: string }[]} */
  const out = [];
  for (const [id, meta] of scores.entries()) {
    // Soft threshold — do not force weak links
    if (meta.score < 2) continue;
    const arch = JUNG_ARCHETYPES[id];
    out.push({
      id: arch.id,
      name: arch.name,
      reading: arch.reading,
      reason: meta.reasons.slice(0, 2).join('; '),
    });
  }

  out.sort((a, b) => {
    const sa = scores.get(a.id)?.score || 0;
    const sb = scores.get(b.id)?.score || 0;
    return sb - sa;
  });

  return out.slice(0, 3);
}
