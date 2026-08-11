/**
 * Shared semantic layer detection for free-input routing.
 * Informs existing engines — does not replace them.
 *
 * Layer ids: dream | numerology | symbol | astrology | date_time | real_life_event | quran
 */

import { detectDreamEngineIntent } from './dream-engine/intent.js';
import { detectNatalChartIntent } from './natal-engine/interpretation-adapter.js';
import { detectQuranVerseLookupIntent } from './quran-verse-lookup/intent.js';

export const SEMANTIC_LAYERS_VERSION = 'atlas-semantic-layers-v1';

/** @typedef {'dream'|'numerology'|'symbol'|'astrology'|'date_time'|'real_life_event'|'quran'} SemanticLayerId */

const DREAM_FRAME =
  /\b(r[uü]yamda|ruyamda|r[uü]yada|ruyada|r[uü]yam[ıi]n|ruyamin|r[uü]ya\s+g[oö]rd|ruya\s+gord|r[uü]yamda|iki\s+gece\s+[oö]nce.*r[uü]ya|gece\s+r[uü]ya)/i;

const DREAM_DOMAIN =
  /\b(r[uü]ya|ruya|dream)\b/i;

const SYMBOL_ASK =
  /sembolik\s+anlam|sembol(?:ik|e|ü|u|ler)?\b|ne\s+anlat(?:[ıi]yor)?|anlam[ıi]na\s+bak|ne\s+anlama\s+geliyor/i;

/** Concrete repeating object/animal — not “karşıma çıkmak” alone. */
const SYMBOL_REPEAT_OBJECT =
  /s[uü]rekli\s+(?!kar[sş][ıi]ma\b)([\p{L}]{3,})\s+g[oö]r|(?:s[uü]rekli\s+)?kar[sş][ıi]ma\s+(?![cç][ıi]k)([\p{L}]{3,})\s+(?:g[oö]r|[cç][ıi]kt)|yine\s+(?:ayn[ıi]\s+)?(?![cç][ıi]k)([\p{L}]{3,})\s+(?:g[oö]r|[cç][ıi]kt)/iu;

const MONTH_TR =
  '(?:ocak|[sş]ubat|mart|nisan|may[iı]s|haziran|temmuz|a[gğ]ustos|eyl[uü]l|ekim|kas[iı]m|aral[iı]k)';

/** Day+month (incl. locative “12 ağustosta”) or numeric / clock cues. */
const DATE_CUE = new RegExp(
  String.raw`(?:\b\d{1,2}\s+${MONTH_TR}\w*|\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b|ay[ıi]n\s+\d{1,2}['’]?[sşüu]?|\b(?:[01]?\d|2[0-3]):[0-5]\d\b)`,
  'iu',
);

const REAL_LIFE_EVENT =
  /\b(sokak|ge[cç]mek\s+zorunda|tesad[uü]fen|ger[cç]ekte|uyan[dığ]|uyand[ıi][gğ]|hayat[ıi]mda|ba[sş]lad[ıi]|kar[sş][ıi]ma\s+[cç][ıi]kt)/i;

const ASTRO_EXPLICIT =
  /do[gğ]um\s+harit|natal|astroloj|bur[cç]|y[uü]kselen|transit|sinastri|kova\s+vurg|(?<!\p{L})(?:ko[cç]|bo[gğ]a|[iı]kizler|yenge[cç]|aslan|ba[sş]ak|terazi|akrep|yay|o[gğ]lak|kova|bal[iı]k)(?:lar|ler)?(?!\p{L})/iu;

const COMBINE_INTENT =
  /birlikte\s+oku|birlikte\s+yorum|birlikte\s+ele|sentez|birbirine\s+ba[gğ]lan|birbirini\s+destek|aras[ıi]nda(?:ki)?\s+(?:bir\s+)?ba[gğ]lant[ıi]|ba[gğ]lant[ıi]\s+var\s+m[ıi]|ili[sş]kili\s+olabilir|ayn[ıi]\s+[oö]r[uü]nt[uü]|yak[ıi]nsama|kar[sş][ıi]la[sş]t[ıi]r|kesii?[sş]im|denklem|meta\s+sentez|çok\s+katman|cok\s+katman|ba[gğ]land[ıi][gğ][ıi]\s+bir\s+yer|ben\s+mi\s+ba[gğ]lant[ıi]/i;

