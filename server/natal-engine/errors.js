/**
 * Controlled natal engine errors (no stack traces in user-facing messages).
 */

export const NatalEngineErrorCode = Object.freeze({
  INVALID_BIRTH_DATE: 'INVALID_BIRTH_DATE',
  INVALID_BIRTH_TIME: 'INVALID_BIRTH_TIME',
  BIRTH_PLACE_REQUIRED: 'BIRTH_PLACE_REQUIRED',
  AMBIGUOUS_BIRTH_PLACE: 'AMBIGUOUS_BIRTH_PLACE',
  LOCATION_RESOLUTION_FAILED: 'LOCATION_RESOLUTION_FAILED',
  TIMEZONE_RESOLUTION_FAILED: 'TIMEZONE_RESOLUTION_FAILED',
  EPHEMERIS_CALCULATION_FAILED: 'EPHEMERIS_CALCULATION_FAILED',
  HOUSE_CALCULATION_REQUIRES_TIME: 'HOUSE_CALCULATION_REQUIRES_TIME',
  UNSUPPORTED_HOUSE_SYSTEM: 'UNSUPPORTED_HOUSE_SYSTEM',
  UNSUPPORTED_ZODIAC_SYSTEM: 'UNSUPPORTED_ZODIAC_SYSTEM',
  UNSUPPORTED_AYANAMSA: 'UNSUPPORTED_AYANAMSA',
});

const USER_MESSAGES = Object.freeze({
  INVALID_BIRTH_DATE: 'Doğum tarihini güvenilir biçimde okuyamadım. Örnek: 27.01.1986 veya 1986-01-27.',
  INVALID_BIRTH_TIME: 'Doğum saatini güvenilir biçimde okuyamadım. Örnek: 18:20.',
  BIRTH_PLACE_REQUIRED:
    'Doğum haritasını güvenilir biçimde hesaplayabilmem için doğum yerini de belirtmelisin.',
  AMBIGUOUS_BIRTH_PLACE:
    'Bu isimde birden fazla konum var. Lütfen ülke veya daha net bir yer adı belirt.',
  LOCATION_RESOLUTION_FAILED:
    'Doğum yerini çözemedim. Bilinen bir şehir adı veya enlem/boylam paylaşır mısın?',
  TIMEZONE_RESOLUTION_FAILED:
    'Doğum anı için zaman dilimini çözemedim. Saat dilimi (ör. Europe/Istanbul) ekleyebilirsin.',
  EPHEMERIS_CALCULATION_FAILED: 'Gök cisimi konumlarını hesaplarken bir sorun oluştu. Lütfen tekrar dene.',
  HOUSE_CALCULATION_REQUIRES_TIME:
    'Yükselen ve evler için kesin doğum saati gerekir; saat bilinmeden tahmin etmem.',
  UNSUPPORTED_HOUSE_SYSTEM: 'İstenen ev sistemi şu an desteklenmiyor.',
  UNSUPPORTED_ZODIAC_SYSTEM: 'İstenen zodyak sistemi şu an desteklenmiyor.',
  UNSUPPORTED_AYANAMSA: 'İstenen ayanamsa şu an desteklenmiyor.',
});

export class NatalEngineError extends Error {
  /**
   * @param {string} code
   * @param {string} [detail]
   * @param {object} [meta]
   */
  constructor(code, detail = '', meta = {}) {
    const userMessage = USER_MESSAGES[code] || 'Natal hesaplama yapılamadı.';
    super(userMessage);
    this.name = 'NatalEngineError';
    this.code = code;
    this.userMessage = userMessage;
    this.detail = detail;
    this.meta = meta;
  }

  toJSON() {
    return {
      ok: false,
      errorCode: this.code,
      message: this.userMessage,
      detail: this.detail || undefined,
      meta: this.meta && Object.keys(this.meta).length ? this.meta : undefined,
    };
  }
}

/**
 * @param {string} code
 * @param {string} [detail]
 * @param {object} [meta]
 */
export function natalError(code, detail, meta) {
  return new NatalEngineError(code, detail, meta);
}
