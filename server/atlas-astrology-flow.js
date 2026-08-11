// ═══════════════════════════════════════════════════════════════════════
// Astrology / symbolic daily analysis flow
// Clarification-first intents + verified data injection for Web + Telegram
// ═══════════════════════════════════════════════════════════════════════

import { buildSymbolicCalendarContext, formatCalendarDataBlock } from './atlas-symbolic-calendar.js';
import { buildEphemerisSnapshot, formatEphemerisDataBlock, DEFAULT_SKY_LOCATION } from './atlas-ephemeris.js';
import { formatNumerologyDataBlock, numerologyDayNumber } from './atlas-numerology.js';
import { getUserMemory } from './user-memory.js';
import {
  calculateNatalFromMemory,
  detectNatalChartIntent,
  formatNatalDataBlock,
  formatNatalSummaryLines,
} from './natal-engine/index.js';
import { MONTH_NAMES_TR } from './natal-engine/constants.js';
import {
  canonicalizeZodiac,
  getConversationState,
  updateConversationState,
} from './conversation-context-engine.js';

export const ASTROLOGY_FLOW_VERSION = 'atlas-astrology-flow-v2.1';

export const CLARIFY_ANALYSIS_TYPE_REPLY = [
  'Tabii. Hangisini inceleyelim?',
  '',
  '• Genel gökyüzü etkisi',
  '• Doğum haritana özel transitler',
  '• İlişki haritası',
  '• Belirli bir yaşam alanı (ilişki, iş, para, sağlık…)',
  '',
  'İstersen Hicri takvim ve numerolojik katmanı da analize ekleyebilirim.',
].join('\n');

export const ASK_BIRTH_DATA_REPLY =
  'Doğum tarihini, mümkünse kesin saatini ve doğum yerini paylaşır mısın?';

export const ASK_BIRTH_PLACE_FOR_HOUSES_REPLY =
  'Doğum haritasını güvenilir biçimde hesaplayabilmem için doğum yerini de belirtmelisin.';

export const ASK_BIRTH_TIME_FOR_ASC_REPLY =
  'Yükselen ve evler için kesin doğum saati gerekir; saat bilinmeden tahmin etmem. Doğum saatini paylaşır mısın?';

export const CLARIFY_RELATIONSHIP_REPLY =
  'İki doğum haritasının genel uyumunu mu, yoksa bugünkü gökyüzünün ilişkinize etkisini mi inceleyelim? İki kişi için doğum tarihi, mümkünse saat ve yer de gerekli.';

export const FATE_REFUSAL_REPLY =
  'Kesin bir felaket veya kaçınılmaz olay söyleyemem. Astroloji burada sembolik bir çerçevedir; korkutucu kader dili kullanmam. İstersen günün genel atmosferini veya belirli bir alanı sakin bir dille inceleyebiliriz.';

/**
 * @typedef {'clarify_type'|'general_daily'|'personal_transit'|'relationship_clarify'|'relationship_needs_data'|'topic_focused'|'multi_layer_daily'|'fate_refusal'|'natal_chart'|'date_specific_astrology'|'unknown'|null} AstrologyFlowIntent
 */

/**
 * @typedef {{
 *   requestType: 'date_specific_astrology',
 *   targetZodiac: string,
 *   targetZodiacEn: string,
 *   targetDate: { year: number, month: number, day: number, isoDate: string, display: string, yearSource: string },
 *   whenIso: string,
 *   groundingState: 'verified'|'unavailable',
 *   relevantTransitKeys: string[],
 *   ephemerisSource: string|null,
 *   requestedAction?: string,
 *   updatedAt: string,
 * }} AstrologyGroundingState
 */

const ASTRO_DOMAIN =
  /astroloj|bur[cç]|g[oö]ky[uü]z|transit|harita|natal|sinastri|numeroloj|hicr|kozmik|cosmic|g[uü]nl[uü]k analiz|g[uü]n[uü]n etkisi|(?<!\p{L})(?:ko[cç]|bo[gğ]a|[iı]kizler|yenge[cç]|aslan|ba[sş]ak|terazi|akrep|yay|o[gğ]lak|kova|bal[iı]k)(?:lar|ler)?(?!\p{L})/iu;

const ANALYSIS_ASK = /analiz|yorum|etki|incele|anlat|bakar mısın|yapar mısın|değerlendir|etkilenecek|nasıl olacak/;

const MONTH_RE =
  /ocak|[sş]ubat|mart|nisan|may[iı]s|haziran|temmuz|a[gğ]ustos|eyl[uü]l|ekim|kas[iı]m|aral[iı]k/iu;

const ZODIAC_EN = {
  Koç: 'Aries',
  Boğa: 'Taurus',
  İkizler: 'Gemini',
  Yengeç: 'Cancer',
  Aslan: 'Leo',
  Başak: 'Virgo',
  Terazi: 'Libra',
  Akrep: 'Scorpio',
  Yay: 'Sagittarius',
  Oğlak: 'Capricorn',
  Kova: 'Aquarius',
  Balık: 'Pisces',
};

const SIGNS_ORDER = [
  'Koç',
  'Boğa',
  'İkizler',
  'Yengeç',
  'Aslan',
  'Başak',
  'Terazi',
  'Akrep',
  'Yay',
  'Oğlak',
  'Kova',
  'Balık',
];

const EXPAND_FOLLOWUP_RE =
  /^(daha\s+detayl[ıi](?:\s+yaz(?:abilir\s+misin)?)?|detayl[ıi]\s+yaz|daha\s+uzun|biraz\s+daha\s+(?:a[cç]|anlat)|derine\s+in|kapsaml[ıi]\s+yaz)(?:abilir\s+misin)?[.!?…]*$/iu;

const GENERIC_ZODIAC_TRAITS_RE =
  /genel\s+[oö]zellik|burcunun\s+[oö]zellik|ne\s+anlama\s+gelir|karakter(?:istik)?\s+[oö]zellik|tipik\s+[oö]zellik/i;

