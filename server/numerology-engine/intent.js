/**
 * Numerology intent + follow-up detection.
 * Follow-ups must stay in numerology session — not route to profile resolvers.
 */
import { parseBirthDateParts } from '../self-profile-resolver.js';

/**
 * @typedef {'full_analysis'|'followup_deeper'|'followup_cycles'|'followup_master'|'followup_karmic'|'followup_period'|'followup_explore'|'ask_birth_date'|null} NumerologyIntentKind
 */

/**
 * @typedef {{
 *   active: boolean,
 *   intent: NumerologyIntentKind,
 *   depthHint: 'short'|'standard'|'deep'|null,
 *   birthDate: string|null,
 *   fullName: string|null,
 *   askedPastLife: boolean,
 *   isFollowUp: boolean,
 * }} NumerologyIntent
 */

const BIRTH_DATE_RE =
  /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/;

const NUMEROLOGY_CUE =
  /numerol|ya[sş]am\s+yol|life\s*path|pinnacle|zirve\s+d[oö]nem|m[uü]cadele\s+say|ki[sş]isel\s+y[ıi]l|usta\s+say|karmik|do[gğ]um\s+g[uü]n[uü]\s+say/i;

const ANALYSIS_VERB =
  /anlat|analiz|yorumla|incele|bakar\s*m[ıi]s[ıi]n|ne\s+der|ne\s+s[oö]yler|hesapla|[cç][ıi]kar|g[oö]ster|a[cç]ikla|a[cç]|s[oö]yle/i;

const FOLLOWUP_DEEPER =
  /^(?:daha\s+detayl[ıi]|detayland[ıi]r|derinle[sş]tir|bilmedi[gğ]im\s+(?:ne|şey|şeyleri)|ba[sş]ka\s+ne\s+(?:var|g[oö]r[uü]yorsun)|daha\s+ne\s+var|devam|ileri\s+git)\b/i;

const FOLLOWUP_CYCLES = /ya[sş]am\s+d[oö]ng/i;
const FOLLOWUP_MASTER =
  /\b(11|22|33)\b.*(?:derin|anlat|ne\s+demek)|usta\s+say|11['’]?\s*i\s+daha|11\/2/i;
const FOLLOWUP_KARMIC =
  /(?:önceki|daha\s+önceki|ge[cç]mi[sş])\s+(?:hayat|ya[sş]am)|karmik\s+bor[cç]|karmik\s+tema|ge[cç]mi[sş]\s+ya[sş]am\s+tema/i;
const FOLLOWUP_PERIOD =
  /şu\s+an\s+hangi\s+d[oö]nem|ki[sş]isel\s+y[ıi]l[ıi]m|hangi\s+d[oö]nemdeyim|aktif\s+d[oö]nem/i;
const FOLLOWUP_EXPLORE =
  /ba[sş]ka\s+ne\s+g[oö]r|ba[sş]ka\s+ne\s+var|ne\s+ka[cç][ıi]rd[ıi]m|g[oö]zden\s+ka[cç]an|proaktif/i;

const NUMEROLOGY_CONTEXT_MARKERS = [
  'numeroloji',
  'yaşam yolu',
  'yasam yolu',
  'life path',
  'kişisel yıl',
  'kisisel yil',
  'pinnacle',
  'zirve',
  'usta sayı',
  'karmik',
  'doğum günü sayısı',
  'atlas-pythagorean-birth',
];

/**
 * @param {string} message
 */
export function extractBirthDateFromMessage(message) {
  const text = String(message ?? '');
  const m = text.match(BIRTH_DATE_RE);
  if (!m) return null;
  if (m[1] && m[2] && m[3]) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return parseBirthDateParts(iso) ? iso : null;
  }
  if (m[4] && m[5] && m[6]) {
    const iso = `${m[4]}-${m[5]}-${m[6]}`;
    return parseBirthDateParts(iso) ? iso : null;
  }
  return null;
}

/**
 * Lightweight name extraction: "adım X Y" / "ismim X Y".
 * @param {string} message
 */
export function extractNameFromMessage(message) {
  const text = String(message ?? '').trim();
  const m = text.match(
    /\b(?:ad[ıi]m|ismim|ad[ıi]m\s+soyad[ıi]m)\s+([A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü'\-]+(?:\s+[A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü'\-]+)+)/u,
  );
  return m ? m[1].trim() : null;
}

/**
 * @param {{ role: string, content: string }[]} [history]
 */
export function hasNumerologyContext(history = []) {
  const corpus = (history || [])
    .slice(-12)
    .map((t) => String(t.content || '').toLocaleLowerCase('tr-TR'))
    .join('\n');
  if (!corpus) return false;
  return NUMEROLOGY_CONTEXT_MARKERS.some((m) => corpus.includes(m));
}

/**
 * @param {string} message
 * @param {{ role: string, content: string }[]} [history]
 * @param {{ sessionActive?: boolean }} [opts]
 * @returns {NumerologyIntent}
 */
