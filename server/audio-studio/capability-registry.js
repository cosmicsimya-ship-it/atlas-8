/**
 * Audio Capability Registry — single source of truth for what Atlas can claim.
 * Responses MUST be driven by runtime flags + provider health, never LLM improvisation.
 */

import { checkFfmpegAvailability } from './providers/local-ffmpeg.js';

/** @typedef {'enabled'|'disabled'|'requires_provider'|'planned'} CapabilityState */

const BOOL_TRUE = new Set(['1', 'true', 'yes', 'on']);

/**
 * @param {string|undefined|null} value
 * @param {boolean} [defaultValue=false]
 */
export function envFlag(value, defaultValue = false) {
  if (value == null || String(value).trim() === '') return defaultValue;
  return BOOL_TRUE.has(String(value).trim().toLowerCase());
}

/**
 * Feature flags (env). Defaults keep processing OFF so Atlas never claims fake capacity.
 */
export function readAudioFeatureFlags(env = process.env) {
  return {
    upload: envFlag(env.ATLAS_AUDIO_UPLOAD_ENABLED, true),
    analysis: envFlag(env.ATLAS_AUDIO_ANALYSIS_ENABLED, true),
    processing: envFlag(env.ATLAS_AUDIO_PROCESSING_ENABLED, false),
    transcription: envFlag(env.ATLAS_AUDIO_TRANSCRIPTION_ENABLED, Boolean(env.OPENAI_API_KEY)),
    stemSeparation: envFlag(env.ATLAS_AUDIO_STEM_SEPARATION_ENABLED, false),
    tuning: envFlag(env.ATLAS_AUDIO_TUNING_ENABLED, false),
    mixing: envFlag(env.ATLAS_AUDIO_MIXING_ENABLED, false),
    mastering: envFlag(env.ATLAS_AUDIO_MASTERING_ENABLED, false),
    generation: envFlag(env.ATLAS_AUDIO_GENERATION_ENABLED, false),
    externalUpload: envFlag(env.ATLAS_AUDIO_EXTERNAL_UPLOAD_ENABLED, false),
  };
}

/**
 * @param {{
 *   flags?: ReturnType<typeof readAudioFeatureFlags>,
 *   ffmpeg?: { ffmpegAvailable: boolean, ffprobeAvailable: boolean },
 *   providers?: Record<string, { enabled: boolean, configured: boolean }>,
 * }} [opts]
 */
export function buildCapabilityRegistry(opts = {}) {
  const flags = opts.flags || readAudioFeatureFlags();
  const ffmpeg = opts.ffmpeg || { ffmpegAvailable: false, ffprobeAvailable: false };
  const providers = opts.providers || {};

  const providerReady = (key) => {
    const p = providers[key];
    return Boolean(p?.enabled && p?.configured);
  };

  /** @type {Record<string, object>} */
  const registry = {
    audioUpload: {
      enabled: flags.upload,
      channels: ['telegram', 'web'],
      state: flags.upload ? 'enabled' : 'disabled',
    },
    metadataInspection: {
      enabled: flags.analysis && ffmpeg.ffprobeAvailable,
      provider: ffmpeg.ffprobeAvailable ? 'ffprobe' : null,
      state:
        !flags.analysis
          ? 'disabled'
          : ffmpeg.ffprobeAvailable
            ? 'enabled'
            : 'requires_provider',
    },
    transcription: {
      enabled: flags.transcription && Boolean(process.env.OPENAI_API_KEY),
      provider: flags.transcription && process.env.OPENAI_API_KEY ? 'openai_whisper' : null,
      state:
        !flags.transcription
          ? 'disabled'
          : process.env.OPENAI_API_KEY
            ? 'enabled'
            : 'requires_provider',
    },
    noiseReduction: {
      enabled: flags.processing && providerReady('noise_reduction'),
      provider: providerReady('noise_reduction') ? 'noise_reduction_provider' : null,
      state: capabilityState(flags.processing, providerReady('noise_reduction')),
    },
    stemSeparation: {
      enabled: flags.stemSeparation && providerReady('stem_separation'),
      provider: providerReady('stem_separation') ? 'stem_separation_provider' : null,
      state: capabilityState(flags.stemSeparation, providerReady('stem_separation')),
    },
    vocalTuning: {
      enabled: flags.tuning && providerReady('vocal_tuning'),
      provider: providerReady('vocal_tuning') ? 'vocal_tuning_provider' : null,
      state: capabilityState(flags.tuning, providerReady('vocal_tuning')),
    },
    mixing: {
      enabled: flags.mixing && providerReady('mixing'),
      provider: providerReady('mixing') ? 'mastering_provider' : null,
      state: capabilityState(flags.mixing, providerReady('mixing')),
    },
    mastering: {
      enabled: flags.mastering && providerReady('mastering'),
      provider: providerReady('mastering') ? 'mastering_provider' : null,
      state: capabilityState(flags.mastering, providerReady('mastering')),
    },
    instrumentGeneration: {
      enabled: flags.generation && providerReady('music_generation'),
      provider: providerReady('music_generation') ? 'music_generation_provider' : null,
      state: capabilityState(flags.generation, providerReady('music_generation')),
    },
    externalUpload: {
      enabled: flags.externalUpload,
      state: flags.externalUpload ? 'enabled' : 'disabled',
      requiresConsent: true,
    },
    ffmpegAvailable: ffmpeg.ffmpegAvailable,
    ffprobeAvailable: ffmpeg.ffprobeAvailable,
    flags,
  };

  return registry;
}

