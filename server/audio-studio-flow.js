/**
 * Audio Studio flow — bridge for Web + Telegram message service.
 * Deterministic capability-honest replies; does not call LLM for studio claims.
 * Current-message evidence (or explicit continuation + pending) is required.
 */

import {
  detectAudioIntent,
  hasAudioStudioContext,
  runAudioStudioTurn,
  AUDIO_STUDIO_VERSION,
  contextKey,
  getPendingAudioContext,
  clearPendingAudioContext,
} from './audio-studio/index.js';
import {
  deriveTelegramTurnIntent,
  filterHistoryForSenderScope,
  logTelegramIntentTrace,
} from './telegram-turn-intent.js';
import { detectTarotSpreadIntent } from './symbolic-synthesis.js';
import {
  resolveSymbolicContext,
  shouldBlockUnrelatedCapability,
} from './symbolic-context.js';

export const AUDIO_STUDIO_FLOW_VERSION = 'atlas-audio-studio-flow-v1';

/**
 * Quick gate — avoid running orchestrator on every message.
 * @param {string} message
 * @param {{ role: string, content: string }[]} history
 * @param {{
 *   hasMedia?: boolean,
 *   channel?: string,
 *   userId?: string|null,
 *   chatId?: string|null,
 *   conversationId?: string|null,
 *   messageThreadId?: string|number|null,
 *   turnIntent?: object|null,
 *   symbolicContext?: object|null,
 * }} [opts]
 */
export function shouldConsiderAudioStudio(message, history = [], opts = {}) {
  const turn = opts.turnIntent;
  if (turn && turn.allowAudioStudio === false) {
    return false;
  }

  // Shared symbolic context (tarot/dream/symbol/pattern) blocks unrelated studio routes.
  const symbolicCtx =
    opts.symbolicContext ||
    resolveSymbolicContext({
      message,
      history,
      conversationId: opts.conversationId || opts.chatId || 'default',
      userId: opts.userId,
    });
  if (shouldBlockUnrelatedCapability(symbolicCtx, message)) {
    return false;
  }

  // Tarot draw / follow-up commands must not fall into audio (istemedim≠stem, etc.).
  const tarot = detectTarotSpreadIntent(message, history);
  if (tarot.active) {
    const text = String(message || '');
    const clearAudioProduction =
      /\b(mix(?:ing)?|master(?:ing)?|st[uü]dyo|\bstem\b|mp3|wav|m4a)\b/i.test(text) &&
      !/(tarot|kart\s+a[cç]|a[cç][ıi]l[ıi]m|\d+\s*kart|üç\s*kart|kart\s+[cç]ek)/i.test(text);
    if (!clearAudioProduction) {
      return false;
    }
  }

  const key = contextKey({
    channel: opts.channel,
    userId: opts.userId,
    chatId: opts.chatId,
    conversationId: opts.conversationId,
    messageThreadId: opts.messageThreadId,
  });
  const pending = getPendingAudioContext(key);

  if (opts.hasMedia && pending?.kind === 'instruction') return true;

  const scopedHistory = filterHistoryForSenderScope(history, {
    userId: opts.userId,
    messageThreadId: opts.messageThreadId,
  });

  const detected = detectAudioIntent(message, scopedHistory, {
    hasMediaAttachment: Boolean(opts.hasMedia),
    pendingAudioIntent: pending?.kind === 'instruction',
    allowContextualFollowup: Boolean(pending?.kind === 'instruction' || turn?.isContinuation),
  });
  if (detected.active && detected.confidence >= 0.7) return true;

  // Soft history gate: only with pending instruction or explicit continuation + current evidence
  if (
    pending?.kind === 'instruction' &&
    hasAudioStudioContext(scopedHistory) &&
    /d[uü]zenle|temizle|st[uü]dyo|mix|master|devam|bunu\s+yap/i.test(String(message || ''))
  ) {
    return true;
  }
  return false;
}

