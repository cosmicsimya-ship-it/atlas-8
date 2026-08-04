// ═══════════════════════════════════════════════════════════════════════
// Channel Adapters — normalize inbound messages and format outbound replies
// Channel-specific logic lives here only; never in the core pipeline.
// ═══════════════════════════════════════════════════════════════════════

import { webUserId, telegramUserId, isValidUserId } from './user-memory.js';
import {
  buildTelegramSpeakerAttribution,
  speakerAttributionToMetadata,
  filterSafeExtraMetadata,
  SPEAKER_LABEL_FALLBACK,
} from './speaker-attribution.js';

/** @typedef {'web' | 'telegram'} AtlasChannel */

/** Neutral instruction when a Telegram photo has no caption. */
export const DEFAULT_PHOTO_INSTRUCTION =
  'Analyze the attached image and respond appropriately.';

/** In-flight queue notice — name-free; never personalize with speaker/mentions. */
export const TELEGRAM_IN_FLIGHT_NOTICE =
  'Önceki mesajını hâlâ işliyorum; bu mesajını sıraya aldım, hemen ardından yanıtlayacağım.';

export function getTelegramInFlightNotice() {
  return TELEGRAM_IN_FLIGHT_NOTICE;
}

/**
 * @typedef {Object} AtlasImageAttachment
 * @property {string} mimeType
 * @property {string} base64
 */

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
 * @property {AtlasImageAttachment} [image]
 */

/**
 * @param {unknown} raw
 * @returns {AtlasImageAttachment|undefined}
 */
function normalizeImageAttachment(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const base64 = typeof raw.base64 === 'string' ? raw.base64.trim() : '';
  if (!base64) return undefined;
  let mimeType =
    typeof raw.mimeType === 'string' && raw.mimeType.trim()
      ? raw.mimeType.trim().toLowerCase().split(';')[0]
      : 'image/jpeg';
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
  return { mimeType, base64 };
}

/**
 * Normalize any channel request body into NormalizedAtlasMessage.
 * Web uses full validation; Telegram HTTP payloads are pre-filtered by the bot.
 * @param {Record<string, unknown>} body
 * @returns {NormalizedAtlasMessage}
 */
export function normalizeAtlasMessageRequest(body) {
  const channel = body?.channel === 'telegram' ? 'telegram' : 'web';
  const image = normalizeImageAttachment(body?.image);

  if (channel === 'telegram') {
    const message = String(body.message ?? '').trim();
    if (!message) {
      throw new Error('message is required and must be a non-empty string');
    }

    const userId = String(body.userId ?? '').trim();
    if (!userId || !isValidUserId(userId)) {
      throw new Error('userId must be a valid identifier (telegram:ID or web:ID)');
    }

    const history = Array.isArray(body.history) ? body.history : [];

    return {
      channel: 'telegram',
      userId,
      conversationId: String(body.conversationId ?? userId),
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
      // context may include speakerAttribution; trust is enforced in index/message-service
      context: body.context && typeof body.context === 'object' ? { ...body.context } : {},
      ...(image ? { image } : {}),
    };
  }

  const web = normalizeWebChatRequest(body);
  if (image) web.image = image;
  return web;
}

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
 * Extract usable text from a Telegram message.
 * Accepts plain text and media captions (photo/video/document).
 * @param {import('node-telegram-bot-api').Message} msg
 * @returns {{ text: string|null, mediaKind: string|null }}
 */
export function extractTelegramText(msg) {
  const text = typeof msg?.text === 'string' ? msg.text.trim() : '';
  if (text) return { text, mediaKind: null };

  const caption = typeof msg?.caption === 'string' ? msg.caption.trim() : '';
  if (caption) {
    const mediaKind = msg.photo
      ? 'photo'
      : msg.video
        ? 'video'
        : msg.document
          ? 'document'
          : msg.audio
            ? 'audio'
            : msg.voice
              ? 'voice'
              : 'media';
    return { text: caption, mediaKind };
  }

  const mediaKind = msg?.voice
    ? 'voice'
    : msg?.video_note
      ? 'video_note'
      : msg?.sticker
        ? 'sticker'
        : msg?.photo
          ? 'photo'
          : msg?.video
            ? 'video'
            : msg?.audio
              ? 'audio'
              : msg?.document
                ? 'document'
                : msg?.animation
                  ? 'animation'
                  : msg?.location
                    ? 'location'
                    : msg?.contact
                      ? 'contact'
                      : msg?.poll
                        ? 'poll'
                        : 'unknown';
  return { text: null, mediaKind };
}