/**
 * @param {boolean} flagOn
 * @param {boolean} providerOk
 * @returns {CapabilityState}
 */
function capabilityState(flagOn, providerOk) {
  if (!flagOn) return 'disabled';
  if (!providerOk) return 'requires_provider';
  return 'enabled';
}

/** Cached snapshot; refresh on demand (providers/ffmpeg may appear later). */
let _cached = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 15_000;

/**
 * Runtime capability snapshot (refreshes ffmpeg probe periodically).
 * @param {{ force?: boolean }} [opts]
 */
export async function getCapabilityRegistry(opts = {}) {
  const now = Date.now();
  if (!opts.force && _cached && now - _cachedAt < CACHE_TTL_MS) {
    return _cached;
  }
  const ffmpeg = await checkFfmpegAvailability();
  const providers = resolveConfiguredProviders();
  _cached = buildCapabilityRegistry({ ffmpeg, providers });
  _cachedAt = now;
  return _cached;
}

/** Sync snapshot using last known ffmpeg state (or pessimistic defaults). */
export function getCapabilityRegistrySync() {
  if (_cached) return _cached;
  return buildCapabilityRegistry({
    ffmpeg: { ffmpegAvailable: false, ffprobeAvailable: false },
    providers: resolveConfiguredProviders(),
  });
}

/** Clear cache (tests). */
export function _resetCapabilityCache() {
  _cached = null;
  _cachedAt = 0;
}

/**
 * Provider config from env — no secrets logged.
 * Keys indicate presence only.
 */
export function resolveConfiguredProviders() {
  const has = (k) => Boolean(process.env[k] && String(process.env[k]).trim());
  return {
    local_ffmpeg: {
      enabled: true,
      configured: true,
    },
    transcription: {
      enabled: envFlag(process.env.ATLAS_AUDIO_TRANSCRIPTION_ENABLED, Boolean(process.env.OPENAI_API_KEY)),
      configured: has('OPENAI_API_KEY'),
    },
    noise_reduction: {
      enabled: envFlag(process.env.ATLAS_AUDIO_PROCESSING_ENABLED, false),
      configured: has('ATLAS_AUDIO_NOISE_REDUCTION_API_KEY'),
    },
    stem_separation: {
      enabled: envFlag(process.env.ATLAS_AUDIO_STEM_SEPARATION_ENABLED, false),
      configured: has('ATLAS_AUDIO_STEM_API_KEY'),
    },
    vocal_tuning: {
      enabled: envFlag(process.env.ATLAS_AUDIO_TUNING_ENABLED, false),
      configured: has('ATLAS_AUDIO_TUNING_API_KEY'),
    },
    music_generation: {
      enabled: envFlag(process.env.ATLAS_AUDIO_GENERATION_ENABLED, false),
      configured: has('ATLAS_AUDIO_GENERATION_API_KEY'),
    },
    mastering: {
      enabled: envFlag(process.env.ATLAS_AUDIO_MASTERING_ENABLED, false),
      configured: has('ATLAS_AUDIO_MASTERING_API_KEY'),
    },
    mixing: {
      enabled: envFlag(process.env.ATLAS_AUDIO_MIXING_ENABLED, false),
      configured: has('ATLAS_AUDIO_MIXING_API_KEY') || has('ATLAS_AUDIO_MASTERING_API_KEY'),
    },
  };
}

