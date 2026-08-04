import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { mkdirSync, writeFileSync, existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createZip } from './zip-utils.js';
import { callOpenAI } from './openai-client.js';
import { processAtlasMessage } from './atlas-message-service.js';
import { normalizeAtlasMessageRequest, toWebChatResponse } from './channel-adapters.js';
import { initializeFounderKnowledge, getFounderKnowledgeStatus } from './founder-knowledge.js';
import { initializeFounderProfiles, getFounderProfileStatus } from './founder-profile.js';
import { initializeAuthorProfile } from './author-profile.js';
import { initializePersonaEngine } from './persona-engine.js';
import { logFounderPipelineDebug } from './founder-identity.js';
import {
  deleteMemoryField,
  deleteUserMemory,
  getMemoryField,
  getUserMemory,
  isValidUserId,
  setMemoryField,
  setUserMemory,
  updateUserMemory,
} from './user-memory.js';
import {
  deleteAnalysisRecord,
  getAnalysisRecord,
  listUserAnalyses,
  saveAnalysisRecord,
} from './analysis-archive.js';
import { Runner } from '../runner/runner.js';
import { routeTask } from '../runner/task-router.js';
import { buildSymbolicAnalysis } from './symbolic-analysis/index.js';
import {
  canAccessUserMemory,
  evaluatePrivacyRequest,
  shouldShortCircuitPrivacy,
  sanitizeFounderResponse,
  logPrivacyEvent,
  SAFE_RESPONSES,
} from './privacy/index.js';
import {
  getAllowedOrigins,
  isAllowedOrigin,
  attachAuthFromSession,
  requireTelegramBotSecret,
  requireCsrfProtection,
  requireAuthenticated,
  requireAuth,
  requireRole,
  readSessionToken,
  setSessionCookie,
  clearSessionCookie,
  ensureCsrfCookie,
  requesterContextFromRequest,
  loginWithPassword,
  logoutSession,
  rateLimitMiddleware,
  findAccountByUserId,
  toPublicAccount,
  logAdminAudit,
} from './auth/index.js';
import { mountAtlasLiveRoutes } from './atlas-live/http/atlas-live-routes.js';
import { createAudioStudioRouter } from './audio-studio-routes.js';
import {
  getCapabilityRegistry,
  audioHealthSnapshot,
  getJobStats,
} from './audio-studio/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const GENERATED_DIR = join(__dirname, 'generated');
const runner = new Runner();

const founderInit = initializeFounderKnowledge();
const founderProfileInit = initializeFounderProfiles();
const authorProfileInit = initializeAuthorProfile();
if (!authorProfileInit.ok) {
  console.warn('[AuthorProfile] init warning:', authorProfileInit.error);
}
const personaEngineInit = initializePersonaEngine();
if (!personaEngineInit.ok) {
  console.warn('[PersonaEngine] init warning:', personaEngineInit.error);
}

/**
 * Memory ACL — uses server auth only. Path userId must match req.auth.userId.
 * @param {import('express').Request} req
 * @param {string} targetUserId
 */
function assertMemoryRouteAccess(req, targetUserId) {
  const auth = req.auth;
  if (!auth?.authenticated || !auth.userId) {
    try {
      logPrivacyEvent({
        channel: 'api',
        eventType: 'unauthorized_route_access',
        action: 'blocked',
        requestType: 'memory_access',
        reason: 'not_authenticated',
      });
    } catch {
      /* non-fatal */
    }
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  const ctx = requesterContextFromRequest(req);
  if (!canAccessUserMemory(ctx, targetUserId)) {
    try {
      logPrivacyEvent({
        channel: 'api',
        requesterId: auth.userId,
        eventType: 'cross_user_memory_attempt',
        action: 'blocked',
        requestType: 'memory_access',
        reason: 'owner_mismatch',
      });
    } catch {
      /* non-fatal */
    }
    return { ok: false, status: 403, error: 'Cross-user memory access denied.' };
  }

  return { ok: true };
}

// Ensure generated/ exists on startup
if (!existsSync(GENERATED_DIR)) {
  mkdirSync(GENERATED_DIR, { recursive: true });
  console.log(`[ATLAS] Created ${GENERATED_DIR}`);
}

const MIME_TYPES = {
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

const allowedOrigins = getAllowedOrigins();
app.use(
  cors({
    origin(origin, callback) {
      // No Origin: allow the request through without reflecting ACAO (non-browser /
      // health / CLI). Browser unsafe routes still require Origin via CSRF middleware.
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Atlas-Csrf', 'X-CSRF-Token'],
    optionsSuccessStatus: 204,
  }),
);
app.use(
  helmet({
    contentSecurityPolicy: false, // Vite/dev UI served separately
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production' || process.env.ATLAS_SECURE_COOKIES === 'true') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const loginRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 10,
  failClosed: true,
  message: 'Too many login attempts',
  keyFn: (req) => `login:${req.ip || 'unknown'}`,
});

const memoryRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  max: 60,
  keyFn: (req) => `memory:${req.auth?.userId || req.ip || 'unknown'}`,
});

const founderSensitiveRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  max: 30,
  keyFn: (req) => `founder-sensitive:${req.auth?.userId || req.ip || 'unknown'}`,
});

const atlasLiveRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  max: 120,
  keyFn: (req) => `atlas-live:${req.auth?.userId || req.ip || 'unknown'}`,
});

mountAtlasLiveRoutes(app, {
  attachAuth: attachAuthFromSession({ createAnonymous: true }),
  requireAuth: requireAuthenticated,
  requireCsrf: requireCsrfProtection,
  rateLimit: atlasLiveRateLimit,
});

const audioStudioRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 30,
  keyFn: (req) => `audio-studio:${req.auth?.userId || req.ip || 'unknown'}`,
});

app.use(
  '/api/audio',
  attachAuthFromSession({ createAnonymous: true }),
  createAudioStudioRouter({
    requireAuth: requireAuthenticated,
    requireCsrf: requireCsrfProtection,
    rateLimit: audioStudioRateLimit,
  }),
);

// ══════════════════════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

app.get('/api/auth/session', attachAuthFromSession({ createAnonymous: true }), (req, res) => {
  const csrf = ensureCsrfCookie(res, req);
  return res.json({
    authenticated: Boolean(req.auth?.authenticated),
    userId: req.auth?.userId ?? null,
    roles: req.auth?.roles ?? [],
    isFounder: Boolean(req.auth?.isFounder),
    isAnonymous: Boolean(req.auth?.isAnonymous),
    authMethod: req.auth?.authMethod ?? null,
    csrfToken: csrf,
  });
});

app.post(
  '/api/auth/login',
  loginRateLimit,
  attachAuthFromSession({ createAnonymous: false }),
  requireCsrfProtection,
  async (req, res) => {
    const username = String(req.body?.username ?? '');
    const password = String(req.body?.password ?? '');
    if (!username || !password) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    try {
      const previous = readSessionToken(req);
      const result = await loginWithPassword({
        username,
        password,
        previousRawToken: previous,
      });
      if (!result.ok) {
        return res.status(401).json({ error: result.error });
      }
      setSessionCookie(res, result.rawToken);
      const csrf = ensureCsrfCookie(res, req);
      return res.json({
        ok: true,
        userId: result.identity.userId,
        roles: result.identity.roles,
        isFounder: result.identity.isFounder,
        csrfToken: csrf,
      });
    } catch (err) {
      console.error('[ATLAS] login error:', err.message);
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }
  },
);

app.post(
  '/api/auth/logout',
  attachAuthFromSession({ createAnonymous: false }),
  requireCsrfProtection,
  (req, res) => {
    try {
      logoutSession(readSessionToken(req));
    } catch {
      /* ignore */
    }
    clearSessionCookie(res);
    return res.json({ ok: true });
  },
);

// ══════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS — backend role checks are authoritative
// ══════════════════════════════════════════════════════════════════════

/**
 * Safe admin profile. No password hash or private user content.
 */
app.get(
  '/api/admin/me',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  (req, res) => {
    try {
      const account = findAccountByUserId(req.auth.userId);
      const publicAccount = toPublicAccount(account);
      try {
        logAdminAudit({
          action: 'admin.me',
          actor: req.auth.userId,
          targetUserId: req.auth.userId,
          targetUsername: publicAccount?.username ?? null,
          targetEmail: publicAccount?.email ?? null,
          result: 'ok',
        });
      } catch {
        /* non-fatal */
      }
      return res.json({
        ok: true,
        userId: req.auth.userId,
        username: publicAccount?.username ?? null,
        email: publicAccount?.email ?? null,
        roles: [...(req.auth.roles ?? [])],
        isAdmin: true,
        isFounder: Boolean(req.auth.isFounder),
        authMethod: req.auth.authMethod ?? null,
      });
    } catch (err) {
      console.error('[ATLAS] admin/me error:', err.message);
      return res.status(503).json({ error: 'Admin service unavailable' });
    }
  },
);

/** Explicitly reject self-service role mutation — roles are CLI / server-side only. */
app.all('/api/admin/roles', (_req, res) => {
  return res.status(405).json({ error: 'Role changes are not available via API' });
});
app.all('/api/me/roles', (_req, res) => {
  return res.status(405).json({ error: 'Role changes are not available via API' });
});
app.all('/api/auth/roles', (_req, res) => {
  return res.status(405).json({ error: 'Role changes are not available via API' });
});

