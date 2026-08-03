/**
 * Audio / media type classification from MIME, extension, metadata, and cues.
 * Extension alone is never trusted.
 */

const EXT_MIME = Object.freeze({
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/m4a',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/opus',
  '.flac': 'audio/flac',
  '.webm': 'audio/webm',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
});

const SUPPORTED_AUDIO_EXTS = new Set([
  '.wav',
  '.mp3',
  '.m4a',
  '.aac',
  '.ogg',
  '.oga',
  '.opus',
  '.flac',
  '.webm',
]);

const AUDIO_MIME_PREFIXES = ['audio/'];
const VIDEO_MIME_PREFIXES = ['video/'];

/**
 * @param {string|null|undefined} name
 */
export function extensionOf(name) {
  const n = String(name || '').toLowerCase();
  const i = n.lastIndexOf('.');
  if (i < 0) return '';
  return n.slice(i);
}

/**
 * @param {string|null|undefined} mime
 * @param {string|null|undefined} fileName
 */
export function normalizeMime(mime, fileName) {
  const m = String(mime || '').trim().toLowerCase();
  if (m && m !== 'application/octet-stream') return m;
  const ext = extensionOf(fileName);
  return EXT_MIME[ext] || m || null;
}

/**
 * @param {{
 *   mimeType?: string|null,
 *   fileName?: string|null,
 *   mediaKind?: string|null,
 *   size?: number|null,
 *   duration?: number|null,
 *   hasAudioStream?: boolean|null,
 *   userText?: string|null,
 *   telegramVoice?: boolean,
 * }} input
 */
export function classifyAudioMedia(input = {}) {
  const mime = normalizeMime(input.mimeType, input.fileName);
  const ext = extensionOf(input.fileName);
  const size = Number(input.size || 0);
  const mediaKind = String(input.mediaKind || '').toLowerCase();
  const text = String(input.userText || '');

  /** @type {string} */
  let detectedType = 'unknown_audio';
  /** @type {string[]} */
  const reasons = [];
  let supported = false;
  let mimeExtMismatch = false;

  if (size === 0 && (input.fileName || input.mimeType)) {
    return {
      detectedType: 'unsupported_media',
      supported: false,
      mime,
      extension: ext,
      reasons: ['zero_byte'],
      mimeExtMismatch: false,
    };
  }

  if (input.telegramVoice || mediaKind === 'voice' || mediaKind === 'telegram_voice') {
    detectedType = 'telegram_voice';
    supported = true;
    reasons.push('telegram_voice');
  } else if (ext === '.mid' || ext === '.midi' || mime === 'audio/midi' || mime === 'audio/x-midi') {
    detectedType = 'midi';
    supported = false;
    reasons.push('midi');
  } else if (/\.(als|flp|logic|band|ptx|cpr)$/i.test(String(input.fileName || ''))) {
    detectedType = 'daw_project';
    supported = false;
    reasons.push('daw_project');
  } else if (
    mediaKind.startsWith('unsupported_video') ||
    mediaKind === 'video' ||
    mediaKind === 'video_note' ||
    VIDEO_MIME_PREFIXES.some((p) => (mime || '').startsWith(p))
  ) {
    detectedType = 'video_with_audio';
    supported = false;
    reasons.push('video');
  } else if (AUDIO_MIME_PREFIXES.some((p) => (mime || '').startsWith(p)) || SUPPORTED_AUDIO_EXTS.has(ext)) {
    supported = SUPPORTED_AUDIO_EXTS.has(ext) || (mime || '').startsWith('audio/');
    detectedType = 'audio_file';
    reasons.push('audio_file');

    if (ext && mime && EXT_MIME[ext] && EXT_MIME[ext] !== mime && !mime.includes(ext.replace('.', ''))) {
      // loose mismatch check
      const expected = EXT_MIME[ext];
      if (expected && mime !== expected && !mime.startsWith(expected.split('/')[0])) {
        mimeExtMismatch = true;
        reasons.push('mime_ext_mismatch');
      }
    }

    if (/podcast/i.test(text)) {
      detectedType = 'podcast_recording';
    } else if (/konu[sş]ma|speech|r[oö]portaj/i.test(text)) {
      detectedType = 'speech_recording';
    } else if (/sadece\s+vokal|vocal\s+only|a\s*cappella/i.test(text)) {
      detectedType = 'vocal_only';
    } else if (/sadece\s+(?:ba[gğ]lama|gitar|enstr[uü]man)|instrument\s+only/i.test(text)) {
      detectedType = 'instrument_only';
    } else if (
      /vokal.*(?:ba[gğ]lama|gitar|enstr)|ba[gğ]lama.*vokal|birlikte\s+kay[ıi]t|mix/i.test(text) ||
      (/vokal|s[oö]yle/i.test(text) && /ba[gğ]lama|gitar|enstr/i.test(text))
    ) {
      detectedType = 'vocal_and_instrument_mix';
    } else if (/demo|beste|şarkı|sarki|m[uü]zik/i.test(text)) {
      detectedType = 'music_demo';
    }
  } else if (mime || ext) {
    detectedType = 'unsupported_media';
    supported = false;
    reasons.push('unsupported');
  }

  if (input.hasAudioStream === false) {
    detectedType = 'unsupported_media';
    supported = false;
    reasons.push('no_audio_stream');
  }

  return {
    detectedType,
    supported,
    mime,
    extension: ext,
    reasons,
    mimeExtMismatch,
  };
}

export { SUPPORTED_AUDIO_EXTS, EXT_MIME };
