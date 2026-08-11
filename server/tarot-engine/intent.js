/**
 * Tarot engine intent — wraps protocol detection + session follow-ups.
 *
 * Follow-up phrases are detected from the message itself; an active
 * per-user session is required by tarot-flow before cards are reused.
 * Shared group history alone must never authorize follow-ups.
 */

import { detectTarotSpreadIntent } from '../symbolic-synthesis.js';

/**
 * @typedef {'spread'|'reveal'|'interpret'|'continue'|'followup_deeper'|'followup_blind_spot'|'followup_combination'|'followup_why_card'|'followup_explore'|null} TarotEngineIntentKind
 */

/**
 * @typedef {{
 *   active: boolean,
 *   intent: TarotEngineIntentKind,
 *   depthHint: 'short'|'standard'|'deep'|null,
 *   isFollowUp: boolean,
 *   protocolIntent: string|null,
 *   requiresSession: boolean,
 * }} TarotEngineIntent
 */

const FOLLOWUP_DEEPER =
  /^(?:daha\s+(?:detayl[ıi]|derin)|detayland[ıi]r|derinle[sş]tir|a[cç]\s+biraz|daha\s+derin\s+anlat|devam(?:\s+et)?)\b/i;

const FOLLOWUP_BLIND =
  /k[oö]r\s+nokta|g[oö]zden\s+ka[cç]an|ne\s+ka[cç][ıi]r/i;

const FOLLOWUP_COMBO =
  /kombinasyon|kart(?:lar)?(?:[ıi]n)?\s+birbir|ili[sş]ki(?:yi)?\s+anlat|birbirine\s+etki/i;

const FOLLOWUP_WHY =
  /bu\s+kart\s+neden|neden\s+[cç][ıi]kt[ıi]|neden\s+geldi|kart(?:lar)?\s+neden/i;

const FOLLOWUP_EXPLORE =
  /ba[sş]ka\s+ne\s+g[oö]r|ba[sş]ka\s+ne\s+var|daha\s+ne\s+var|ne\s+daha\s+g[oö]r[uü]yorsun/i;

/** Intents that reuse or continue an existing spread — need conversationId::userId session. */
export const TAROT_SESSION_REQUIRED_INTENTS = new Set([
  'reveal',
  'interpret',
  'continue',
  'followup_deeper',
  'followup_blind_spot',
  'followup_combination',
  'followup_why_card',
  'followup_explore',
]);

/**
 * Extract a short intention phrase from the user message.
 * Turkish-safe: avoid `\b` around stems like "aç" (breaks on ç).
 * @param {string} message
 */