// ══════════════════════════════════════════════════════════════════════
// AI ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

app.get('/api/ai/health', async (_req, res) => {
  const founderStatus = getFounderKnowledgeStatus();
  const founderProfileStatus = getFounderProfileStatus();
  let audio = null;
  try {
    const registry = await getCapabilityRegistry();
    audio = audioHealthSnapshot(registry, getJobStats());
  } catch (err) {
    audio = { error: 'audio_health_unavailable' };
  }
  res.json({
    status: 'ok',
    configured: OPENAI_API_KEY.length > 0,
    model: DEFAULT_MODEL,
    webChat: true,
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    memory: true,
    auth: true,
    founderKnowledge: founderStatus.loaded && founderStatus.profileCount > 0,
    founderProfiles: founderStatus.profileCount,
    founderBiography: founderProfileStatus.loaded && founderProfileStatus.profileCount > 0,
    founderBiographyProfiles: founderProfileStatus.profileCount,
    modelProvider: OPENAI_API_KEY.length > 0,
    audio,
  });
});

/**
 * /api/ai/complete — no longer a public raw-model bypass.
 * Option B: founder/admin session required + privacy evaluation on prompts.
 */
app.post(
  '/api/ai/complete',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuthenticated,
  requireCsrfProtection,
  founderSensitiveRateLimit,
  async (req, res) => {
    if (!req.auth?.roles?.includes('founder') && !req.auth?.roles?.includes('admin')) {
      try {
        logPrivacyEvent({
          channel: 'api',
          requesterId: req.auth?.userId ?? null,
          eventType: 'ai_complete_blocked',
          action: 'blocked',
          reason: 'admin_or_founder_required',
        });
      } catch {
        /* ignore */
      }
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { systemPrompt, userPrompt, model, temperature, maxTokens } = req.body ?? {};
    if (!userPrompt) {
      return res.status(400).json({ error: 'userPrompt is required' });
    }
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OPENAI_API_KEY not set in .env' });
    }

    const combined = `${systemPrompt ?? ''}\n${userPrompt}`;
    const privacyEval = evaluatePrivacyRequest({
      message: combined,
      requesterContext: requesterContextFromRequest(req),
    });

    if (shouldShortCircuitPrivacy(privacyEval) && !privacyEval.authorized) {
      try {
        logPrivacyEvent({
          channel: 'api',
          requesterId: req.auth.userId,
          eventType: 'ai_complete_privacy_blocked',
          action: 'blocked',
          requestType: privacyEval.requestType,
          reason: privacyEval.reason,
        });
      } catch {
        /* ignore */
      }
      return res.status(403).json({
        error: 'Privacy policy blocked this request',
        reply: privacyEval.safeReply ?? SAFE_RESPONSES.PRIVACY,
      });
    }

    try {
      const result = await callOpenAI({
        systemPrompt,
        userPrompt,
        model: model || DEFAULT_MODEL,
        temperature,
        maxTokens,
        apiKey: OPENAI_API_KEY,
      });

      const text = typeof result?.content === 'string' ? result.content : '';

      const guarded = sanitizeFounderResponse(text, {
        requesterContext: requesterContextFromRequest(req),
        evaluation: privacyEval,
        channel: 'api',
      });

      if (guarded.blocked) {
        return res.status(403).json({
          error: 'Privacy policy blocked model output',
          reply: guarded.reply,
        });
      }

      console.log(
        `[ATLAS] ✓ ai/complete ${result.model} | ${result.tokensUsed} tok | $${result.costUsd.toFixed(4)}`,
      );
      return res.json({ ...result, content: guarded.reply, text: guarded.reply });
    } catch (err) {
      console.error(`[ATLAS] ${err.message}`);
      const status = err.status ?? 500;
      return res.status(status).json({ error: err.message });
    }
  },
);

const chatRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 45,
  message: 'Çok fazla istek. Lütfen kısa bir süre sonra yeniden dene.',
  keyFn: (req) => `chat:${req.auth?.userId || req.ip || 'unknown'}`,
});

const atlasMessageRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 60,
  message: 'Çok fazla istek. Lütfen kısa bir süre sonra yeniden dene.',
  keyFn: (req) =>
    `atlas-message:${req.auth?.userId || req.body?.userId || req.ip || 'unknown'}`,
});

const analysisRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 20,
  message: 'Çok fazla analiz isteği. Lütfen kısa bir süre sonra yeniden dene.',
  keyFn: (req) => `analysis:${req.auth?.userId || req.ip || 'unknown'}`,
});

