/**
 * ATLAS LIVE — Web channel adapter (transport-agnostic).
 *
 * Web UI → Web Live Adapter → Atlas Live Engine
 *
 * Thin session + event normalization only.
 * No presenter logic, scheduling, voice synthesis, HTTP, WebSocket, or browser audio.
 */

import { createAtlasLiveEngine } from '../engine.js';
import {
  makeAdapterError,
  makeSessionRecord,
  toPublicSessionState,
  validateTransition,
  WEB_ADAPTER_ERROR_CODES,
} from './web-session-schema.js';
import { makeWebEvent, normalizeEngineCallback, normalizeTickResult } from './web-event-normalizer.js';

/**
 * @typedef {object} WebLiveAdapterOptions
 * @property {typeof createAtlasLiveEngine} [engineFactory]
 * @property {{ now?: () => number, iso?: () => string }} [clock]
 * @property {{ debug?: Function, warn?: Function, error?: Function }} [logger]
 * @property {() => string} [idFactory]
 */

/**
 * @param {WebLiveAdapterOptions} [options]
 */
export function createWebLiveAdapter(options = {}) {
  const engineFactory = options.engineFactory ?? createAtlasLiveEngine;
  const clock = {
    now: options.clock?.now ?? (() => Date.now()),
    iso: options.clock?.iso ?? (() => new Date().toISOString()),
  };
  const logger = {
    debug: options.logger?.debug ?? (() => {}),
    warn: options.logger?.warn ?? (() => {}),
    error: options.logger?.error ?? (() => {}),
  };
  const idFactory =
    options.idFactory ??
    (() => `web_${clock.now()}_${Math.random().toString(36).slice(2, 8)}`);

  /** @type {Map<string, { record: import('./web-session-schema.js').WebSessionRecord, engine: object|null, events: import('./web-session-schema.js').WebAdapterEvent[], sequence: number }>} */
  const sessions = new Map();

  function getEntry(sessionId) {
    const entry = sessions.get(sessionId);
    if (!entry) {
      throw makeAdapterError(
        WEB_ADAPTER_ERROR_CODES.SESSION_NOT_FOUND,
        `Session not found: ${sessionId}`,
        { sessionId },
      );
    }
    return entry;
  }

  function appendEvents(entry, events) {
    for (const ev of events) {
      entry.events.push(ev);
      entry.record.lastEventAt = ev.timestamp;
    }
  }

  function pushSessionEvent(entry, type, payload) {
    entry.sequence += 1;
    const ev = makeWebEvent(entry.record.sessionId, entry.sequence, type, payload, clock.iso());
    appendEvents(entry, [ev]);
    return ev;
  }

  function assertTransition(entry, action) {
    const result = validateTransition(entry.record.status, action);
    if (!result.allowed) {
      throw makeAdapterError(result.code, result.message, {
        sessionId: entry.record.sessionId,
        status: entry.record.status,
        action,
      });
    }
    return result;
  }

  function createEngineEventHandler(entry) {
    return (type, payload) => {
      try {
        const normalized = normalizeEngineCallback(
          entry.record.sessionId,
          entry.sequence + 1,
          type,
          payload,
          clock.iso(),
        );
        if (normalized.length) {
          entry.sequence += normalized.length;
          appendEvents(entry, normalized);
        }
      } catch (err) {
        logger.warn('[WebLiveAdapter] engine event normalization failed', {
          sessionId: entry.record.sessionId,
          type,
          message: err?.message,
        });
        entry.sequence += 1;
        appendEvents(entry, [
          makeWebEvent(
            entry.record.sessionId,
            entry.sequence,
            'presenter.error',
            {
              code: WEB_ADAPTER_ERROR_CODES.EVENT_NORMALIZATION_FAILED,
              message: err?.message ?? 'Engine event normalization failed',
              engineType: type,
            },
            clock.iso(),
          ),
        ]);
      }
    };
  }

  /**
   * @param {{
   *   sessionId?: string,
   *   topic?: string|null,
   *   language?: string,
   *   voiceMode?: string,
   *   metadata?: object,
   *   engineOptions?: object,
   * }} [input]
   */
  function createSession(input = {}) {
    const sessionId = input.sessionId ?? idFactory();
    if (sessions.has(sessionId)) {
      throw makeAdapterError(
        WEB_ADAPTER_ERROR_CODES.INVALID_STATE_TRANSITION,
        `Session already exists: ${sessionId}`,
        { sessionId },
      );
    }

    const record = makeSessionRecord({
      sessionId,
      topic: input.topic ?? null,
      language: input.language ?? 'en',
      voiceMode: input.voiceMode ?? 'mock',
      metadata: input.metadata,
      now: clock.iso(),
    });

    const entry = {
      record,
      engine: null,
      events: [],
      sequence: 0,
      engineOptions: input.engineOptions ?? {},
    };

    sessions.set(sessionId, entry);
    pushSessionEvent(entry, 'session.created', {
      topic: record.topic,
      language: record.language,
      voiceMode: record.voiceMode,
      metadata: { ...record.metadata },
    });

    logger.debug('[WebLiveAdapter] session created', { sessionId });
    return toPublicSessionState(record);
  }

  /**
   * @param {string} sessionId
   * @param {{ openAnnouncer?: boolean }} [opts]
   */
  async function startSession(sessionId, opts = {}) {
    const entry = getEntry(sessionId);
    assertTransition(entry, 'start');

    try {
      const engine = engineFactory({
        sessionId,
        autoLoop: false,
        voiceProvider: entry.record.voiceMode || 'mock',
        ...entry.engineOptions,
        onEvent: createEngineEventHandler(entry),
      });

      entry.engine = engine;

      await engine.start({ openAnnouncer: opts.openAnnouncer !== false });

      entry.record.status = 'running';
      entry.record.startedAt = clock.iso();
      entry.record.pausedAt = null;

      pushSessionEvent(entry, 'session.started', {
        engineVersion: engine.version,
        engineSessionId: engine.sessionId,
      });

      syncCurrentBeat(entry);
      return toPublicSessionState(entry.record);
    } catch (err) {
      entry.record.status = 'error';
      entry.record.errorCode = WEB_ADAPTER_ERROR_CODES.ENGINE_START_FAILED;
      entry.record.errorMessage = err?.message ?? 'Engine start failed';
      logger.error('[WebLiveAdapter] engine start failed', {
        sessionId,
        message: entry.record.errorMessage,
      });
      throw makeAdapterError(
        WEB_ADAPTER_ERROR_CODES.ENGINE_START_FAILED,
        entry.record.errorMessage,
        { sessionId },
      );
    }
  }

  /**
   * @param {string} sessionId
   */
  function pauseSession(sessionId) {
    const entry = getEntry(sessionId);
    assertTransition(entry, 'pause');

    if (!entry.engine) {
      throw makeAdapterError(
        WEB_ADAPTER_ERROR_CODES.ENGINE_START_FAILED,
        'Engine is not initialized for this session',
        { sessionId },
      );
    }

    entry.engine.pause();
    entry.record.status = 'paused';
    entry.record.pausedAt = clock.iso();
    pushSessionEvent(entry, 'session.paused', {});
    syncCurrentBeat(entry);
    return toPublicSessionState(entry.record);
  }

  /**
   * @param {string} sessionId
   */
  async function resumeSession(sessionId) {
    const entry = getEntry(sessionId);
    assertTransition(entry, 'resume');

    if (!entry.engine) {
      throw makeAdapterError(
        WEB_ADAPTER_ERROR_CODES.ENGINE_START_FAILED,
        'Engine is not initialized for this session',
        { sessionId },
      );
    }

    await entry.engine.resume();
    entry.record.status = 'running';
    entry.record.pausedAt = null;
    pushSessionEvent(entry, 'session.resumed', {});
    syncCurrentBeat(entry);
    return toPublicSessionState(entry.record);
  }

  /**
   * @param {string} sessionId
   */
  async function stopSession(sessionId) {
    const entry = getEntry(sessionId);
    const transition = validateTransition(entry.record.status, 'stop');

    if (!transition.allowed) {
      if (
        entry.record.status === 'stopped' ||
        entry.record.status === 'completed'
      ) {
        throw makeAdapterError(
          WEB_ADAPTER_ERROR_CODES.SESSION_ALREADY_STOPPED,
          transition.message,
          { sessionId, status: entry.record.status },
        );
      }
      throw makeAdapterError(transition.code, transition.message, {
        sessionId,
        status: entry.record.status,
      });
    }

    if (entry.engine) {
      await entry.engine.stop();
    }

    entry.record.status = 'stopped';
    entry.record.stoppedAt = clock.iso();
    entry.record.currentBeat = null;
    pushSessionEvent(entry, 'session.stopped', {});
    logger.debug('[WebLiveAdapter] session stopped', { sessionId });
    return toPublicSessionState(entry.record);
  }

  /**
   * @param {string} sessionId
   */
  async function tickSession(sessionId) {
    const entry = getEntry(sessionId);
    assertTransition(entry, 'tick');

    if (!entry.engine) {
      throw makeAdapterError(
        WEB_ADAPTER_ERROR_CODES.TICK_FAILED,
        'Engine is not initialized for this session',
        { sessionId },
      );
    }

    try {
      const tickResult = await entry.engine.tick();
      const baseSeq = entry.sequence + 1;
      const normalized = normalizeTickResult(
        sessionId,
        baseSeq,
        tickResult,
        clock.iso(),
      );
      if (normalized.length) {
        entry.sequence += normalized.length;
        appendEvents(entry, normalized);
      }
      syncCurrentBeat(entry, tickResult.beat ?? null);
      return {
        session: toPublicSessionState(entry.record),
        tick: tickResult,
        events: normalized,
      };
    } catch (err) {
      entry.record.status = 'error';
      entry.record.errorCode = WEB_ADAPTER_ERROR_CODES.TICK_FAILED;
      entry.record.errorMessage = err?.message ?? 'Tick failed';
      entry.sequence += 1;
      const errorEvent = makeWebEvent(
        sessionId,
        entry.sequence,
        'presenter.error',
        {
          code: WEB_ADAPTER_ERROR_CODES.TICK_FAILED,
          message: entry.record.errorMessage,
        },
        clock.iso(),
      );
      appendEvents(entry, [errorEvent]);
      logger.error('[WebLiveAdapter] tick failed', { sessionId, message: entry.record.errorMessage });
      throw makeAdapterError(
        WEB_ADAPTER_ERROR_CODES.TICK_FAILED,
        entry.record.errorMessage,
        { sessionId },
      );
    }
  }

  /**
   * @param {string} sessionId
   */
  function getSessionState(sessionId) {
    const entry = getEntry(sessionId);
    syncCurrentBeat(entry);
    return toPublicSessionState(entry.record);
  }

  /**
   * @param {string} sessionId
   * @param {{ sinceSequence?: number, limit?: number }} [opts]
   */
  function getSessionEvents(sessionId, opts = {}) {
    const entry = getEntry(sessionId);
    let events = [...entry.events];
    if (Number.isFinite(opts.sinceSequence)) {
      events = events.filter((e) => e.sequence > opts.sinceSequence);
    }
    if (Number.isFinite(opts.limit) && opts.limit > 0) {
      events = events.slice(-opts.limit);
    }
    return events;
  }

  /**
   * @param {object} entry
   * @param {object|null} [beatOverride]
   */
  function syncCurrentBeat(entry, beatOverride) {
    if (!entry.engine) {
      entry.record.currentBeat = beatOverride ?? null;
      return;
    }
    const snap = entry.engine.snapshot();
    const beat = beatOverride ?? snap.currentBeat;
    entry.record.currentBeat = beat
      ? {
          id: beat.id,
          kind: beat.kind,
          reason: beat.reason,
          engineState: snap.state,
        }
      : null;
    if (entry.record.metadata) {
      entry.record.metadata.engineState = snap.state;
      entry.record.metadata.listenerCount = snap.listenerCount;
    }
  }

  function listSessions() {
    return [...sessions.values()].map((e) => toPublicSessionState(e.record));
  }

  return {
    createSession,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    tickSession,
    getSessionState,
    getSessionEvents,
    listSessions,
  };
}