export function extractIntention(message) {
  const text = String(message || '').trim();
  if (!text) return 'genel durum';
  const cleaned = text
    .replace(/^(tarot|classic\s+tarot)\s*/i, '')
    .replace(/\b(\d{1,2}|bir|iki|üç|u[cç]|d[oö]rt|be[sş])\s*kart(?:l[ıi]k)?\b/gi, '')
    .replace(/yorum\s+istemedim[,.]?\s*/gi, '')
    .replace(
      /a[cç][ıi]l[ıi]m(?:[ıi])?\s+yap(?:mal[ıi]s[ıi]n)?|tarot\s+a[cç]|kart\s+a[cç]|kart(?:lar)?\s+[cç]ek|tekrar\s+kart\s+[cç]ek|bir\s+kart\s+daha\s+[cç]ek|kartlar[ıi]\s+se[cç]/gi,
      '',
    )
    .replace(/(?:^|\s)a[cç](?:\s|$)/gi, ' ')
    .replace(/[.!?…]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'genel durum';
}

/**
 * Parse explicit requested card count from the message.
 * @param {string} message
 * @returns {number|null}
 */
export function parseRequestedCardCount(message) {
  const text = String(message || '');
  const digit = text.match(/\b(\d{1,2})\s*kart(?:l[ıi]k)?\b/i);
  if (digit) {
    const n = Number(digit[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
  }
  if (/\b(üç|u[cç])\s*kart(?:l[ıi]k)?\b/i.test(text)) return 3;
  if (/\bbir\s*kart\b/i.test(text)) return 1;
  if (/\biki\s*kart\b/i.test(text)) return 2;
  return null;
}

/**
 * True when the message is primarily a draw / open command with little topical content.
 * @param {string} message
 */
export function isPrimarilyDrawCommand(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  const hasDraw =
    /kart\s+a[cç]|tarot\s+a[cç]|a[cç][ıi]l[ıi]m(?:[ıi])?\s+yap|kart(?:lar)?\s+[cç]ek|tekrar\s+kart|bir\s+kart\s+daha|\d+\s*kart|üç\s*kart|^a[cç]$|^a[cç]\s/i.test(
      text,
    );
  if (!hasDraw) return false;
  const rest = extractIntention(text);
  return !rest || rest === 'genel durum' || rest.length < 10;
}

/**
 * Prefer prior-turn topical intention when the current message is draw-only.
 * @param {string} message
 * @param {{ role: string, content: string }[]} [history]
 * @param {{ intention?: string|null, topic?: string|null }|null} [session]
 */
export function resolveSpreadIntention(message, history = [], session = null) {
  const fromMsg = extractIntention(message);
  const drawOnly = isPrimarilyDrawCommand(message);

  if (!drawOnly && fromMsg && fromMsg !== 'genel durum' && fromMsg.length >= 8) {
    return fromMsg;
  }

  for (let i = (history || []).length - 1; i >= 0; i -= 1) {
    const turn = history[i];
    if (!turn || turn.role !== 'user') continue;
    if (isPrimarilyDrawCommand(turn.content)) continue;
    const prev = extractIntention(turn.content);
    if (prev && prev !== 'genel durum' && prev.length >= 6) {
      return prev;
    }
    // Natural preamble without explicit draw verbs (e.g. "Aklımdaki kişinin enerjisi")
    const raw = String(turn.content || '').trim();
    if (
      raw.length >= 8 &&
      /(enerji|ki[sş]i|duygu|ili[sş]ki|niyet|alan)/i.test(raw) &&
      !/mix|master|st[uü]dyo|\bstem\b/i.test(raw)
    ) {
      return raw.replace(/[.!?…]+$/g, '').trim().slice(0, 120);
    }
  }

  if (session?.intention && String(session.intention).trim()) {
    return String(session.intention).trim();
  }
  if (session?.topic && String(session.topic).trim()) {
    return String(session.topic).trim();
  }
  return fromMsg || 'genel durum';
}

/**
 * @param {string} message
 * @param {{ role: string, content: string }[]} [history]
 * @param {{ sessionActive?: boolean }} [opts]
 * @returns {TarotEngineIntent}
 */
export function detectTarotEngineIntent(message, history = [], opts = {}) {
  const text = String(message ?? '').trim();
  const empty = {
    active: false,
    intent: null,
    depthHint: null,
    isFollowUp: false,
    protocolIntent: null,
    requiresSession: false,
  };
  if (!text) return empty;

  const lower = text.toLocaleLowerCase('tr-TR');
  let depthHint = null;
  if (/\b(k[ıi]saca|k[ıi]sa\s+anlat|[oö]zetle)\b/u.test(lower)) depthHint = 'short';
  if (
    /detayl[ıi]|tam\s+analiz|derin(?:le[sş]tir|e|\s)|tamam[ıi]n[ıi]\s+g[oö]ster|raporla|rapor\s+ver|her\s+katman|element/u.test(
      lower,
    )
  ) {
    depthHint = 'deep';
  }

  const protocol = detectTarotSpreadIntent(message, history);

  // Follow-up phrases are message-driven; session gate lives in tarot-flow.
  // Do NOT use shared history markers — that leaks group context across users.
  if (FOLLOWUP_BLIND.test(lower)) {
    return {
      active: true,
      intent: 'followup_blind_spot',
      depthHint,
      isFollowUp: true,
      protocolIntent: protocol.intent,
      requiresSession: true,
    };
  }
  if (FOLLOWUP_COMBO.test(lower)) {
    return {
      active: true,
      intent: 'followup_combination',
      depthHint,
      isFollowUp: true,
      protocolIntent: protocol.intent,
      requiresSession: true,
    };
  }
  if (FOLLOWUP_WHY.test(lower)) {
    return {
      active: true,
      intent: 'followup_why_card',
      depthHint,
      isFollowUp: true,
      protocolIntent: protocol.intent,
      requiresSession: true,
    };
  }
  if (FOLLOWUP_EXPLORE.test(lower)) {
    return {
      active: true,
      intent: 'followup_explore',
      depthHint: depthHint || 'deep',
      isFollowUp: true,
      protocolIntent: protocol.intent,
      requiresSession: true,
    };
  }
  if (
    FOLLOWUP_DEEPER.test(lower) &&
    !/bir\s+de|şimdi\s+de|eylem|duygu|alan/i.test(lower)
  ) {
    return {
      active: true,
      intent: 'followup_deeper',
      depthHint: depthHint || 'deep',
      isFollowUp: true,
      protocolIntent: protocol.intent,
      requiresSession: true,
    };
  }

  if (!protocol.active) {
    // Per-user session (not shared history) authorizes classic follow-up commands.
    if (opts.sessionActive) {
      const cmd = lower.replace(/[.!?…]+$/g, '').trim();
      if (cmd === 'yorumla' || cmd.startsWith('yorumla ')) {
        return {
          active: true,
          intent: 'interpret',
          depthHint,
          isFollowUp: true,
          protocolIntent: null,
          requiresSession: true,
        };
      }
      if (
        /^(devam|bir\s+de|şimdi\s+de)/i.test(cmd) &&
        /(aç|bak|yorum|kart|eylem|duygu|ilişki|alan)/i.test(cmd)
      ) {
        return {
          active: true,
          intent: 'continue',
          depthHint,
          isFollowUp: true,
          protocolIntent: null,
          requiresSession: true,
        };
      }
    }
    return empty;
  }

  if (protocol.intent === 'reveal-cards') {
    return {
      active: true,
      intent: 'reveal',
      depthHint,
      isFollowUp: true,
      protocolIntent: protocol.intent,
      requiresSession: true,
    };
  }
  if (protocol.intent === 'interpret') {
    return {
      active: true,
      intent: 'interpret',
      depthHint,
      isFollowUp: true,
      protocolIntent: protocol.intent,
      requiresSession: true,
    };
  }
  if (protocol.intent === 'continue') {
    return {
      active: true,
      intent: 'continue',
      depthHint,
      isFollowUp: true,
      protocolIntent: protocol.intent,
      requiresSession: true,
    };
  }

  return {
    active: true,
    intent: 'spread',
    depthHint,
    isFollowUp: false,
    protocolIntent: protocol.intent,
    requiresSession: false,
  };
}

/**
 * @param {TarotEngineIntentKind} intent
 */
export function focusFromTarotIntent(intent) {
  switch (intent) {
    case 'reveal':
      return 'reveal';
    case 'followup_blind_spot':
      return 'blind_spot';
    case 'followup_combination':
      return 'combination';
    case 'followup_why_card':
      return 'why_card';
    case 'followup_explore':
      return 'explore';
    case 'followup_deeper':
      return null;
    case 'interpret':
      return null;
    default:
      return null;
  }
}
