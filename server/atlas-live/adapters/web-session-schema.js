/**
 * ATLAS LIVE — Web adapter session model & state transitions.
 * Transport-agnostic; no HTTP, WebSocket, or browser audio.
 */

/** @typedef {'created'|'running'|'paused'|'stopped'|'completed'|'error'} WebSessionStatus */

/**
 * @typedef {object} WebSessionRecord
 * @property {string} sessionId
 * @property {WebSessionStatus} status
 * @property {string} createdAt
 * @property {string|null} startedAt
 * @property {string|null} pausedAt
 * @property {string|null} stoppedAt
 * @property {string|null} topic
 * @property {string} language
 * @property {string} voiceMode
 * @property {object|null} currentBeat
 * @property {string|null} lastEventAt
 * @property {object} metadata
 * @property {string|null} [errorCode]
 * @property {string|null} [errorMessage]
 */

/** @typedef {object} WebAdapterEvent
 * @property {string} id
 * @property {string} sessionId
 * @property {string} type
 * @property {string} timestamp
 * @property {number} sequence
 * @property {object} payload
 */

export const WEB_SESSION_STATUSES = Object.freeze([
  'created',
  'running',
  'paused',
  'stopped',
  'completed',
  'error',
]);

export const WEB_EVENT_TYPES = Object.freeze([
  'session.created',
  'session.started',
  'session.paused',
  'session.resumed',
  'session.stopped',
  'presenter.segment',
  'presenter.transition',
  'presenter.music',
  'presenter.voice',
  'presenter.completed',
  'presenter.error',
]);

export const WEB_ADAPTER_ERROR_CODES = Object.freeze({
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  ENGINE_START_FAILED: 'ENGINE_START_FAILED',
  TICK_FAILED: 'TICK_FAILED',
  EVENT_NORMALIZATION_FAILED: 'EVENT_NORMALIZATION_FAILED',
  SESSION_ALREADY_STOPPED: 'SESSION_ALREADY_STOPPED',
});

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [details]
 */
export function makeAdapterError(code, message, details = {}) {
  const err = new Error(message);
  err.code = code;
  err.details = details;
  return err;
}

/**
 * @param {WebSessionStatus} from
 * @param {'start'|'pause'|'resume'|'stop'|'tick'} action
 * @returns {{ allowed: boolean, to?: WebSessionStatus, code?: string, message?: string }}
 */
export function validateTransition(from, action) {
  const rules = {
    created: { start: 'running' },
    running: { pause: 'paused', stop: 'stopped', tick: 'running' },
    paused: { resume: 'running', stop: 'stopped' },
    stopped: {},
    completed: {},
    error: {},
  };

  const next = rules[from]?.[action];
  if (!next) {
    const messages = {
      start: 'Session cannot be started in its current state',
      pause: 'Only a running session can be paused',
      resume: 'Only a paused session can be resumed',
      stop: 'Session is already stopped or completed',
      tick: 'Ticks are only allowed while the session is running',
    };
    return {
      allowed: false,
      code:
        from === 'stopped' || from === 'completed'
          ? WEB_ADAPTER_ERROR_CODES.SESSION_ALREADY_STOPPED
          : WEB_ADAPTER_ERROR_CODES.INVALID_STATE_TRANSITION,
      message: messages[action] || 'Invalid state transition',
    };
  }

  return { allowed: true, to: /** @type {WebSessionStatus} */ (next) };
}

/**
 * @param {{
 *   sessionId: string,
 *   topic?: string|null,
 *   language?: string,
 *   voiceMode?: string,
 *   metadata?: object,
 *   now?: string,
 * }} input
 * @returns {WebSessionRecord}
 */
export function makeSessionRecord(input) {
  const now = input.now ?? new Date().toISOString();
  return {
    sessionId: input.sessionId,
    status: 'created',
    createdAt: now,
    startedAt: null,
    pausedAt: null,
    stoppedAt: null,
    topic: input.topic ?? null,
    language: input.language ?? 'en',
    voiceMode: input.voiceMode ?? 'mock',
    currentBeat: null,
    lastEventAt: null,
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {},
    errorCode: null,
    errorMessage: null,
  };
}

/**
 * @param {WebSessionRecord} session
 * @returns {object}
 */
export function toPublicSessionState(session) {
  return {
    sessionId: session.sessionId,
    status: session.status,
    createdAt: session.createdAt,
    startedAt: session.startedAt,
    pausedAt: session.pausedAt,
    stoppedAt: session.stoppedAt,
    topic: session.topic,
    language: session.language,
    voiceMode: session.voiceMode,
    currentBeat: session.currentBeat,
    lastEventAt: session.lastEventAt,
    metadata: { ...session.metadata },
    ...(session.errorCode ? { errorCode: session.errorCode, errorMessage: session.errorMessage } : {}),
  };
}
