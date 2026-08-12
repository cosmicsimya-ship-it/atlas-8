/**
 * Normalized voice / TTS error model.
 * Never include API keys, provider secrets, or full user text in messages.
 */

export const VOICE_ERROR_CODES = Object.freeze({
  EMPTY_TEXT: 'empty_text',
  TEXT_TOO_LONG: 'text_too_long',
  VOICE_NOT_FOUND: 'voice_not_found',
  VOICE_NOT_CONFIGURED: 'voice_not_configured',
  LANGUAGE_NOT_SUPPORTED: 'language_not_supported',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  PROVIDER_TIMEOUT: 'provider_timeout',
  QUOTA_EXCEEDED: 'quota_exceeded',
  RATE_LIMITED: 'rate_limited',
  SYNTHESIS_FAILED: 'synthesis_failed',
  INVALID_FORMAT: 'invalid_format',
  INVALID_INPUT: 'invalid_input',
  CACHE_ERROR: 'cache_error',
});

const USER_MESSAGES = Object.freeze({
  [VOICE_ERROR_CODES.EMPTY_TEXT]: 'Metin boş olamaz.',
  [VOICE_ERROR_CODES.TEXT_TOO_LONG]: 'Metin çok uzun.',
  [VOICE_ERROR_CODES.VOICE_NOT_FOUND]: 'Ses bulunamadı.',
  [VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED]: 'Ses henüz yapılandırılmamış.',
  [VOICE_ERROR_CODES.LANGUAGE_NOT_SUPPORTED]: 'Bu dil desteklenmiyor.',
  [VOICE_ERROR_CODES.PROVIDER_UNAVAILABLE]: 'Ses sağlayıcısı kullanılamıyor.',
  [VOICE_ERROR_CODES.PROVIDER_TIMEOUT]: 'Ses üretimi zaman aşımına uğradı.',
  [VOICE_ERROR_CODES.QUOTA_EXCEEDED]: 'Ses kotası doldu.',
  [VOICE_ERROR_CODES.RATE_LIMITED]: 'Çok fazla istek. Lütfen biraz bekleyin.',
  [VOICE_ERROR_CODES.SYNTHESIS_FAILED]: 'Ses üretimi başarısız oldu.',
  [VOICE_ERROR_CODES.INVALID_FORMAT]: 'Geçersiz ses formatı.',
  [VOICE_ERROR_CODES.INVALID_INPUT]: 'Geçersiz istek.',
  [VOICE_ERROR_CODES.CACHE_ERROR]: 'Önbellek hatası.',
});

const HTTP_STATUS = Object.freeze({
  [VOICE_ERROR_CODES.EMPTY_TEXT]: 400,
  [VOICE_ERROR_CODES.TEXT_TOO_LONG]: 400,
  [VOICE_ERROR_CODES.VOICE_NOT_FOUND]: 404,
  [VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED]: 503,
  [VOICE_ERROR_CODES.LANGUAGE_NOT_SUPPORTED]: 400,
  [VOICE_ERROR_CODES.PROVIDER_UNAVAILABLE]: 503,
  [VOICE_ERROR_CODES.PROVIDER_TIMEOUT]: 504,
  [VOICE_ERROR_CODES.QUOTA_EXCEEDED]: 429,
  [VOICE_ERROR_CODES.RATE_LIMITED]: 429,
  [VOICE_ERROR_CODES.SYNTHESIS_FAILED]: 502,
  [VOICE_ERROR_CODES.INVALID_FORMAT]: 400,
  [VOICE_ERROR_CODES.INVALID_INPUT]: 400,
  [VOICE_ERROR_CODES.CACHE_ERROR]: 500,
});

export class VoiceError extends Error {
  /**
   * @param {string} code
   * @param {string} [detail]
   * @param {{ retryable?: boolean, meta?: Record<string, unknown> }} [opts]
   */
  constructor(code, detail, opts = {}) {
    super(USER_MESSAGES[code] || detail || 'Voice error');
    this.name = 'VoiceError';
    this.code = code;
    this.detail = detail || null;
    this.retryable = Boolean(opts.retryable);
    this.meta = opts.meta || undefined;
    this.status = HTTP_STATUS[code] ?? 500;
  }
}

/**
 * @param {string} code
 */
export function userMessageForVoiceError(code) {
  return USER_MESSAGES[code] || USER_MESSAGES[VOICE_ERROR_CODES.SYNTHESIS_FAILED];
}

/**
 * @param {string} code
 */
export function httpStatusForVoiceError(code) {
  return HTTP_STATUS[code] ?? 500;
}

/**
 * Map provider/network failures into normalized VoiceError codes.
 * @param {unknown} err
 * @param {{ timeoutMs?: number }} [ctx]
 */
export function normalizeProviderError(err, ctx = {}) {
  if (err instanceof VoiceError) return err;

  const message = String(err?.message || err || '');
  const status = Number(err?.status || err?.statusCode || 0);
  const lower = message.toLowerCase();

  if (
    err?.name === 'AbortError' ||
    lower.includes('aborted') ||
    lower.includes('timeout') ||
    lower.includes('timed out')
  ) {
    return new VoiceError(VOICE_ERROR_CODES.PROVIDER_TIMEOUT, message, {
      retryable: true,
      meta: { timeoutMs: ctx.timeoutMs },
    });
  }

  if (status === 401 || status === 403) {
    return new VoiceError(VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED, 'provider_auth_failed');
  }

  if (status === 429 || lower.includes('quota') || lower.includes('rate limit')) {
    const quota =
      lower.includes('quota') || lower.includes('credit') || lower.includes('billing');
    return new VoiceError(
      quota ? VOICE_ERROR_CODES.QUOTA_EXCEEDED : VOICE_ERROR_CODES.RATE_LIMITED,
      message,
      { retryable: !quota },
    );
  }

  if (status >= 500) {
    return new VoiceError(VOICE_ERROR_CODES.PROVIDER_UNAVAILABLE, message, {
      retryable: true,
    });
  }

  return new VoiceError(VOICE_ERROR_CODES.SYNTHESIS_FAILED, message);
}
