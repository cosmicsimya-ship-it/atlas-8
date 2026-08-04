/**
 * Extract symbols, emotions, and narrative motifs from dream text.
 */

import { DREAM_SYMBOL_CORPUS } from './symbols.js';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   matchedAlias: string,
 *   themes: string[],
 *   psychological: string,
 *   classical: string,
 *   jungHint: string|null,
 * }} ExtractedSymbol
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   weight: number,
 * }} ExtractedEmotion
 */

/**
 * @typedef {{
 *   motifs: string[],
 *   labels: string[],
 *   summary: string,
 * }} NarrativeAnalysis
 */

const EMOTION_PATTERNS = Object.freeze([
  { id: 'korku', label: 'korku', patterns: [/kork[uy]|ürk[üu]|dehşet|panik/i] },
  { id: 'ozlem', label: 'özlem', patterns: [/özlem|hasret|özl[üu]/i] },
  { id: 'huzur', label: 'huzur', patterns: [/huzur|sakin|rahat|ferah|güvenli\s+his/i] },
  { id: 'baski', label: 'baskı', patterns: [/bask[ıi]|sıkış|ezil|ağırlık/i] },
  { id: 'kacis', label: 'kaçış', patterns: [/kaç[ıi]y|kaçt[ıi]|kurtul/i] },
  { id: 'kaygi', label: 'kaygı', patterns: [/kayg[ıi]|endiş|gergin|tedirgin/i] },
  { id: 'umut', label: 'umut', patterns: [/umut|ümit|umutlu|ışık\s+görd/i] },
  { id: 'mutluluk', label: 'mutluluk', patterns: [/mutlu|sevinç|neşe|sevinçli|keyif/i] },
  { id: 'pismanlik', label: 'pişmanlık', patterns: [/pişman|keşke|üzgün|ah\s+keşke/i] },
  { id: 'merak', label: 'merak', patterns: [/merak|şaşkın|hayret|acaba/i] },
  { id: 'ozgurluk', label: 'özgürlük', patterns: [/özgür|serbest|ferahl|uçuyorum/i] },
]);

const NARRATIVE_PATTERNS = Object.freeze([
  {
    id: 'chase',
    label: 'kovalanıyor',
    patterns: [/kovalan|kovalıyor|takip\s+ed|peşimde|kaçıyorum/i],
  },
  {
    id: 'rush',
    label: 'bir yere yetişmeye çalışıyor',
    patterns: [/yetiş|kaçırd[ıi]m|geç\s+kald|vaktim\s+yok|acele/i],
  },
  {
    id: 'loss',
    label: 'bir şey kaybediyor',
    patterns: [/kaybett[ıi]m|kaybol|bulam[ıi]yor|yitir/i],
  },
  {
    id: 'finding',
    label: 'bir şey buluyor',
    patterns: [/buldum|karşıma\s+çık|keşfet|ele\s+geçir/i],
  },
  {
    id: 'talking',
    label: 'biriyle konuşuyor',
    patterns: [/konuşt[uy]|dedi\s+ki|söyledi|anlatt[ıi]|diyalog/i],
  },
  {
    id: 'closed_space',
    label: 'kapalı alan',
    patterns: [/kapalı|mağara|tünel|asansör|küçük\s+oda|sıkışık|bodrum/i],
  },
  {
    id: 'open_space',
    label: 'açık alan',
    patterns: [/açık\s+alan|tarla|çayır|ufuk|geniş\s+alan|sahil|tepe/i],
  },
  {
    id: 'escape',
    label: 'kaçış/kurtuluş arıyor',
    patterns: [/kaçış|kurtul|çıkış\s+ara|kapıyı\s+aç/i],
  },
  {
    id: 'ascent',
    label: 'yükseliyor',
    patterns: [/yüksel|çıkıyorum|merdiven\s+çık|tırman/i],
  },
  {
    id: 'descent',
    label: 'iniyor',
    patterns: [/iniyorum|aşağı|bodrum|çukur/i],
  },
  {
    id: 'sea_like',
    label: 'kuşatıcı su/alan',
    patterns: [/deniz|okyanus|dalga|sular\s+bürüd/i],
  },
]);

/**
 * Turkish-friendly motif match: exact token OR stem+suffix (ev → evimdeydim, kapı → kapıyı).
 * @param {string} haystack lowercased text
 * @param {string} alias lowercased alias
 */
function aliasMatches(haystack, alias) {
  if (!alias) return false;
  // Exact token boundaries
  const exact = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(alias)}([^\\p{L}\\p{N}]|$)`,
    'iu',
  );
  if (exact.test(haystack)) return true;
  // Stem inside an inflected word (min alias length 3 to avoid "ay"/"su"/"it" noise)
  if (alias.length < 3) return false;
  const stem = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(alias)}[\\p{L}\\p{N}]{0,12}([^\\p{L}\\p{N}]|$)`,
    'iu',
  );
  return stem.test(haystack);
}

