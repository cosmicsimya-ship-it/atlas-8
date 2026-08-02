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
 * @param {string} message
 */
export function extractIntention(message) {
  const text = String(message || '').trim();
  if (!text) return 'genel durum';
  const cleaned = text
    .replace(/^(tarot|classic\s+tarot)\s*/i, '')
    .replace(/\b(üç|3)\s*kart\b/gi, '')
    .replace(/\b(açılım\s+yap|tarot\s+aç|kart\s+[cç]ek|a[cç])\b/gi, '')
    .replace(/[.!?…]+$/g, '')
    .trim();
  return cleaned || text.slice(0, 120);
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
  if (/\b(detayl[ıi]|tam\s+analiz|derin|her\s+katman|element)\b/u.test(lower)) {
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
