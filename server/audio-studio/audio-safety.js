/**
 * Audio Studio safety — consent, cloning blocks, path traversal, ownership.
 */

import { basename, normalize, resolve, sep } from 'path';
import { AUDIO_ERROR_CODES, AudioStudioError } from './audio-errors.js';

const CLONE_CUES =
  /ses(?:imi|ini)?\s+klon|voice\s+clon|taklit\s+et|[uü]nl[uü].{0,40}ses|ba[sş]kas[ıi]n[ıi]n\s+sesi|deepfake|sesini\s+kopyala/i;

const PUBLIC_SHARE_CUES = /herkese\s+a[cç]|public\s+share|yay[ıi]nla\s+payla[sş]/i;

/**
 * @param {string} userText
 */
export function evaluateAudioSafety(userText) {
  const text = String(userText || '');
  const blocks = [];
  const requiresConsent = [];

  if (CLONE_CUES.test(text)) {
    blocks.push({
      code: AUDIO_ERROR_CODES.SAFETY_BLOCKED,
      reason: 'voice_cloning_or_impersonation',
      message:
        'Başka bir kişinin sesini taklit etme veya ses klonlama taleplerini otomatik kabul etmem. Kendi kaydın üzerinde çalışmak farklıdır; klonlama için ayrı güvenlik onayı gerekir ve şu an aktif değildir.',
    });
  }

  if (PUBLIC_SHARE_CUES.test(text)) {
    requiresConsent.push('public_share');
  }

  return {
    blocked: blocks.length > 0,
    blocks,
    requiresConsent,
  };
}

/**
 * Ensure a path stays under a root directory (no traversal).
 * @param {string} rootDir
 * @param {string} candidatePath
 */
export function assertSafePath(rootDir, candidatePath) {
  const root = resolve(rootDir);
  const target = resolve(root, candidatePath);
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (target !== root && !target.startsWith(prefix)) {
    throw new AudioStudioError(AUDIO_ERROR_CODES.PATH_TRAVERSAL, 'Path traversal blocked');
  }
  return target;
}

/**
 * Sanitize a user-supplied filename for storage.
 * @param {string} name
 */
export function safeFileName(name) {
  const base = basename(String(name || 'audio.bin')).replace(/[^\w.\-()+ ]+/g, '_');
  const cleaned = base.replace(/\.\.+/g, '.').trim() || 'audio.bin';
  return cleaned.slice(0, 180);
}

/**
 * Ops that require explicit consent before external upload.
 */
export const CONSENT_REQUIRED_OPS = new Set([
  'external_upload',
  'voice_cloning',
  'add_instrumentation',
  'persist_to_memory',
  'public_share',
  'paid_provider',
]);

/**
 * @param {string[]} operations
 * @param {{ externalConsent?: boolean, generationConsent?: boolean }} consents
 */
export function missingConsents(operations, consents = {}) {
  const missing = [];
  for (const op of operations || []) {
    if (op === 'add_instrumentation' && !consents.generationConsent) {
      missing.push('add_instrumentation');
    }
    if (op === 'external_upload' && !consents.externalConsent) {
      missing.push('external_upload');
    }
  }
  return missing;
}

/**
 * Ownership check: job belongs to requester.
 * @param {{ userId?: string|null }} job
 * @param {string|null|undefined} requesterId
 */
export function assertJobAccess(job, requesterId) {
  if (!job) {
    throw new AudioStudioError(AUDIO_ERROR_CODES.JOB_NOT_FOUND);
  }
  if (!requesterId || !job.userId || String(job.userId) !== String(requesterId)) {
    throw new AudioStudioError(AUDIO_ERROR_CODES.UNAUTHORIZED);
  }
  return true;
}

/**
 * Redact secrets from log payloads.
 * @param {object} obj
 */
export function redactForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  const secretKeys = /token|api[_-]?key|authorization|secret|password|url|filePath|localPath|base64/i;
  for (const [k, v] of Object.entries(clone)) {
    if (secretKeys.test(k)) {
      clone[k] = '[redacted]';
    } else if (v && typeof v === 'object') {
      clone[k] = redactForLog(v);
    }
  }
  return clone;
}

export { normalize };