/**
 * @param {string} text
 * @returns {ExtractedSymbol[]}
 */
export function extractSymbols(text) {
  const lower = String(text || '').toLocaleLowerCase('tr-TR');
  if (!lower.trim()) return [];

  /** @type {ExtractedSymbol[]} */
  const found = [];
  const seen = new Set();

  // Longer aliases first so "deniz" wins before accidental short stems
  const ranked = [...DREAM_SYMBOL_CORPUS].map((sym) => ({
    sym,
    aliases: [...sym.aliases].sort((a, b) => b.length - a.length),
  }));

  for (const { sym, aliases } of ranked) {
    for (const alias of aliases) {
      const a = alias.toLocaleLowerCase('tr-TR');
      if (aliasMatches(lower, a) && !seen.has(sym.id)) {
        seen.add(sym.id);
        found.push({
          id: sym.id,
          name: sym.name,
          matchedAlias: alias,
          themes: [...sym.themes],
          psychological: sym.psychological,
          classical: sym.classical,
          jungHint: sym.jungHint,
        });
        break;
      }
    }
  }

  return found;
}

/**
 * @param {string} text
 * @param {string} [statedEmotion]
 * @returns {ExtractedEmotion[]}
 */
export function extractEmotions(text, statedEmotion = '') {
  const blob = `${text || ''}\n${statedEmotion || ''}`;
  /** @type {ExtractedEmotion[]} */
  const out = [];

  for (const e of EMOTION_PATTERNS) {
    let weight = 0;
    for (const re of e.patterns) {
      if (re.test(blob)) weight += 1;
    }
    if (statedEmotion) {
      const s = statedEmotion.toLocaleLowerCase('tr-TR');
      if (s.includes(e.label) || s.includes(e.id)) weight += 2;
    }
    if (weight > 0) {
      out.push({ id: e.id, label: e.label, weight });
    }
  }

  out.sort((a, b) => b.weight - a.weight);
  return out;
}

/**
 * @param {string} text
 * @returns {NarrativeAnalysis}
 */
export function extractNarrative(text) {
  const t = String(text || '');
  /** @type {string[]} */
  const motifs = [];
  /** @type {string[]} */
  const labels = [];

  for (const n of NARRATIVE_PATTERNS) {
    if (n.patterns.some((re) => re.test(t))) {
      motifs.push(n.id);
      labels.push(n.label);
    }
  }

  let summary = 'Rüyanın olay örgüsü net bir motifle öne çıkmıyor; sembol ve duygu katmanı daha belirleyici olabilir.';
  if (labels.length) {
    summary = `Olay örgüsünde öne çıkanlar: ${labels.join('; ')}.`;
  }

  return { motifs, labels, summary };
}

/**
 * Heuristic: is there enough dream narrative to analyze?
 * @param {string} text
 */
export function hasDreamNarrative(text) {
  const t = String(text || '').trim();
  if (t.length < 40) return false;
  // Must look like a story, not just "rüyamı yorumla"
  const storyCues =
    /rüyamda|rüyada|gördüm|gördüğüm|vardı|gidiyordum|kaçıy|bulundum|uyanınca|uyandım|hissettim|deniz|ev|su|yılan|kapı|uçak|tren|araba/i;
  if (!storyCues.test(t)) {
    // Long enough free text without command-only
    const commandOnly =
      /^(rüyamı?\s+yorumla|rüya\s+analizi|dream\s+interpret|yorumla)[.!?…]*$/i;
    if (commandOnly.test(t)) return false;
    return t.length >= 80;
  }
  return true;
}

/**
 * Strip dream-analysis command wrappers to get narrative core.
 * @param {string} message
 */
export function extractDreamNarrative(message) {
  let t = String(message || '').trim();
  t = t
    .replace(/^(atlas[,:]?\s*)/i, '')
    .replace(/\b(rüyamı?\s+yorumla|rüya\s+analizi\s+yap|dream\s+interpretation|yorumlar\s+mısın)\b/gi, ' ')
    .replace(/\b(detaylı|tam\s+analiz|derin|kısaca|özetle)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

/**
 * Full extraction bundle.
 * @param {{
 *   narrative: string,
 *   statedSymbols?: string,
 *   statedEmotion?: string,
 *   wakingEmotion?: string,
 *   recurring?: boolean|null,
 * }} input
 */
export function extractDreamLayers(input) {
  const narrative = String(input.narrative || '').trim();
  const stated = String(input.statedSymbols || '');
  const symbols = extractSymbols(`${narrative}\n${stated}`);
  const emotions = extractEmotions(
    narrative,
    [input.statedEmotion, input.wakingEmotion].filter(Boolean).join(' '),
  );
  const narrativeAnalysis = extractNarrative(narrative);

  return {
    narrative,
    symbols,
    emotions,
    narrativeAnalysis,
    recurring: input.recurring ?? null,
    statedEmotion: input.statedEmotion || null,
    wakingEmotion: input.wakingEmotion || null,
  };
}

/**
 * @param {string} s
 */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
