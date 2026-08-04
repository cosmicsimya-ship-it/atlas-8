// ═══════════════════════════════════════════════════════════════════════
// Response Guard — sanitize outbound replies before Telegram / Web / API
// ═══════════════════════════════════════════════════════════════════════

import { SAFE_RESPONSES, safeResponseForRequestType } from './privacy-policy.js';
import { getApprovedPublicFields, loadFounderPublicProfile } from './founder-privacy.js';
import { logPrivacyEvent } from './privacy-logger.js';
import { canAccessFounderPrivateData } from './authorization.js';

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?:\+|00)?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g;
const TOKEN_RE =
  /\b(sk-[a-zA-Z0-9]{10,}|Bearer\s+[A-Za-z0-9._\-]+|OPENAI_API_KEY|ATLAS_FOUNDER_[A-Z_]+|process\.env\.[A-Z0-9_]+)\b/gi;
const MEMORY_JSON_RE =
  /\{\s*"users"\s*:|"profile"\s*:\s*\{[^}]{0,200}"birthDate"|"ownerUserId"\s*:/i;
const INTERNAL_PATH_RE =
  /\b(user_memory\.json|founder_public_profile\.json|knowledge\/founders|data\/privacy_events|server\/privacy)\b/i;
const INTERNAL_ID_RE = /\b(telegram:\d{5,}|web:[a-zA-Z0-9_-]{8,})\b/g;

/** Patterns that strongly suggest private founder leakage */
const PRIVATE_LEAK_PHRASES = [
  /\blara'?n[ıi]n\s+do[gğ]um\s+tarih/i,
  /\bdo[gğ]um\s+tarihi\s*:\s*\d/i,
  /\bevl[iy].*lara|lara.*evl[iy]/i,
  /\bçocuklar[ıi]\s+var/i,
  /\bsa[gğ]l[ıi]k\s+sorun/i,
  /\bhaf[ıi]za\s+kayd[ıi]/i,
  /\buser_memory\b/i,
  /\blinkedUserIds\b/i,
  /\bfounderNotes\b/i,
  /\bcommunicationPreferences\b/i,
];

/**
 * Structured + textual scan of a generated reply.
 * @param {string} reply
 * @param {{
 *   requesterContext?: import('./authorization.js').RequesterContext,
 *   evaluation?: { requestType?: string, authorized?: boolean }|null,
 *   channel?: string,
 *   knownSecrets?: string[],
 * }} [options]
 * @returns {{
 *   safe: boolean,
 *   reply: string,
 *   blocked: boolean,
 *   reasons: string[],
 * }}
 */
export function sanitizeFounderResponse(reply, options = {}) {
  const text = typeof reply === 'string' ? reply : String(reply ?? '');
  const authorized = canAccessFounderPrivateData(options.requesterContext);
  const reasons = [];

  if (authorized) {
    // Still strip credentials / env vars even for owner.
    let cleaned = text.replace(TOKEN_RE, '[REDACTED]');
    if (Array.isArray(options.knownSecrets)) {
      for (const secret of options.knownSecrets) {
        if (secret && text.includes(secret)) {
          cleaned = cleaned.split(secret).join('[REDACTED]');
          reasons.push('secret_redacted');
        }
      }
    }
    return { safe: true, reply: cleaned, blocked: false, reasons };
  }

  if (EMAIL_RE.test(text)) reasons.push('email');
  EMAIL_RE.lastIndex = 0;
  if (PHONE_RE.test(text)) reasons.push('phone');
  PHONE_RE.lastIndex = 0;
  if (TOKEN_RE.test(text)) reasons.push('token_or_env');
  TOKEN_RE.lastIndex = 0;
  if (MEMORY_JSON_RE.test(text)) reasons.push('raw_memory_json');
  if (INTERNAL_PATH_RE.test(text)) reasons.push('internal_path');
  if (INTERNAL_ID_RE.test(text)) reasons.push('internal_id');
  INTERNAL_ID_RE.lastIndex = 0;

  for (const p of PRIVATE_LEAK_PHRASES) {
    if (p.test(text)) {
      reasons.push('private_founder_phrase');
      break;
    }
  }

  // Birth-date shaped values near Lara mention
  if (/\blara\b/i.test(text) && /\b(19|20)\d{2}[-./]\d{1,2}[-./]\d{1,2}\b/.test(text)) {
    reasons.push('possible_birth_date');
  }

  // Address-like lines with Lara
  if (/\blara\b/i.test(text) && /\b(mah(alle)?|sokak|cadde|apartman|no:\s*\d+)\b/i.test(text)) {
    reasons.push('possible_address');
  }

  if (reasons.length === 0) {
    return { safe: true, reply: text, blocked: false, reasons };
  }

  const requestType = options.evaluation?.requestType ?? 'private_data';
  const safeReply = safeResponseForRequestType(
    requestType === 'public_profile' ? 'private_data' : requestType,
  );

  try {
    logPrivacyEvent({
      channel: options.channel ?? 'api',
      requesterId: options.requesterContext?.userId ?? null,
      eventType: 'founder_private_data_leak_blocked',
      action: 'blocked',
      requestType,
      reason: reasons.join(','),
    });
  } catch {
    // never crash
  }

  return {
    safe: false,
    reply: safeReply || SAFE_RESPONSES.PRIVACY,
    blocked: true,
    reasons,
  };
}

/**
 * Guard any outbound Atlas reply (all channels).
 * @param {string} reply
 * @param {Parameters<typeof sanitizeFounderResponse>[1]} options
 */
export function guardOutboundReply(reply, options = {}) {
  return sanitizeFounderResponse(reply, options);
}

/**
 * Ensure public founder response does not accidentally include non-allowed fields.
 * @param {string} reply
 */
export function assertReplyUsesOnlyPublicFounderFacts(reply) {
  const fields = getApprovedPublicFields();
  loadFounderPublicProfile();
  // Soft check — used by tests; runtime uses sanitizeFounderResponse.
  const text = reply ?? '';
  const leakedInternal =
    /founderNotes|linkedUserIds|communicationPreferences|decisionAuthority/i.test(text);
  return !leakedInternal && Boolean(fields.displayName);
}