/**
 * @param {{
 *   message: string,
 *   history?: { role: string, content: string, userId?: string|null }[],
 *   userId?: string|null,
 *   displayName?: string|null,
 *   channel?: string,
 *   chatId?: string|null,
 *   messageId?: string|null,
 *   conversationId?: string|null,
 *   messageThreadId?: string|number|null,
 *   replyTargetMessageId?: string|number|null,
 *   quotedText?: string|null,
 *   repliedToText?: string|null,
 *   media?: object|null,
 *   activationReason?: string|null,
 * }} input
 */
export async function tryAudioStudioFlowReply(input) {
  const history = input.history || [];
  const hasMedia = Boolean(input.media?.localPath || input.media?.fileId);
  const attachmentType = input.media?.mediaKind || (hasMedia ? 'audio' : null);

  const key = contextKey({
    channel: input.channel,
    userId: input.userId,
    chatId: input.chatId,
    conversationId: input.conversationId,
    messageThreadId: input.messageThreadId,
  });
  const pending = getPendingAudioContext(key);

  const turnIntent = deriveTelegramTurnIntent({
    message: input.message,
    channel: input.channel,
    userId: input.userId,
    chatId: input.chatId,
    messageThreadId: input.messageThreadId,
    messageId: input.messageId,
    replyTargetMessageId: input.replyTargetMessageId,
    quotedText: input.quotedText,
    repliedToText: input.repliedToText,
    hasAttachment: hasMedia,
    attachmentType,
    priorIntent: pending?.intent || null,
    activePendingAction: pending?.kind === 'instruction' ? 'audio_instruction' : null,
    history,
  });

  logTelegramIntentTrace({
    ...turnIntent,
    chatId: input.chatId,
    topicId: input.messageThreadId,
    senderId: input.userId,
    messageId: input.messageId,
    activationReason: input.activationReason || null,
    pendingActionUsed: false,
  });

  // Announcements reset stale pending studio actions for this sender scope.
  // Short acks / silence do not expire pending — TTL still applies.
  if (turnIntent.isAnnouncement && pending?.kind === 'instruction' && !turnIntent.isContinuation) {
    clearPendingAudioContext(key);
  }

  if (
    !shouldConsiderAudioStudio(input.message, history, {
      hasMedia,
      channel: input.channel,
      userId: input.userId,
      chatId: input.chatId,
      conversationId: input.conversationId,
      messageThreadId: input.messageThreadId,
      turnIntent,
      symbolicContext: input.symbolicContext || null,
    })
  ) {
    return null;
  }

  // Confidence guard: production replies need current-turn evidence or valid continuation
  if (!turnIntent.allowAudioStudio) {
    return null;
  }

  const scopedHistory = filterHistoryForSenderScope(history, {
    userId: input.userId,
    messageThreadId: input.messageThreadId,
  });

  const result = await runAudioStudioTurn({
    message: input.message,
    history: scopedHistory,
    userId: input.userId,
    displayName: input.displayName,
    channel: input.channel,
    chatId: input.chatId,
    messageId: input.messageId,
    conversationId: input.conversationId,
    messageThreadId: input.messageThreadId,
    media: input.media || null,
  });

  if (!result?.handled || !result.reply) return null;

  logTelegramIntentTrace({
    ...turnIntent,
    chatId: input.chatId,
    topicId: input.messageThreadId,
    senderId: input.userId,
    messageId: input.messageId,
    activationReason: input.activationReason || null,
    pendingActionUsed: Boolean(pending),
  });

  return {
    handled: true,
    intent: result.intent,
    reply: result.reply,
    engine: result.engine || 'audio-studio',
    data: {
      audioStudioFlowVersion: AUDIO_STUDIO_FLOW_VERSION,
      audioStudioVersion: AUDIO_STUDIO_VERSION,
      turnIntentVersion: turnIntent.version,
      currentIntent: turnIntent.currentIntent,
      isContinuation: turnIntent.isContinuation,
      ...(result.data || {}),
    },
  };
}
