/**
 * Audio Studio — structured error codes and user-facing messages.
 * Never expose stack traces to the user.
 */

export const AUDIO_ERROR_CODES = Object.freeze({
  FILE_DOWNLOAD_FAILED: 'FILE_DOWNLOAD_FAILED',
  FILE_CORRUPT: 'FILE_CORRUPT',
  FORMAT_UNSUPPORTED: 'FORMAT_UNSUPPORTED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  DURATION_TOO_LONG: 'DURATION_TOO_LONG',
  NO_AUDIO_STREAM: 'NO_AUDIO_STREAM',
  PROVIDER_NOT_CONFIGURED: 'PROVIDER_NOT_CONFIGURED',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_QUOTA: 'PROVIDER_QUOTA',
  PROCESSING_INTERRUPTED: 'PROCESSING_INTERRUPTED',
  DISK_FULL: 'DISK_FULL',
  FFMPEG_NOT_FOUND: 'FFMPEG_NOT_FOUND',
  FFPROBE_NOT_FOUND: 'FFPROBE_NOT_FOUND',
  OUTPUT_FAILED: 'OUTPUT_FAILED',
  OUTPUT_VALIDATION_FAILED: 'OUTPUT_VALIDATION_FAILED',
  JOB_CANCELLED: 'JOB_CANCELLED',
  DUPLICATE_FILE: 'DUPLICATE_FILE',
  CONTEXT_MISMATCH: 'CONTEXT_MISMATCH',
  CAPABILITY_DISABLED: 'CAPABILITY_DISABLED',
  CONSENT_REQUIRED: 'CONSENT_REQUIRED',
  PATH_TRAVERSAL: 'PATH_TRAVERSAL',
  UNAUTHORIZED: 'UNAUTHORIZED',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  ZERO_BYTE_FILE: 'ZERO_BYTE_FILE',
  MIME_MISMATCH: 'MIME_MISMATCH',
  SAFETY_BLOCKED: 'SAFETY_BLOCKED',
});