/**
 * Whether a group/supergroup message is addressed to this bot.
 * @param {import('node-telegram-bot-api').Message} msg
 * @param {string} text
 * @param {{ id?: number, username?: string } | null} botIdentity
 */
export function isTelegramGroupMessageAddressedToBot(msg, text, botIdentity = null) {
  const raw = text ?? '';
  const lower = raw.toLowerCase();
  // Word-ish "atlas" / @atlas — avoid matching unrelated substrings mid-token.
  if (/(?:^|[\s@])atlas(?:[\s,!?.:;…]|$)/iu.test(lower) || /^@?atlas\b/iu.test(lower)) {
    return true;
  }

  const replyFrom = msg.reply_to_message?.from;
  if (replyFrom) {
    if (botIdentity?.id != null && Number(replyFrom.id) === Number(botIdentity.id)) {
      return true;
    }
    if (replyFrom.is_bot === true) return true;
  }

  const username = botIdentity?.username?.replace(/^@/, '').toLowerCase();
  if (username) {
    if (lower.includes(`@${username}`)) return true;
  }

  const entities = [...(msg.entities ?? []), ...(msg.caption_entities ?? [])];
  for (const entity of entities) {
    if (entity.type === 'mention' && username && text) {
      const mention = text.slice(entity.offset, entity.offset + entity.length).toLowerCase();
      if (mention === `@${username}`) return true;
    }
    if (
      entity.type === 'text_mention' &&
      botIdentity?.id != null &&
      entity.user?.id != null &&
      Number(entity.user.id) === Number(botIdentity.id)
    ) {
      return true;
    }
    if (entity.type === 'bot_command') return true;
  }

  // Presence / wake and slash commands also count as addressed at the edge.
  if (/^\s*\/[a-z0-9_]{2,32}(@\w+)?\b/i.test(raw)) return true;
  if (
    /^(?:ordam[ıi]s[ıi]n|orada\s*m[ıi]s[ıi]n|burada\s*m[ıi]s[ıi]n|burdam[ıi]s[ıi]n|aktif\s*m[ıi]s[ıi]n|ses\s*ver|dinliyor\s*musun)\s*[?.!…]*$/iu.test(
      raw.trim(),
    )
  ) {
    return true;
  }

  return false;
}

/**
 * @param {import('node-telegram-bot-api').Message} msg
 * @param {{ id?: number, username?: string } | null} botIdentity
 */
export function isTelegramReplyToBot(msg, botIdentity = null) {
  const replyFrom = msg?.reply_to_message?.from;
  if (!replyFrom) return false;
  if (botIdentity?.id != null && Number(replyFrom.id) === Number(botIdentity.id)) return true;
  return replyFrom.is_bot === true;
}

/**
 * Normalize a Telegram message object.
 * Uses Telegram user ID for memory; chat ID for conversation history.
 * Multimodal handlers may supply `options.resolvedMessage` / `options.image`.
 * @param {import('node-telegram-bot-api').Message} msg
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} history
 * @param {{
 *   id?: number,
 *   username?: string,
 *   requireGroupMention?: boolean,
 *   resolvedMessage?: string,
 *   mediaKind?: string|null,
 *   extraMetadata?: Record<string, unknown>,
 *   image?: AtlasImageAttachment,
 * } | null} [options]
 */