// ── Atlas Chat — server-resolved identity only ──
app.post(
  '/api/chat',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  requireCsrfProtection,
  chatRateLimit,
  async (req, res) => {
    try {
      const body = {
        ...(req.body ?? {}),
        channel: 'web',
        // Ignore client userId — session identity wins
        userId: req.auth.userId,
      };
      const normalized = normalizeAtlasMessageRequest(body);
      normalized.userId = req.auth.userId;

      const result = await processAtlasMessage(normalized, {
        mode: req.body?.mode,
        model: req.body?.model || DEFAULT_MODEL,
        temperature: req.body?.temperature,
        maxTokens: req.body?.maxTokens,
        runner,
        auth: req.auth,
        requesterContext: requesterContextFromRequest(req),
      });

      const response = toWebChatResponse(result);
      const httpStatus =
        result.status === 'error' && result.errorCode === 'INVALID_INPUT' ? 400 : 200;

      console.log(
        `[ATLAS] ✓ chat/${normalized.channel} (${response.profile}/${response.mode})` +
          `${response.memoryHandled ? ' [memory]' : ''} | ${response.engine ?? response.model} | ${response.tokensUsed} tok`,
      );
      return res.status(httpStatus).json(response);
    } catch (err) {
      if (err.message?.includes('userId must be') || err.message?.includes('message is required')) {
        return res.status(400).json({ error: err.message });
      }
      if (err.message === 'CORS origin denied') {
        return res.status(403).json({ error: 'Origin not allowed' });
      }
      console.error(`[ATLAS] chat error: ${err.message}`);
      const status = err.status ?? 500;
      return res.status(status).json({ error: err.message });
    }
  },
);

// ── Telegram bot → backend (shared secret) OR authenticated web ──
app.post(
  '/api/atlas/message',
  requireTelegramBotSecret,
  (req, res, next) => {
    if (req.atlasBotVerified) return next();
    return attachAuthFromSession({ createAnonymous: true })(req, res, next);
  },
  (req, res, next) => {
    if (req.atlasBotVerified) return next();
    return requireAuthenticated(req, res, next);
  },
  (req, res, next) => {
    if (req.atlasBotVerified) return next();
    return requireCsrfProtection(req, res, next);
  },
  atlasMessageRateLimit,
  async (req, res) => {
    try {
      const body = {
        ...(req.body ?? {}),
        userId: req.auth.userId,
        channel: req.atlasBotVerified ? 'telegram' : req.body?.channel || 'web',
      };
      const normalized = normalizeAtlasMessageRequest(body);
      normalized.userId = req.auth.userId;
      if (req.atlasBotVerified) {
        normalized.channel = 'telegram';
        // Trust only bot-built speakerAttribution; drop spoofed body context otherwise.
        if (
          body?.context?.speakerAttribution &&
          typeof body.context.speakerAttribution === 'object' &&
          body.context.speakerAttribution.trusted === true
        ) {
          normalized.context = {
            ...(normalized.context && typeof normalized.context === 'object'
              ? normalized.context
              : {}),
            speakerAttribution: body.context.speakerAttribution,
          };
        } else {
          normalized.context = {
            ...(normalized.context && typeof normalized.context === 'object'
              ? normalized.context
              : {}),
            speakerAttribution: undefined,
          };
        }
      } else if (normalized.context?.speakerAttribution) {
        // Public/session HTTP must never trust client speakerAttribution.
        delete normalized.context.speakerAttribution;
      }

      const result = await processAtlasMessage(normalized, {
        model: req.body?.model || DEFAULT_MODEL,
        temperature: req.body?.temperature,
        maxTokens: req.body?.maxTokens,
        runner,
        auth: req.auth,
        requesterContext: requesterContextFromRequest(req),
        atlasBotVerified: Boolean(req.atlasBotVerified),
      });

      if (result.data?.pipelineDebug) {
        logFounderPipelineDebug(result.data.pipelineDebug, `Backend/${normalized.channel}`);
      }

      return res.json(result);
    } catch (err) {
      console.error(`[ATLAS] atlas/message error: ${err.message}`);
      return res.status(400).json({
        status: 'error',
        reply: err.message,
        errorCode: 'INVALID_INPUT',
      });
    }
  },
);

// ══════════════════════════════════════════════════════════════════════
// USER MEMORY ENDPOINTS — owner = req.auth.userId only
// ══════════════════════════════════════════════════════════════════════