const USER_MESSAGES = Object.freeze({
  [AUDIO_ERROR_CODES.FILE_DOWNLOAD_FAILED]:
    'Dosyayı indiremedim. Biraz sonra tekrar göndermeyi dener misin?',
  [AUDIO_ERROR_CODES.FILE_CORRUPT]:
    'Dosyayı aldım ancak ses akışını okuyamadım. Dosya bozuk olabilir veya codec desteklenmiyor olabilir. WAV, MP3 ya da M4A olarak yeniden göndermen gerekir.',
  [AUDIO_ERROR_CODES.FORMAT_UNSUPPORTED]:
    'Bu format şu anda desteklenmiyor. WAV, MP3, M4A, AAC, OGG, OPUS veya FLAC deneyebilirsin.',
  [AUDIO_ERROR_CODES.FILE_TOO_LARGE]:
    'Dosya boyutu limitin üzerinde. Daha kısa veya daha düşük bitrate’li bir kayıt göndermeyi dene.',
  [AUDIO_ERROR_CODES.DURATION_TOO_LONG]:
    'Kayıt süresi limitin üzerinde. Daha kısa bir bölüm göndermen gerekir.',
  [AUDIO_ERROR_CODES.NO_AUDIO_STREAM]:
    'Dosyada işlenebilir bir ses kanalı bulamadım.',
  [AUDIO_ERROR_CODES.PROVIDER_NOT_CONFIGURED]:
    'Bu işlem için gerekli ses işleme entegrasyonu şu anda yapılandırılmamış.',
  [AUDIO_ERROR_CODES.PROVIDER_TIMEOUT]:
    'Haricî ses servisi zaman aşımına uğradı. İşlem tamamlanamadı.',
  [AUDIO_ERROR_CODES.PROVIDER_QUOTA]:
    'Haricî ses servisinin kotası dolmuş görünüyor. Şu an bu adımı tamamlayamıyorum.',
  [AUDIO_ERROR_CODES.PROCESSING_INTERRUPTED]:
    'İşlem yarıda kesildi. İstersen kaldığı yerden yeniden deneyebiliriz.',
  [AUDIO_ERROR_CODES.DISK_FULL]:
    'Sunucuda yeterli disk alanı yok; dosyayı şu an saklayamıyorum.',
  [AUDIO_ERROR_CODES.FFMPEG_NOT_FOUND]:
    'Teknik analiz için FFmpeg bulunamadı. Metadata incelemesi şu an kullanılamıyor.',
  [AUDIO_ERROR_CODES.FFPROBE_NOT_FOUND]:
    'Teknik analiz için ffprobe bulunamadı. Metadata incelemesi şu an kullanılamıyor.',
  [AUDIO_ERROR_CODES.OUTPUT_FAILED]:
    'Çıktı üretilemedi. Orijinal dosyan korunuyor.',
  [AUDIO_ERROR_CODES.OUTPUT_VALIDATION_FAILED]:
    'Üretilen çıktı doğrulamadan geçmedi; bu yüzden teslim etmiyorum.',
  [AUDIO_ERROR_CODES.JOB_CANCELLED]:
    'İş iptal edildi. Devam etmeyecek.',
  [AUDIO_ERROR_CODES.DUPLICATE_FILE]:
    'Bu dosyayı kısa süre önce zaten aldım. Mevcut iş üzerinden devam edebiliriz.',
  [AUDIO_ERROR_CODES.CONTEXT_MISMATCH]:
    'Talimat ile ses dosyasını güvenli biçimde eşleştiremedim. Dosyayı yeniden gönderip ne istediğini kısaca yaz.',
  [AUDIO_ERROR_CODES.CAPABILITY_DISABLED]:
    'Bu ses işlemi şu anda aktif değil.',
  [AUDIO_ERROR_CODES.CONSENT_REQUIRED]:
    'Bu adım haricî bir servise dosya göndermeyi gerektiriyor. Onayın olmadan devam etmem.',
  [AUDIO_ERROR_CODES.PATH_TRAVERSAL]:
    'Dosya yolu geçersiz. İşlem reddedildi.',
  [AUDIO_ERROR_CODES.UNAUTHORIZED]:
    'Bu ses işine erişim yetkin yok.',
  [AUDIO_ERROR_CODES.JOB_NOT_FOUND]:
    'İlgili ses işini bulamadım.',
  [AUDIO_ERROR_CODES.INVALID_INPUT]:
    'Ses isteği geçersiz veya eksik.',
  [AUDIO_ERROR_CODES.ZERO_BYTE_FILE]:
    'Dosya boş görünüyor (0 bayt). Geçerli bir kayıt göndermen gerekir.',
  [AUDIO_ERROR_CODES.MIME_MISMATCH]:
    'Dosya uzantısı ile içerik türü uyuşmuyor. Güvenli formatta (WAV/MP3/M4A) yeniden göndermen gerekir.',
  [AUDIO_ERROR_CODES.SAFETY_BLOCKED]:
    'Bu talep güvenlik politikası nedeniyle işlenemez.',
});

/**
 * @param {string} code
 * @param {string} [detail]
 */
export function userMessageForAudioError(code, detail) {
  const base = USER_MESSAGES[code] || 'Ses işlemi sırasında bir sorun oluştu.';
  if (detail && process.env.ATLAS_AUDIO_DEBUG_ERRORS === '1') {
    return `${base} (${detail})`;
  }
  return base;
}

export class AudioStudioError extends Error {
  /**
   * @param {string} code
   * @param {string} [message]
   * @param {{ cause?: unknown, details?: object }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message || userMessageForAudioError(code));
    this.name = 'AudioStudioError';
    this.code = code;
    this.details = opts.details || null;
    if (opts.cause) this.cause = opts.cause;
  }
}