export function normalizeTelegramMessage(msg, history = [], options = null) {
  const extracted = extractTelegramText(msg);
  const resolvedOverride =
    typeof options?.resolvedMessage === 'string' ? options.resolvedMessage.trim() : '';
  const text = resolvedOverride || extracted.text;
  const mediaKind =
    options?.mediaKind !== undefined ? options.mediaKind : extracted.mediaKind;

  if (!text) {
    const kind = mediaKind && mediaKind !== 'unknown' ? mediaKind : 'non-text';
    throw new Error(`Unsupported message type (${kind})`);
  }

  const hasUserSender = Boolean(msg.from?.id);
  const hasSenderChat = Boolean(msg.sender_chat?.id);
  if (!hasUserSender && !hasSenderChat) {
    throw new Error('Telegram message missing sender identity');
  }

  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  const botIdentity = {
    id: options?.id,
    username: options?.username,
  };
  const addressText = extracted.text || text;
  const replyToBot = isTelegramReplyToBot(msg, botIdentity);
  const addressedToBot =
    replyToBot || isTelegramGroupMessageAddressedToBot(msg, addressText, botIdentity);

  // Opt-in hard throw (legacy). Pipeline + telegram edge enforce silence by default.
  const requireGroupMention =
    options?.requireGroupMention === true ||
    process.env.TELEGRAM_GROUP_REQUIRE_MENTION === 'true';

  if (isGroup && requireGroupMention && !addressedToBot && options?.allowActiveSession !== true) {
    throw new Error('GROUP_MESSAGE_IGNORED');
  }

  const attribution = buildTelegramSpeakerAttribution(msg, text);
  const attributionMeta = speakerAttributionToMetadata(attribution);
  const safeExtra = filterSafeExtraMetadata(options?.extraMetadata);

  // Synthetic id for sender_chat-only (anonymous admin / channel) — not a personal memory key.
  const resolvedUserId = hasUserSender
    ? telegramUserId(msg.from.id)
    : telegramUserId(`sc_${String(msg.chat.id).replace(/[^a-zA-Z0-9_]/g, '_')}`);

  /** @type {NormalizedAtlasMessage} */
  const normalized = {
    channel: 'telegram',
    userId: resolvedUserId,
    conversationId: String(msg.chat.id),
    message: text,
    history,
    // Sender display fields: Telegram from.* / sender_chat only — never from message text.
    username: attribution.sender.username ?? undefined,
    displayName: attribution.sender.displayName ?? SPEAKER_LABEL_FALLBACK,
    metadata: {
      chatType: msg.chat.type,
      chatTitle: msg.chat.title ?? null,
      messageId: msg.message_id,
      messageThreadId: msg.message_thread_id ?? null,
      isGroup,
      telegramFromId: hasUserSender ? String(msg.from.id) : null,
      mediaKind: mediaKind ?? null,
      hasImage: Boolean(options?.image?.base64),
      replyToBot,
      addressedToBot,
      botUsername: botIdentity.username ?? null,
      ...attributionMeta,
      ...safeExtra,
    },
    context: {
      speakerAttribution: {
        ...attribution,
        ...attributionMeta,
        trusted: true,
        channel: 'telegram',
        sender: attribution.sender,
      },
    },
  };

  if (options?.image?.base64) {
    normalized.image = {
      mimeType: options.image.mimeType || 'image/jpeg',
      base64: options.image.base64,
    };
  }

  return normalized;
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
    MODEL_UNAVAILABLE: 'Model şu an geçici olarak kullanılamıyor. Lütfen biraz sonra tekrar dene.',
    TIMEOUT: 'Mesajını aldım ancak şu anda yanıtı tamamlayamadım. Lütfen birkaç saniye sonra tekrar dene.',
    RATE_LIMIT: 'İstek limiti aşıldı. Kısa bir süre sonra tekrar dene.',
    INVALID_INPUT: 'Geçersiz istek.',
    MEMORY_FAILURE: 'Hafıza işlemi başarısız oldu.',
    ENGINE_FAILURE: 'Atlas motoru yanıt üretemedi.',
    IMAGE_DOWNLOAD_FAILED: 'Görseli indiremedim. Lütfen fotoğrafı tekrar gönder.',
    UNSUPPORTED_IMAGE_FORMAT:
      'Bu görsel formatını desteklemiyorum. JPEG, PNG, WebP veya GIF gönder.',
    IMAGE_TOO_LARGE: 'Görsel çok büyük. Daha küçük bir fotoğraf gönder (en fazla 10 MB).',
    UNSUPPORTED_MESSAGE:
      'Bu içerik türünü henüz işleyemiyorum. Metin veya fotoğraf gönderebilirsin.',
  };
  return map[errorCode] ?? fallback;
}
