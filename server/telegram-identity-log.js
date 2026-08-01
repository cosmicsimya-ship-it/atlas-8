// ═══════════════════════════════════════════════════════════════════════
// Telegram identity logging — PII-safe founder match diagnostics
// ═══════════════════════════════════════════════════════════════════════

import { createHmac } from 'crypto';
import { isIdentityDebugEnabled } from './founder-identity.js';

export const FOUNDER_NOT_MATCHED_REASON = 'FOUNDER_NOT_LINKED';

/**
 * Secret-keyed HMAC truncation for optional ops correlation.
 * Never logs the raw Telegram numeric id.
 * @param {string|number|null|undefined} telegramFromId
 * @param {{ secret?: string|null }} [options]
 * @returns {string|null}
 */
export function buildTelegramIdentityCorrelationId(telegramFromId, options = {}) {
  const id = telegramFromId == null ? '' : String(telegramFromId).trim();
  if (!id) return null;
  const secret =
    options.secret ??
    process.env.ATLAS_IDENTITY_LOG_HMAC_SECRET ??
    process.env.TELEGRAM_BOT_TOKEN ??
    '';
  if (!secret) return null;
  return createHmac('sha256', String(secret))
    .update(`telegram:${id}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Structured, PII-safe founder-not-matched log fields.
 * @param {{
 *   founderMatched?: boolean,
 *   memoryLoaded?: boolean,
 *   correlationId?: string|null,
 *   reasonCode?: string,
 *   updateId?: string|number|null,
 * }} [input]
 */
export function buildFounderNotMatchedLogFields(input = {}) {
  /** @type {Record<string, string|boolean|number>} */
  const fields = {
    channel: 'telegram',
    founderMatched: input.founderMatched === true,
    reasonCode: input.reasonCode ?? FOUNDER_NOT_MATCHED_REASON,
    resultStatus: 'founder_not_linked',
    memoryLoaded: Boolean(input.memoryLoaded),
  };
  if (input.correlationId) {
    fields.correlationId = String(input.correlationId);
  }
  if (input.updateId != null && String(input.updateId).trim()) {
    fields.updateId = String(input.updateId).trim();
  }
  return fields;
}

/**
 * Format a single-line warn without raw from.id / chat.id / names.
 * @param {ReturnType<typeof buildFounderNotMatchedLogFields>} fields
 */
export function formatFounderNotMatchedWarn(fields) {
  const parts = Object.entries(fields).map(([k, v]) => `${k}=${v}`);
  return `[Telegram] Founder not matched | ${parts.join(' | ')}`;
}

/**
 * @param {{
 *   memoryLoaded?: boolean,
 *   telegramFromId?: string|number|null,
 *   updateId?: string|number|null,
 *   hmacSecret?: string|null,
 * }} input
 * @param {{ warn?: (...args: unknown[]) => void }} [logger]
 */
export function logFounderNotMatchedSafe(input = {}, logger = console) {
  const correlationId = buildTelegramIdentityCorrelationId(input.telegramFromId, {
    secret: input.hmacSecret,
  });
  const fields = buildFounderNotMatchedLogFields({
    founderMatched: false,
    memoryLoaded: input.memoryLoaded,
    correlationId,
    updateId: input.updateId,
  });
  const line = formatFounderNotMatchedWarn(fields);
  const warn = typeof logger.warn === 'function' ? logger.warn.bind(logger) : console.warn;
  warn(line);
  return { fields, line };
}

/**
 * One-time founder setup hint — never prints raw Telegram identity.
 * Only when ATLAS_IDENTITY_DEBUG is enabled.
 * @param {{ warn?: (...args: unknown[]) => void, log?: (...args: unknown[]) => void }} [logger]
 */
export function logFounderSetupHintSafe(logger = console) {
  if (!isIdentityDebugEnabled()) return false;
  const log = typeof logger.log === 'function' ? logger.log.bind(logger) : console.log;
  log(
    '[Telegram] Founder linkage hint: set ATLAS_FOUNDER_TELEGRAM_IDS in .env to your Telegram numeric user id (from a trusted id lookup tool). Never commit the value; never paste chat ids.',
  );
  return true;
}
