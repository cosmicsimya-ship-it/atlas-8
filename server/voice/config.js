/**
 * Voice / TTS runtime configuration.
 * Secrets stay in env — never expose to clients or logs.
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, '..', '..');
export const VOICE_ASSETS_ROOT = join(REPO_ROOT, 'voice-assets');
export const VOICE_SOURCE_DIR = join(VOICE_ASSETS_ROOT, 'source');
export const VOICE_PROCESSED_DIR = join(VOICE_ASSETS_ROOT, 'processed');
export const VOICE_REGISTRY_PATH = join(VOICE_ASSETS_ROOT, 'registry', 'voices.json');
export const VOICE_CACHE_DIR = join(REPO_ROOT, 'data', 'voice-cache');

/** Bump when synthesis defaults change so cache keys invalidate. */
export const SYNTHESIS_SETTINGS_VERSION = 'v1';

export const SUPPORTED_LANGUAGES = Object.freeze(['tr-TR', 'en-US', 'en-GB']);

export const SUPPORTED_FORMATS = Object.freeze({
  mp3: { mimeType: 'audio/mpeg', extension: 'mp3' },
  wav: { mimeType: 'audio/wav', extension: 'wav' },
});

/**
 * @param {string|undefined|null} value
 * @param {boolean} [fallback]
 */
export function envFlag(value, fallback = false) {
  if (value == null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

/**
 * Resolve active TTS provider id from env.
 * Default: elevenlabs (real calls only when credentials exist).
 * Use `mock` for offline/unit tests.
 */
export function getActiveProviderId() {
  const raw = String(process.env.ATLAS_TTS_PROVIDER || 'elevenlabs')
    .trim()
    .toLowerCase();
  if (!raw) return 'elevenlabs';
  return raw;
}

export function getVoiceConfig() {
  const maxTextLength = Number(process.env.ATLAS_TTS_MAX_TEXT_LENGTH || 2_500);
  const timeoutMs = Number(process.env.ATLAS_TTS_TIMEOUT_MS || 30_000);
  const dryRun = envFlag(process.env.ATLAS_TTS_DRY_RUN, false);
  const cacheEnabled = envFlag(process.env.ATLAS_TTS_CACHE_ENABLED, true);
  const cacheTtlMs = Number(process.env.ATLAS_TTS_CACHE_TTL_MS || 7 * 24 * 60 * 60 * 1000);
  const anonymousMaxPerMinute = Number(process.env.ATLAS_TTS_ANON_RATE_MAX || 5);
  const authenticatedMaxPerMinute = Number(process.env.ATLAS_TTS_AUTH_RATE_MAX || 30);
  const dailyCharQuota = Number(process.env.ATLAS_TTS_DAILY_CHAR_QUOTA || 50_000);
  const dailyRequestQuota = Number(process.env.ATLAS_TTS_DAILY_REQUEST_QUOTA || 200);

  return {
    providerId: getActiveProviderId(),
    maxTextLength: Number.isFinite(maxTextLength) && maxTextLength > 0 ? maxTextLength : 2_500,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30_000,
    dryRun,
    cacheEnabled,
    cacheTtlMs: Number.isFinite(cacheTtlMs) && cacheTtlMs > 0 ? cacheTtlMs : 7 * 24 * 60 * 60 * 1000,
    anonymousMaxPerMinute:
      Number.isFinite(anonymousMaxPerMinute) && anonymousMaxPerMinute > 0
        ? anonymousMaxPerMinute
        : 5,
    authenticatedMaxPerMinute:
      Number.isFinite(authenticatedMaxPerMinute) && authenticatedMaxPerMinute > 0
        ? authenticatedMaxPerMinute
        : 30,
    dailyCharQuota:
      Number.isFinite(dailyCharQuota) && dailyCharQuota > 0 ? dailyCharQuota : 50_000,
    dailyRequestQuota:
      Number.isFinite(dailyRequestQuota) && dailyRequestQuota > 0 ? dailyRequestQuota : 200,
    defaultVoiceId: String(process.env.ATLAS_TTS_DEFAULT_VOICE || 'lara').trim() || 'lara',
    defaultLanguage:
      String(process.env.ATLAS_TTS_DEFAULT_LANGUAGE || 'tr-TR').trim() || 'tr-TR',
    defaultFormat: String(process.env.ATLAS_TTS_DEFAULT_FORMAT || 'mp3').trim() || 'mp3',
    elevenlabs: {
      apiKey: String(process.env.ELEVENLABS_API_KEY || '').trim(),
      modelId:
        String(process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2').trim() ||
        'eleven_multilingual_v2',
      /** Shared Lara identity — preferred when multilingual same-voice is available */
      laraVoiceId: String(
        process.env.ELEVENLABS_LARA_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || '',
      ).trim(),
      laraVoiceIdTr: String(process.env.ELEVENLABS_LARA_VOICE_ID_TR || '').trim(),
      laraVoiceIdEn: String(process.env.ELEVENLABS_LARA_VOICE_ID_EN || '').trim(),
      baseUrl: String(process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io').replace(
        /\/$/,
        '',
      ),
    },
    openai: {
      apiKey: String(process.env.OPENAI_API_KEY || '').trim(),
      model: String(process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts').trim() || 'gpt-4o-mini-tts',
      /** OpenAI voice name (alloy, etc.) — optional overlay for registry entries */
      defaultVoice: String(process.env.OPENAI_TTS_VOICE || '').trim(),
    },
  };
}

/**
 * Load registry JSON if present.
 * @returns {object|null}
 */
export function loadRegistryFile() {
  if (!existsSync(VOICE_REGISTRY_PATH)) return null;
  try {
    const raw = readFileSync(VOICE_REGISTRY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Resolve env placeholders like ${ELEVENLABS_LARA_VOICE_ID}.
 * @param {unknown} value
 * @returns {string}
 */
export function resolveEnvString(value) {
  if (value == null) return '';
  const s = String(value).trim();
  const m = /^\$\{([A-Z0-9_]+)\}$/.exec(s);
  if (m) return String(process.env[m[1]] || '').trim();
  return s;
}
