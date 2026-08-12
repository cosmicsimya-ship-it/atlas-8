/**
 * Central speech synthesis service — provider-independent.
 */

import {
  SUPPORTED_FORMATS,
  SUPPORTED_LANGUAGES,
  SYNTHESIS_SETTINGS_VERSION,
  getVoiceConfig,
} from './config.js';
import { VOICE_ERROR_CODES, VoiceError } from './errors.js';
import { buildCacheKey, readCache, writeCache } from './cache.js';
import { assertWithinQuota, recordUsage } from './usage.js';
import {
  getDefaultVoice,
  getVoice,
  isVoiceConfigured,
  resolveProviderVoiceId,
  voiceSupportsLanguage,
} from './registry.js';
import { createVoiceProvider } from './providers/index.js';

/**
 * @param {unknown} language
 */
export function normalizeLanguage(language) {
  const raw = String(language || '').trim();
  if (!raw) return null;
  if (SUPPORTED_LANGUAGES.includes(raw)) return raw;
  const lower = raw.toLowerCase();
  if (lower === 'tr' || lower === 'tr-tr') return 'tr-TR';
  if (lower === 'en' || lower === 'en-us') return 'en-US';
  if (lower === 'en-gb' || lower === 'en-uk') return 'en-GB';
  return null;
}

/**
 * @param {{
 *   text: unknown,
 *   voiceId?: unknown,
 *   voice?: unknown,
 *   language?: unknown,
 *   format?: unknown,
 *   speed?: unknown,
 *   userKey?: string,
 *   signal?: AbortSignal,
 *   skipCache?: boolean,
 *   providerOverride?: import('./providers/index.js').VoiceProvider|null,
 * }} input
 */
