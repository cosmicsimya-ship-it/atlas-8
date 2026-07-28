// ═══════════════════════════════════════════════════════════════════════
// Channel Adapters — normalize inbound messages and format outbound replies
// Channel-specific logic lives here only; never in the core pipeline.
// ═══════════════════════════════════════════════════════════════════════

import { webUserId, telegramUserId, isValidUserId } from './user-memory.js';

/** @typedef {'web' | 'telegram'} AtlasChannel */

/**
 * @typedef {Object} NormalizedAtlasMessage
 * @property {AtlasChannel} channel
 * @property {string} userId
 * @property {string} conversationId
 * @property {string} message
 * @property {Array<{ role: 'user' | 'assistant', content: string }>} history
 * @property {string} [username]
 * @property {string} [displayName]
 * @property {Record<string, unknown>} [metadata]
 * @property {Record<string, unknown>} [context]
 */

/**
 * Normalize Web Chat POST /api/chat body.
 * @param {Record<string, unknown>} body
 * @returns {NormalizedAtlasMessage}
 */
export function normalizeWebChatRequest(body) {
  const message = String(body.message ?? '').trim();
  if (!message) {
    throw new Error('message is required and must be a non-empty string');
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const sessionFromBody = body.userId ? String(body.userId) : null;
  const sessionFromContext =
    body.context && typeof body.context === 'object' && body.context.sessionId
      ? webUserId(String(body.context.sessionId))
      : null;

  const userId = sessionFromBody ?? sessionFromContext ?? '';
  if (userId && !isValidUserId(userId)) {
    throw new Error('userId must be a valid identifier (telegram:ID or web:ID)');
  }

  const conversationId =
    (body.conversationId && String(body.conversationId)) ||
    userId ||
    'web:anonymous';

  return {
    channel: 'web',
    userId: userId || 'web:anonymous',
    conversationId,
    message,
    history: history
      .filter((t) => t && typeof t === 'object')
      .map((t) => ({
        role: t.role === 'assistant' ? 'assistant' : 'user',
        content: String(t.content ?? ''),
      })),
    username: body.username ? String(body.username) : undefined,
    displayName: body.displayName ? String(body.displayName) : undefined,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    context: body.context && typeof body.context === 'object' ? body.context : {},
  };
}

/**
 * Normalize a Telegram message object.
 * Uses Telegram user ID for memory; chat ID for conversation history.
 * @param {import('node-telegram-bot-api').Message} msg
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} history
 */
export function normalizeTelegramMessage(msg, history = []) {
  const text = msg.text?.trim();
  if (!text) {
    throw new Error('Unsupported message type — text messages only');
  }
  if (!msg.from?.id) {
    throw new Error('Telegram message missing sender identity');
  }

  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  if (isGroup) {
    const calledAtlas = text.toLowerCase().includes('atlas');
    const repliedToBot = msg.reply_to_message?.from?.is_bot === true;
    if (!calledAtlas && !repliedToBot) {
      throw new Error('GROUP_MESSAGE_IGNORED');
    }
  }

  return {
    channel: 'telegram',
    userId: telegramUserId(msg.from.id),
    conversationId: String(msg.chat.id),
    message: text,
    history,
    username: msg.from.username ?? undefined,
    displayName: [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || undefined,
    metadata: {
      chatType: msg.chat.type,
      chatTitle: msg.chat.title ?? null,
      messageId: msg.message_id,
      isGroup,
    },
    context: {},
  };
}

/**
 * Split long plain-text replies for Telegram's 4096 character limit.
 * @param {string} text
 * @param {number} [maxLen]
 * @returns {string[]}
 */
export function splitTelegramMessage(text, maxLen = 4096) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return [''];
  if (trimmed.length <= maxLen) return [trimmed];

  const chunks = [];
  let remaining = trimmed;

  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n\n', maxLen);
    if (splitAt < maxLen * 0.5) {
      splitAt = remaining.lastIndexOf('\n', maxLen);
    }
    if (splitAt < maxLen * 0.5) {
      splitAt = remaining.lastIndexOf(' ', maxLen);
    }
    if (splitAt <= 0) {
      splitAt = maxLen;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

/**
 * Apply Telegram-safe plain text formatting (no Markdown in core pipeline).
 * @param {string} reply
 */
export function formatTelegramReply(reply) {
  return (reply ?? '').replace(/\*\*/g, '').trim();
}

/**
 * Map pipeline result to Web Chat response shape (backward compatible).
 * @param {import('./atlas-message-service.js').AtlasMessageResult} result
 */
export function toWebChatResponse(result) {
  const data = result.data ?? {};
  return {
    reply: result.reply,
    content: result.reply,
    mode: data.mode ?? 'conversational',
    profile: data.profile ?? 'conversational',
    tarotIntent: data.tarotIntent ?? null,
    memoryUpdated: result.memoryUpdated ?? false,
    memoryHandled: data.memoryHandled ?? false,
    founderSession: data.founderSession ?? false,
    status: result.status,
    intent: result.intent ?? null,
    engine: result.engine ?? data.engine ?? null,
    model: data.model ?? 'atlas',
    provider: data.provider ?? 'atlas',
    tokensUsed: data.tokensUsed ?? 0,
    costUsd: data.costUsd ?? 0,
    latencyMs: data.latencyMs ?? 0,
    errorCode: result.errorCode ?? null,
  };
}

/**
 * User-facing error text by error code (channel-neutral).
 * @param {string} errorCode
 * @param {string} [fallback]
 */
export function normalizeErrorReply(errorCode, fallback = 'Beklenmeyen bir hata oluştu.') {
  const map = {
    BACKEND_UNAVAILABLE: 'Atlas backend şu an kullanılamıyor.',
    MODEL_UNAVAILABLE: 'Model sağlayıcı yapılandırılmamış. OPENAI_API_KEY gerekli.',
    TIMEOUT: 'Yanıt süresi aşıldı. Lütfen tekrar dene.',
    RATE_LIMIT: 'İstek limiti aşıldı. Kısa bir süre sonra tekrar dene.',
    INVALID_INPUT: 'Geçersiz istek.',
    MEMORY_FAILURE: 'Hafıza işlemi başarısız oldu.',
    ENGINE_FAILURE: 'Atlas motoru yanıt üretemedi.',
    UNSUPPORTED_MESSAGE: 'Bu mesaj türü desteklenmiyor.',
  };
  return map[errorCode] ?? fallback;
}
