// ═══════════════════════════════════════════════════════════════════════
// Telegram multimodal message handlers
// Photos → download → Atlas pipeline (shared callOpenAI multimodal).
// Voice/audio → Whisper transcription → same pipeline.
// ═══════════════════════════════════════════════════════════════════════

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { transcribeAudioFile } from '../openai-client.js';
import {
  normalizeErrorReply,
  DEFAULT_PHOTO_INSTRUCTION,
} from '../channel-adapters.js';
import {
  detectInboundKind,
  downloadTelegramFile,
  pickHighestPhoto,
  readFileBase64,
  safeUnlink,
  isImageMime,
  resolveMimeType,
  MediaError,
  MAX_TELEGRAM_IMAGE_BYTES,
} from './media.js';
import {
  contextKey,
  shouldRouteAudioToStudio,
  safeFileName,
} from '../audio-studio/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const TELEGRAM_MEDIA_DIR = join(__dirname, '..', '..', 'data', 'telegram-media');
const AUDIO_INBOUND_DIR = join(__dirname, '..', '..', 'data', 'audio-jobs', '_inbound');

/**
 * Preserve a copy for Audio Studio before temp cleanup.
 * @param {string} sourcePath
 * @param {string} fileName
 */
function stageAudioForStudio(sourcePath, fileName) {
  if (!existsSync(AUDIO_INBOUND_DIR)) {
    mkdirSync(AUDIO_INBOUND_DIR, { recursive: true });
  }
  const destName = `${Date.now()}_${randomBytes(3).toString('hex')}_${safeFileName(fileName)}`;
  const dest = join(AUDIO_INBOUND_DIR, destName);
  copyFileSync(sourcePath, dest);
  return dest;
}

/**
 * @typedef {Object} ResolvedInbound
 * @property {string} kind
 * @property {string} [message]
 * @property {Record<string, unknown>} [metadata]
 * @property {{ mimeType: string, base64: string }} [image]
 * @property {string} [directReply]
 * @property {boolean} [ignore]
 * @property {string} [errorCode]
 */

/**
 * @param {import('node-telegram-bot-api').TelegramBot} bot
 * @param {string} fileId
 * @param {{ mimeHint?: string, preferredExt?: string, requireImageMime?: boolean, maxBytes?: number }} [opts]
 * @param {(downloaded: { filePath: string, mimeType: string, fileUniqueName: string, byteLength: number }) => Promise<any>} fn
 */
async function withDownloadedFile(bot, fileId, opts, fn) {
  let filePath = null;
  try {
    const downloaded = await downloadTelegramFile(bot, fileId, TELEGRAM_MEDIA_DIR, opts);
    filePath = downloaded.filePath;
    return await fn(downloaded);
  } finally {
    safeUnlink(filePath);
  }
}

/**
 * Download image and attach for Atlas multimodal pipeline (no separate Vision pass).
 * @returns {Promise<ResolvedInbound>}
 */
async function resolveImageForPipeline(bot, fileId, caption = '', opts = {}) {
  try {
    return await withDownloadedFile(
      bot,
      fileId,
      {
        mimeHint: opts.mimeHint,
        preferredExt: opts.preferredExt,
        requireImageMime: true,
        maxBytes: MAX_TELEGRAM_IMAGE_BYTES,
      },
      async (downloaded) => {
        const mimeType = downloaded.mimeType || opts.mimeHint || 'image/jpeg';
        if (!isImageMime(mimeType)) {
          throw new MediaError('UNSUPPORTED_IMAGE_FORMAT', mimeType);
        }

        const captionText = (caption || '').trim();
        const message = captionText || DEFAULT_PHOTO_INSTRUCTION;
        const base64 = readFileBase64(downloaded.filePath);

        return {
          kind: opts.mediaKind || 'photo',
          message,
          image: { mimeType, base64 },
          metadata: {
            mediaKind: opts.mediaKind || 'photo',
            mimeType,
            hadCaption: Boolean(captionText),
            byteLength: downloaded.byteLength,
            multimodal: true,
          },
        };
      },
    );
  } catch (err) {
    if (err instanceof MediaError) {
      return {
        kind: 'error',
        errorCode: err.code,
        directReply: normalizeErrorReply(err.code),
        metadata: { mediaKind: opts.mediaKind || 'photo' },
      };
    }
    console.warn('[Telegram] Image resolve failed:', err?.message || err);
    return {
      kind: 'error',
      errorCode: 'IMAGE_DOWNLOAD_FAILED',
      directReply: normalizeErrorReply('IMAGE_DOWNLOAD_FAILED'),
      metadata: { mediaKind: opts.mediaKind || 'photo' },
    };
  }
}

/**
 * @returns {Promise<ResolvedInbound>}
 */
