/**
 * ATLAS LIVE — public API.
 * Living AI radio host engine. Isolated from chat / astrology / message pipeline.
 *
 * Usage:
 *   import { createAtlasLiveEngine } from './atlas-live/index.js';
 *   const live = createAtlasLiveEngine({ autoLoop: false });
 *   await live.start();
 *   await live.tick();
 */

export {
  ATLAS_LIVE_VERSION,
  LIVE_EVENT_TYPES,
  CONTENT_CATEGORIES,
  makeSpokenSegment,
  makeLiveEvent,
  makePresenterBeat,
  validateSpokenSegment,
} from './schema.js';

export {
  DEFAULT_PERSONALITY,
  createPersonality,
  resolveDaypartMood,
  shapeCuesForPersonality,
  buildPersonalityBrief,
} from './personality.js';

export {
  listCategories,
  listContentBlocks,
  registerContentBlock,
  getEligibleBlocks,
  pickWeightedBlock,
  selectNextBlock,
} from './topics.js';

export { createHistory } from './history.js';

export {
  buildPresenterSystemPrompt,
  buildPolishUserPrompt,
  buildEventAckPrompts,
  fallbackEventCues,
  cuesToScript,
} from './prompts.js';

export {
  DEFAULT_SCHEDULER_CONFIG,
  createScheduler,
  jitterDuration,
} from './scheduler.js';

export {
  DEFAULT_MUSIC_OPTIONS,
  createMusicController,
} from './music-controller.js';

export {
  estimateSpeechDurationMs,
  createMockVoiceProvider,
  createElevenLabsProvider,
  createOpenAIRealtimeProvider,
  createAzureTtsProvider,
  createGoogleTtsProvider,
  createLocalXttsProvider,
  createVoiceProvider,
  createVoiceFacade,
} from './voice.js';

export {
  planTransition,
  prependTransition,
  resolveEventInterruptPolicy,
  pickTransitionLiner,
} from './transitions.js';

export { createPresenter } from './presenter.js';

export { createAtlasLiveEngine } from './engine.js';

export { createWebLiveAdapter } from './adapters/web-live-adapter.js';
export {
  WEB_SESSION_STATUSES,
  WEB_EVENT_TYPES,
  WEB_ADAPTER_ERROR_CODES,
  validateTransition,
  makeSessionRecord,
  toPublicSessionState,
} from './adapters/web-session-schema.js';
export {
  makeWebEvent,
  normalizeEngineCallback,
  normalizeTickResult,
} from './adapters/web-event-normalizer.js';

export { mountAtlasLiveRoutes, createAtlasLiveRouter } from './http/atlas-live-routes.js';
export {
  validateCreateSessionBody,
  sanitizeMetadata,
  isValidSessionId,
  parseEventsQuery,
  SUPPORTED_LOCALES,
  ALLOWED_VOICE_MODES,
} from './http/request-validation.js';
export {
  sendOk,
  sendError,
  sendAdapterError,
  HTTP_API_ERROR_CODES,
} from './http/api-response.js';