/** Repeating / pattern number language — not a single age mention. */
export const REPEATING_NUMBER_CUE =
  /s[uü]rekli\s+(kar[sş][ıi]ma\s+)?[cç][ıi]k|yine\s+[cç][ıi]kt|tekrar\s+eden\s+say[ıi]|ayn[ıi]\s+say[ıi]|kar[sş][ıi]ma\s+[cç][ıi]k[ıi]yor|saatte|plakada|[oö]deme\s+ekran|[oö]r[uü]nt[uü]s[uü]\s+var\s+m[ıi]|bunun\s+bir\s+[oö]r[uü]nt|[oö]r[uü]nt[uü]\s+var\s+m[ıi]|anlam[ıi]\s+var\s+m[ıi]|anlam[ıi]\s+varm[ıi]|iki\s+kere|bir\s+haftad[ıi]r|birka[cç]\s+g[uü]nd[uü]r|[uü][cç]\s+g[uü]nd[uü]r/i;

const AGE_FALSE_POSITIVE =
  /\b\d{1,3}\s+ya[sş][ıi]nda|\b\d{1,3}\s+ya[sş][ıi]nday[ıi]m|\bya[sş][ıi]m\s+\d{1,3}\b/i;

const SINGLE_NUMBER =
  /\b(\d{1,4})\b/g;

/**
 * Extract memorable numbers (exclude years 1900-2099 unless paired with pattern cue).
 * @param {string} text
 * @returns {string[]}
 */
export function extractPatternNumbers(text) {
  const out = [];
  const re = /\b(\d{1,4})\b/g;
  let m;
  while ((m = re.exec(String(text ?? ''))) !== null) {
    const n = m[1];
    const asInt = Number(n);
    if (asInt >= 1900 && asInt <= 2099) continue;
    if (n.length === 4 && asInt > 31) continue;
    out.push(n);
  }
  // HH:MM → also keep minute/hour compounds like 07:27 → 7, 27 already via digits; keep "07:27" token
  const times = String(text ?? '').match(/\b([0-2]?\d):([0-5]\d)\b/g) || [];
  for (const t of times) out.push(t);
  return [...new Set(out)];
}

/**
 * @param {string} message
 * @returns {boolean}
 */
export function isRepeatingNumberPattern(message, history = []) {
  const text = String(message ?? '');
  if (!text.trim()) return false;
  if (AGE_FALSE_POSITIVE.test(text)) return false;

  const numbers = extractPatternNumbers(text);
  const hasNumber = numbers.length > 0;
  const cue = REPEATING_NUMBER_CUE.test(text);
  const multiNumbers =
    (text.match(/\b\d{1,3}\b/g) || []).filter((n) => {
      const v = Number(n);
      return !(v >= 1900 && v <= 2099);
    }).length >= 2 &&
    /ve|veya|ile|,\s*\d/i.test(text);

  if (hasNumber && cue) return true;
  if (multiNumbers && /tekrar|s[uü]rekli|kar[sş][ıi]ma|[oö]r[uü]nt[uü]|ba[gğ]lant[ıi]/i.test(text)) {
    return true;
  }

  // History inheritance: short follow-up "27 yine çıktı"
  if (hasNumber && /\byine\b|[cç][ıi]kt[ıi]/i.test(text) && historyHasNumericPattern(history)) {
    return true;
  }
  return false;
}

/**
 * @param {{ role?: string, content?: string }[]} history
 */
export function historyHasNumericPattern(history = []) {
  const corpus = (history || [])
    .map((h) => String(h?.content || '').toLocaleLowerCase('tr-TR'))
    .join('\n');
  if (!corpus) return false;
  if (/numeroloji|ya[sş]am yolu|atlas-pythagorean|say[ıi]sal [oö]r[uü]nt/i.test(corpus)) {
    return true;
  }
  return (
    REPEATING_NUMBER_CUE.test(corpus) &&
    /\d/.test(corpus)
  );
}

