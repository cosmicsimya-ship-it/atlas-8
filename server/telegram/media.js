// ═══════════════════════════════════════════════════════════════════════
// Telegram media helpers — download, MIME detection, temp cleanup
// Channel-specific; never logs tokens or full private file URLs.
// ═══════════════════════════════════════════════════════════════════════

import {
  existsSync,
  mkdirSync,
  unlinkSync,
  readFileSync,
  writeFileSync,
  statSync,
} from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import axios from 'axios';

/** Default max download size for Telegram images (10 MiB). */
export const MAX_TELEGRAM_IMAGE_BYTES = Number(process.env.TELEGRAM_MAX_IMAGE_BYTES) || 10 * 1024 * 1024;

/** Download timeout for Telegram file HTTP GET. */
export const TELEGRAM_FILE_DOWNLOAD_TIMEOUT_MS =
  Number(process.env.TELEGRAM_FILE_DOWNLOAD_TIMEOUT_MS) || 60_000;

export const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const AUDIO_MIME_TYPES = new Set([
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/flac',
  'audio/aac',
  'audio/opus',
  'audio/x-m4a',
]);

const EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.mp4': 'audio/mp4',
  '.m4a': 'audio/m4a',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
};

/**
 * Typed media failure for Telegram → user-facing Turkish mapping.
 */
export class MediaError extends Error {
  /**
   * @param {'IMAGE_DOWNLOAD_FAILED'|'UNSUPPORTED_IMAGE_FORMAT'|'IMAGE_TOO_LARGE'|'UNSUPPORTED_MESSAGE'|'MEDIA_FAILURE'} code
   * @param {string} [detail]
   */
  constructor(code, detail = '') {
    super(detail || code);
    this.name = 'MediaError';
    this.code = code;
  }
}

/**
 * @param {string} dir
 */
export function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Best-effort delete; never throws.
 * @param {string|null|undefined} filePath
 */
export function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

/**
 * @param {string|null|undefined} mime
 */
export function isImageMime(mime) {
  if (!mime) return false;
  const normalized = String(mime).toLowerCase().split(';')[0].trim();
  if (normalized === 'image/jpg') return true;
  return IMAGE_MIME_TYPES.has(normalized);
}

/**
 * @param {string|null|undefined} mime
 */
export function isAudioMime(mime) {
  if (!mime) return false;
  const normalized = String(mime).toLowerCase().split(';')[0].trim();
  return AUDIO_MIME_TYPES.has(normalized) || normalized.startsWith('audio/');
}

/**
 * @param {string|null|undefined} filePath
 * @param {string|null|undefined} mimeHint
 */
export function resolveMimeType(filePath, mimeHint = null) {
  if (mimeHint) {
    const hint = String(mimeHint).toLowerCase().split(';')[0].trim();
    if (hint === 'image/jpg') return 'image/jpeg';
    return hint;
  }
  const ext = extname(filePath || '').toLowerCase();
  return EXT_TO_MIME[ext] || 'application/octet-stream';
}

/**
 * Highest-resolution Telegram photo size.
 * @param {Array<{ file_id: string, width?: number, height?: number, file_size?: number }>} photoSizes
 */
export function pickHighestPhoto(photoSizes) {
  if (!Array.isArray(photoSizes) || photoSizes.length === 0) return null;
  return [...photoSizes].sort((a, b) => {
    const areaA = (a.width || 0) * (a.height || 0);
    const areaB = (b.width || 0) * (b.height || 0);
    if (areaA !== areaB) return areaB - areaA;
    return (b.file_size || 0) - (a.file_size || 0);
  })[0];
}

/**
 * @param {import('node-telegram-bot-api').Message} msg
 * @returns {string}
 */
export function detectInboundKind(msg) {
  if (typeof msg?.text === 'string' && msg.text.trim()) return 'text';
  if (Array.isArray(msg?.photo) && msg.photo.length) return 'photo';
  if (msg?.voice) return 'voice';
  if (msg?.audio) return 'audio';
  if (msg?.sticker) return 'sticker';
  if (msg?.document) {
    const mime = msg.document.mime_type || '';
    if (isImageMime(mime)) return 'image_document';
    if (isAudioMime(mime)) return 'audio_document';
    const name = String(msg.document.file_name || '').toLowerCase();
    if (/\.(png|jpe?g|webp|gif)$/i.test(name)) return 'image_document';
    if (/\.(ogg|oga|mp3|m4a|wav|flac|aac|opus|webm)$/i.test(name)) return 'audio_document';
    return 'unsupported_document';
  }
  if (msg?.video) return 'unsupported_video';
  if (msg?.video_note) return 'unsupported_video_note';
  if (msg?.animation) return 'unsupported_animation';
  if (msg?.location) return 'unsupported_location';
  if (msg?.contact) return 'unsupported_contact';
  if (msg?.poll) return 'unsupported_poll';
  return 'unsupported';
}

