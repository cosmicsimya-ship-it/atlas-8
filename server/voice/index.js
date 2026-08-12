/**
 * ATLAS multilingual voice / TTS layer — public API.
 */

export {
  VOICE_ASSETS_ROOT,
  VOICE_SOURCE_DIR,
  VOICE_PROCESSED_DIR,
  VOICE_REGISTRY_PATH,
  VOICE_CACHE_DIR,
  SYNTHESIS_SETTINGS_VERSION,
  SUPPORTED_LANGUAGES,
  SUPPORTED_FORMATS,
  getVoiceConfig,
  getActiveProviderId,
  envFlag,
} from './config.js';

export {
  VOICE_ERROR_CODES,
  VoiceError,
  userMessageForVoiceError,
  httpStatusForVoiceError,
  normalizeProviderError,
} from './errors.js';

export {
  listRegistryVoices,
  listPublicVoices,
  getVoice,
  getDefaultVoice,
  resolveProviderVoiceId,
  isVoiceConfigured,
  voiceSupportsLanguage,
  getLaraMasterPath,
} from './registry.js';

export {
  createVoiceProvider,
  createElevenLabsProvider,
  createOpenAITTSProvider,
  createMockTTSProvider,
} from './providers/index.js';

export { synthesizeSpeech, normalizeLanguage } from './synthesize.js';
export { buildCacheKey, readCache, writeCache, getCacheStats, clearVoiceCacheForTests } from './cache.js';
export {
  assertWithinQuota,
  recordUsage,
  getUsageSnapshot,
  resetUsageForTests,
} from './usage.js';
export { createVoiceRouter, mountVoiceRoutes, sanitizePublicPayload } from './routes.js';

export const VOICE_LAYER_VERSION = 'atlas-voice-v1';