async function resolveAudioFile(bot, fileId, opts = {}) {
  return withDownloadedFile(
    bot,
    fileId,
    {
      mimeHint: opts.mimeHint,
      preferredExt: opts.preferredExt || '.ogg',
      requireImageMime: false,
      maxBytes: MAX_TELEGRAM_IMAGE_BYTES,
    },
    async (downloaded) => {
      const mimeType = downloaded.mimeType || opts.mimeHint || 'audio/ogg';
      const fileName = downloaded.fileUniqueName || 'audio.ogg';
      const studioKey = opts.studioContextKey || null;
      const caption = String(opts.caption || '').trim();
      const routeStudio =
        Boolean(opts.forceStudio) ||
        (studioKey ? shouldRouteAudioToStudio(studioKey, caption) : false) ||
        /st[uü]dyo|mix|master|d[uü]zenle|temizle|analiz|profesyonel/i.test(caption) ||
        opts.mediaKind === 'audio' ||
        opts.mediaKind === 'audio_document';

      /** @type {Record<string, unknown>} */
      const metadata = {
        mediaKind: opts.mediaKind || 'voice',
        mimeType,
        duration: opts.duration ?? null,
        byteLength: downloaded.byteLength,
      };

      if (routeStudio) {
        const staged = stageAudioForStudio(downloaded.filePath, fileName);
        metadata.audioStudioFile = {
          localPath: staged,
          fileName,
          mimeType,
          fileId,
          size: downloaded.byteLength,
          duration: opts.duration ?? null,
          mediaKind: opts.mediaKind || 'voice',
        };
        metadata.source = 'audio-studio-inbound';
      }

      let message = caption;
      if (!message || !routeStudio) {
        try {
          const transcription = await transcribeAudioFile({
            filePath: downloaded.filePath,
            mimeType,
            fileName,
          });
          message = caption || transcription.text;
          metadata.transcriptionModel = transcription.model;
          metadata.source = routeStudio
            ? 'audio-studio-inbound+speech-to-text'
            : 'speech-to-text';
        } catch (err) {
          if (!routeStudio) throw err;
          message =
            caption ||
            'Ses dosyası alındı. Teknik analiz / prodüksiyon talebi olarak değerlendir.';
          metadata.transcriptionError = true;
        }
      }

      return {
        kind: opts.mediaKind || 'voice',
        message: message || '[audio]',
        metadata,
      };
    },
  );
}

/** @returns {Promise<ResolvedInbound>} */
export async function handleTextMessage(msg) {
  return {
    kind: 'text',
    message: String(msg.text || '').trim(),
    metadata: { mediaKind: null },
  };
}

/** @returns {Promise<ResolvedInbound>} */
export async function handlePhotoMessage(bot, msg) {
  const best = pickHighestPhoto(msg.photo);
  if (!best?.file_id) {
    return {
      kind: 'error',
      errorCode: 'IMAGE_DOWNLOAD_FAILED',
      directReply: normalizeErrorReply('IMAGE_DOWNLOAD_FAILED'),
      metadata: { mediaKind: 'photo' },
    };
  }
  return resolveImageForPipeline(bot, best.file_id, msg.caption || '', {
    mimeHint: 'image/jpeg',
    preferredExt: '.jpg',
    mediaKind: 'photo',
  });
}

/** @returns {Promise<ResolvedInbound>} */
export async function handleImageDocument(bot, msg) {
  const doc = msg.document;
  if (!doc?.file_id) {
    return {
      kind: 'error',
      errorCode: 'IMAGE_DOWNLOAD_FAILED',
      directReply: normalizeErrorReply('IMAGE_DOWNLOAD_FAILED'),
      metadata: { mediaKind: 'image_document' },
    };
  }
  const mime = resolveMimeType(doc.file_name, doc.mime_type);
  if (!isImageMime(mime)) {
    return {
      kind: 'error',
      errorCode: 'UNSUPPORTED_IMAGE_FORMAT',
      directReply: normalizeErrorReply('UNSUPPORTED_IMAGE_FORMAT'),
      metadata: { mediaKind: 'image_document', mimeType: mime },
    };
  }
  return resolveImageForPipeline(bot, doc.file_id, msg.caption || '', {
    mimeHint: mime,
    mediaKind: 'image_document',
  });
}

/** @returns {Promise<ResolvedInbound>} */
export async function handleVoiceMessage(bot, msg, resolveOpts = {}) {
  const voice = msg.voice;
  if (!voice?.file_id) {
    return handleUnsupportedMessage(msg);
  }
  try {
    const fromId = msg.from?.id != null ? String(msg.from.id) : 'anon';
    const studioContextKey = contextKey({
      channel: 'telegram',
      userId: fromId ? `telegram:${fromId}` : null,
      chatId: msg.chat?.id != null ? String(msg.chat.id) : null,
    });
    return await resolveAudioFile(bot, voice.file_id, {
      mimeHint: voice.mime_type || 'audio/ogg',
      preferredExt: '.ogg',
      mediaKind: 'voice',
      duration: voice.duration,
      caption: msg.caption || '',
      studioContextKey,
      forceStudio: Boolean(resolveOpts.forceStudio),
    });
  } catch (err) {
    console.warn('[Telegram] Voice transcription failed:', err?.message || err);
    return {
      kind: 'error',
      errorCode: 'MODEL_UNAVAILABLE',
      directReply: normalizeErrorReply('MODEL_UNAVAILABLE'),
      metadata: { mediaKind: 'voice' },
    };
  }
}