/**
 * Build Telegram file download URL without returning it to callers/logs.
 * @param {string} botToken
 * @param {string} filePath
 */
function buildTelegramFileUrl(botToken, filePath) {
  return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
}

/**
 * Download a Telegram file to a unique path under destDir.
 * @param {import('node-telegram-bot-api').TelegramBot} bot
 * @param {string} fileId
 * @param {string} destDir
 * @param {{
 *   preferredExt?: string,
 *   mimeHint?: string,
 *   maxBytes?: number,
 *   requireImageMime?: boolean,
 * }} [opts]
 * @returns {Promise<{ filePath: string, mimeType: string, fileUniqueName: string, byteLength: number }>}
 */
export async function downloadTelegramFile(bot, fileId, destDir, opts = {}) {
  ensureDir(destDir);

  let file;
  try {
    file = await bot.getFile(fileId);
  } catch (err) {
    throw new MediaError('IMAGE_DOWNLOAD_FAILED', err?.message || 'getFile failed');
  }

  const remotePath = typeof file?.file_path === 'string' ? file.file_path : '';
  if (!remotePath) {
    throw new MediaError('IMAGE_DOWNLOAD_FAILED', 'Telegram file_path missing');
  }

  const maxBytes = opts.maxBytes ?? MAX_TELEGRAM_IMAGE_BYTES;
  if (typeof file.file_size === 'number' && file.file_size > maxBytes) {
    throw new MediaError('IMAGE_TOO_LARGE', `file_size=${file.file_size}`);
  }

  const mimeType = resolveMimeType(remotePath, opts.mimeHint);
  if (opts.requireImageMime && !isImageMime(mimeType)) {
    throw new MediaError('UNSUPPORTED_IMAGE_FORMAT', mimeType);
  }

  const remoteExt = extname(remotePath) || opts.preferredExt || '';
  const uniqueName = `${Date.now()}-${randomUUID().slice(0, 8)}${remoteExt || ''}`;
  const filePath = join(destDir, uniqueName);

  const token = bot.token || process.env.TELEGRAM_BOT_TOKEN || '';
  if (!token) {
    throw new MediaError('IMAGE_DOWNLOAD_FAILED', 'bot token unavailable');
  }

  const url = buildTelegramFileUrl(token, remotePath);

  let response;
  try {
    response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: TELEGRAM_FILE_DOWNLOAD_TIMEOUT_MS,
      maxContentLength: maxBytes,
      maxBodyLength: maxBytes,
      // Never attach auth headers that could be logged elsewhere
      validateStatus: (s) => s >= 200 && s < 300,
    });
  } catch (err) {
    const code = err?.code || '';
    if (code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED' || /max content length/i.test(err?.message || '')) {
      throw new MediaError('IMAGE_TOO_LARGE', 'download exceeded maxBytes');
    }
    throw new MediaError('IMAGE_DOWNLOAD_FAILED', err?.message || 'download failed');
  } finally {
    // Ensure URL with token is not retained on the error object by callers
  }

  const buffer = Buffer.from(response.data);
  if (buffer.byteLength > maxBytes) {
    throw new MediaError('IMAGE_TOO_LARGE', `bytes=${buffer.byteLength}`);
  }
  if (buffer.byteLength === 0) {
    throw new MediaError('IMAGE_DOWNLOAD_FAILED', 'empty file');
  }

  writeFileSync(filePath, buffer);

  return {
    filePath,
    mimeType,
    fileUniqueName: uniqueName,
    byteLength: buffer.byteLength,
  };
}

/**
 * Read file as base64 (no data-URL prefix).
 * @param {string} filePath
 */
export function readFileBase64(filePath) {
  return readFileSync(filePath).toString('base64');
}

/**
 * @param {string} filePath
 */
export function fileByteLength(filePath) {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}
