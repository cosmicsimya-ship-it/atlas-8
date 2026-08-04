/**
 * Atlas Audio Studio — public exports.
 */

export {
  buildCapabilityRegistry,
  getCapabilityRegistry,
  getCapabilityRegistrySync,
  readAudioFeatureFlags,
  assessCapabilities,
  summarizeCapabilities,
  audioHealthSnapshot,
  CAPABILITY_LABELS,
  envFlag,
  _resetCapabilityCache,
} from './capability-registry.js';

export {
  detectAudioIntent,
  operationsForIntent,
  hasAudioStudioContext,
  containsFalseCapabilityPromise,
} from './audio-intent.js';

export { classifyAudioMedia, SUPPORTED_AUDIO_EXTS } from './audio-classifier.js';

export {
  inspectAudioFile,
  validateAudioFileBasics,
  formatAnalysisForUser,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_SEC,
} from './audio-metadata.js';

export {
  createAudioJob,
  readJob,
  updateJob,
  deleteJob,
  listJobs,
  storeOriginalFile,
  getJobStats,
  cleanupExpiredJobs,
  AUDIO_JOBS_ROOT,
  JOB_STATUSES,
  createJobId,
} from './audio-job-store.js';

export {
  buildAudioStudioReply,
  selectClarifyingQuestions,
  enforceTruthfulAudioReply,
} from './audio-response-builder.js';

export { runAudioStudioTurn } from './audio-orchestrator.js';

export {
  contextKey,
  setPendingAudioInstruction,
  setPendingAudioFile,
  getPendingAudioContext,
  clearPendingAudioContext,
  shouldRouteAudioToStudio,
  _resetAudioContextStore,
} from './audio-context.js';

export {
  evaluateAudioSafety,
  assertSafePath,
  safeFileName,
  assertJobAccess,
  redactForLog,
} from './audio-safety.js';

export { AUDIO_ERROR_CODES, AudioStudioError, userMessageForAudioError } from './audio-errors.js';

export {
  recordAudioFeatureRequest,
  listAudioFeatureRequests,
  _resetFeatureRequestStore,
} from './audio-feature-requests.js';

export { logAudioEvent } from './audio-log.js';

export { loadProviders } from './providers/stubs.js';
export { checkFfmpegAvailability, probeMediaFile } from './providers/local-ffmpeg.js';
export { buildDefaultProcessorChain } from './processors/base.js';

export const AUDIO_STUDIO_VERSION = 'atlas-audio-studio-v1';
