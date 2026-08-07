/**
 * Dream engine intent — new analysis + session follow-ups.
 * Follow-ups require per-user session (conversationId::userId).
 */

/**
 * @typedef {'analyze'|'clarify'|'followup_deeper'|'followup_symbols'|'followup_emotion'|'followup_jung'|'followup_classical'|'followup_psych'|'followup_personal'|'followup_blind_spot'|'followup_explore'|null} DreamEngineIntentKind
 */

/**
 * @typedef {{
 *   active: boolean,
 *   intent: DreamEngineIntentKind,
 *   depthHint: 'short'|'standard'|'deep'|null,
 *   isFollowUp: boolean,
 *   requiresSession: boolean,
 *   recurringHint: boolean|null,
 * }} DreamEngineIntent
 */

const DREAM_DOMAIN =
  /r[uü]ya|ruyam|dream\s+interpret|dream\s+analysis|rüya\s+yorum|ruya\s+yorum/i;

const ANALYZE_ASK =
  /yorumla|analiz|anlam(?:[ıi]|land[ıi]r)|ne\s+demek|ne\s+anlama|a[cç][ıi]kla|oku/i;

const FOLLOWUP_DEEPER =
  /^(?:daha\s+(?:detayl[ıi]|derin)|detayland[ıi]r|derinle[sş]tir|a[cç]\s+biraz|daha\s+derin\s+anlat|devam(?:\s+et)?)\b/i;

const FOLLOWUP_SYMBOLS = /sembol(?:ler)?(?:i|ini)?|motif(?:ler)?/i;
const FOLLOWUP_EMOTION = /duygu(?:lar)?(?:[ıi]|yu)?|ne\s+hisset|his\s+katman/i;
const FOLLOWUP_JUNG = /jung|arketip|shadow|anima|animus|gölge\s+arketip/i;
const FOLLOWUP_CLASSICAL = /klasik|ibn\s*s[iî]r|geleneksel\s+yorum/i;
const FOLLOWUP_PSYCH = /psikolojik|bilinçalt|bastır|içsel/i;
const FOLLOWUP_PERSONAL = /bellek|ki[sş]isel|benimle\s+ili[sş]ki|son\s+konu[sş]/i;
const FOLLOWUP_BLIND = /k[oö]r\s+nokta|g[oö]zden\s+ka[cç]an|ne\s+ka[cç][ıi]r/i;
const FOLLOWUP_EXPLORE =
  /ba[sş]ka\s+ne\s+g[oö]r|ba[sş]ka\s+ne\s+var|daha\s+ne\s+var|ne\s+daha\s+g[oö]r[uü]yorsun/i;

const RECURRING_YES = /tekrar(?:layan| eden)?|sık\s+g[oö]r|ayn[ıi]\s+r[uü]ya|recurring/i;
const RECURRING_NO = /ilk\s+kez|bir\s+kez|tekrar\s+de[gğ]il|hay[ıi]r.*tekrar/i;

/** Intents that reuse an existing dream session. */
export const DREAM_SESSION_REQUIRED_INTENTS = new Set([
  'followup_deeper',
  'followup_symbols',
  'followup_emotion',
  'followup_jung',
  'followup_classical',
  'followup_psych',
  'followup_personal',
  'followup_blind_spot',
  'followup_explore',
]);

/**
 * @param {string} message
 * @returns {boolean|null}
 */
export function extractRecurringHint(message) {
  const t = String(message || '');
  if (RECURRING_YES.test(t) && !RECURRING_NO.test(t)) return true;
  if (RECURRING_NO.test(t)) return false;
  return null;
}

/**
 * @param {string} message
 * @param {{ role: string, content: string }[]} [history]
 * @param {{ sessionActive?: boolean }} [opts]
 * @returns {DreamEngineIntent}
 */