const DATE_SPECIFIC_TIME_RE =
  /(?:\d{1,2}\s+(?:ocak|[sş]ubat|mart|nisan|may[iı]s|haziran|temmuz|a[gğ]ustos|eyl[uü]l|ekim|kas[iı]m|aral[iı]k)\w*|\byar[ıi]n\b|\bbu\s+hafta\b|\bbug[uü]n\b|\btutulma\b|\bretro(?:su|da|da)?\b|\bingress\b|\bistasyon\b)/iu;

const ABSOLUTE_ASTRO_PROPHECY_RE =
  /\b(kesin(likle)?\s+(ayr[ıi]l[ıi]k|yeni\s+ili[sş]ki|evlilik|i[sş]ten\s+[cç][ıi]k|ba[sş][ıi]na\s+gelecek)|kesin\s+olarak\s+(yeni\s+ili[sş]ki|ayr[ıi]l[ıi]k)\s+getir)/i;

function normalizeTr(text) {
  return String(text ?? '').toLocaleLowerCase('tr-TR');
}

function foldMonthKey(raw) {
  return String(raw ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

/**
 * Extract tropical zodiac target (supports plurals: kovalar → Kova).
 * @param {string} message
 * @returns {string|null}
 */
export function extractZodiacTarget(message) {
  const text = String(message || '');
  const m = text.match(
    /(?<!\p{L})(ko[cç]|bo[gğ]a|[iı]kizler|yenge[cç]|aslan|ba[sş]ak|terazi|akrep|yay|o[gğ]lak|kova|bal[iı]k)(?:lar|ler|bur[cç](?:u|lar[ıi])?)?(?!\p{L})/iu,
  );
  if (!m) return null;
  return canonicalizeZodiac(m[1]);
}

/**
 * Resolve calendar date for astrology (day+month required for date-specific).
 * Year: explicit → history grounding → current civil year (never silently rewrite a known year).
 * @param {string} message
 * @param {{ role?: string, content?: string }[]} [history]
 * @param {{ now?: Date, conversationId?: string }} [opts]
 */
export function resolveAstrologyDate(message, history = [], opts = {}) {
  const text = String(message || '');
  const now = opts.now instanceof Date ? opts.now : new Date();
  const prior =
    (opts.conversationId && getAstrologyGrounding(opts.conversationId)?.targetDate) ||
    extractDateFromHistory(history);

  const explicitYear = text.match(/\b(20\d{2}|19\d{2})\b/);
  const dayMonth = text.match(
    new RegExp(String.raw`\b(\d{1,2})\s+(${MONTH_RE.source})\w*`, 'iu'),
  );

  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const monthKey = foldMonthKey(dayMonth[2]);
    const month = MONTH_NAMES_TR[monthKey] ?? MONTH_NAMES_TR[dayMonth[2].toLocaleLowerCase('tr-TR')];
    if (!month || day < 1 || day > 31) {
      return { ok: false, reason: 'INVALID_DAY_MONTH', needsClarification: true };
    }
    const year = explicitYear
      ? Number(explicitYear[1])
      : prior?.year && prior.month === month && prior.day === day
        ? prior.year
        : civilYearInZone(now, DEFAULT_SKY_LOCATION.timeZone);
    const yearSource = explicitYear
      ? 'explicit'
      : prior?.year && prior.month === month && prior.day === day
        ? 'conversation'
        : 'current_civil_year';
    if (!isValidYmd(year, month, day)) {
      return { ok: false, reason: 'INVALID_CALENDAR_DATE', needsClarification: true };
    }
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return {
      ok: true,
      year,
      month,
      day,
      isoDate,
      display: `${day} ${monthDisplayTr(month)} ${year}`,
      yearSource,
      when: localNoonIstanbul(year, month, day),
    };
  }

  if (/\byar[ıi]n\b/i.test(text)) {
    const t = new Date(now.getTime() + 24 * 3600 * 1000);
    const parts = civilYmdInZone(t, DEFAULT_SKY_LOCATION.timeZone);
    const isoDate = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    return {
      ok: true,
      ...parts,
      isoDate,
      display: `${parts.day} ${monthDisplayTr(parts.month)} ${parts.year}`,
      yearSource: 'relative_tomorrow',
      when: localNoonIstanbul(parts.year, parts.month, parts.day),
    };
  }

  if (/\bbug[uü]n\b/i.test(text)) {
    const parts = civilYmdInZone(now, DEFAULT_SKY_LOCATION.timeZone);
    const isoDate = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    return {
      ok: true,
      ...parts,
      isoDate,
      display: `${parts.day} ${monthDisplayTr(parts.month)} ${parts.year}`,
      yearSource: 'relative_today',
      when: localNoonIstanbul(parts.year, parts.month, parts.day),
    };
  }

  if (prior?.isoDate) {
    return {
      ok: true,
      year: prior.year,
      month: prior.month,
      day: prior.day,
      isoDate: prior.isoDate,
      display: prior.display || `${prior.day} ${monthDisplayTr(prior.month)} ${prior.year}`,
      yearSource: 'conversation',
      when: localNoonIstanbul(prior.year, prior.month, prior.day),
    };
  }

  return { ok: false, reason: 'DATE_NOT_FOUND', needsClarification: true };
}

function extractDateFromHistory(history) {
  for (const turn of [...(history || [])].reverse().slice(0, 8)) {
    if (turn?.role !== 'user') continue;
    const resolved = resolveAstrologyDate(turn.content || '', [], { now: new Date() });
    if (resolved.ok) {
      return {
        year: resolved.year,
        month: resolved.month,
        day: resolved.day,
        isoDate: resolved.isoDate,
        display: resolved.display,
      };
    }
  }
  return null;
}

function civilYearInZone(date, timeZone) {
  return civilYmdInZone(date, timeZone).year;
}

function civilYmdInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function localNoonIstanbul(year, month, day) {
  // Approximation: 12:00 Europe/Istanbul ≈ 09:00 UTC (standard); DST handled loosely via +03.
  return new Date(Date.UTC(year, month - 1, day, 9, 0, 0));
}

function isValidYmd(year, month, day) {
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function monthDisplayTr(month) {
  const names = [
    '',
    'Ocak',
    'Şubat',
    'Mart',
    'Nisan',
    'Mayıs',
    'Haziran',
    'Temmuz',
    'Ağustos',
    'Eylül',
    'Ekim',
    'Kasım',
    'Aralık',
  ];
  return names[month] || String(month);
}

/**
 * True when message asks for date/time-bound transit interpretation (not generic traits).
 * @param {string} message
 * @param {{ role?: string, content?: string }[]} [history]
 * @param {{ conversationId?: string }} [opts]
 */
export function isDateSpecificAstrologyRequest(message, history = [], opts = {}) {
  const text = String(message || '').trim();
  if (!text) return false;
  if (GENERIC_ZODIAC_TRAITS_RE.test(text)) return false;

  const grounding = opts.conversationId ? getAstrologyGrounding(opts.conversationId) : null;
  if (isExpandAstrologyFollowUp(text) && (grounding?.requestType === 'date_specific_astrology' || historyHasDateSpecificAstrology(history))) {
    return true;
  }

  const zodiac = extractZodiacTarget(text) || grounding?.targetZodiac || extractZodiacFromHistory(history);
  const hasTime = DATE_SPECIFIC_TIME_RE.test(text) || Boolean(grounding?.targetDate);
  const asksEffect = ANALYSIS_ASK.test(normalizeTr(text)) || /nas[ıi]l\s+etkil|etki(?:si|lenecek)?/i.test(text);
  return Boolean(zodiac && hasTime && asksEffect);
}

function extractZodiacFromHistory(history) {
  for (const turn of [...(history || [])].reverse().slice(0, 8)) {
    if (turn?.role !== 'user') continue;
    const z = extractZodiacTarget(turn.content || '');
    if (z) return z;
  }
  return null;
}

function historyHasDateSpecificAstrology(history) {
  return (history || []).some((t) => {
    if (t?.role !== 'user') return false;
    const text = String(t.content || '');
    if (!text || GENERIC_ZODIAC_TRAITS_RE.test(text)) return false;
    const zodiac = extractZodiacTarget(text);
    const hasTime = DATE_SPECIFIC_TIME_RE.test(text);
    const asksEffect =
      ANALYSIS_ASK.test(normalizeTr(text)) || /nas[ıi]l\s+etkil|etki(?:si|lenecek)?/i.test(text);
    return Boolean(zodiac && hasTime && asksEffect);
  });
}

/**
 * @param {string} message
 */
export function isExpandAstrologyFollowUp(message) {
  const text = String(message || '').trim();
  if (!text || text.length > 80) return false;
  if (EXPAND_FOLLOWUP_RE.test(text)) return true;
  // Avoid ASCII \b after Turkish ı/İ — use letter-boundary instead.
  return /^daha\s+detayl[ıi](?!\p{L})/iu.test(text) && text.split(/\s+/).filter(Boolean).length <= 8;
}

/**
 * @param {string} conversationId
 * @returns {AstrologyGroundingState|null}
 */
export function getAstrologyGrounding(conversationId) {
  if (!conversationId) return null;
  const state = getConversationState(conversationId);
  return state.astrologyGrounding || null;
}

/**
 * @param {string} conversationId
 * @param {AstrologyGroundingState} grounding
 */
export function rememberAstrologyGrounding(conversationId, grounding) {
  if (!conversationId || !grounding) return;
  updateConversationState(conversationId, {
    astrologyGrounding: grounding,
    activeTopic: 'astrology',
    symbolicDomain: 'astrology',
  });
}

/**
 * Select only transits relevant to a sun-sign cohort (no full-sky dump).
 * @param {ReturnType<typeof buildEphemerisSnapshot>} sky
 * @param {string} zodiac
 */
export function selectRelevantCelestialFacts(sky, zodiac) {
  /** @type {{ key: string, kind: string, body?: string, detail: string, grounded: true }[]} */
  const facts = [];
  if (!sky?.ok || !zodiac) {
    return { ok: false, facts: [], keys: [] };
  }

  const signIndex = SIGNS_ORDER.indexOf(zodiac);
  const opposite = signIndex >= 0 ? SIGNS_ORDER[(signIndex + 6) % 12] : null;
  const squareA = signIndex >= 0 ? SIGNS_ORDER[(signIndex + 3) % 12] : null;
  const squareB = signIndex >= 0 ? SIGNS_ORDER[(signIndex + 9) % 12] : null;

  if (sky.sun) {
    facts.push({
      key: `sun:${sky.sun.sign}`,
      kind: 'luminaries',
      body: 'Güneş',
      detail: `Güneş ${sky.sun.display}`,
      grounded: true,
    });
  }
  if (sky.moon) {
    facts.push({
      key: `moon:${sky.moon.sign}:${sky.moon.phase}`,
      kind: 'luminaries',
      body: 'Ay',
      detail: `Ay ${sky.moon.display} — faz: ${sky.moon.phase}`,
      grounded: true,
    });
  }

  for (const p of Object.values(sky.planets || {})) {
    if (!p?.sign) continue;
    const inTarget = p.sign === zodiac;
    const inOpp = p.sign === opposite;
    const inSquare = p.sign === squareA || p.sign === squareB;
    const isLuminary = p.body === 'Güneş' || p.body === 'Ay';
    if (isLuminary) continue;
    if (inTarget || inOpp || inSquare) {
      const relation = inTarget ? `hedef burç (${zodiac})` : inOpp ? `karşıt (${opposite})` : 'kare ekseni';
      facts.push({
        key: `planet:${p.body}:${p.sign}`,
        kind: 'transit_sign',
        body: p.body,
        detail: `${p.body} ${p.display} — ${relation}`,
        grounded: true,
      });
    }
  }

  for (const name of sky.retrogrades || []) {
    facts.push({
      key: `retro:${name}`,
      kind: 'retrograde',
      body: name,
      detail: `${name} retrograd (24s delta örneklemi)`,
      grounded: true,
    });
  }

  // Deduplicate by key
  const seen = new Set();
  const unique = [];
  for (const f of facts) {
    if (seen.has(f.key)) continue;
    seen.add(f.key);
    unique.push(f);
  }

  return { ok: true, facts: unique, keys: unique.map((f) => f.key) };
}

/**
 * Whether a free-text celestial claim is supported by verified facts.
 * @param {string} claim
 * @param {{ facts: { detail: string, body?: string }[] }} relevant
 * @param {ReturnType<typeof buildEphemerisSnapshot>|null} [sky]
 */
export function isCelestialClaimGrounded(claim, relevant, sky = null) {
  const text = String(claim || '');
  const bodies = ['Güneş', 'Ay', 'Merkür', 'Venüs', 'Mars', 'Jüpiter', 'Satürn', 'Uranüs', 'Neptün', 'Plüton'];
  const mentioned = bodies.filter((b) => new RegExp(b, 'i').test(text));
  if (!mentioned.length) return true; // no factual celestial body claim
  const corpus = [
    ...(relevant?.facts || []).map((f) => f.detail),
    ...Object.values(sky?.planets || {}).map((p) => `${p.body} ${p.sign} ${p.display}`),
    ...(sky?.retrogrades || []).map((r) => `${r} retro`),
  ]
    .join('\n')
    .toLocaleLowerCase('tr-TR');

  const signAlt =
    'ko[cç]|bo[gğ]a|[iı]kizler|yenge[cç]|aslan|ba[sş]ak|terazi|akrep|yay|o[gğ]lak|kova|bal[iı]k';

  for (const body of mentioned) {
    const signHit = text.match(
      new RegExp(`${body}(?:\\s+burcu)?\\s+(${signAlt})(?:['’]?d[ae]|\\s+burcu)?`, 'i'),
    );
    if (signHit) {
      const sign = canonicalizeZodiac(signHit[1]);
      if (!sign) return false;
      const bodyInCorpus = new RegExp(`${body}[^\\n]*${sign}`, 'i').test(corpus);
      if (!bodyInCorpus) return false;
    }
    if (/retro/i.test(text) && new RegExp(body, 'i').test(text)) {
      const retros = (sky?.retrogrades || []).map((r) => r.toLocaleLowerCase('tr-TR'));
      if (!retros.includes(body.toLocaleLowerCase('tr-TR'))) return false;
    }
  }
  return true;
}

/**
 * Soften deterministic prophecy language (symbolic layer bound).
 * @param {string} reply
 */
export function applyAstrologyProphecyGuard(reply) {
  const original = typeof reply === 'string' ? reply : '';
  if (!original.trim()) return { reply: original, hits: [], changed: false };
  const hits = [];
  let text = original;
  if (ABSOLUTE_ASTRO_PROPHECY_RE.test(text)) {
    hits.push('absolute_astro_prophecy');
    text = text
      .replace(/\bkesin(likle)?\s+ayr[ıi]l[ıi]k\s+ya[sş]ayacaks[ıi]n\b/gi, 'ayrılık teması öne çıkabilir')
      .replace(/\bkesin\s+olarak\s+yeni\s+ili[sş]ki\s+getir(?:ir|ebilir)\b/gi, 'yeni ilişki temasını tetikleyebilir')
      .replace(/\bkesin(likle)?\s+/gi, 'olası biçimde ');
  }
  return { reply: text, hits, changed: text !== original };
}

/**
 * @param {string} message
 * @param {{ role: string, content: string }[]} [history]
 * @param {{ conversationId?: string, now?: Date }} [opts]
 */
export function detectAstrologyFlowIntent(message, history = [], opts = {}) {
  const text = String(message ?? '').trim();
  if (!text) return null;
  const lower = normalizeTr(text);

  if (/kesin (kötü|felaket|başıma gelecek)|kaçınılmaz|bugün kesin/.test(lower)) {
    if (ASTRO_DOMAIN.test(lower) || /olacak mı|başıma/.test(lower)) {
      return 'fate_refusal';
    }
  }

  // Generic traits — do NOT force date-specific grounding gate
  if (GENERIC_ZODIAC_TRAITS_RE.test(text) && extractZodiacTarget(text) && !DATE_SPECIFIC_TIME_RE.test(text)) {
    return null;
  }

  if (isDateSpecificAstrologyRequest(text, history, opts)) {
    return 'date_specific_astrology';
  }

  const natalIntent = detectNatalChartIntent(text);
  if (natalIntent === 'natal_chart' || natalIntent === 'natal_ascendant') {
    return 'natal_chart';
  }

  const pendingClarify = hasAssistantClarify(history);

  // Follow-ups after clarification
  if (pendingClarify || isAstrologyFollowUp(lower)) {
    if (/genel|gökyüz|kolektif/.test(lower) && !/haritam|doğum|ilişki/.test(lower)) {
      if (/hicr|numerol/.test(lower) || /hepsini|sentez|birlikte/.test(lower)) {
        return 'multi_layer_daily';
      }
      return 'general_daily';
    }
    if (/haritam|natal|doğum harita|bana özel|kişisel transit|benim haritam/.test(lower)) {
      return 'personal_transit';
    }
    if (/ilişki|sinastri|partner|eşim|sevgili/.test(lower)) {
      if (/uyum|birleşik|composite|transit.*ilişki|ilişki.*transit/.test(lower)) {
        return 'relationship_needs_data';
      }
      return 'relationship_clarify';
    }
    if (/\biş\b|para|sağlık|ruhsal|karar/.test(lower)) {
      return 'topic_focused';
    }
  }

  // Explicit multi-layer
  if (/astroloj/.test(lower) && /numerol/.test(lower) && /hicr/.test(lower)) {
    return 'multi_layer_daily';
  }

  if (/hicr/.test(lower) && /(astroloj|numerol|gün)/.test(lower) && ANALYSIS_ASK.test(lower)) {
    return 'multi_layer_daily';
  }

  // Explicit general sky
  if (/genel (gökyüz|etki|analiz)/.test(lower) || /gökyüzünü (anlat|analiz)/.test(lower)) {
    return 'general_daily';
  }

  // Personal chart effect
  if (/haritama etkisi|doğum haritama|bana özel transit|natal.*(etki|analiz)/.test(lower)) {
    return 'personal_transit';
  }

  // Relationship (include ilişkimize / ilişkiye)
  if (
    /ilişki(m|miz|niz)?e?\s*etkisi|ilişkimize|ilişkiye etkisi|sinastri|ilişki analizi|ilişkimizin/.test(
      lower,
    )
  ) {
    return 'relationship_clarify';
  }

  // Ambiguous astrology / daily analysis ask → clarify
  if (ASTRO_DOMAIN.test(lower) && ANALYSIS_ASK.test(lower)) {
    if (/genel/.test(lower) && (/hicr|numerol/.test(lower))) return 'multi_layer_daily';
    if (/genel/.test(lower)) return 'general_daily';
    return 'clarify_type';
  }

  if (/bugün.*(astroloj|burç|gökyüz|numerol|hicr)/.test(lower) && ANALYSIS_ASK.test(lower)) {
    return 'clarify_type';
  }

  if (/günlük (astroloj|analiz|yorum)/.test(lower)) {
    return 'clarify_type';
  }

  return null;
}

function hasAssistantClarify(history) {
  return (history ?? [])
    .slice(-4)
    .some(
      (t) =>
        t.role === 'assistant' &&
        /genel gökyüz|doğum haritana özel|belirli bir alan/i.test(normalizeTr(t.content ?? '')),
    );
}

function isAstrologyFollowUp(lowerText) {
  return /^(genel|haritam|doğum|ilişki|iş|para|sağlık|ruhsal|karar|kısa|detaylı|daha\s+detayl)/.test(
    lowerText.trim(),
  );
}

/**
 * @param {{
 *   message: string,
 *   history?: { role: string, content: string }[],
 *   userId?: string,
 *   conversationId?: string,
 *   now?: Date,
 * }} input
 * @returns {{ intent: string, reply: string, engine: string, data?: object } | null}
 */
export function tryAstrologyFlowReply(input) {
  const intent = detectAstrologyFlowIntent(input.message, input.history ?? [], {
    conversationId: input.conversationId,
    now: input.now,
  });
  if (!intent) return null;

  if (intent === 'fate_refusal') {
    return { intent, reply: FATE_REFUSAL_REPLY, engine: 'astrology-flow' };
  }

  if (intent === 'date_specific_astrology') {
    // Clarification-only when date cannot be resolved; otherwise LLM + verified ephemeris.
    const date = resolveAstrologyDate(input.message, input.history ?? [], {
      conversationId: input.conversationId,
      now: input.now,
    });
    const zodiac =
      extractZodiacTarget(input.message) ||
      getAstrologyGrounding(input.conversationId)?.targetZodiac ||
      extractZodiacFromHistory(input.history ?? []);
    if (!date.ok || !zodiac) {
      return {
        intent,
        reply:
          'Bu tarih + burç yorumu için net bir gün (ör. 12 Ağustos) ve burç belirtmen yeterli; yıl konuşmadan çıkarılamazsa bulunduğumuz yılı kullanırım. Hangisini netleştirelim?',
        engine: 'astrology-flow',
        data: {
          factualGroundingRequired: true,
          dateOk: Boolean(date.ok),
          zodiacOk: Boolean(zodiac),
          reason: date.reason || (!zodiac ? 'ZODIAC_NOT_FOUND' : null),
        },
      };
    }
    return null;
  }

  if (intent === 'clarify_type') {
    return { intent, reply: CLARIFY_ANALYSIS_TYPE_REPLY, engine: 'astrology-flow' };
  }

  if (intent === 'relationship_clarify') {
    return { intent, reply: CLARIFY_RELATIONSHIP_REPLY, engine: 'astrology-flow' };
  }

  if (intent === 'natal_chart') {
    const natal = tryNatalChartDeterministicReply(input);
    if (natal) return natal;
    // Has enough data → LLM interprets verified natal block (caller injects context)
    return null;
  }

  if (intent === 'personal_transit') {
    const missing = getMissingBirthFields(input.userId);
    if (missing.length) {
      return {
        intent,
        reply: ASK_BIRTH_DATA_REPLY,
        engine: 'astrology-flow',
        data: { missingBirthFields: missing },
      };
    }
    // Has data → let LLM proceed with injected context (caller)
    return null;
  }

  if (intent === 'relationship_needs_data') {
    return {
      intent,
      reply:
        'İlişki analizi için iki kişinin doğum tarihlerini, mümkünse saatlerini, doğum yerlerini ve incelenmek istenen ilişki konusunu paylaşır mısın?',
      engine: 'astrology-flow',
    };
  }

  if (intent === 'topic_focused') {
    // If topic chosen but no chart preference, ask lightly only when natal implied
    if (/haritam|bana [oö]zel|transit/i.test(input.message)) {
      const missing = getMissingBirthFields(input.userId);
      if (missing.length) {
        return { intent, reply: ASK_BIRTH_DATA_REPLY, engine: 'astrology-flow', data: { missingBirthFields: missing } };
      }
    }
    return null;
  }

  // general_daily / multi_layer_daily → LLM with data
  return null;
}

/**
 * Deterministic natal chart short-circuit when calculation fails or data incomplete.
 * On success returns null so LLM can interpret the verified block.
 * @param {{ message: string, userId?: string }} input
 */
function tryNatalChartDeterministicReply(input) {
  const missing = getMissingBirthFields(input.userId);
  if (missing.includes('birthDate') || missing.includes('birthPlace')) {
    return {
      intent: 'natal_chart',
      reply: ASK_BIRTH_DATA_REPLY,
      engine: 'natal-engine',
      data: { missingBirthFields: missing },
    };
  }

  const memory = input.userId && input.userId !== 'web:anonymous' ? getUserMemory(input.userId) : null;
  const wantsAsc =
    /yükselen|ascendant|rising|evler|mc|midheaven/i.test(input.message || '') ||
    detectNatalChartIntent(input.message) === 'natal_ascendant';

  if (wantsAsc && !memory?.profile?.birthTime) {
    return {
      intent: 'natal_chart',
      reply: ASK_BIRTH_TIME_FOR_ASC_REPLY,
      engine: 'natal-engine',
      data: { missingBirthFields: ['birthTime'] },
    };
  }

  const chart = calculateNatalFromMemory(input.userId);
  if (!chart.ok) {
    if (chart.errorCode === 'AMBIGUOUS_BIRTH_PLACE') {
      const names = (chart.meta?.candidates || []).map((c) => c.displayName).filter(Boolean);
      return {
        intent: 'natal_chart',
        reply: names.length
          ? `Bu isimde birden fazla konum var: ${names.join('; ')}. Hangisini kullanayım?`
          : ASK_BIRTH_PLACE_FOR_HOUSES_REPLY,
        engine: 'natal-engine',
        data: { errorCode: chart.errorCode, candidates: chart.meta?.candidates },
      };
    }
    if (chart.errorCode === 'BIRTH_PLACE_REQUIRED' || chart.errorCode === 'LOCATION_RESOLUTION_FAILED') {
      return {
        intent: 'natal_chart',
        reply: ASK_BIRTH_PLACE_FOR_HOUSES_REPLY,
        engine: 'natal-engine',
        data: { errorCode: chart.errorCode },
      };
    }
    return {
      intent: 'natal_chart',
      reply: chart.message || ASK_BIRTH_DATA_REPLY,
      engine: 'natal-engine',
      data: { errorCode: chart.errorCode },
    };
  }

  // Pure calculation ask without "yorum/analiz" → return verified numbers only
  const lower = normalizeTr(input.message || '');
  if (
    /hesapla|kaç|nedir|göster|çıkar/.test(lower) &&
    !/yorum|analiz|anlat|ne anlama/.test(lower)
  ) {
    const lines = formatNatalSummaryLines(chart);
    const note = chart.dataQuality.fullChartAvailable
      ? ''
      : '\n\nNot: Tam yükselen/ev hesabı için eksik veri vardı; yalnızca güvenilir hesaplanan noktalar gösterildi.';
    return {
      intent: 'natal_chart',
      reply: ['Doğum haritan (hesaplanan):', ...lines].join('\n') + note,
      engine: 'natal-engine',
      data: {
        natal: {
          analysisId: chart.analysisId,
          fullChartAvailable: chart.dataQuality.fullChartAvailable,
          methodologyId: chart.methodology.methodologyId,
        },
      },
    };
  }

  return null;
}

function getMissingBirthFields(userId) {
  if (!userId || userId === 'web:anonymous') return ['birthDate', 'birthTime', 'birthPlace'];
  const memory = getUserMemory(userId);
  const missing = [];
  if (!memory?.profile?.birthDate) missing.push('birthDate');
  if (!memory?.profile?.birthPlace) missing.push('birthPlace');
  // birth time optional but preferred — do not block solely on time; ask in reply if missing when proceeding
  return missing.filter((f) => f === 'birthDate' || f === 'birthPlace');
}

/**
 * Build verified data + instruction block for LLM astrology answers.
 * @param {{
 *   message: string,
 *   history?: { role: string, content: string }[],
 *   userId?: string,
 *   when?: Date,
 *   conversationId?: string,
 *   now?: Date,
 * }} options
 */
export function buildAstrologyAnalysisContext(options = {}) {
  const intent =
    detectAstrologyFlowIntent(options.message, options.history ?? [], {
      conversationId: options.conversationId,
      now: options.now,
    }) ?? 'general_daily';

  const priorGrounding = options.conversationId
    ? getAstrologyGrounding(options.conversationId)
    : null;
  const expandFollowUp = isExpandAstrologyFollowUp(options.message);

  /** @type {ReturnType<typeof resolveAstrologyDate>|null} */
  let resolvedDate = null;
  /** @type {string|null} */
  let targetZodiac = null;
  /** @type {ReturnType<typeof selectRelevantCelestialFacts>|null} */
  let relevant = null;

  let when = options.when ?? options.now ?? new Date();
  if (intent === 'date_specific_astrology') {
    resolvedDate = resolveAstrologyDate(options.message, options.history ?? [], {
      conversationId: options.conversationId,
      now: options.now ?? new Date(),
    });
    targetZodiac =
      extractZodiacTarget(options.message) ||
      priorGrounding?.targetZodiac ||
      extractZodiacFromHistory(options.history ?? []);
    if (resolvedDate?.ok) {
      when = resolvedDate.when;
    } else if (priorGrounding?.whenIso) {
      when = new Date(priorGrounding.whenIso);
    }
  }

  const calendar = buildSymbolicCalendarContext(when);
  const sky = buildEphemerisSnapshot({
    when,
    locationName: DEFAULT_SKY_LOCATION.name,
    latitude: DEFAULT_SKY_LOCATION.latitude,
    longitude: DEFAULT_SKY_LOCATION.longitude,
    timeZone: DEFAULT_SKY_LOCATION.timeZone,
  });

  if (intent === 'date_specific_astrology' && targetZodiac) {
    relevant = selectRelevantCelestialFacts(sky, targetZodiac);
  }

  let numerologyBlock = '';
  if (calendar.ok) {
    numerologyBlock = formatNumerologyDataBlock(calendar.gregorian);
  }

  const length = detectLengthPreference(options.message, {
    expandFollowUp,
    intent,
  });
  const includeHijri = intent === 'multi_layer_daily' || /hicr/i.test(options.message);
  const includeNumerology =
    intent === 'multi_layer_daily' || /numerol/i.test(options.message) || intent === 'general_daily';

  const memory = options.userId && options.userId !== 'web:anonymous' ? getUserMemory(options.userId) : null;
  const birthTimeKnown = Boolean(memory?.profile?.birthTime);

  /** @type {ReturnType<typeof calculateNatalFromMemory>|null} */
  let natalChart = null;
  if (
    (intent === 'personal_transit' || intent === 'natal_chart') &&
    memory?.profile?.birthDate
  ) {
    natalChart = calculateNatalFromMemory(options.userId);
  }

  const structure =
    intent === 'date_specific_astrology'
      ? `ZORUNLU SIRA (factual → symbolic):
1) FACTUAL CELESTIAL LAYER — yalnızca aşağıdaki VERIFIED EPHEMERIS + RELEVANT TRANSITS bloklarından gezegen/burç/faz/retro iddiası.
2) RELEVANCE — yalnızca hedef burç (${targetZodiac || '—'}) için seçilmiş transitler.
3) SYMBOLIC INTERPRETATION — tematik/psikolojik yorum; kesin kader yok.
Yasak: blok dışı “Ay X’te”, “Venüs karşıt”, “tutulma var”, “Mars retro” uydurmak.
${expandFollowUp ? 'Bu tur genişletme (expand_previous_analysis): aynı tarih + aynı burç + aynı doğrulanmış transit setini derinleştir; yeni celestial fact icat etme.' : ''}`
      : intent === 'personal_transit' || intent === 'natal_chart'
        ? `Yapı: doğrulanmış natal noktalar (aşağıdaki VERIFIED NATAL bloğu), transitler (ephemeris), etkilenen evler yalnızca natal blokta ev varsa, en güçlü 3 tema, destekleyici/zorlayıcı etkiler, uygulanabilir öneriler. Natal dereceleri yeniden hesaplama veya uydurma.`
        : `Yapı: Miladi+Hicri tarih (istendiyse), Ay fazı/burcu, öne çıkan transitler, genel atmosfer, numeroloji (istendiyse), Hicri ay teması (istendiyse), ortak tema, dikkat alanı, pratik öneri.`;

  const lengthRule =
    length === 'short'
      ? 'Uzunluk: en fazla ~150 kelime (kısa özet).'
      : length === 'detailed'
        ? 'Uzunluk: kapsamlı ama tekrarsız (yaklaşık 500–800 kelime). İlk turda ana tema + yerleşim/açı etkisi + gölge/gerilim + dönemsel bağlam ver; kullanıcıyı zorlatma.'
        : 'Uzunluk: standart 300–500 kelime; kişisel veriler varsa sözlük tanımıyla yetinme; aynı temayı tekrar etme.';

  const natalBlock =
    natalChart != null
      ? formatNatalDataBlock(natalChart)
      : intent === 'personal_transit' || intent === 'natal_chart'
        ? '## VERIFIED NATAL CHART DATA\nUnavailable — do NOT invent Ascendant, houses, or natal degrees.'
        : '';

  const relevantBlock =
    intent === 'date_specific_astrology'
      ? formatRelevantTransitBlock(relevant, targetZodiac, resolvedDate)
      : '';

  const groundingState =
    intent === 'date_specific_astrology'
      ? sky.ok && resolvedDate?.ok && targetZodiac
        ? 'verified'
        : 'unavailable'
      : null;

  /** @type {AstrologyGroundingState|null} */
  let groundingRecord = null;
  if (intent === 'date_specific_astrology' && resolvedDate?.ok && targetZodiac) {
    groundingRecord = {
      requestType: 'date_specific_astrology',
      targetZodiac,
      targetZodiacEn: ZODIAC_EN[targetZodiac] || targetZodiac,
      targetDate: {
        year: resolvedDate.year,
        month: resolvedDate.month,
        day: resolvedDate.day,
        isoDate: resolvedDate.isoDate,
        display: resolvedDate.display,
        yearSource: resolvedDate.yearSource,
      },
      whenIso: sky.whenIso || resolvedDate.when.toISOString(),
      groundingState: groundingState || 'unavailable',
      relevantTransitKeys: relevant?.keys || priorGrounding?.relevantTransitKeys || [],
      ephemerisSource: sky.metadata?.source ?? null,
      requestedAction: expandFollowUp ? 'expand_previous_analysis' : 'interpret',
      updatedAt: new Date().toISOString(),
    };
    if (options.conversationId) {
      rememberAstrologyGrounding(options.conversationId, groundingRecord);
    }
  }

  const dateSpecificLock =
    intent === 'date_specific_astrology'
      ? `
## DATE-SPECIFIC ASTROLOGY GROUNDING GATE
- primary_domain = astrology
- request_type = date_specific_astrology
- target_zodiac = ${targetZodiac || 'MISSING'} (${ZODIAC_EN[targetZodiac] || ''})
- target_date = ${resolvedDate?.display || priorGrounding?.targetDate?.display || 'MISSING'}
- target_year = ${resolvedDate?.year ?? priorGrounding?.targetDate?.year ?? 'MISSING'} (source: ${resolvedDate?.yearSource || priorGrounding?.targetDate?.yearSource || 'n/a'})
- grounding_state = ${groundingState}
- factual_grounding_required = true
- Processing order: factual celestial data → relevant transit selection → symbolic interpretation.
- If grounding_state != verified: DO NOT fabricate transit claims; say data is unavailable.
- Bounded language only: "öne çıkarabilir", "tetikleyebilir", "daha görünür hâle getirebilir" — never deterministic prophecy.
`.trim()
      : '';

  return {
    intent,
    length,
    calendar,
    sky,
    natalChart: natalChart?.ok ? natalChart : null,
    numerology: calendar.ok
      ? numerologyDayNumber(calendar.gregorian.year, calendar.gregorian.month, calendar.gregorian.day)
      : null,
    birthTimeKnown,
    locationName: DEFAULT_SKY_LOCATION.name,
    targetZodiac,
    resolvedDate: resolvedDate?.ok ? resolvedDate : null,
    relevantTransits: relevant,
    grounding: groundingRecord,
    factualGroundingRequired: intent === 'date_specific_astrology',
    layerOrder: intent === 'date_specific_astrology'
      ? ['factual_celestial', 'relevant_transit_selection', 'symbolic_interpretation']
      : null,
    promptBlock: `
## ASTROLOGY FLOW (${ASTROLOGY_FLOW_VERSION})
Intent: ${intent}
${lengthRule}
${structure}

${dateSpecificLock}

Analiz konumu (gökyüzü/transit varsayılanı): ${DEFAULT_SKY_LOCATION.name}. Farklı şehir istenirse sor.

Üslup:
- İlk paragrafta ana temayı söyle.
- "Destekleyen sistemler / ayrışan noktalar / kör nokta / gerçeklik kontrolü" başlıklarını otomatik üretme; yalnızca gerçekten gerekliyse kullan.
- Kesin olay/kader tahmini yok; tıbbi/hukuki/finansal tavsiye yerine geçmez.
- Sembolik/yorumlayıcı çerçeveyi koru.
- Yükselen, ev, gezegen derecesi veya açı UYDURMA; yalnızca doğrulanmış natal/ephemeris bloklarını kullan.
${!birthTimeKnown && (intent === 'personal_transit' || intent === 'natal_chart') ? '- Doğum saati yok: yükselen ve ev yorumlarının sınırlı olduğunu açıkça söyle; tahmin etme.' : ''}
${natalChart && !natalChart.dataQuality?.fullChartAvailable ? '- Tam natal harita yok: eksik veri nedeniyle yükselen/ev iddiası yasak.' : ''}

${natalBlock}

${relevantBlock}

${formatEphemerisDataBlock(sky)}

${includeHijri || intent === 'multi_layer_daily' || intent === 'general_daily' || intent === 'date_specific_astrology' ? formatCalendarDataBlock(calendar) : formatCalendarDataBlock(calendar)}

${includeNumerology ? numerologyBlock : ''}
`.trim(),
    metadata: {
      astrologyFlowVersion: ASTROLOGY_FLOW_VERSION,
      calendarMethod: calendar.metadata?.method ?? null,
      ephemerisSource: sky.metadata?.source ?? null,
      defaultLocation: DEFAULT_SKY_LOCATION.name,
      natalEngineId: natalChart?.engineId ?? null,
      natalAnalysisId: natalChart?.analysisId ?? null,
      natalFullChart: natalChart?.dataQuality?.fullChartAvailable ?? false,
      dateSpecific: intent === 'date_specific_astrology',
      targetZodiac: targetZodiac || null,
      targetDate: resolvedDate?.isoDate || priorGrounding?.targetDate?.isoDate || null,
      groundingState,
      factualGroundingRequired: intent === 'date_specific_astrology',
      layerOrder:
        intent === 'date_specific_astrology'
          ? ['factual_celestial', 'relevant_transit_selection', 'symbolic_interpretation']
          : null,
      requestedAction: expandFollowUp ? 'expand_previous_analysis' : 'interpret',
    },
  };
}

function formatRelevantTransitBlock(relevant, zodiac, resolvedDate) {
  if (!relevant?.ok || !relevant.facts?.length) {
    return `## RELEVANT TRANSITS FOR ${zodiac || 'TARGET'}
Doğrulanmış ilgili transit seçilemedi. Gezegen/burç/faz/retro iddiası UYDURMA.`;
  }
  const lines = relevant.facts.map((f) => `- [${f.kind}] ${f.detail}`);
  return `## RELEVANT TRANSITS FOR ${zodiac} (${resolvedDate?.display || 'resolved date'})
Yalnızca bu liste + VERIFIED EPHEMERIS üzerinden factual claim yap.
${lines.join('\n')}
Keys: ${relevant.keys.join(', ')}`;
}

export function detectLengthPreference(message, opts = {}) {
  if (/k[ıi]sa [oö]zet|k[ıi]saca|özetle/i.test(message)) return 'short';
  if (
    opts.expandFollowUp ||
    /detayl[ıi]|kapsaml[ıi]|derine|yorumla|kişisel analiz|tam analiz/i.test(message)
  ) {
    return 'detailed';
  }
  // Personal chart / transit asks default to richer first-turn depth
  if (/haritam|natal|bana özel|kişisel transit|doğum harita/i.test(message)) {
    return 'detailed';
  }
  if (opts.intent === 'date_specific_astrology') return 'detailed';
  return 'standard';
}

/**
 * Whether this message should use astrology analysis LLM path (with data injection).
 * @param {string|null} intent
 */
export function isAstrologyAnalysisIntent(intent) {
  return (
    intent === 'general_daily' ||
    intent === 'multi_layer_daily' ||
    intent === 'topic_focused' ||
    intent === 'personal_transit' ||
    intent === 'natal_chart' ||
    intent === 'date_specific_astrology'
  );
}