/**
 * Assess which of the requested operations are available.
 * @param {string[]} requestedOperations
 * @param {ReturnType<typeof buildCapabilityRegistry>} registry
 */
export function assessCapabilities(requestedOperations, registry) {
  /** @type {string[]} */
  const available = [];
  /** @type {string[]} */
  const unavailable = [];
  /** @type {string[]} */
  const requiresProvider = [];

  const map = {
    noise_reduction: 'noiseReduction',
    vocal_enhancement: 'noiseReduction',
    instrument_balance: 'mixing',
    mixing: 'mixing',
    mastering: 'mastering',
    stem_separation: 'stemSeparation',
    vocal_tuning: 'vocalTuning',
    add_instrumentation: 'instrumentGeneration',
    metadata_inspection: 'metadataInspection',
    transcription: 'transcription',
    analyze: 'metadataInspection',
    format_convert: 'metadataInspection',
  };

  for (const op of requestedOperations || []) {
    const key = map[op] || null;
    if (!key) {
      unavailable.push(op);
      continue;
    }
    const entry = registry[key];
    if (!entry) {
      unavailable.push(op);
      continue;
    }
    if (entry.state === 'enabled' && entry.enabled) {
      available.push(op);
    } else if (entry.state === 'requires_provider') {
      requiresProvider.push(op);
    } else {
      unavailable.push(op);
    }
  }

  return { available, unavailable, requiresProvider };
}

/**
 * Human labels for capability keys (Turkish).
 */
export const CAPABILITY_LABELS = Object.freeze({
  audioUpload: 'ses dosyası kabulü',
  metadataInspection: 'teknik analiz (metadata / seviye)',
  transcription: 'konuşma metne çevirme',
  noiseReduction: 'gürültü temizleme',
  stemSeparation: 'vokal / enstrüman ayrımı (stem)',
  vocalTuning: 'vokal perde düzeltme',
  mixing: 'mix / dengeleme',
  mastering: 'mastering',
  instrumentGeneration: 'aranje / enstrüman ekleme',
  externalUpload: 'haricî servise dosya gönderimi',
});

/**
 * Summarize registry for replies.
 * @param {ReturnType<typeof buildCapabilityRegistry>} registry
 */
export function summarizeCapabilities(registry) {
  const enabled = [];
  const requiresProvider = [];
  const disabled = [];

  for (const [key, label] of Object.entries(CAPABILITY_LABELS)) {
    const entry = registry[key];
    if (!entry) continue;
    if (entry.state === 'enabled' && entry.enabled) enabled.push({ key, label });
    else if (entry.state === 'requires_provider') requiresProvider.push({ key, label });
    else disabled.push({ key, label });
  }

  return { enabled, requiresProvider, disabled };
}

/**
 * Health slice for /api/ai/health
 * @param {ReturnType<typeof buildCapabilityRegistry>} registry
 * @param {{ running?: number, queued?: number, lastError?: string|null }} [jobStats]
 */
export function audioHealthSnapshot(registry, jobStats = {}) {
  const providers = resolveConfiguredProviders();
  const configured = Object.entries(providers)
    .filter(([, v]) => v.configured)
    .map(([k]) => k);

  return {
    ffmpegAvailable: Boolean(registry.ffmpegAvailable),
    ffprobeAvailable: Boolean(registry.ffprobeAvailable),
    providersConfigured: configured,
    audioUploadEnabled: Boolean(registry.audioUpload?.enabled),
    audioAnalysisEnabled: Boolean(registry.metadataInspection?.enabled),
    audioProcessingEnabled: Boolean(registry.flags?.processing),
    audioJobsRunning: jobStats.running ?? 0,
    audioJobsQueued: jobStats.queued ?? 0,
    lastAudioError: jobStats.lastError ?? null,
  };
}
