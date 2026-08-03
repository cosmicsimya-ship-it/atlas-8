/**
 * Stub provider adapters — declare capacity only when configured.
 * No commercial lock-in; orchestrator selects by registry.
 */

import { envFlag } from '../capability-registry.js';
import { getLocalFfmpegProviderDescriptor, checkFfmpegAvailability } from './local-ffmpeg.js';

/**
 * @param {string} id
 * @param {{
 *   enabledFlag: boolean,
 *   apiKeyEnv: string,
 *   operations: string[],
 *   formats?: string[],
 * }} cfg
 */
function makeProvider(id, cfg) {
  const apiKeyPresent = Boolean(process.env[cfg.apiKeyEnv]?.trim());
  const enabled = Boolean(cfg.enabledFlag);
  const configured = apiKeyPresent;
  return {
    id,
    enabled,
    configured,
    apiKeyPresent,
    supportedOperations: cfg.operations,
    supportedFormats: cfg.formats || ['wav', 'mp3', 'm4a'],
    maxFileSize: Number(process.env.ATLAS_AUDIO_MAX_BYTES || 52_428_800),
    maxDuration: Number(process.env.ATLAS_AUDIO_MAX_DURATION_SEC || 1800),
    timeout: Number(process.env.ATLAS_AUDIO_PROVIDER_TIMEOUT_MS || 120_000),
    privacyPolicyLabel: 'external_provider_requires_consent',
    costEstimateMode: 'unknown',
    async healthCheck() {
      return {
        ok: enabled && configured,
        reason: !enabled ? 'flag_off' : !configured ? 'api_key_missing' : 'ok',
      };
    },
    async execute() {
      return {
        ok: false,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        message: `${id} is not configured; refusing simulated output`,
      };
    },
  };
}

/**
 * @returns {Promise<Record<string, object>>}
 */
export async function loadProviders() {
  const avail = await checkFfmpegAvailability();
  return {
    local_ffmpeg: getLocalFfmpegProviderDescriptor(avail),
    transcription_provider: makeProvider('transcription_provider', {
      enabledFlag: envFlag(process.env.ATLAS_AUDIO_TRANSCRIPTION_ENABLED, Boolean(process.env.OPENAI_API_KEY)),
      apiKeyEnv: 'OPENAI_API_KEY',
      operations: ['transcription'],
    }),
    noise_reduction_provider: makeProvider('noise_reduction_provider', {
      enabledFlag: envFlag(process.env.ATLAS_AUDIO_PROCESSING_ENABLED, false),
      apiKeyEnv: 'ATLAS_AUDIO_NOISE_REDUCTION_API_KEY',
      operations: ['remove_noise', 'remove_hum', 'remove_clicks', 'deess_vocal'],
    }),
    stem_separation_provider: makeProvider('stem_separation_provider', {
      enabledFlag: envFlag(process.env.ATLAS_AUDIO_STEM_SEPARATION_ENABLED, false),
      apiKeyEnv: 'ATLAS_AUDIO_STEM_API_KEY',
      operations: ['isolate_vocal', 'isolate_instrument'],
    }),
    vocal_tuning_provider: makeProvider('vocal_tuning_provider', {
      enabledFlag: envFlag(process.env.ATLAS_AUDIO_TUNING_ENABLED, false),
      apiKeyEnv: 'ATLAS_AUDIO_TUNING_API_KEY',
      operations: ['tune_vocal', 'align_timing'],
    }),
    music_generation_provider: makeProvider('music_generation_provider', {
      enabledFlag: envFlag(process.env.ATLAS_AUDIO_GENERATION_ENABLED, false),
      apiKeyEnv: 'ATLAS_AUDIO_GENERATION_API_KEY',
      operations: ['add_instrumentation'],
    }),
    mastering_provider: makeProvider('mastering_provider', {
      enabledFlag: envFlag(process.env.ATLAS_AUDIO_MASTERING_ENABLED, false),
      apiKeyEnv: 'ATLAS_AUDIO_MASTERING_API_KEY',
      operations: ['mix', 'master', 'normalize_loudness', 'equalize', 'compress', 'add_reverb', 'widen_stereo'],
    }),
  };
}
