/**
 * ATLAS LIVE HTTP API — request validation.
 * No presenter logic. Input sanitization only.
 */

export const SUPPORTED_LOCALES = Object.freeze(['en', 'tr']);
export const ALLOWED_VOICE_MODES = Object.freeze(['text-only']);
export const ALLOWED_CREATE_FIELDS = Object.freeze(['topic', 'language', 'voiceMode', 'metadata']);

export const LIMITS = Object.freeze({
  MAX_TOPIC_LENGTH: 200,
  MAX_METADATA_KEYS: 10,
  MAX_METADATA_VALUE_LENGTH: 500,
  MAX_METADATA_JSON_BYTES: 2048,
});

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * @param {unknown} body
 * @returns {{ ok: true, value: { topic: string, language: string, voiceMode: string, metadata: object } } | { ok: false, code: string, message: string }}
 */
export function validateCreateSessionBody(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'INVALID_INPUT', message: 'Request body must be a JSON object.' };
  }

  const keys = Object.keys(body);
  const unknown = keys.filter((k) => !ALLOWED_CREATE_FIELDS.includes(k));
  if (unknown.length) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: `Unknown fields are not allowed: ${unknown.join(', ')}`,
    };
  }

  if ('sessionId' in body) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: 'sessionId must not be supplied by the client.',
    };
  }

  const topic = body.topic;
  if (typeof topic !== 'string' || !topic.trim()) {
    return { ok: false, code: 'INVALID_INPUT', message: 'topic is required and must be a non-empty string.' };
  }
  const trimmedTopic = topic.trim();
  if (trimmedTopic.length > LIMITS.MAX_TOPIC_LENGTH) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: `topic must be at most ${LIMITS.MAX_TOPIC_LENGTH} characters.`,
    };
  }

  const language = body.language ?? 'en';
  if (typeof language !== 'string' || !SUPPORTED_LOCALES.includes(language)) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: `language must be one of: ${SUPPORTED_LOCALES.join(', ')}`,
    };
  }

  const voiceMode = body.voiceMode ?? 'text-only';
  if (typeof voiceMode !== 'string' || !ALLOWED_VOICE_MODES.includes(voiceMode)) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: `voiceMode must be one of: ${ALLOWED_VOICE_MODES.join(', ')}`,
    };
  }

  const metadataResult = sanitizeMetadata(body.metadata ?? {});
  if (!metadataResult.ok) {
    return metadataResult;
  }

  return {
    ok: true,
    value: {
      topic: trimmedTopic,
      language,
      voiceMode,
      metadata: metadataResult.value,
    },
  };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: object } | { ok: false, code: string, message: string }}
 */
export function sanitizeMetadata(raw) {
  if (raw == null) return { ok: true, value: {} };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, code: 'INVALID_INPUT', message: 'metadata must be a plain JSON object.' };
  }

  let serialized;
  try {
    serialized = JSON.stringify(raw);
  } catch {
    return { ok: false, code: 'INVALID_INPUT', message: 'metadata is not serializable.' };
  }

  if (serialized.length > LIMITS.MAX_METADATA_JSON_BYTES) {
    return { ok: false, code: 'INVALID_INPUT', message: 'metadata payload is too large.' };
  }

  const keys = Object.keys(raw);
  if (keys.length > LIMITS.MAX_METADATA_KEYS) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: `metadata may contain at most ${LIMITS.MAX_METADATA_KEYS} keys.`,
    };
  }

  /** @type {Record<string, string|number|boolean|null>} */
  const clean = {};
  for (const key of keys) {
    if (DANGEROUS_KEYS.has(key)) {
      return { ok: false, code: 'INVALID_INPUT', message: 'metadata contains disallowed keys.' };
    }
    const value = raw[key];
    const t = typeof value;
    if (value !== null && t !== 'string' && t !== 'number' && t !== 'boolean') {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: 'metadata values must be string, number, boolean, or null.',
      };
    }
    if (t === 'string' && value.length > LIMITS.MAX_METADATA_VALUE_LENGTH) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: `metadata string values must be at most ${LIMITS.MAX_METADATA_VALUE_LENGTH} characters.`,
      };
    }
    clean[key] = value;
  }

  return { ok: true, value: clean };
}

/**
 * @param {string} sessionId
 * @returns {boolean}
 */
export function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && /^web_[a-zA-Z0-9_]+$/.test(sessionId);
}

/**
 * @param {unknown} raw
 * @param {{ max?: number, defaultLimit?: number }} [opts]
 */
export function parseEventsQuery(raw, opts = {}) {
  const max = opts.max ?? 100;
  const defaultLimit = opts.defaultLimit ?? 50;
  const out = { sinceSequence: undefined, limit: defaultLimit };

  if (raw.afterSequence != null) {
    const n = Number(raw.afterSequence);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, code: 'INVALID_INPUT', message: 'afterSequence must be a non-negative number.' };
    }
    out.sinceSequence = Math.floor(n);
  }

  if (raw.limit != null) {
    const n = Number(raw.limit);
    if (!Number.isFinite(n) || n < 1) {
      return { ok: false, code: 'INVALID_INPUT', message: 'limit must be a positive number.' };
    }
    out.limit = Math.min(Math.floor(n), max);
  }

  return { ok: true, value: out };
}