export async function synthesizeSpeech(input = {}) {
  const cfg = getVoiceConfig();
  const started = Date.now();

  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text) {
    throw new VoiceError(VOICE_ERROR_CODES.EMPTY_TEXT);
  }
  if (text.length > cfg.maxTextLength) {
    throw new VoiceError(VOICE_ERROR_CODES.TEXT_TOO_LONG, null, {
      meta: { max: cfg.maxTextLength, length: text.length },
    });
  }

  const language = normalizeLanguage(input.language ?? cfg.defaultLanguage);
  if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
    throw new VoiceError(VOICE_ERROR_CODES.LANGUAGE_NOT_SUPPORTED, null, {
      meta: { supported: [...SUPPORTED_LANGUAGES] },
    });
  }

  const requestedVoice =
    String(input.voiceId || input.voice || cfg.defaultVoiceId || '').trim() ||
    getDefaultVoice()?.id ||
    'lara';
  const voice = getVoice(requestedVoice);
  if (!voice) {
    throw new VoiceError(VOICE_ERROR_CODES.VOICE_NOT_FOUND);
  }
  if (!voiceSupportsLanguage(voice, language)) {
    throw new VoiceError(VOICE_ERROR_CODES.LANGUAGE_NOT_SUPPORTED, null, {
      meta: { voice: voice.id, languages: voice.languages },
    });
  }

  const formatRaw = String(input.format || cfg.defaultFormat || 'mp3')
    .trim()
    .toLowerCase();
  const format = formatRaw === 'mpeg' ? 'mp3' : formatRaw;
  if (!SUPPORTED_FORMATS[format]) {
    throw new VoiceError(VOICE_ERROR_CODES.INVALID_FORMAT);
  }

  let speed = null;
  if (input.speed != null && input.speed !== '') {
    const n = Number(input.speed);
    if (!Number.isFinite(n) || n < 0.5 || n > 2) {
      throw new VoiceError(VOICE_ERROR_CODES.INVALID_INPUT, 'invalid_speed');
    }
    speed = n;
  }

  const providerId = cfg.providerId;
  const provider =
    input.providerOverride ||
    createVoiceProvider(providerId === 'mock' ? 'mock' : voice.provider || providerId);

  // Mock path is always "configured" for tests.
  const configured =
    provider.id === 'mock' || cfg.dryRun
      ? provider.id === 'mock' || isVoiceConfigured(voice) || cfg.dryRun
      : isVoiceConfigured(voice);

  if (provider.id !== 'mock' && !configured && !cfg.dryRun) {
    // Still check env more precisely for clearer errors
    if (provider.id === 'elevenlabs' && !cfg.elevenlabs.apiKey) {
      throw new VoiceError(VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED, 'api_key_missing');
    }
    if (provider.id === 'openai' && !cfg.openai.apiKey) {
      throw new VoiceError(VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED, 'api_key_missing');
    }
    const providerVoiceId = resolveProviderVoiceId(voice, language);
    if (!providerVoiceId) {
      throw new VoiceError(VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED, 'provider_voice_id_missing');
    }
  }

  const providerVoiceId =
    resolveProviderVoiceId(voice, language) ||
    (provider.id === 'mock' ? 'mock-lara' : null);

  if (provider.id !== 'mock' && !providerVoiceId && !cfg.dryRun) {
    throw new VoiceError(VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED, 'provider_voice_id_missing');
  }

  const model =
    provider.id === 'elevenlabs'
      ? cfg.elevenlabs.modelId
      : provider.id === 'openai'
        ? cfg.openai.model
        : 'mock';

  assertWithinQuota({
    userKey: input.userKey || 'anonymous',
    charCount: text.length,
  });

  const cacheKey = buildCacheKey({
    text,
    voice: voice.id,
    language,
    provider: provider.id,
    model,
    format,
    speed,
    settingsVersion: SYNTHESIS_SETTINGS_VERSION,
  });

  if (!input.skipCache) {
    const cached = readCache(cacheKey);
    if (cached.hit && cached.audioBuffer) {
      recordUsage({
        userKey: input.userKey,
        provider: provider.id,
        model,
        voice: voice.id,
        language,
        charCount: text.length,
        success: true,
        latencyMs: Date.now() - started,
        cacheHit: true,
      });
      return {
        ok: true,
        audioBuffer: cached.audioBuffer,
        mimeType: cached.mimeType || SUPPORTED_FORMATS[format].mimeType,
        format: cached.format || format,
        voice: voice.id,
        language,
        provider: provider.id,
        cached: true,
        meta: {
          cacheHit: true,
          settingsVersion: SYNTHESIS_SETTINGS_VERSION,
        },
      };
    }
  }

  // Dry-run without mock: refuse paid call with voice_not_configured style signal
  if (cfg.dryRun && provider.id !== 'mock') {
    recordUsage({
      userKey: input.userKey,
      provider: provider.id,
      model,
      voice: voice.id,
      language,
      charCount: text.length,
      success: false,
      latencyMs: Date.now() - started,
      errorCode: VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED,
      cacheHit: false,
    });
    throw new VoiceError(VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED, 'dry_run');
  }

  const result = await provider.synthesize({
    text,
    language,
    providerVoiceId: providerVoiceId || 'mock-lara',
    format,
    speed: speed ?? undefined,
    signal: input.signal,
  });

  if (!result.ok || !result.audioBuffer) {
    const code = result.error || VOICE_ERROR_CODES.SYNTHESIS_FAILED;
    recordUsage({
      userKey: input.userKey,
      provider: provider.id,
      model,
      voice: voice.id,
      language,
      charCount: text.length,
      success: false,
      latencyMs: Date.now() - started,
      errorCode: code,
      cacheHit: false,
    });
    throw new VoiceError(code, result.meta?.reason);
  }

  writeCache(cacheKey, {
    audioBuffer: result.audioBuffer,
    mimeType: result.mimeType || SUPPORTED_FORMATS[format].mimeType,
    format: result.format || format,
    provider: provider.id,
    voice: voice.id,
    language,
    model,
    charCount: text.length,
  });

  recordUsage({
    userKey: input.userKey,
    provider: provider.id,
    model,
    voice: voice.id,
    language,
    charCount: text.length,
    success: true,
    latencyMs: Date.now() - started,
    cacheHit: false,
  });

  return {
    ok: true,
    audioBuffer: result.audioBuffer,
    mimeType: result.mimeType || SUPPORTED_FORMATS[format].mimeType,
    format: result.format || format,
    voice: voice.id,
    language,
    provider: provider.id,
    cached: false,
    durationMs: result.durationMs,
    meta: {
      ...(result.meta || {}),
      settingsVersion: SYNTHESIS_SETTINGS_VERSION,
      cacheHit: false,
    },
  };
}