/**
 * Ambiguous pattern-seeking without concrete evidence.
 * @param {string} message
 */
export function isAmbiguousPatternSeeking(message) {
  const text = String(message ?? '').trim();
  if (!text) return false;
  const vague =
    /ayn[ıi]\s+[sş]ey.*kar[sş][ıi]ma|farkl[ıi]\s+bi[cç]imlerde|sanki.*tekrar|tekrar\s+ediyor\s+gibi|bir\s+[oö]r[uü]nt[uü]\s+var\s+gibi/i.test(
      text,
    );
  if (!vague) return false;
  // If concrete layers already present, not ambiguous
  if (DREAM_DOMAIN.test(text)) return false;
  if (isRepeatingNumberPattern(text)) return false;
  if (SYMBOL_ASK.test(text) || SYMBOL_REPEAT_OBJECT.test(text)) return false;
  if (ASTRO_EXPLICIT.test(text)) return false;
  if (extractPatternNumbers(text).length > 0) return false;
  return true;
}

export const AMBIGUOUS_PATTERN_CLARIFY_REPLY =
  'Bir örüntü arıyor olabilirsin; henüz somut bir örnek yok. Son zamanlarda tekrar eden neydi — bir sayı, sembol, rüya, tarih ya da olay? Birkaç örnek yeter.';

/**
 * @param {string} message
 * @param {{ role?: string, content?: string }[]} [history]
 * @returns {{
 *   primaryLayer: SemanticLayerId|null,
 *   secondaryLayers: SemanticLayerId[],
 *   layers: SemanticLayerId[],
 *   evidence: string[],
 *   confidence: 'low'|'medium'|'high',
 *   wantsSynthesis: boolean,
 *   combineExplicit: boolean,
 *   dreamFramed: boolean,
 *   numbers: string[],
 *   ambiguousPattern: boolean,
 *   version: string,
 * }}
 */
