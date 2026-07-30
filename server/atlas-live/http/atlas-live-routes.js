/**
 * ATLAS LIVE — HTTP API routes.
 *
 * Web UI → HTTP API → Web Live Adapter → Atlas Live Engine
 *
 * Request validation + adapter delegation + response normalization only.
 */

import { Router } from 'express';
import { createWebLiveAdapter } from '../adapters/web-live-adapter.js';
import { WEB_ADAPTER_ERROR_CODES } from '../adapters/web-session-schema.js';
import {
  validateCreateSessionBody,
  isValidSessionId,
  parseEventsQuery,
} from './request-validation.js';
import {
  sendOk,
  sendError,
  sendAdapterError,
  isSessionOwner,
  HTTP_API_ERROR_CODES,
} from './api-response.js';

/**
 * @typedef {object} AtlasLiveRouteDeps
 * @property {ReturnType<typeof createWebLiveAdapter>} [adapter]
 * @property {import('express').RequestHandler} [attachAuth]
 * @property {import('express').RequestHandler} [requireAuth]
 * @property {import('express').RequestHandler} [requireCsrf]
 * @property {import('express').RequestHandler} [rateLimit]
 */

/**
 * @param {AtlasLiveRouteDeps} [deps]
 */
export function createAtlasLiveRouter(deps = {}) {
  const adapter = deps.adapter ?? createWebLiveAdapter();
  const router = Router();

  const attachAuth = deps.attachAuth ?? ((_req, _res, next) => next());
  const requireAuth = deps.requireAuth ?? ((_req, _res, next) => next());
  const requireCsrf = deps.requireCsrf ?? ((_req, _res, next) => next());
  const rateLimit = deps.rateLimit ?? ((_req, _res, next) => next());

  const readChain = [attachAuth, requireAuth, rateLimit];
  const writeChain = [attachAuth, requireAuth, requireCsrf, rateLimit];

  function getUserId(req) {
    return req.auth?.userId ?? null;
  }

  function assertOwner(req, session) {
    const userId = getUserId(req);
    if (!userId) {
      const err = new Error('Authentication required');
      err.code = HTTP_API_ERROR_CODES.SESSION_FORBIDDEN;
      throw err;
    }
    if (!isSessionOwner(session, userId)) {
      const err = new Error('Session access denied');
      err.code = HTTP_API_ERROR_CODES.SESSION_FORBIDDEN;
      throw err;
    }
  }

  function handleRouteError(res, err) {
    if (err?.code === HTTP_API_ERROR_CODES.SESSION_FORBIDDEN) {
      return sendError(res, 403, HTTP_API_ERROR_CODES.SESSION_FORBIDDEN);
    }
    if (err?.code === HTTP_API_ERROR_CODES.INVALID_INPUT) {
      return sendError(res, 400, HTTP_API_ERROR_CODES.INVALID_INPUT, err.message);
    }
    if (Object.values(WEB_ADAPTER_ERROR_CODES).includes(err?.code)) {
      return sendAdapterError(res, err);
    }
    return sendError(res, 500, HTTP_API_ERROR_CODES.INTERNAL_ERROR);
  }

  router.post('/api/atlas-live/sessions', ...writeChain, (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return sendError(res, 401, HTTP_API_ERROR_CODES.SESSION_FORBIDDEN, 'Authentication required.');
      }

      const validated = validateCreateSessionBody(req.body);
      if (!validated.ok) {
        return sendError(res, 400, validated.code, validated.message);
      }

      const { topic, language, voiceMode, metadata } = validated.value;
      const session = adapter.createSession({
        topic,
        language,
        voiceMode,
        metadata: {
          ...metadata,
          ownerUserId: userId,
        },
        engineOptions: {
          voiceProvider: 'mock',
          scheduler: {
            minSpeakGapMs: 1,
            maxSpeakGapMs: 2,
            minSilenceMs: 100,
            maxSilenceMs: 200,
            minMusicMs: 100,
            maxMusicMs: 200,
            listenWindowMs: 100,
            speakBias: 0.9,
          },
        },
      });

      return sendOk(res, 201, { session });
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  router.post('/api/atlas-live/sessions/:sessionId/start', ...writeChain, async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!isValidSessionId(sessionId)) {
        return sendError(res, 400, HTTP_API_ERROR_CODES.INVALID_INPUT, 'Invalid session id.');
      }

      const current = adapter.getSessionState(sessionId);
      assertOwner(req, current);
      const session = await adapter.startSession(sessionId, { openAnnouncer: false });
      return sendOk(res, 200, { session });
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  router.post('/api/atlas-live/sessions/:sessionId/pause', ...writeChain, (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!isValidSessionId(sessionId)) {
        return sendError(res, 400, HTTP_API_ERROR_CODES.INVALID_INPUT, 'Invalid session id.');
      }

      const current = adapter.getSessionState(sessionId);
      assertOwner(req, current);
      const session = adapter.pauseSession(sessionId);
      return sendOk(res, 200, { session });
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  router.post('/api/atlas-live/sessions/:sessionId/resume', ...writeChain, async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!isValidSessionId(sessionId)) {
        return sendError(res, 400, HTTP_API_ERROR_CODES.INVALID_INPUT, 'Invalid session id.');
      }

      const current = adapter.getSessionState(sessionId);
      assertOwner(req, current);
      const session = await adapter.resumeSession(sessionId);
      return sendOk(res, 200, { session });
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  router.post('/api/atlas-live/sessions/:sessionId/stop', ...writeChain, async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!isValidSessionId(sessionId)) {
        return sendError(res, 400, HTTP_API_ERROR_CODES.INVALID_INPUT, 'Invalid session id.');
      }

      const current = adapter.getSessionState(sessionId);
      assertOwner(req, current);
      const session = await adapter.stopSession(sessionId);
      return sendOk(res, 200, { session });
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  router.post('/api/atlas-live/sessions/:sessionId/tick', ...writeChain, async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!isValidSessionId(sessionId)) {
        return sendError(res, 400, HTTP_API_ERROR_CODES.INVALID_INPUT, 'Invalid session id.');
      }

      const current = adapter.getSessionState(sessionId);
      assertOwner(req, current);
      const result = await adapter.tickSession(sessionId);
      return sendOk(res, 200, {
        session: result.session,
        tick: {
          ok: result.tick?.ok ?? true,
          durationMs: result.tick?.durationMs ?? null,
          beat: result.tick?.beat
            ? {
                id: result.tick.beat.id,
                kind: result.tick.beat.kind,
                reason: result.tick.beat.reason,
                durationMs: result.tick.beat.durationMs,
              }
            : null,
        },
        events: result.events,
      });
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  router.get('/api/atlas-live/sessions/:sessionId', ...readChain, (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!isValidSessionId(sessionId)) {
        return sendError(res, 400, HTTP_API_ERROR_CODES.INVALID_INPUT, 'Invalid session id.');
      }

      const session = adapter.getSessionState(sessionId);
      assertOwner(req, session);
      return sendOk(res, 200, { session });
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  router.get('/api/atlas-live/sessions/:sessionId/events', ...readChain, (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!isValidSessionId(sessionId)) {
        return sendError(res, 400, HTTP_API_ERROR_CODES.INVALID_INPUT, 'Invalid session id.');
      }

      const parsed = parseEventsQuery(req.query);
      if (!parsed.ok) {
        return sendError(res, 400, parsed.code, parsed.message);
      }

      const session = adapter.getSessionState(sessionId);
      assertOwner(req, session);

      const events = adapter.getSessionEvents(sessionId, {
        sinceSequence: parsed.value.sinceSequence,
        limit: parsed.value.limit,
      });

      return sendOk(res, 200, { events, limit: parsed.value.limit });
    } catch (err) {
      return handleRouteError(res, err);
    }
  });

  return { router, adapter };
}

/**
 * Mount Atlas Live HTTP routes on an Express app.
 * @param {import('express').Express} app
 * @param {AtlasLiveRouteDeps} [deps]
 */
export function mountAtlasLiveRoutes(app, deps = {}) {
  const { router } = createAtlasLiveRouter(deps);
  app.use(router);
  return router;
}