export function detectDreamEngineIntent(message, history = [], opts = {}) {
  const text = String(message ?? '').trim();
  const empty = {
    active: false,
    intent: null,
    depthHint: null,
    isFollowUp: false,
    requiresSession: false,
    recurringHint: null,
  };
  if (!text) return empty;

  const lower = text.toLocaleLowerCase('tr-TR');
  let depthHint = null;
  if (/\b(k[ıi]saca|k[ıi]sa\s+anlat|[oö]zetle)\b/u.test(lower)) depthHint = 'short';
  if (
    /detayl[ıi]|ayr[ıi]nt[ıi]l[ıi]|tam\s+analiz|derin(?:le[sş]tir|e|\s)|tamam[ıi]n[ıi]\s+g[oö]ster|raporla|rapor\s+ver|her\s+katman|jung|klasik/u.test(
      lower,
    )
  ) {
    depthHint = 'deep';
  }

  const recurringHint = extractRecurringHint(text);
  const domain = DREAM_DOMAIN.test(text);
  const sessionActive = Boolean(opts.sessionActive);

  // Follow-ups: message-driven; session gate in dream-flow
  if (sessionActive || domain) {
    if (FOLLOWUP_BLIND.test(lower) && (sessionActive || domain)) {
      if (sessionActive) {
        return {
          active: true,
          intent: 'followup_blind_spot',
          depthHint,
          isFollowUp: true,
          requiresSession: true,
          recurringHint,
        };
      }
    }
    if (sessionActive && FOLLOWUP_JUNG.test(lower)) {
      return {
        active: true,
        intent: 'followup_jung',
        depthHint: depthHint || 'deep',
        isFollowUp: true,
        requiresSession: true,
        recurringHint,
      };
    }
    if (sessionActive && FOLLOWUP_CLASSICAL.test(lower)) {
      return {
        active: true,
        intent: 'followup_classical',
        depthHint: depthHint || 'deep',
        isFollowUp: true,
        requiresSession: true,
        recurringHint,
      };
    }
    if (sessionActive && FOLLOWUP_PSYCH.test(lower)) {
      return {
        active: true,
        intent: 'followup_psych',
        depthHint: depthHint || 'deep',
        isFollowUp: true,
        requiresSession: true,
        recurringHint,
      };
    }
    if (sessionActive && FOLLOWUP_PERSONAL.test(lower)) {
      return {
        active: true,
        intent: 'followup_personal',
        depthHint,
        isFollowUp: true,
        requiresSession: true,
        recurringHint,
      };
    }
    if (sessionActive && FOLLOWUP_EMOTION.test(lower) && !ANALYZE_ASK.test(lower)) {
      return {
        active: true,
        intent: 'followup_emotion',
        depthHint,
        isFollowUp: true,
        requiresSession: true,
        recurringHint,
      };
    }
    if (sessionActive && FOLLOWUP_SYMBOLS.test(lower) && !domain) {
      return {
        active: true,
        intent: 'followup_symbols',
        depthHint,
        isFollowUp: true,
        requiresSession: true,
        recurringHint,
      };
    }
    if (sessionActive && FOLLOWUP_EXPLORE.test(lower)) {
      return {
        active: true,
        intent: 'followup_explore',
        depthHint: depthHint || 'deep',
        isFollowUp: true,
        requiresSession: true,
        recurringHint,
      };
    }
    if (
      sessionActive &&
      FOLLOWUP_DEEPER.test(lower) &&
      !/bir\s+de|şimdi\s+de/i.test(lower)
    ) {
      return {
        active: true,
        intent: 'followup_deeper',
        depthHint: depthHint || 'deep',
        isFollowUp: true,
        requiresSession: true,
        recurringHint,
      };
    }
  }

  // Explicit dream domain
  if (domain) {
    // "rüyamı yorumla" without story → clarify (still active)
    if (!ANALYZE_ASK.test(text) && text.length < 50) {
      return {
        active: true,
        intent: 'clarify',
        depthHint,
        isFollowUp: false,
        requiresSession: false,
        recurringHint,
      };
    }
    return {
      active: true,
      intent: 'analyze',
      depthHint,
      isFollowUp: false,
      requiresSession: false,
      recurringHint,
    };
  }

  // Session: user continues telling the dream after clarify
  if (sessionActive) {
    const cmd = lower.replace(/[.!?…]+$/g, '').trim();
    if (
      cmd === 'yorumla' ||
      cmd.startsWith('yorumla ') ||
      /^(devam|anlatay[ıi]m|r[uü]yamda)/i.test(cmd)
    ) {
      return {
        active: true,
        intent: 'analyze',
        depthHint,
        isFollowUp: true,
        requiresSession: true,
        recurringHint,
      };
    }
    // Long narrative continuation after clarify
    if (text.length >= 60 && /gördüm|rüyamda|vardı|gidiy|kaç|hisset/i.test(text)) {
      return {
        active: true,
        intent: 'analyze',
        depthHint,
        isFollowUp: true,
        requiresSession: true,
        recurringHint,
      };
    }
  }

  // Soft: history recently asked about dream + user dumps narrative
  const recentDreamAsk = (history || [])
    .slice(-6)
    .some(
      (h) =>
        h.role === 'assistant' &&
        /r[uü]ya|sembol|uyand[ıi][gğ][ıi]nda/i.test(String(h.content || '')),
    );
  if (
    recentDreamAsk &&
    text.length >= 80 &&
    /gördüm|rüyamda|vardı|deniz|yılan|ev|kapı/i.test(text)
  ) {
    return {
      active: true,
      intent: 'analyze',
      depthHint,
      isFollowUp: false,
      requiresSession: false,
      recurringHint,
    };
  }

  return empty;
}

/**
 * @param {DreamEngineIntentKind} intent
 */
export function focusFromDreamIntent(intent) {
  switch (intent) {
    case 'clarify':
      return 'clarify';
    case 'followup_symbols':
      return 'symbols';
    case 'followup_emotion':
      return 'emotion';
    case 'followup_jung':
      return 'jung';
    case 'followup_classical':
      return 'classical';
    case 'followup_psych':
      return 'psychological';
    case 'followup_personal':
      return 'personal';
    case 'followup_blind_spot':
      return 'blind_spot';
    case 'followup_explore':
      return 'explore';
    case 'followup_deeper':
      return null;
    case 'analyze':
      return null;
    default:
      return null;
  }
}