export function detectSemanticLayers(message, history = []) {
  const text = String(message ?? '').trim();
  /** @type {SemanticLayerId[]} */
  const layers = [];
  /** @type {string[]} */
  const evidence = [];

  const empty = {
    primaryLayer: null,
    secondaryLayers: [],
    layers: [],
    evidence: [],
    confidence: /** @type {'low'} */ ('low'),
    wantsSynthesis: false,
    combineExplicit: false,
    dreamFramed: false,
    numbers: [],
    ambiguousPattern: false,
    version: SEMANTIC_LAYERS_VERSION,
  };
  if (!text) return empty;

  const dreamFramed = DREAM_FRAME.test(text);
  const dreamIntent = detectDreamEngineIntent(text, history, {});
  if (dreamIntent.active || dreamFramed || DREAM_DOMAIN.test(text)) {
    layers.push('dream');
    evidence.push(dreamFramed ? 'dream_frame' : 'dream_domain');
  }

  const numbers = extractPatternNumbers(text);
  if (isRepeatingNumberPattern(text, history)) {
    layers.push('numerology');
    evidence.push('repeating_number_pattern');
  } else if (
    numbers.length &&
    dreamFramed &&
    /\b\d{1,3}\b/.test(text)
  ) {
    // Number inside a dream → numeric secondary, not auto primary numerology
    layers.push('numerology');
    evidence.push('number_in_dream');
  }

  const symbolObject = SYMBOL_REPEAT_OBJECT.test(text) || SYMBOL_ASK.test(text);
  // "sembol" word or repeating animal/object without being pure dream ask
  if (symbolObject || (/\bsembol\b/i.test(text) && !dreamFramed)) {
    layers.push('symbol');
    evidence.push(SYMBOL_ASK.test(text) ? 'symbol_ask' : 'symbol_repeat');
  } else if (/\bsembol\b/i.test(text)) {
    layers.push('symbol');
    evidence.push('symbol_mention');
  }

  const natal = detectNatalChartIntent(text);
  if (natal || ASTRO_EXPLICIT.test(text)) {
    layers.push('astrology');
    evidence.push(natal ? `natal:${natal}` : 'astro_explicit');
  }

  if (DATE_CUE.test(text)) {
    layers.push('date_time');
    evidence.push('date_time_cue');
  }

  if (REAL_LIFE_EVENT.test(text) && !dreamFramed) {
    layers.push('real_life_event');
    evidence.push('real_life_event');
  } else if (REAL_LIFE_EVENT.test(text) && /uyan|sokak|tesad|ge[cç]mek/i.test(text)) {
    // waking life after dream still counts as secondary real-life
    layers.push('real_life_event');
    evidence.push('waking_life_after_dream');
  }

  const quran = detectQuranVerseLookupIntent(text);
  if (quran.active) {
    layers.push('quran');
    evidence.push('quran_lookup');
  }

  const unique = [...new Set(layers)];
  const combineExplicit = COMBINE_INTENT.test(text);
  const ambiguousPattern = isAmbiguousPatternSeeking(text);

  /** @type {SemanticLayerId|null} */
  let primaryLayer = null;

  // Narrative frame: capability mentioned inside a dream → dream stays primary
  if (dreamFramed || (dreamIntent.active && dreamIntent.intent === 'analyze')) {
    primaryLayer = 'dream';
  } else if (unique.includes('astrology') && natal && !dreamFramed) {
    primaryLayer = 'astrology';
  } else if (
    unique.includes('astrology') &&
    unique.includes('date_time') &&
    !dreamFramed
  ) {
    // Date-specific zodiac / transit asks beat incidental Qur’an false positives.
    primaryLayer = 'astrology';
  } else if (unique.includes('numerology') && !dreamFramed) {
    primaryLayer = 'numerology';
  } else if (unique.includes('symbol')) {
    primaryLayer = 'symbol';
  } else if (unique.includes('quran')) {
    primaryLayer = 'quran';
  } else if (unique.includes('date_time') && unique.includes('symbol')) {
    primaryLayer = 'symbol';
  } else if (unique.includes('dream')) {
    primaryLayer = 'dream';
  } else if (unique.includes('astrology')) {
    primaryLayer = 'astrology';
  } else if (unique.includes('date_time')) {
    primaryLayer = 'date_time';
  } else if (unique.length) {
    primaryLayer = unique[0];
  }

  const secondaryLayers = unique.filter((l) => l !== primaryLayer);
  const relationshipAsk =
    combineExplicit ||
    /ba[gğ]lant|ili[sş]ki|birlikte|[oö]r[uü]nt[uü].*par[cç]a|ayn[ıi]\s+tarih|birbirine/i.test(text);
  const wantsSynthesis = Boolean(
    (combineExplicit && unique.length >= 1) ||
      (unique.length >= 2 && relationshipAsk),
  );

  let confidence = 'low';
  if (unique.length >= 2 || (primaryLayer && evidence.length >= 2)) confidence = 'medium';
  if (
    (primaryLayer === 'dream' && dreamIntent.active) ||
    (primaryLayer === 'astrology' && natal) ||
    (primaryLayer === 'numerology' && isRepeatingNumberPattern(text, history))
  ) {
    confidence = 'high';
  }
  if (ambiguousPattern) confidence = 'low';

  return {
    primaryLayer,
    secondaryLayers,
    layers: unique,
    evidence,
    confidence,
    wantsSynthesis: Boolean(wantsSynthesis && unique.length >= 2) || Boolean(combineExplicit && unique.length >= 1),
    combineExplicit,
    dreamFramed,
    numbers,
    ambiguousPattern,
    version: SEMANTIC_LAYERS_VERSION,
  };
}

/**
 * Whether solo deterministic engines should yield to synthesis.
 * Dream-primary without explicit combine keeps dream engine reachable.
 * Multi-layer without an explicit relationship ask should NOT skip primary engines.
 */
export function shouldPreferConvergence(semantic) {
  if (!semantic?.wantsSynthesis) return false;
  if (semantic.primaryLayer === 'dream' && !semantic.combineExplicit) return false;
  // Require explicit combine/relationship language for convergence monopolization
  if (!semantic.combineExplicit) return false;
  if (semantic.layers.length < 2 && !semantic.combineExplicit) return false;
  return true;
}
