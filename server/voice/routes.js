/**
 * Voice TTS HTTP routes — POST /synthesize, GET /voices, GET /health
 */

import { Router } from 'express';
import { getVoiceConfig, SUPPORTED_LANGUAGES } from './config.js';
import { VOICE_ERROR_CODES, VoiceError, httpStatusForVoiceError, userMessageForVoiceError } from './errors.js';
import { listPublicVoices, getLaraMasterPath, isVoiceConfigured, getVoice } from './registry.js';
import { synthesizeSpeech } from './synthesize.js';
import { getUsageSnapshot } from './usage.js';
import { getCacheStats } from './cache.js';
import { createVoiceProvider } from './providers/index.js';

/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {*} data
 */
function sendOk(res, status, data) {
  return res.status(status).json({ ok: true, data, error: null });
}

/**
 * @param {import('express').Response} res
 * @param {VoiceError|Error} err
 */
function sendVoiceError(res, err) {
  const code =
    err instanceof VoiceError
      ? err.code
      : VOICE_ERROR_CODES.SYNTHESIS_FAILED;
  const status = err instanceof VoiceError ? err.status : httpStatusForVoiceError(code);
  return res.status(status).json({
    ok: false,
    data: null,
    error: {
      code,
      message: userMessageForVoiceError(code),
      retryable: Boolean(err?.retryable),
    },
  });
}

/**
 * Strip anything that looks like a secret from objects before JSON.
 * @param {unknown} value
 */
export function sanitizePublicPayload(value) {
  if (value == null) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitizePublicPayload);
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const key = k.toLowerCase();
    if (
      key.includes('apikey') ||
      key.includes('api_key') ||
      key.includes('secret') ||
      key.includes('authorization') ||
      key === 'xi-api-key' ||
      key === 'providervoiceid' ||
      key === 'provider_voice_id' ||
      key === 'providervoiceids'
    ) {
      continue;
    }
    out[k] = sanitizePublicPayload(v);
  }
  return out;
}

/**
 * Auth is optional for listing/health; synthesize requires voice.lara entitlement.
 * @param {{
 *   requireCsrf?: import('express').RequestHandler,
 *   rateLimit?: import('express').RequestHandler,
 *   requireVoiceLara?: import('express').RequestHandler,
 * }} [deps]
 */
export function createVoiceRouter(deps = {}) {
  const router = Router();
  const requireCsrf = deps.requireCsrf || ((_req, _res, next) => next());
  const rateLimit = deps.rateLimit || ((_req, _res, next) => next());
  const requireVoiceLara =
    deps.requireVoiceLara || ((_req, _res, next) => next());

  router.get('/voices', rateLimit, (req, res) => {
    try {
      const voices = listPublicVoices();
      return sendOk(res, 200, {
        voices,
        languages: [...SUPPORTED_LANGUAGES],
        defaultVoice: getVoiceConfig().defaultVoiceId,
        defaultLanguage: getVoiceConfig().defaultLanguage,
      });
    } catch (err) {
      return sendVoiceError(res, err);
    }
  });

  router.get('/health', rateLimit, async (_req, res) => {
    try {
      const cfg = getVoiceConfig();
      const provider = createVoiceProvider(cfg.providerId);
      const health = provider.healthCheck
        ? await provider.healthCheck()
        : { ok: false, detail: 'no_healthcheck' };
      const lara = getVoice('lara');
      return sendOk(res, 200, sanitizePublicPayload({
        provider: provider.id,
        providerHealthy: Boolean(health.ok),
        dryRun: cfg.dryRun,
        laraConfigured: lara ? isVoiceConfigured(lara) : false,
        masterAssetPresent: Boolean(getLaraMasterPath()),
        cache: getCacheStats(),
      }));
    } catch (err) {
      return sendVoiceError(res, err);
    }
  });

  router.post(
    '/synthesize',
    rateLimit,
    requireCsrf,
    requireVoiceLara,
    async (req, res) => {
      try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const userKey = req.auth?.userId || req.ip || 'anonymous';

        // Ignore client-supplied plan/entitlement fields (cannot self-grant)
        if (body && typeof body === 'object') {
          delete body.plan;
          delete body.entitlements;
          delete body.subscription;
          delete body.subscriptionStatus;
        }

        // Reject unknown secret-looking fields early
        for (const key of Object.keys(body)) {
          const lower = key.toLowerCase();
          if (
            lower.includes('apikey') ||
            lower.includes('api_key') ||
            lower.includes('secret') ||
            lower === 'xi-api-key'
          ) {
            return sendVoiceError(
              res,
              new VoiceError(VOICE_ERROR_CODES.INVALID_INPUT, 'secret_field_rejected'),
            );
          }
        }

        const result = await synthesizeSpeech({
          text: body.text,
          voice: body.voice,
          voiceId: body.voiceId,
          language: body.language,
          format: body.format,
          speed: body.speed,
          userKey,
          signal: req.abortSignal,
        });

        const accept = String(req.headers.accept || '');
        const wantJson = accept.includes('application/json') && body.returnJson === true;

        if (wantJson) {
          return sendOk(
            res,
            200,
            sanitizePublicPayload({
              voice: result.voice,
              language: result.language,
              provider: result.provider,
              format: result.format,
              mimeType: result.mimeType,
              cached: result.cached,
              audioBase64: result.audioBuffer.toString('base64'),
              usage: getUsageSnapshot(userKey),
            }),
          );
        }

        res.setHeader('Content-Type', result.mimeType || 'audio/mpeg');
        res.setHeader('X-Atlas-Voice', result.voice);
        res.setHeader('X-Atlas-Language', result.language);
        res.setHeader('X-Atlas-Provider', result.provider);
        res.setHeader('X-Atlas-Cached', result.cached ? '1' : '0');
        res.setHeader('Cache-Control', 'private, max-age=0, no-store');
        return res.status(200).send(result.audioBuffer);
      } catch (err) {
        return sendVoiceError(res, err instanceof VoiceError ? err : new VoiceError(
          VOICE_ERROR_CODES.SYNTHESIS_FAILED,
          err?.message,
        ));
      }
    },
  );

  return router;
}

export function mountVoiceRoutes(app, deps = {}) {
  app.use('/api/voice', createVoiceRouter(deps));
}