/** @returns {Promise<ResolvedInbound>} */
export async function handleAudioMessage(bot, msg, resolveOpts = {}) {
  const audio = msg.audio || msg.document;
  if (!audio?.file_id) {
    return handleUnsupportedMessage(msg);
  }
  try {
    const mime = audio.mime_type || resolveMimeType(audio.file_name, null);
    const fromId = msg.from?.id != null ? String(msg.from.id) : 'anon';
    const studioContextKey = contextKey({
      channel: 'telegram',
      userId: fromId ? `telegram:${fromId}` : null,
      chatId: msg.chat?.id != null ? String(msg.chat.id) : null,
    });
    return await resolveAudioFile(bot, audio.file_id, {
      mimeHint: mime || 'audio/mpeg',
      mediaKind: msg.audio ? 'audio' : 'audio_document',
      duration: audio.duration,
      caption: msg.caption || '',
      studioContextKey,
      forceStudio: Boolean(resolveOpts.forceStudio),
      preferredExt: audio.file_name ? undefined : '.mp3',
    });
  } catch (err) {
    console.warn('[Telegram] Audio transcription failed:', err?.message || err);
    return {
      kind: 'error',
      errorCode: 'MODEL_UNAVAILABLE',
      directReply: normalizeErrorReply('MODEL_UNAVAILABLE'),
      metadata: { mediaKind: 'audio' },
    };
  }
}

/**
 * Stickers / video notes / etc. — reject with clear unsupported message
 * (animated stickers get a friendlier note). Static stickers are unsupported
 * for the image pipeline to keep photo path focused; emoji-only fallback.
 * @returns {Promise<ResolvedInbound>}
 */
export async function handleStickerMessage(_bot, msg) {
  const sticker = msg.sticker;
  if (sticker?.is_animated || sticker?.is_video) {
    return {
      kind: 'unsupported',
      directReply:
        'Animasyonlu veya video sticker’ları şu an desteklemiyorum. Fotoğraf veya metin gönderebilirsin.',
      metadata: {
        mediaKind: 'sticker',
        stickerAnimated: Boolean(sticker?.is_animated),
        stickerVideo: Boolean(sticker?.is_video),
      },
    };
  }
  return handleUnsupportedMessage(msg);
}

/** @returns {Promise<ResolvedInbound>} */
export async function handleUnsupportedMessage(msg) {
  const kind = detectInboundKind(msg);
  const caption = String(msg.caption || msg.text || '').trim();
  // Video + extract/studio intent → pipeline advisory (no fake processing)
  if (
    (kind === 'unsupported_video' || kind === 'unsupported_video_note') &&
    /sesi?\s+[cç][ıi]kar|st[uü]dyo|d[uü]zenle|analiz|extract/i.test(caption)
  ) {
    return {
      kind: 'video_audio_request',
      message:
        caption ||
        'Videodaki sesi çıkarmak veya düzenlemek istiyorum.',
      metadata: {
        mediaKind: kind === 'unsupported_video_note' ? 'video_note' : 'video',
        detectedType: 'video_with_audio',
        source: 'telegram-video-audio-request',
      },
    };
  }
  return {
    kind: 'unsupported',
    errorCode: 'UNSUPPORTED_MESSAGE',
    directReply: normalizeErrorReply('UNSUPPORTED_MESSAGE'),
    metadata: { mediaKind: kind },
  };
}

/**
 * Route a Telegram message to the correct multimodal handler.
 * @param {import('node-telegram-bot-api').TelegramBot} bot
 * @param {import('node-telegram-bot-api').Message} msg
 * @returns {Promise<ResolvedInbound>}
 */
export async function resolveMultimodalInbound(bot, msg, resolveOpts = {}) {
  const kind = detectInboundKind(msg);

  switch (kind) {
    case 'text':
      return handleTextMessage(msg);
    case 'photo':
      return handlePhotoMessage(bot, msg);
    case 'image_document':
      return handleImageDocument(bot, msg);
    case 'voice':
      return handleVoiceMessage(bot, msg, resolveOpts);
    case 'audio':
    case 'audio_document':
      return handleAudioMessage(bot, msg, resolveOpts);
    case 'sticker':
      return handleStickerMessage(bot, msg);
    default:
      return handleUnsupportedMessage(msg);
  }
}

export { detectInboundKind, DEFAULT_PHOTO_INSTRUCTION, MediaError };