export function detectNumerologyIntent(message, history = [], opts = {}) {
  const text = String(message ?? '').trim();
  const empty = {
    active: false,
    intent: null,
    depthHint: null,
    birthDate: null,
    fullName: null,
    askedPastLife: false,
    isFollowUp: false,
  };
  if (!text) return empty;

  const lower = text.toLocaleLowerCase('tr-TR');
  const birthDate = extractBirthDateFromMessage(text);
  const fullName = extractNameFromMessage(text);
  const inSession = Boolean(opts.sessionActive) || hasNumerologyContext(history);

  const askedPastLife = FOLLOWUP_KARMIC.test(lower);
  let depthHint = null;
  if (/\b(k[ıi]saca|k[ıi]sa\s+anlat|özetle)\b/u.test(lower)) depthHint = 'short';
  if (
    /\b(detayl[ıi]|tam\s+analiz|derin|bilmedi[gğ]im|her\s+katman)\b/u.test(lower)
  ) {
    depthHint = 'deep';
  }

  // Session follow-ups — do not treat as new identity/profile intents
  if (inSession) {
    if (FOLLOWUP_CYCLES.test(lower)) {
      return {
        active: true,
        intent: 'followup_cycles',
        depthHint,
        birthDate,
        fullName,
        askedPastLife: false,
        isFollowUp: true,
      };
    }
    if (FOLLOWUP_MASTER.test(lower) || /11['’]?\s*i\s+daha\s+derin|11\s+say[ıi]s[ıi]n[ıi]\s+zaten/i.test(lower)) {
      return {
        active: true,
        intent: 'followup_master',
        depthHint: depthHint || 'deep',
        birthDate,
        fullName,
        askedPastLife: false,
        isFollowUp: true,
      };
    }
    if (askedPastLife) {
      return {
        active: true,
        intent: 'followup_karmic',
        depthHint,
        birthDate,
        fullName,
        askedPastLife: true,
        isFollowUp: true,
      };
    }
    if (FOLLOWUP_PERIOD.test(lower)) {
      return {
        active: true,
        intent: 'followup_period',
        depthHint,
        birthDate,
        fullName,
        askedPastLife: false,
        isFollowUp: true,
      };
    }
    if (FOLLOWUP_EXPLORE.test(lower) || FOLLOWUP_DEEPER.test(lower)) {
      return {
        active: true,
        intent: FOLLOWUP_DEEPER.test(lower) && !FOLLOWUP_EXPLORE.test(lower)
          ? 'followup_deeper'
          : 'followup_explore',
        depthHint: depthHint || (FOLLOWUP_DEEPER.test(lower) ? 'deep' : null),
        birthDate,
        fullName,
        askedPastLife: false,
        isFollowUp: true,
      };
    }
  }

  // Standalone past-life with numerology cue or session
  if (askedPastLife && (NUMEROLOGY_CUE.test(lower) || inSession || birthDate)) {
    return {
      active: true,
      intent: 'followup_karmic',
      depthHint,
      birthDate,
      fullName,
      askedPastLife: true,
      isFollowUp: inSession,
    };
  }

  // "11 sayısını zaten biliyorum..." even without prior session markers in history
  if (
    /zaten\s+biliyorum|bilmedi[gğ]im\s+şey/i.test(lower) &&
    (/\b(11|22|33)\b/.test(lower) || NUMEROLOGY_CUE.test(lower) || inSession)
  ) {
    return {
      active: true,
      intent: 'followup_master',
      depthHint: 'deep',
      birthDate,
      fullName,
      askedPastLife: false,
      isFollowUp: inSession,
    };
  }

  // Multi-system daily/astro asks stay on astrology / cross-layer paths
  if (
    /astroloj|g[oö]ky[uü]z|transit|hicr[iî]|g[uü]nl[uü]k\s+analiz/i.test(lower) &&
    /numerol/i.test(lower) &&
    !birthDate &&
    !/ya[sş]am\s+yol|do[gğ]um\s+tarih/i.test(lower)
  ) {
    return empty;
  }

  // Explicit numerology analysis request
  const hasCue = NUMEROLOGY_CUE.test(lower) || /\/numeroloji\b/i.test(text);
  if (hasCue && (ANALYSIS_VERB.test(lower) || birthDate || /ne\??\s*$/i.test(lower))) {
    if (!birthDate && !inSession) {
      // May still proceed if memory has birth date — flow layer resolves
      return {
        active: true,
        intent: 'full_analysis',
        depthHint,
        birthDate: null,
        fullName,
        askedPastLife: false,
        isFollowUp: false,
      };
    }
    return {
      active: true,
      intent: 'full_analysis',
      depthHint,
      birthDate,
      fullName,
      askedPastLife: false,
      isFollowUp: false,
    };
  }

  // Bare birth date + numerology-ish short ask
  if (birthDate && (hasCue || ANALYSIS_VERB.test(lower))) {
    return {
      active: true,
      intent: 'full_analysis',
      depthHint,
      birthDate,
      fullName,
      askedPastLife: false,
      isFollowUp: false,
    };
  }

  // Command only
  if (/^\/numeroloji\b/i.test(text)) {
    return {
      active: true,
      intent: birthDate ? 'full_analysis' : 'ask_birth_date',
      depthHint,
      birthDate,
      fullName,
      askedPastLife: false,
      isFollowUp: false,
    };
  }

  return empty;
}

/**
 * Map intent → orchestrator focus flag.
 * @param {NumerologyIntentKind} intent
 */
export function focusFromIntent(intent) {
  switch (intent) {
    case 'followup_cycles':
      return 'cycles';
    case 'followup_master':
      return 'master';
    case 'followup_karmic':
      return 'karmic';
    case 'followup_period':
      return 'period';
    case 'followup_explore':
      return 'explore';
    case 'followup_deeper':
      return null;
    default:
      return null;
  }
}