app.get(
  '/api/memory/:userId',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  memoryRateLimit,
  (req, res) => {
    const { userId } = req.params;
    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const access = assertMemoryRouteAccess(req, userId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    try {
      const memory = getUserMemory(req.auth.userId);
      return res.json({ userId: req.auth.userId, memory });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
);

app.put(
  '/api/memory/:userId',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  requireCsrfProtection,
  memoryRateLimit,
  async (req, res) => {
    const { userId } = req.params;
    const { memory } = req.body ?? {};

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const access = assertMemoryRouteAccess(req, userId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    if (!memory || typeof memory !== 'object') {
      return res.status(400).json({ error: 'memory object is required' });
    }

    const result = await setUserMemory(req.auth.userId, memory);
    if (!result.ok) {
      return res.status(500).json({ error: result.error });
    }
    return res.json({ userId: req.auth.userId, memory: result.memory, saved: true });
  },
);

app.patch(
  '/api/memory/:userId',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  requireCsrfProtection,
  memoryRateLimit,
  async (req, res) => {
    const { userId } = req.params;
    const partial = req.body ?? {};

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const access = assertMemoryRouteAccess(req, userId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const result = await updateUserMemory(req.auth.userId, partial);
    if (!result.ok) {
      return res.status(500).json({ error: result.error });
    }
    return res.json({ userId: req.auth.userId, memory: result.memory, saved: true });
  },
);

app.delete(
  '/api/memory/:userId',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  requireCsrfProtection,
  memoryRateLimit,
  async (req, res) => {
    const { userId } = req.params;

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const access = assertMemoryRouteAccess(req, userId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const result = await deleteUserMemory(req.auth.userId);
    if (!result.ok) {
      const status = result.error === 'User memory not found' ? 404 : 500;
      return res.status(status).json({ error: result.error });
    }
    return res.json({ userId: req.auth.userId, deleted: true });
  },
);

app.get(
  '/api/memory/:userId/field',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  memoryRateLimit,
  (req, res) => {
    const { userId } = req.params;
    const path = req.query.path;

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    const access = assertMemoryRouteAccess(req, userId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }
    if (typeof path !== 'string' || !path.trim()) {
      return res.status(400).json({ error: 'path query parameter is required' });
    }

    try {
      const value = getMemoryField(req.auth.userId, path);
      if (value === undefined) {
        return res.status(404).json({ error: 'Field not found' });
      }
      return res.json({ userId: req.auth.userId, path, value });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
);

app.put(
  '/api/memory/:userId/field',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  requireCsrfProtection,
  memoryRateLimit,
  async (req, res) => {
    const { userId } = req.params;
    const path = req.query.path ?? req.body?.path;
    const { value } = req.body ?? {};

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    const access = assertMemoryRouteAccess(req, userId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }
    if (typeof path !== 'string' || !path.trim()) {
      return res.status(400).json({ error: 'path is required' });
    }

    const result = await setMemoryField(req.auth.userId, path, value);
    if (!result.ok) {
      return res.status(500).json({ error: result.error });
    }
    return res.json({
      userId: req.auth.userId,
      path,
      value,
      saved: true,
      memory: result.memory,
    });
  },
);

app.delete(
  '/api/memory/:userId/field',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  requireCsrfProtection,
  memoryRateLimit,
  async (req, res) => {
    const { userId } = req.params;
    const path = req.query.path;

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    const access = assertMemoryRouteAccess(req, userId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }
    if (typeof path !== 'string' || !path.trim()) {
      return res.status(400).json({ error: 'path query parameter is required' });
    }

    const result = await deleteMemoryField(req.auth.userId, path);
    if (!result.ok) {
      const status = result.error === 'Field not found' ? 404 : 500;
      return res.status(status).json({ error: result.error });
    }
    return res.json({
      userId: req.auth.userId,
      path,
      deleted: true,
      memory: result.memory,
    });
  },
);

// ══════════════════════════════════════════════════════════════════════
// ANALYSIS ARCHIVE ENDPOINTS (separate from profile memory)
// ══════════════════════════════════════════════════════════════════════

app.get(
  '/api/archive/:userId',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  (req, res) => {
    const { userId } = req.params;
    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    const access = assertMemoryRouteAccess(req, userId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }
    try {
      const analyses = listUserAnalyses(req.auth.userId);
      return res.json({ userId: req.auth.userId, analyses });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
);

app.get(
  '/api/archive/:userId/:analysisId',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  (req, res) => {
    const { userId, analysisId } = req.params;
    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    const access = assertMemoryRouteAccess(req, userId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }
    const record = getAnalysisRecord(req.auth.userId, analysisId);
    if (!record) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    return res.json({ userId: req.auth.userId, analysis: record });
  },
);

app.post(
  '/api/archive/:userId',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  requireCsrfProtection,
  async (req, res) => {
  const { userId } = req.params;
  const { record } = req.body ?? {};

  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  const access = assertMemoryRouteAccess(req, userId);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }
  if (!record || typeof record !== 'object') {
    return res.status(400).json({ error: 'record object is required' });
  }

  const result = await saveAnalysisRecord(req.auth.userId, record);
  if (!result.ok) {
    return res.status(500).json({ error: result.error });
  }
  return res.json({ userId: req.auth.userId, record: result.record, saved: true });
  },
);

app.delete(
  '/api/archive/:userId/:analysisId',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  requireCsrfProtection,
  async (req, res) => {
  const { userId, analysisId } = req.params;

  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  const access = assertMemoryRouteAccess(req, userId);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }

  const result = await deleteAnalysisRecord(req.auth.userId, analysisId);
  if (!result.ok) {
    const status = result.error === 'Analysis not found' ? 404 : 500;
    return res.status(status).json({ error: result.error });
  }
  return res.json({ userId: req.auth.userId, analysisId, deleted: true });
  },
);

// ══════════════════════════════════════════════════════════════════════
// ASSET PERSISTENCE ENDPOINTS
// Internal OS production packages — require non-anonymous auth.
// ══════════════════════════════════════════════════════════════════════

function isSafeAssetPathSegment(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 200 &&
    !value.includes('..') &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes('\0')
  );
}

const assetReadAuth = [
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
];
const assetWriteAuth = [
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireCsrfProtection,
];

// ── Save a completed pipeline package to disk ─────────────────────────
app.post('/api/assets/save', ...assetWriteAuth, (req, res) => {
  const { package: pkg } = req.body;

  if (!pkg || !pkg.topic || !pkg.script) {
    return res.status(400).json({ error: 'Invalid package — missing topic or script' });
  }

  // Create timestamped folder
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const folderName = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const folderPath = join(GENERATED_DIR, folderName);

  try {
    mkdirSync(folderPath, { recursive: true });
  } catch (err) {
    console.error(`[ATLAS] Failed to create folder: ${err.message}`);
    return res.status(500).json({ error: `Failed to create folder: ${err.message}` });
  }

  // Define files to write
  const files = [
    {
      name: 'script.md',
      content: `# ${pkg.topic}\n\n> ${pkg.hook || ''}\n\n${pkg.script}`,
    },
    {
      name: 'visual-prompts.md',
      content: `# Visual Prompts — ${pkg.topic}\n\n` +
        (Array.isArray(pkg.visualPrompts)
          ? pkg.visualPrompts.map((vp) => `## Scene ${vp.scene} (${vp.duration})\n\n${vp.prompt}\n`).join('\n')
          : `Raw output:\n\n${JSON.stringify(pkg.visualPrompts, null, 2)}`),
    },
    {
      name: 'thumbnail-brief.md',
      content: `# Thumbnail Brief — ${pkg.topic}\n\n${pkg.thumbnailConcept}`,
    },
    {
      name: 'seo-package.md',
      content: `# SEO Package — ${pkg.topic}\n\n## Title Options\n\n` +
        (pkg.titles || []).map((t, i) => `${i + 1}. ${t}`).join('\n') +
        `\n\n## Description\n\n${pkg.description || ''}` +
        `\n\n## Hashtags\n\n${(pkg.hashtags || []).join(' ')}`,
    },
    {
      name: 'final-package.json',
      content: JSON.stringify(pkg, null, 2),
    },
  ];

  // Write and verify each file
  const written = [];
  for (const file of files) {
    const filePath = join(folderPath, file.name);
    try {
      writeFileSync(filePath, file.content, 'utf-8');

      // Verify the file actually exists on disk
      if (!existsSync(filePath)) {
        console.error(`[ATLAS] Write verification failed: ${filePath}`);
        return res.status(500).json({ error: `Write verification failed for ${file.name}` });
      }

      const stat = statSync(filePath);
      written.push({
        name: file.name,
        size: stat.size,
        path: `${folderName}/${file.name}`,
      });
    } catch (err) {
      console.error(`[ATLAS] Failed to write ${file.name}: ${err.message}`);
      return res.status(500).json({ error: `Failed to write ${file.name}: ${err.message}` });
    }
  }

  console.log(`[ATLAS] ✓ Saved ${written.length} files to ${folderName}/`);
  return res.json({ folder: folderName, files: written });
});

// ── List all generated assets ─────────────────────────────────────────
app.get('/api/assets', ...assetReadAuth, (_req, res) => {
  try {
    if (!existsSync(GENERATED_DIR)) {
      return res.json({ productions: [] });
    }

    const folders = readdirSync(GENERATED_DIR)
      .filter((name) => {
        const fullPath = join(GENERATED_DIR, name);
        return statSync(fullPath).isDirectory();
      })
      .sort()
      .reverse(); // newest first

    const productions = folders.map((folder) => {
      const folderPath = join(GENERATED_DIR, folder);
      const files = readdirSync(folderPath)
        .filter((f) => statSync(join(folderPath, f)).isFile())
        .map((f) => {
          const stat = statSync(join(folderPath, f));
          return {
            name: f,
            size: stat.size,
            path: `${folder}/${f}`,
            modified: stat.mtime.toISOString(),
          };
        });

      // Try to read topic from final-package.json
      let topic = folder;
      const pkgPath = join(folderPath, 'final-package.json');
      if (existsSync(pkgPath)) {
        try {
          const pkgData = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          if (pkgData.topic) topic = pkgData.topic;
        } catch { /* use folder name */ }
      }

      const folderStat = statSync(folderPath);
      return {
        folder,
        topic,
        created: folderStat.mtime.toISOString(),
        files,
      };
    });

    return res.json({ productions });
  } catch (err) {
    console.error(`[ATLAS] Failed to list assets: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── Download a specific generated file ────────────────────────────────
app.get('/api/assets/:folder/:file/download', ...assetReadAuth, (req, res) => {
  const { folder, file } = req.params;

  // Prevent path traversal
  if (!isSafeAssetPathSegment(folder) || !isSafeAssetPathSegment(file)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  const filePath = join(GENERATED_DIR, folder, file);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const ext = extname(file).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file}"`);

  const content = readFileSync(filePath);
  return res.send(content);
});

// ── Download a full production as a real ZIP archive ──────────────────
const PACKAGE_FILES = [
  'script.md',
  'visual-prompts.md',
  'thumbnail-brief.md',
  'seo-package.md',
  'final-package.json',
];

app.get('/api/assets/:folder/download-zip', ...assetReadAuth, (req, res) => {
  const { folder } = req.params;

  // Prevent path traversal
  if (!isSafeAssetPathSegment(folder)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  const folderPath = join(GENERATED_DIR, folder);

  if (!existsSync(folderPath) || !statSync(folderPath).isDirectory()) {
    return res.status(404).json({ error: 'Production not found' });
  }

  try {
    const entries = [];
    for (const fileName of PACKAGE_FILES) {
      const filePath = join(folderPath, fileName);
      if (existsSync(filePath)) {
        entries.push({ name: fileName, content: readFileSync(filePath) });
      }
    }

    if (entries.length === 0) {
      return res.status(404).json({ error: 'No package files found for this production' });
    }

    const zipBuffer = createZip(entries);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${folder}.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    return res.send(zipBuffer);
  } catch (err) {
    console.error(`[ATLAS] Failed to build ZIP for ${folder}: ${err.message}`);
    return res.status(500).json({ error: `Failed to build ZIP: ${err.message}` });
  }
});
// ══════════════════════════════════════════════════════════════════════
// PERSONAL ANALYSIS ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

// ── Run the Personal Analysis Pipeline (routeTask → core-engine) ──────
// task_type is intentionally hardcoded to 'personal-analysis' below and
// is never read from the request body — this route exists for exactly
// one purpose, and this guarantees it can never fall through to the
// Content Pipeline regardless of what a caller sends.
app.post(
  '/api/personal-analysis',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  requireCsrfProtection,
  analysisRateLimit,
  async (req, res) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const { task_id, subject_profile, analysis_inputs, constraints } = body;
  // subject_id is always the authenticated user — never client-supplied
  const subject_id = req.auth.userId;

  if (typeof task_id !== 'string' || task_id.trim().length === 0) {
    return res.status(400).json({ error: 'task_id is required and must be a non-empty string' });
  }
  if (typeof subject_profile !== 'object' || subject_profile === null || Array.isArray(subject_profile)) {
    return res.status(400).json({ error: 'subject_profile is required and must be an object' });
  }
  if (analysis_inputs !== undefined && (typeof analysis_inputs !== 'object' || analysis_inputs === null || Array.isArray(analysis_inputs))) {
    return res.status(400).json({ error: 'analysis_inputs, if provided, must be an object' });
  }
  if (constraints !== undefined && !Array.isArray(constraints)) {
    return res.status(400).json({ error: 'constraints, if provided, must be an array' });
  }

  try {
    const result = await routeTask(
      {
        task_type: 'personal-analysis',
        task_id,
        subject_id,
        subject_profile,
        analysis_inputs,
        constraints,
      },
      runner
    );

    // The agent/provider call itself failed (routeTask/runPersonalAnalysis-
    // PipelineRunner's ok: false, result: null case) — this is a gateway
    // failure, not a client input problem or a core-engine business
    // outcome.
    if (result.result === null) {
      console.error(`[ATLAS] Personal analysis call failed for task ${task_id}: ${JSON.stringify(result.trace?.stages?.['core-engine']?.error)}`);
      return res.status(502).json({
        error: 'core-engine call did not succeed',
        stoppedAt: result.stoppedAt,
        detail: result.trace?.stages?.['core-engine']?.error ?? null,
      });
    }

    // Beyond this point, core-engine was reached and returned an envelope.
    // "complete" and non-"complete" (insufficient_data | reject) are both
    // valid business outcomes of core-engine's own logic, not HTTP errors —
    // both are reported as 200 with the envelope as the body.
    console.log(`[ATLAS] ✓ personal-analysis task ${task_id} → status: ${result.result.status}`);
    return res.status(200).json(result.result);

  } catch (err) {
    console.error(`[ATLAS] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
  },
);

// ══════════════════════════════════════════════════════════════════════
// SYMBOLIC ANALYSIS — unified experience (Ebced/Cifir/… stay internal)
// ══════════════════════════════════════════════════════════════════════

app.post(
  '/api/symbolic-analysis',
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  requireCsrfProtection,
  analysisRateLimit,
  (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const input =
      body.input && typeof body.input === 'object' && !Array.isArray(body.input)
        ? body.input
        : body;

    try {
      const report = buildSymbolicAnalysis({
        input,
        layers: Array.isArray(body.layers) ? body.layers : undefined,
      });

      // insufficient_data is a business outcome (200). Internal `trace`
      // stays off the default client payload unless explicitly requested.
      const includeTrace = body.include_trace === true;
      const payload = includeTrace
        ? report
        : {
            version: report.version,
            ok: report.ok,
            error: report.error,
            missingRequired: report.missingRequired,
            userResult: report.userResult,
            metadata: {
              llmUsed: report.metadata?.llmUsed ?? false,
              fabricated: report.metadata?.fabricated ?? false,
              photoUpload: report.metadata?.photoUpload ?? false,
              inputContract: report.metadata?.inputContract,
            },
          };

      return res.status(200).json(payload);
    } catch (err) {
      console.error(`[ATLAS] symbolic-analysis failed: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  },
);

// ══════════════════════════════════════════════════════════════════════
// PRODUCTION FRONTEND (optional) — serve Vite `dist/` from same origin
// Enable: NODE_ENV=production (and dist present) or ATLAS_SERVE_FRONTEND=1
// Disable: ATLAS_SERVE_FRONTEND=0
// ══════════════════════════════════════════════════════════════════════

const DIST_DIR = join(__dirname, '..', 'dist');
const serveFrontendExplicit = process.env.ATLAS_SERVE_FRONTEND;
const serveFrontend =
  serveFrontendExplicit === '1' ||
  (serveFrontendExplicit !== '0' &&
    process.env.NODE_ENV === 'production' &&
    existsSync(join(DIST_DIR, 'index.html')));

if (serveFrontend) {
  app.use(
    express.static(DIST_DIR, {
      index: false,
      maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
      fallthrough: true,
    }),
  );
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    const indexPath = join(DIST_DIR, 'index.html');
    if (!existsSync(indexPath)) return next();
    return res.sendFile(indexPath);
  });
  console.log(`[ATLAS] Serving frontend from ${DIST_DIR}`);
}

// ══════════════════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════════════════

export { app };

if (process.env.ATLAS_NO_LISTEN !== '1') {
  app.listen(PORT, () => {
    console.log('');
    console.log('  ATLAS Backend');
    console.log(`  http://localhost:${PORT}`);
    console.log(`  OpenAI: ${OPENAI_API_KEY ? '✓ Key configured' : '✗ No key — add OPENAI_API_KEY to .env'}`);
    console.log(`  Model:  ${DEFAULT_MODEL}`);
    console.log(`  Assets: ${GENERATED_DIR}`);
    console.log(`  Frontend: ${serveFrontend ? '✓ dist/ (same-origin)' : '✗ not served (API-only)'}`);
    console.log('  Auth:   POST /api/auth/login, GET /api/auth/session, POST /api/auth/logout');
    console.log('  Admin:  GET /api/admin/me (admin role required)');
    console.log('  Routes: POST /api/chat, POST /api/atlas/message, GET /api/ai/health, /api/audio/*');
    console.log('  Memory: ✓ JSON persistence initialized');
    console.log(
      `  Founder Knowledge: ${founderInit.ok ? '✓' : '✗'} ${founderInit.profileCount} profile(s)`,
    );
    console.log(
      `  Founder Profile:   ${founderProfileInit.ok ? '✓' : '✗'} ${founderProfileInit.profileCount} biography profile(s)`,
    );
    console.log(`  Web Chat: ✓ shared pipeline active`);
    console.log(`  Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? 'configured (start server/telegram.js separately)' : 'not configured'}`);
    console.log(`  CORS origins: ${allowedOrigins.join(', ')}`);
    console.log('');
  });
}
 