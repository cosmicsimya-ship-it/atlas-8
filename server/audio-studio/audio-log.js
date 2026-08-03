/**
 * Structured audio-studio logging — no secrets, no raw audio, no full PII content.
 */

import { redactForLog } from './audio-safety.js';

/**
 * @param {{
 *   jobId?: string|null,
 *   userId?: string|null,
 *   channel?: string|null,
 *   intent?: string|null,
 *   mediaType?: string|null,
 *   provider?: string|null,
 *   operation?: string|null,
 *   durationMs?: number|null,
 *   status?: string|null,
 *   errorCode?: string|null,
 *   extra?: object,
 * }} entry
 */
export function logAudioEvent(entry) {
  const payload = redactForLog({
    scope: 'audio-studio',
    ts: new Date().toISOString(),
    jobId: entry.jobId || null,
    userId: entry.userId ? String(entry.userId).slice(0, 64) : null,
    channel: entry.channel || null,
    intent: entry.intent || null,
    mediaType: entry.mediaType || null,
    provider: entry.provider || null,
    operation: entry.operation || null,
    durationMs: entry.durationMs ?? null,
    status: entry.status || null,
    errorCode: entry.errorCode || null,
    ...(entry.extra || {}),
  });
  console.log('[AudioStudio]', JSON.stringify(payload));
}
