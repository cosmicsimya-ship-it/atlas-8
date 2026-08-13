/**
 * Image attachment validation for Lara Prime image analysis.
 * Entitlement check (image.analysis) happens at the call site via
 * requireCapability; this module only validates the attachment itself.
 */

export const ALLOWED_IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/** Decoded byte ceiling — keeps model-input cost and abuse risk bounded. */
export function getMaxImageBytes() {
  const raw = Number(process.env.ATLAS_IMAGE_MAX_BYTES || 6_000_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 6_000_000;
}

/**
 * @param {{ mimeType?: string, base64?: string }} image
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function validateImageAttachment(image) {
  if (!image || typeof image !== 'object') {
    return { ok: false, code: 'invalid_input', message: 'Görsel eksik.' };
  }

  const mimeType = String(image.mimeType || '').toLowerCase().split(';')[0];
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    return {
      ok: false,
      code: 'unsupported_image_type',
      message: 'Yalnızca JPG, PNG veya WEBP görseller desteklenir.',
    };
  }

  const base64 = typeof image.base64 === 'string' ? image.base64.trim() : '';
  if (!base64) {
    return { ok: false, code: 'invalid_input', message: 'Görsel verisi boş.' };
  }

  // Reject obvious non-base64 payloads early (cheap check before size math).
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64.replace(/^data:[^,]+,/, ''))) {
    return { ok: false, code: 'invalid_input', message: 'Görsel verisi geçersiz.' };
  }

  // base64 -> byte estimate without full decode (3 bytes per 4 chars, minus padding).
  const cleaned = base64.replace(/^data:[^,]+,/, '');
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  const decodedBytes = Math.floor((cleaned.length * 3) / 4) - padding;

  const maxBytes = getMaxImageBytes();
  if (decodedBytes > maxBytes) {
    return {
      ok: false,
      code: 'image_too_large',
      message: `Görsel çok büyük (maks. ${Math.round(maxBytes / 1_000_000)}MB).`,
    };
  }

  return { ok: true };
}
