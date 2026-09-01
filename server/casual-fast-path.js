/**
 * Casual fast-path — early exit for clear, low-risk conversational turns.
 *
 * Latency only: reuses tryDeterministicConversationReply / detectConversationIntent.
 * When eligibility is uncertain → return null (NORMAL PIPELINE).
 * Never invents answers; never bypasses Quran/dream/memory/health/tarot/analysis.
 */

import {
  detectConversationIntent,
  tryDeterministicConversationReply,
} from './atlas-conversation-style.js';
import { detectQuranVerseLookupIntent } from './quran-verse-lookup/intent.js';
import { detectDreamEngineIntent } from './dream-engine/intent.js';
import { detectCrossLayerSynthesisIntent } from './cross-layer-synthesis/message-integration.js';
import {
  shouldRouteToPersonalAnalysis,
} from './symbolic-synthesis.js';

export const CASUAL_FAST_PATH_VERSION = 'casual-fast-path/v1';

/** Deterministic intents eligible for early short-circuit. */
export const DETERMINISTIC_FAST_PATH_INTENTS = new Set([
  'greeting',
  'how_are_you',
  'thanks',
  'ping',
  'fatigue',
  'get_current_hijri_date',
  'who_are_you',
  'backend_diag',
]);

/**
 * Domains that must NEVER take the light / early path.
 * High-precision exclusion — prefer NORMAL PIPELINE on doubt.
 */
const SPECIALIZED_DOMAIN_RE =
  /\b(r[uü]ya|ruyam|dream\s+interpret|kuran|kur[’'`]?an|\bâyet|\bayet|\bsûre|\bsure\b|tarot|astroloj|numerol|ebced|cifir|abjad|esma|zikir|haritam|do[gğ]um\s*harit|kader\s*matris|ya[sş]am\s*yol|sembolik\s+analiz|fal\b|kehanet|hat[ıi]rla|kaydet|unut|belle[gğ]im|profilim|g[oö]rsel\s+analiz)\b/iu;

const MEMORY_FOLLOW_RE =
  /\b(daha\s+[oö]nce|ge[cç]en\s+sefer|konu[sş]tu[gğ]umuz|hat[ıi]rl[ıi]yor\s*musun|benim\s+ad[ıi]m|ad[ıi]m[ıi]\s+kaydet)\b/iu;

const MULTI_STEP_RE =
  /\b(ad[ıi]m\s*ad[ıi]m|detayl[ıi]|kapsaml[ıi]|kar[sş][ıi]la[sş]t[ıi]r|sentez|birle[sş]tir|hem\s+.+\s+hem|analiz\s+et|yorumla)\b/iu;

/**
 * @param {string} message
 * @param {{
 *   hasImage?: boolean,
 *   healthActive?: boolean,
 *   memoryIntentType?: string|null,
 *   tarotActive?: boolean,
 *   followUpResolved?: boolean,
 *   history?: unknown[],
 *   personalAnalysis?: boolean,
 * }} ctx
 */
export function evaluateCasualFastPathEligibility(message, ctx = {}) {
  const text = String(message ?? '').trim();
  if (!text) {
    return { eligible: false, kind: null, reason: 'empty', intent: 'other' };
  }

  if (ctx.hasImage) {
    return { eligible: false, kind: null, reason: 'has_image', intent: 'other' };
  }
  if (ctx.healthActive) {
    return { eligible: false, kind: null, reason: 'health_safety', intent: 'other' };
  }
  if (ctx.memoryIntentType) {
    return { eligible: false, kind: null, reason: 'memory_intent', intent: 'other' };
  }
  if (ctx.tarotActive) {
    return { eligible: false, kind: null, reason: 'tarot_active', intent: 'other' };
  }
  if (ctx.followUpResolved) {
    return { eligible: false, kind: null, reason: 'follow_up', intent: 'other' };
  }
  if (ctx.personalAnalysis) {
    return { eligible: false, kind: null, reason: 'personal_analysis', intent: 'other' };
  }

  const intent = detectConversationIntent(text);

  if (SPECIALIZED_DOMAIN_RE.test(text) || MEMORY_FOLLOW_RE.test(text) || MULTI_STEP_RE.test(text)) {
    return { eligible: false, kind: null, reason: 'specialized_or_multistep', intent };
  }

  const quran = detectQuranVerseLookupIntent(text);
  if (quran.active) {
    return { eligible: false, kind: null, reason: 'quran_intent', intent };
  }

  const dream = detectDreamEngineIntent(text, ctx.history ?? [], {});
  if (dream.active) {
    return { eligible: false, kind: null, reason: 'dream_intent', intent };
  }

  const synthesis = detectCrossLayerSynthesisIntent(text);
  if (synthesis.wantsSynthesis) {
    return { eligible: false, kind: null, reason: 'synthesis', intent };
  }

  if (DETERMINISTIC_FAST_PATH_INTENTS.has(intent)) {
    return {
      eligible: true,
      kind: 'deterministic',
      reason: `deterministic:${intent}`,
      intent,
    };
  }

  // who_am_i needs identity/memory path — never early-light.
  if (intent === 'who_am_i' || intent === 'detail') {
    return { eligible: false, kind: null, reason: `intent:${intent}`, intent };
  }

  // Light LLM: short, single-turn, low-risk general ask only.
  const history = Array.isArray(ctx.history) ? ctx.history : [];
  if (history.length > 0) {
    return { eligible: false, kind: null, reason: 'has_history', intent };
  }

  if (intent !== 'other') {
    return { eligible: false, kind: null, reason: `intent:${intent}`, intent };
  }

  if (text.length > 72 || text.length < 8) {
    return { eligible: false, kind: null, reason: 'length', intent };
  }

  // Prefer a clear question form for light path — avoid ambiguous fragments.
  if (!/[?？]/.test(text) && !/\b(nedir|ne\s+demek|nedir\b|kaç|hangi)\b/iu.test(text)) {
    return { eligible: false, kind: null, reason: 'not_clear_question', intent };
  }

  if (shouldRouteToPersonalAnalysis(text)) {
    return { eligible: false, kind: null, reason: 'personal_analysis_route', intent };
  }

  return {
    eligible: true,
    kind: 'light_llm',
    reason: 'light_general',
    intent,
  };
}

/**
 * Build early deterministic result payload (same shape as late short-circuit).
 * @returns {{ reply: string, intent: string, conversationIntent: string } | null}
 */
export function tryCasualDeterministicFastPath(input) {
  const evalResult = evaluateCasualFastPathEligibility(input.message, input);
  if (!evalResult.eligible || evalResult.kind !== 'deterministic') {
    return null;
  }

  const deterministic = tryDeterministicConversationReply({
    message: input.message,
    userId: input.userId,
    founderSession: input.founderSession,
  });
  if (!deterministic) return null;

  return {
    reply: deterministic.reply,
    conversationIntent: deterministic.intent,
    intent: `conversation:${deterministic.intent}`,
    fastPath: {
      version: CASUAL_FAST_PATH_VERSION,
      kind: 'deterministic',
      reason: evalResult.reason,
    },
  };
}

/**
 * @param {string} message
 * @param {object} ctx
 * @returns {boolean}
 */
export function shouldUseLightLlmFastPath(message, ctx = {}) {
  const evalResult = evaluateCasualFastPathEligibility(message, ctx);
  return evalResult.eligible && evalResult.kind === 'light_llm';
}
