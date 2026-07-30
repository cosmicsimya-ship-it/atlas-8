/**
 * ATLAS LIVE HTTP API — response helpers.
 */

import { WEB_ADAPTER_ERROR_CODES } from '../adapters/web-session-schema.js';

export const HTTP_API_ERROR_CODES = Object.freeze({
  INVALID_INPUT: 'INVALID_INPUT',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_FORBIDDEN: 'SESSION_FORBIDDEN',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  SESSION_ALREADY_STOPPED: 'SESSION_ALREADY_STOPPED',
  ENGINE_START_FAILED: 'ENGINE_START_FAILED',
  TICK_FAILED: 'TICK_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

const USER_MESSAGES = Object.freeze({
  [HTTP_API_ERROR_CODES.INVALID_INPUT]: 'Geçersiz istek.',
  [HTTP_API_ERROR_CODES.SESSION_NOT_FOUND]: 'Atlas Live session bulunamadı.',
  [HTTP_API_ERROR_CODES.SESSION_FORBIDDEN]: 'Bu session için erişim izniniz yok.',
  [HTTP_API_ERROR_CODES.INVALID_STATE_TRANSITION]: 'Geçersiz session durumu.',
  [HTTP_API_ERROR_CODES.SESSION_ALREADY_STOPPED]: 'Session zaten durdurulmuş.',
  [HTTP_API_ERROR_CODES.ENGINE_START_FAILED]: 'Atlas Live oturumu başlatılamadı.',
  [HTTP_API_ERROR_CODES.TICK_FAILED]: 'Presenter tick üretilemedi.',
  [HTTP_API_ERROR_CODES.INTERNAL_ERROR]: 'Beklenmeyen bir sunucu hatası oluştu.',
});

/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {*} data
 */
export function sendOk(res, status, data) {
  return res.status(status).json({ ok: true, data, error: null });
}

/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} code
 * @param {string} [message]
 */
export function sendError(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    data: null,
    error: {
      code,
      message: message ?? USER_MESSAGES[code] ?? 'İşlem başarısız.',
    },
  });
}

/**
 * Map adapter error codes to HTTP status.
 * @param {string} code
 */
export function httpStatusForAdapterCode(code) {
  switch (code) {
    case WEB_ADAPTER_ERROR_CODES.SESSION_NOT_FOUND:
      return 404;
    case WEB_ADAPTER_ERROR_CODES.INVALID_STATE_TRANSITION:
    case WEB_ADAPTER_ERROR_CODES.SESSION_ALREADY_STOPPED:
      return 409;
    case WEB_ADAPTER_ERROR_CODES.ENGINE_START_FAILED:
    case WEB_ADAPTER_ERROR_CODES.TICK_FAILED:
    case WEB_ADAPTER_ERROR_CODES.EVENT_NORMALIZATION_FAILED:
      return 500;
    default:
      return 500;
  }
}

/**
 * @param {import('express').Response} res
 * @param {Error & { code?: string }} err
 */
export function sendAdapterError(res, err) {
  const code = err?.code ?? HTTP_API_ERROR_CODES.INTERNAL_ERROR;
  const status = httpStatusForAdapterCode(code);
  const message =
    code === HTTP_API_ERROR_CODES.INTERNAL_ERROR
      ? USER_MESSAGES.INTERNAL_ERROR
      : USER_MESSAGES[code] ?? err?.message ?? USER_MESSAGES.INTERNAL_ERROR;
  return sendError(res, status, code, message);
}

/**
 * @param {object} session
 * @param {string} userId
 * @returns {boolean}
 */
export function isSessionOwner(session, userId) {
  const owner = session?.metadata?.ownerUserId;
  if (!owner) return true;
  return owner === userId;
}
