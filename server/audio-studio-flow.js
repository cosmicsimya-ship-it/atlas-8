/**
 * Audio Studio flow — bridge for Web + Telegram message service.
 * Deterministic capability-honest replies; does not call LLM for studio claims.
 */

import {
  detectAudioIntent,
  hasAudioStudioContext,
  runAudioStudioTurn,
  AUDIO_STUDIO_VERSION,
  contextKey,
  getPendingAudioContext,
} from './audio-studio/index.js';

export const AUDIO_STUDIO_FLOW_VERSION = 'atlas-audio-studio-flow-v1';

/**
 * Quick gate — avoid running orchestrator on every message.
 * @param {string} message
 * @param {{ role: string, content: string }[]} history
 * @param {{ hasMedia?: boolean, channel?: string, userId?: string|null, chatId?: string|null, conversationId?: string|null }} [opts]
 */
export function shouldConsiderAudioStudio(message, history = [], opts = {}) {
  if (opts.hasMedia) {
    const key = contextKey({
      channel: opts.channel,
      userId: opts.userId,
      chatId: opts.chatId,
      conversationId: opts.conversationId,
    });
    const pending = getPendingAudioContext(key);
    if (pending?.kind === 'instruction') return true;
  }

  const detected = detectAudioIntent(message, history, {
    hasMediaAttachment: Boolean(opts.hasMedia),
    pendingAudioIntent: false,
  });
  if (detected.active) return true;
  if (hasAudioStudioContext(history) && /d[uü]zenle|temizle|st[uü]dyo|profesyonel|mix|master/i.test(String(message || ''))) {
    return true;
  }
  return false;
}

/**
 * @param {{
 *   message: string,
 *   history?: { role: string, content: string }[],
 *   userId?: string|null,
 *   displayName?: string|null,
 *   channel?: string,
 *   chatId?: string|null,
 *   messageId?: string|null,
 *   conversationId?: string|null,
 *   media?: object|null,
 * }} input
 */
export async function tryAudioStudioFlowReply(input) {
  const history = input.history || [];
  const hasMedia = Boolean(input.media?.localPath || input.media?.fileId);

  if (
    !shouldConsiderAudioStudio(input.message, history, {
      hasMedia,
      channel: input.channel,
      userId: input.userId,
      chatId: input.chatId,
      conversationId: input.conversationId,
    })
  ) {
    return null;
  }

  const result = await runAudioStudioTurn({
    message: input.message,
    history,
    userId: input.userId,
    displayName: input.displayName,
    channel: input.channel,
    chatId: input.chatId,
    messageId: input.messageId,
    conversationId: input.conversationId,
    media: input.media || null,
  });

  if (!result?.handled || !result.reply) return null;

  return {
    handled: true,
    intent: result.intent,
    reply: result.reply,
    engine: result.engine || 'audio-studio',
    data: {
      audioStudioFlowVersion: AUDIO_STUDIO_FLOW_VERSION,
      audioStudioVersion: AUDIO_STUDIO_VERSION,
      ...(result.data || {}),
    },
  };
}
