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
import { chatUsageGate } from './entitlements/usage-guard.js';
import { CAPABILITIES } from './entitlements/capabilities.js';
import { resolveEntitlements, hasCapability } from './entitlements/resolve.js';
import { getSubscription, toPublicSubscription } from './entitlements/subscription-store.js';
import { getChatUsageSnapshot } from './usage/chat-usage.js';
import { getPrimeProfile, updatePrimeProfile } from './prime/profile.js';
import { listPrimeMemoryFacts, deletePrimeMemoryFact } from './prime/memory.js';
import { buildPrimeToday } from './prime/today.js';
import { getTodayCheckin, saveTodayCheckin, listCheckinHistory } from './prime/checkin.js';
import { buildSevenDayOutlookTracked } from './prime/outlook.js';
import {
  listAdminUsers,
  getAdminUserDetail,
  getAdminOverview,
  getAdminUsage,
  getAdminCosts,
  getAdminHealth,
  getAdminAuditLog,
} from './admin/control-center.js';
import { listAtlasLabTraces, getAtlasLabTrace } from './atlas-lab/trace-store.js';
import {
  grantPrime,
  revokePrime,
  extendPrime,
  setPrimeExpiry,
  resetUsageToday,
  setAccountDisabled,
  erasePersonalData,
} from './admin/write-actions.js';
import {
  createFeedback,
  listFeedback,
  getFeedbackById,
  updateFeedbackStatus,
  updateFeedbackPriority,
  setFeedbackAdminNote,
} from './feedback/store.js';
import {
  recordError,
  listErrors,
  getErrorById,
  updateErrorStatus,
} from './admin/error-log.js';
import { validateImageAttachment } from './entitlements/image-guard.js';
import {
  appendMessage as appendConversationMessage,
  getConversation as getStoredConversation,
  listUserConversations,
  deleteConversation as deleteStoredConversation,
  deleteAllUserConversations,
} from './conversations.js';
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
  registerWithEmail,
  loginWithGoogleIdentity,
  logoutSession,
  rateLimitMiddleware,
  checkRateLimit,
  findAccountByUserId,
  listAllAccounts,
  toPublicAccount,
  toSessionProfile,
  logAdminAudit,
  mountGoogleOAuthRoutes,
} from './auth/index.js';
import { mountAtlasLiveRoutes } from './atlas-live/http/atlas-live-routes.js';
import { createAudioStudioRouter } from './audio-studio-routes.js';
import { createVoiceRouter } from './voice/index.js';
import { getVoiceConfig } from './voice/config.js';
import {
  createEntitlementsRouter,
  requireVoiceLara,
  requirePrimeWorld,
  buildEntitlementsResponse,
} from './entitlements/index.js';
import {
  createBillingRouter,
  createBillingWebhookRouter,
} from './billing/index.js';
import {
  getCapabilityRegistry,
  audioHealthSnapshot,
  getJobStats,
} from './audio-studio/index.js';

import { mountSeoRoutes } from './seo/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CRITICAL (Namecheap LiteSpeed / lsnode.js):
// Do NOT use top-level await in this file (e.g. `await import('./seo/...')`).
// lsnode loads the app with require(); a TLA graph throws:
//   Error [ERR_REQUIRE_ASYNC_MODULE]
// and every URL returns HTML 503. Keep SEO as a static import; package always ships server/seo/.

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

// Canonical host: apex. www → https://cosmicsimya.com (301)
app.use((req, res, next) => {
  const host = String(req.headers.host || '')
    .split(':')[0]
    .toLowerCase();
  if (host === 'www.cosmicsimya.com') {
    const pathQs = req.originalUrl || '/';
    return res.redirect(301, `https://cosmicsimya.com${pathQs}`);
  }
  return next();
});

// Default body limit stays tight — most routes only carry small JSON payloads.
// /api/chat gets its own larger parser (see below) for base64 image attachments;
// this keeps the wider attack surface scoped to the one route that needs it.
const DEFAULT_JSON_LIMIT = '2mb';
// Comfortably above image-guard.js's 6MB decoded ceiling (base64 adds ~33% + JSON envelope).
const CHAT_JSON_LIMIT = '10mb';
const chatJsonParser = express.json({ limit: CHAT_JSON_LIMIT });

app.use((req, res, next) => {
  if (req.path === '/api/chat') return next(); // parsed by chatJsonParser in the route chain below
  return express.json({ limit: DEFAULT_JSON_LIMIT })(req, res, next);
});
app.use(cookieParser());

const loginRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 10,
  failClosed: true,
  message: 'Too many login attempts',
  keyFn: (req) => `login:${req.ip || 'unknown'}`,
});

const registerRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 8,
  failClosed: true,
  message: 'Too many registration attempts',
  keyFn: (req) => `register:${req.ip || 'unknown'}`,
});

const googleOAuthRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 30,
  failClosed: true,
  message: 'Too many Google authentication attempts',
  keyFn: (req) => `google-oauth:${req.ip || 'unknown'}`,
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

/** Voice TTS — Premium-gated synthesize; CSRF on POST. */
function voiceTtsRateLimit(req, res, next) {
  try {
    const cfg = getVoiceConfig();
    const isAnon =
      Boolean(req.auth?.isAnonymous) ||
      (Array.isArray(req.auth?.roles) && req.auth.roles.includes('anonymous')) ||
      (typeof req.auth?.userId === 'string' && req.auth.userId.startsWith('anonymous:'));
    const max = isAnon ? cfg.anonymousMaxPerMinute : cfg.authenticatedMaxPerMinute;
    const key = `voice-tts:${req.auth?.userId || req.ip || 'unknown'}`;
    const result = checkRateLimit(key, { windowMs: 60_000, max });
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      return res.status(429).json({
        ok: false,
        data: null,
        error: { code: 'rate_limited', message: 'Çok fazla istek. Lütfen biraz bekleyin.' },
      });
    }
    return next();
  } catch {
    return next();
  }
}

app.use(
  '/api/voice',
  attachAuthFromSession({ createAnonymous: true }),
  createVoiceRouter({
    requireCsrf: requireCsrfProtection,
    rateLimit: voiceTtsRateLimit,
    requireVoiceLara: requireVoiceLara(),
  }),
);

const entitlementsRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 60,
  keyFn: (req) => `entitlements:${req.auth?.userId || req.ip || 'unknown'}`,
});

app.use(
  '/api/me/entitlements',
  attachAuthFromSession({ createAnonymous: true }),
  createEntitlementsRouter({ rateLimit: entitlementsRateLimit }),
);

/** Alias for mobile clients that prefer a flat path */
app.use(
  '/api/entitlements',
  attachAuthFromSession({ createAnonymous: true }),
  createEntitlementsRouter({ rateLimit: entitlementsRateLimit }),
);

const billingRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 30,
  keyFn: (req) => `billing:${req.auth?.userId || req.ip || 'unknown'}`,
});

const billingWebhookRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 120,
  keyFn: (req) => `billing-webhook:${req.ip || 'unknown'}`,
});

app.use(
  '/api/billing',
  attachAuthFromSession({ createAnonymous: true }),
  createBillingRouter({
    requireAuth: requireAuthenticated,
    requireCsrf: requireCsrfProtection,
    rateLimit: billingRateLimit,
  }),
);

app.use(
  '/api/billing/webhook',
  createBillingWebhookRouter({ rateLimit: billingWebhookRateLimit }),
);

// ══════════════════════════════════════════════════════════════════════
// SEO — /sitemap.xml + /robots.txt (before static SPA fallback)
// ══════════════════════════════════════════════════════════════════════

mountSeoRoutes(app);

// ══════════════════════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

app.get('/api/auth/session', attachAuthFromSession({ createAnonymous: true }), (req, res) => {
  const csrf = ensureCsrfCookie(res, req);
  const isAnon = Boolean(req.auth?.isAnonymous);
  const account =
    req.auth?.authenticated && !isAnon && req.auth?.userId
      ? findAccountByUserId(req.auth.userId)
      : null;
  const profile = toSessionProfile(account);
  const entitlements = buildEntitlementsResponse(req.auth || {});
  return res.json({
    authenticated: Boolean(req.auth?.authenticated),
    userId: req.auth?.userId ?? null,
    roles: req.auth?.roles ?? [],
    isFounder: Boolean(req.auth?.isFounder),
    isAnonymous: isAnon,
    authMethod: req.auth?.authMethod ?? null,
    email: profile?.email ?? null,
    displayName: profile?.displayName ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    plan: entitlements.plan,
    entitlements: entitlements.entitlements,
    csrfToken: csrf,
  });
});

mountGoogleOAuthRoutes(app, { rateLimit: googleOAuthRateLimit });

app.post(
  '/api/auth/register',
  registerRateLimit,
  attachAuthFromSession({ createAnonymous: false }),
  requireCsrfProtection,
  async (req, res) => {
    const email = String(req.body?.email ?? '');
    const password = String(req.body?.password ?? '');
    const passwordConfirm =
      req.body?.passwordConfirm !== undefined ? String(req.body.passwordConfirm) : undefined;
    const displayName =
      req.body?.displayName != null ? String(req.body.displayName).trim().slice(0, 120) : null;

    if (passwordConfirm !== undefined && passwordConfirm !== password) {
      return res.status(400).json({
        error: 'Passwords do not match',
        code: 'password_mismatch',
      });
    }

    try {
      const previous = readSessionToken(req);
      const result = await registerWithEmail({
        email,
        password,
        displayName,
        previousRawToken: previous,
      });
      if (!result.ok) {
        const status =
          result.code === 'duplicate_email'
            ? 409
            : result.code === 'weak_password' || result.code === 'invalid_email'
              ? 400
              : 400;
        return res.status(status).json({ error: result.error, code: result.code });
      }
      setSessionCookie(res, result.rawToken);
      const csrf = ensureCsrfCookie(res, req);
      const profile = toSessionProfile(result.account);
      return res.status(201).json({
        ok: true,
        roles: result.identity.roles,
        isFounder: result.identity.isFounder,
        email: profile?.email ?? null,
        displayName: profile?.displayName ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        csrfToken: csrf,
      });
    } catch (err) {
      console.error('[ATLAS] register error:', err.message);
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }
  },
);

app.post(
  '/api/auth/login',
  loginRateLimit,
  attachAuthFromSession({ createAnonymous: false }),
  requireCsrfProtection,
  async (req, res) => {
    const username = String(req.body?.username ?? req.body?.email ?? '');
    const password = String(req.body?.password ?? '');
    if (!username || !password) {
      return res.status(400).json({
        error: 'Invalid username or password',
        code: 'invalid_credentials',
      });
    }

    try {
      const previous = readSessionToken(req);
      const result = await loginWithPassword({
        username,
        password,
        previousRawToken: previous,
      });
      if (!result.ok) {
        return res.status(401).json({ error: result.error, code: result.code });
      }
      setSessionCookie(res, result.rawToken);
      const csrf = ensureCsrfCookie(res, req);
      const profile = toSessionProfile(result.account);
      return res.json({
        ok: true,
        roles: result.identity.roles,
        isFounder: result.identity.isFounder,
        email: profile?.email ?? null,
        displayName: profile?.displayName ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
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

/**
 * Prime membership visibility for admin — plan, subscription status,
 * entitlements, and usage only. Never returns raw memory facts, raw
 * images/audio, secrets, API keys, webhook secrets, or provider payloads.
 * Guests are never listed (listAllAccounts only returns real accounts).
 */
app.get(
  '/api/admin/membership',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  (req, res) => {
    try {
      const accounts = listAllAccounts();
      const members = accounts.map((account) => {
        const publicAccount = toPublicAccount(account);
        let resolved;
        try {
          resolved = resolveEntitlements({
            authenticated: true,
            userId: account.userId,
            isAnonymous: false,
          });
        } catch {
          // Fail closed: an unresolvable subscription record must never be
          // shown as premium.
          resolved = {
            plan: 'free',
            subscriptionStatus: 'unknown',
            entitlements: {},
            subscription: null,
          };
        }
        const usage = getChatUsageSnapshot(account.userId, resolved.plan);
        return {
          userId: publicAccount.userId,
          username: publicAccount.username,
          email: publicAccount.email,
          plan: resolved.plan,
          subscriptionStatus: resolved.subscriptionStatus,
          subscription: resolved.subscription, // already public-safe (toPublicSubscription)
          entitlements: {
            'voice.lara': hasCapability(resolved.entitlements, CAPABILITIES.VOICE_LARA),
            'usage.extended': hasCapability(resolved.entitlements, CAPABILITIES.USAGE_EXTENDED),
            'image.analysis': hasCapability(resolved.entitlements, CAPABILITIES.IMAGE_ANALYSIS),
            'memory.extended': hasCapability(resolved.entitlements, CAPABILITIES.MEMORY_EXTENDED),
          },
          usage: { dailyUsed: usage.used, dailyLimit: usage.limit },
        };
      });

      try {
        logAdminAudit({
          action: 'admin.membership_list',
          actor: req.auth.userId,
          targetUserId: null,
          targetUsername: null,
          targetEmail: null,
          result: 'ok',
        });
      } catch {
        /* non-fatal */
      }

      return res.json({ ok: true, members });
    } catch (err) {
      console.error('[ATLAS] admin/membership error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Prime personal center — authenticated accounts only, never guest.
// Owner-scoped by construction: userId always comes from req.auth, never
// from the request body/params.
// ═══════════════════════════════════════════════════════════════════════
const primeRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 60,
  message: 'Çok fazla istek. Lütfen kısa bir süre sonra yeniden dene.',
  keyFn: (req) => `prime:${req.auth?.userId || req.ip || 'unknown'}`,
});

app.get(
  '/api/prime/profile',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  primeRateLimit,
  (req, res) => {
    const result = getPrimeProfile(req.auth.userId);
    if (!result.ok) return res.status(500).json({ ok: false, error: result.error });
    return res.json({ ok: true, profile: result.profile });
  },
);

app.patch(
  '/api/prime/profile',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireCsrfProtection,
  primeRateLimit,
  async (req, res) => {
    const result = await updatePrimeProfile(req.auth.userId, req.body ?? {});
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, profile: result.profile });
  },
);

app.get(
  '/api/prime/today',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  primeRateLimit,
  (req, res) => {
    try {
      const today = buildPrimeToday(req.auth.userId, req.auth);
      return res.json({ ok: true, today });
    } catch (err) {
      console.error('[ATLAS] prime/today error:', err.message);
      return res.status(500).json({ ok: false, error: 'Prime home service unavailable' });
    }
  },
);

app.get(
  '/api/prime/memory',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  primeRateLimit,
  (req, res) => {
    const result = listPrimeMemoryFacts(req.auth.userId);
    if (!result.ok) return res.status(500).json({ ok: false, error: result.error });
    return res.json({ ok: true, facts: result.facts });
  },
);

app.delete(
  '/api/prime/memory/:factKey',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireCsrfProtection,
  primeRateLimit,
  async (req, res) => {
    const result = await deletePrimeMemoryFact(req.auth.userId, req.params.factKey);
    if (!result.ok) {
      const status = result.error === 'Fact not found' ? 404 : 400;
      return res.status(status).json({ ok: false, error: result.error });
    }
    return res.json({ ok: true, deleted: true });
  },
);

const requirePrimeWorldGate = requirePrimeWorld();

app.get(
  '/api/prime/checkin/today',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requirePrimeWorldGate,
  primeRateLimit,
  (req, res) => {
    const result = getTodayCheckin(req.auth.userId);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, date: result.date, checkin: result.checkin, frequency: result.frequency });
  },
);

app.get(
  '/api/prime/checkin/history',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requirePrimeWorldGate,
  primeRateLimit,
  (req, res) => {
    const result = listCheckinHistory(req.auth.userId, { limit: req.query.limit });
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, items: result.items });
  },
);

app.post(
  '/api/prime/checkin',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireCsrfProtection,
  requirePrimeWorldGate,
  primeRateLimit,
  async (req, res) => {
    const result = await saveTodayCheckin(req.auth.userId, req.body ?? {});
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, checkin: result.checkin, frequency: result.frequency });
  },
);

app.get(
  '/api/prime/outlook',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requirePrimeWorldGate,
  primeRateLimit,
  (req, res) => {
    try {
      const profileResult = getPrimeProfile(req.auth.userId);
      const profile = profileResult.ok ? profileResult.profile : null;
      const todayCheckin = getTodayCheckin(req.auth.userId);
      const outlook = buildSevenDayOutlookTracked({
        profile,
        checkin: todayCheckin.ok ? todayCheckin.checkin : null,
        timezone: profile?.birth?.timezone || null,
      });
      return res.json({ ok: true, outlook });
    } catch (err) {
      console.error('[ATLAS] prime/outlook error:', err.message);
      return res.status(500).json({ ok: false, error: 'Outlook service unavailable' });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════
// User feedback submission — feeds the Admin Control Center Feedback tab.
// Any authenticated (non-anonymous) user may submit; listing/triage is
// admin-only (see Admin Control Center section below).
// ═══════════════════════════════════════════════════════════════════════
const feedbackSubmitRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 20,
  message: 'Çok fazla geri bildirim gönderildi. Lütfen kısa bir süre sonra yeniden dene.',
  keyFn: (req) => `feedback-submit:${req.auth?.userId || req.ip || 'unknown'}`,
});

app.post(
  '/api/feedback',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireCsrfProtection,
  feedbackSubmitRateLimit,
  async (req, res) => {
    const result = await createFeedback({
      userId: req.auth.userId,
      type: req.body?.type,
      message: req.body?.message,
      route: req.body?.route,
      conversationId: req.body?.conversationId,
      messageId: req.body?.messageId,
    });
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, feedback: result.feedback });
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Admin Control Center — Phase A. All routes: requireAuth + requireRole('admin').
// Read-only (write actions deferred per audit — no safe subscription-store
// write API with audit/rollback semantics exists yet).
// ═══════════════════════════════════════════════════════════════════════
const adminRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 120,
  message: 'Çok fazla istek. Lütfen kısa bir süre sonra yeniden dene.',
  keyFn: (req) => `admin-cc:${req.auth?.userId || req.ip || 'unknown'}`,
});

app.get(
  '/api/admin/overview',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    try {
      return res.json({ ok: true, overview: getAdminOverview() });
    } catch (err) {
      console.error('[ATLAS] admin/overview error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

app.get(
  '/api/admin/users',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    try {
      const result = listAdminUsers({
        search: req.query.search,
        plan: req.query.plan,
        subscriptionStatus: req.query.subscriptionStatus,
        role: req.query.role,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[ATLAS] admin/users error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

app.get(
  '/api/admin/prime',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    try {
      const result = listAdminUsers({
        plan: 'premium',
        limit: req.query.limit,
        offset: req.query.offset,
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[ATLAS] admin/prime error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

app.get(
  '/api/admin/users/:userId',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    try {
      const result = getAdminUserDetail(req.params.userId);
      if (!result.ok) return res.status(404).json({ ok: false, error: result.error });
      return res.json({ ok: true, user: result.user });
    } catch (err) {
      console.error('[ATLAS] admin/users/:userId error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

app.get(
  '/api/admin/usage',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    try {
      return res.json({ ok: true, usage: getAdminUsage() });
    } catch (err) {
      console.error('[ATLAS] admin/usage error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

app.get(
  '/api/admin/costs',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    return res.json({ ok: true, costs: getAdminCosts() });
  },
);

app.get(
  '/api/admin/health',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    try {
      return res.json({ ok: true, health: getAdminHealth() });
    } catch (err) {
      console.error('[ATLAS] admin/health error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

app.get(
  '/api/admin/audit',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    try {
      const result = getAdminAuditLog({ limit: req.query.limit, offset: req.query.offset });
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[ATLAS] admin/audit error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════
// ATLAS LAB (read-only, dev/admin observability) — recent request traces
// captured by server/atlas-lab/trace-store.js via request-timing.js. This
// is diagnostic-only: it never mutates a conversation, never rewrites a
// response, and carries no chain-of-thought (see trace-store.js header).
// ═══════════════════════════════════════════════════════════════════════
app.get(
  '/api/admin/atlas-lab/traces',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const channel = typeof req.query.channel === 'string' && req.query.channel ? req.query.channel : undefined;
      const traces = listAtlasLabTraces({ channel, limit });
      return res.json({ ok: true, traces });
    } catch (err) {
      console.error('[ATLAS] admin/atlas-lab/traces error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

app.get(
  '/api/admin/atlas-lab/traces/:requestId',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    try {
      const trace = getAtlasLabTrace(req.params.requestId);
      if (!trace) return res.status(404).json({ ok: false, error: 'Trace not found' });
      return res.json({ ok: true, trace });
    } catch (err) {
      console.error('[ATLAS] admin/atlas-lab/traces/:requestId error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Admin Control Center — Feedback panel (read). Structured user feedback
// with a status/priority/note triage workflow.
// ═══════════════════════════════════════════════════════════════════════
app.get(
  '/api/admin/feedback',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    try {
      const result = listFeedback({
        status: req.query.status,
        priority: req.query.priority,
        type: req.query.type,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[ATLAS] admin/feedback error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

app.get(
  '/api/admin/feedback/:id',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    try {
      const entry = getFeedbackById(req.params.id);
      if (!entry) return res.status(404).json({ ok: false, error: 'Feedback not found' });
      return res.json({ ok: true, feedback: entry });
    } catch (err) {
      console.error('[ATLAS] admin/feedback/:id error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Admin Control Center — Error / Incident panel (read). Errors are
// captured server-side (global error handler + explicit reports below);
// this only ever exposes the already-redacted safeMessage, never a raw
// stack trace or request payload.
// ═══════════════════════════════════════════════════════════════════════
app.get(
  '/api/admin/errors',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    try {
      const result = listErrors({
        status: req.query.status,
        severity: req.query.severity,
        source: req.query.source,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[ATLAS] admin/errors error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

app.get(
  '/api/admin/errors/:id',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  adminRateLimit,
  (req, res) => {
    try {
      const entry = getErrorById(req.params.id);
      if (!entry) return res.status(404).json({ ok: false, error: 'Error not found' });
      return res.json({ ok: true, error: entry });
    } catch (err) {
      console.error('[ATLAS] admin/errors/:id error:', err.message);
      return res.status(503).json({ ok: false, error: 'Admin service unavailable' });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Admin Control Center — Phase B write actions. All mutating, all
// requireAuth + requireRole('admin') + CSRF, all audited server-side.
// ═══════════════════════════════════════════════════════════════════════
const ADMIN_WRITE_FORBIDDEN_FIELDS = ['adminId', 'actorId', 'entitlements', 'role', 'roles', 'isAdmin', 'plan', 'capabilities'];
function rejectAdminAuthoritySpoof(req, res, next) {
  for (const key of ADMIN_WRITE_FORBIDDEN_FIELDS) {
    if (req.body && typeof req.body === 'object' && key in req.body) {
      return res.status(400).json({ ok: false, error: `Field not allowed: ${key}` });
    }
  }
  return next();
}

app.post(
  '/api/admin/users/:userId/prime/grant',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  requireCsrfProtection,
  adminRateLimit,
  rejectAdminAuthoritySpoof,
  (req, res) => {
    const result = grantPrime({
      actorId: req.auth.userId,
      targetUserId: req.params.userId,
      durationDays: req.body?.durationDays,
      reason: req.body?.reason,
    });
    return res.status(result.ok ? 200 : (result.status ?? 400)).json(result);
  },
);

app.post(
  '/api/admin/users/:userId/prime/revoke',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  requireCsrfProtection,
  adminRateLimit,
  rejectAdminAuthoritySpoof,
  (req, res) => {
    const result = revokePrime({
      actorId: req.auth.userId,
      targetUserId: req.params.userId,
      reason: req.body?.reason,
    });
    return res.status(result.ok ? 200 : (result.status ?? 400)).json(result);
  },
);

app.post(
  '/api/admin/users/:userId/prime/extend',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  requireCsrfProtection,
  adminRateLimit,
  rejectAdminAuthoritySpoof,
  (req, res) => {
    const result = extendPrime({
      actorId: req.auth.userId,
      targetUserId: req.params.userId,
      durationDays: req.body?.durationDays,
      reason: req.body?.reason,
    });
    return res.status(result.ok ? 200 : (result.status ?? 400)).json(result);
  },
);

app.patch(
  '/api/admin/users/:userId/prime/expiry',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  requireCsrfProtection,
  adminRateLimit,
  rejectAdminAuthoritySpoof,
  (req, res) => {
    const result = setPrimeExpiry({
      actorId: req.auth.userId,
      targetUserId: req.params.userId,
      expiryDate: req.body?.expiryDate,
      reason: req.body?.reason,
    });
    return res.status(result.ok ? 200 : (result.status ?? 400)).json(result);
  },
);

app.post(
  '/api/admin/users/:userId/usage/reset',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  requireCsrfProtection,
  adminRateLimit,
  rejectAdminAuthoritySpoof,
  (req, res) => {
    const result = resetUsageToday({
      actorId: req.auth.userId,
      targetUserId: req.params.userId,
      reason: req.body?.reason,
    });
    return res.status(result.ok ? 200 : (result.status ?? 400)).json(result);
  },
);

app.post(
  '/api/admin/users/:userId/account/disable',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  requireCsrfProtection,
  adminRateLimit,
  rejectAdminAuthoritySpoof,
  async (req, res) => {
    const result = await setAccountDisabled({
      actorId: req.auth.userId,
      targetUserId: req.params.userId,
      disabled: true,
      reason: req.body?.reason,
    });
    return res.status(result.ok ? 200 : (result.status ?? 400)).json(result);
  },
);

app.post(
  '/api/admin/users/:userId/account/enable',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  requireCsrfProtection,
  adminRateLimit,
  rejectAdminAuthoritySpoof,
  async (req, res) => {
    const result = await setAccountDisabled({
      actorId: req.auth.userId,
      targetUserId: req.params.userId,
      disabled: false,
      reason: req.body?.reason,
    });
    return res.status(result.ok ? 200 : (result.status ?? 400)).json(result);
  },
);

app.post(
  '/api/admin/users/:userId/privacy/erase',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  requireCsrfProtection,
  adminRateLimit,
  rejectAdminAuthoritySpoof,
  async (req, res) => {
    const result = await erasePersonalData({
      actorId: req.auth.userId,
      targetUserId: req.params.userId,
      reason: req.body?.reason,
    });
    return res.status(result.ok ? 200 : (result.status ?? 400)).json(result);
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Admin Control Center — Feedback panel (write). All mutating, all
// requireAuth + requireRole('admin') + CSRF, all audited server-side.
// ═══════════════════════════════════════════════════════════════════════
app.patch(
  '/api/admin/feedback/:id/status',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  requireCsrfProtection,
  adminRateLimit,
  rejectAdminAuthoritySpoof,
  async (req, res) => {
    const before = getFeedbackById(req.params.id);
    const result = await updateFeedbackStatus({ id: req.params.id, status: req.body?.status });
    try {
      logAdminAudit({
        action: 'admin.feedback.status',
        actor: req.auth.userId,
        targetUserId: before?.userId ?? null,
        result: result.ok ? 'ok' : 'error',
        meta: { feedbackId: req.params.id, before: before?.status ?? null, after: result.ok ? result.feedback.status : null },
      });
    } catch {
      /* audit failure must never block the mutation's response */
    }
    return res.status(result.ok ? 200 : (result.status ?? 400)).json(result);
  },
);

app.patch(
  '/api/admin/feedback/:id/priority',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  requireCsrfProtection,
  adminRateLimit,
  rejectAdminAuthoritySpoof,
  async (req, res) => {
    const before = getFeedbackById(req.params.id);
    const result = await updateFeedbackPriority({ id: req.params.id, priority: req.body?.priority });
    try {
      logAdminAudit({
        action: 'admin.feedback.priority',
        actor: req.auth.userId,
        targetUserId: before?.userId ?? null,
        result: result.ok ? 'ok' : 'error',
        meta: { feedbackId: req.params.id, before: before?.priority ?? null, after: result.ok ? result.feedback.priority : null },
      });
    } catch {
      /* non-fatal */
    }
    return res.status(result.ok ? 200 : (result.status ?? 400)).json(result);
  },
);

app.patch(
  '/api/admin/feedback/:id/note',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  requireCsrfProtection,
  adminRateLimit,
  rejectAdminAuthoritySpoof,
  async (req, res) => {
    const before = getFeedbackById(req.params.id);
    const result = await setFeedbackAdminNote({ id: req.params.id, note: req.body?.note });
    try {
      logAdminAudit({
        action: 'admin.feedback.note',
        actor: req.auth.userId,
        targetUserId: before?.userId ?? null,
        result: result.ok ? 'ok' : 'error',
        meta: { feedbackId: req.params.id },
      });
    } catch {
      /* non-fatal */
    }
    return res.status(result.ok ? 200 : (result.status ?? 400)).json(result);
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Admin Control Center — Error / Incident panel (write).
// ═══════════════════════════════════════════════════════════════════════
app.patch(
  '/api/admin/errors/:id/status',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  requireCsrfProtection,
  adminRateLimit,
  rejectAdminAuthoritySpoof,
  async (req, res) => {
    const before = getErrorById(req.params.id);
    const result = await updateErrorStatus({ id: req.params.id, status: req.body?.status });
    try {
      logAdminAudit({
        action: 'admin.error.status',
        actor: req.auth.userId,
        targetUserId: null,
        result: result.ok ? 'ok' : 'error',
        meta: { errorId: req.params.id, before: before?.status ?? null, after: result.ok ? result.error.status : null },
      });
    } catch {
      /* non-fatal */
    }
    return res.status(result.ok ? 200 : (result.status ?? 400)).json(result);
  },
);

/**
 * Manual incident entry — for cases an admin observes but that weren't
 * auto-captured (e.g. reported by a user out-of-band). Goes through the
 * same redact + fingerprint/dedup path as the automatic capture below.
 */
app.post(
  '/api/admin/errors/report',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireRole('admin'),
  requireCsrfProtection,
  adminRateLimit,
  rejectAdminAuthoritySpoof,
  async (req, res) => {
    const result = await recordError({
      source: req.body?.source || 'admin_manual',
      severity: req.body?.severity,
      code: req.body?.code,
      message: req.body?.message,
      route: req.body?.route,
      userId: req.body?.targetUserId,
    });
    try {
      logAdminAudit({
        action: 'admin.error.report',
        actor: req.auth.userId,
        targetUserId: req.body?.targetUserId ?? null,
        result: result.ok ? 'ok' : 'error',
        meta: { errorId: result.ok ? result.error.id : null, deduped: result.deduped ?? false },
      });
    } catch {
      /* non-fatal */
    }
    return res.status(result.ok ? 200 : (result.status ?? 400)).json(result);
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

// Free vs Prime "Genişletilmiş kullanım" — plan-aware burst + daily quota gate.
// Replaces the flat per-IP/user rate limit for the web chat route.
const chatUsageRateLimit = chatUsageGate({ keyPrefix: 'chat' });

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
  chatJsonParser,
  attachAuthFromSession({ createAnonymous: true }),
  requireAuthenticated,
  requireCsrfProtection,
  chatUsageRateLimit,
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

      if (normalized.image) {
        let entitled = false;
        try {
          const resolved = resolveEntitlements(req.auth || {});
          entitled = hasCapability(resolved.entitlements, CAPABILITIES.IMAGE_ANALYSIS);
        } catch {
          entitled = false; // fail closed
        }
        if (!entitled) {
          return res.status(403).json({
            ok: false,
            data: null,
            error: {
              code: 'premium_required',
              feature: CAPABILITIES.IMAGE_ANALYSIS,
              message: 'Görsel analiz, Lara Prime kapsamında sunulur.',
            },
          });
        }
        const validation = validateImageAttachment(normalized.image);
        if (!validation.ok) {
          return res.status(400).json({
            ok: false,
            data: null,
            error: { code: validation.code, message: validation.message },
          });
        }
      }

      // Conversation persistence — authenticated accounts only (never guest/anonymous).
      // Best-effort: a persistence failure must never break the chat response itself.
      const canPersist = Boolean(req.auth?.authenticated) && !req.auth?.isAnonymous;
      let conversationId =
        typeof req.body?.conversationId === 'string' ? req.body.conversationId.trim() : null;
      const clientRequestId =
        typeof req.body?.clientRequestId === 'string' ? req.body.clientRequestId.trim() : null;

      if (canPersist) {
        try {
          // Idempotency: if this exact client-generated request id was already
          // persisted (retry after a client-side timeout, etc.), don't double-write
          // the user turn again.
          let alreadyPersisted = false;
          if (conversationId && clientRequestId) {
            const existing = getStoredConversation(req.auth.userId, conversationId);
            alreadyPersisted = Boolean(
              existing?.messages?.some((m) => m.clientRequestId === clientRequestId),
            );
          }
          if (!alreadyPersisted) {
            const userWrite = await appendConversationMessage(req.auth.userId, conversationId, {
              role: 'user',
              content: normalized.message,
              hasImage: Boolean(normalized.image),
              imageMimeType: normalized.image?.mimeType ?? null,
              clientRequestId,
            });
            if (userWrite.ok) conversationId = userWrite.conversationId;
          }
        } catch (persistErr) {
          console.error(`[ATLAS] conversation persist (user) failed: ${persistErr.message}`);
        }
      }

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
      if (req.atlasUsage) {
        response.usage = {
          plan: req.atlasUsage.plan,
          dailyUsed: req.atlasUsage.dailyUsed,
          dailyLimit: req.atlasUsage.dailyLimit,
        };
      }

      // Assistant turn is persisted only on genuine success — a failed
      // provider/model call must never write a fake assistant reply. The
      // user's own message above is already saved regardless of outcome.
      if (canPersist && conversationId && result.status !== 'error' && response.reply) {
        try {
          await appendConversationMessage(req.auth.userId, conversationId, {
            role: 'assistant',
            content: response.reply,
          });
        } catch (persistErr) {
          console.error(`[ATLAS] conversation persist (assistant) failed: ${persistErr.message}`);
        }
      }
      if (conversationId) {
        response.conversationId = conversationId;
      }

      const httpStatus =
        result.status === 'error' && result.errorCode === 'INVALID_INPUT' ? 400 : 200;

      console.log(
        `[ATLAS] ✓ chat/${normalized.channel} (${response.profile}/${response.mode})` +
          `${response.memoryHandled ? ' [memory]' : ''}` +
          ` | ${response.engine ?? response.model} | ${response.tokensUsed} tok` +
          ` | req=${response.requestId ?? 'n/a'}` +
          ` | status=${response.completionStatus ?? response.status ?? 'n/a'}` +
          `${response.retryable ? ` | retryable=${response.errorCode}` : ''}` +
          ` | ${response.latencyMs ?? 0}ms`,
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

// ── Conversation persistence — authenticated accounts only, never guest ──
const conversationsRateLimit = rateLimitMiddleware({
  windowMs: 60_000,
  max: 60,
  message: 'Çok fazla istek. Lütfen kısa bir süre sonra yeniden dene.',
  keyFn: (req) => `conversations:${req.auth?.userId || req.ip || 'unknown'}`,
});

app.get(
  '/api/conversations',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  conversationsRateLimit,
  (req, res) => {
    try {
      const list = listUserConversations(req.auth.userId);
      return res.json({ ok: true, conversations: list });
    } catch (err) {
      console.error(`[ATLAS] conversations list error: ${err.message}`);
      return res.status(500).json({ ok: false, error: 'Conversations service unavailable' });
    }
  },
);

app.get(
  '/api/conversations/:id',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  conversationsRateLimit,
  (req, res) => {
    try {
      const conversation = getStoredConversation(req.auth.userId, req.params.id);
      if (!conversation) {
        // Same response whether it doesn't exist or belongs to someone else —
        // never confirm/deny existence of another user's conversation id.
        return res.status(404).json({ ok: false, error: 'Conversation not found' });
      }
      return res.json({ ok: true, conversation });
    } catch (err) {
      console.error(`[ATLAS] conversation get error: ${err.message}`);
      return res.status(500).json({ ok: false, error: 'Conversations service unavailable' });
    }
  },
);

app.delete(
  '/api/conversations/:id',
  attachAuthFromSession({ createAnonymous: false }),
  requireAuth,
  requireCsrfProtection,
  conversationsRateLimit,
  async (req, res) => {
    try {
      const result = await deleteStoredConversation(req.auth.userId, req.params.id);
      if (!result.ok) {
        return res.status(404).json({ ok: false, error: 'Conversation not found' });
      }
      return res.json({ ok: true, deleted: true });
    } catch (err) {
      console.error(`[ATLAS] conversation delete error: ${err.message}`);
      return res.status(500).json({ ok: false, error: 'Conversations service unavailable' });
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
    let conversationsDeleted = 0;
    try {
      const convResult = await deleteAllUserConversations(req.auth.userId);
      if (convResult.ok) conversationsDeleted = convResult.deleted ?? 0;
    } catch (err) {
      console.error(`[ATLAS] conversation erase failed during memory delete: ${err.message}`);
    }
    return res.json({ userId: req.auth.userId, deleted: true, conversationsDeleted });
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
      setHeaders(res, filePath) {
        const lower = String(filePath).toLowerCase();
        if (lower.endsWith('.html') || lower.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          return;
        }
        // Hashed Vite assets (when not singlefile)
        if (/\.[a-f0-9]{8,}\.(js|css|woff2?)$/i.test(lower)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    if (req.path === '/sitemap.xml' || req.path === '/robots.txt') return next();
    const indexPath = join(DIST_DIR, 'index.html');
    if (!existsSync(indexPath)) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    return res.sendFile(indexPath);
  });
  console.log(`[ATLAS] Serving frontend from ${DIST_DIR}`);
}

// ══════════════════════════════════════════════════════════════════════
// ERROR HANDLING — body-parser (payload-too-large / malformed JSON) must
// never surface an HTML error page to API clients.
// ══════════════════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  if (!err) return next();
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      ok: false,
      data: null,
      error: { code: 'payload_too_large', message: 'İstek gövdesi çok büyük.' },
    });
  }
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({
      ok: false,
      data: null,
      error: { code: 'invalid_json', message: 'Geçersiz istek gövdesi.' },
    });
  }
  return next(err);
});

// ══════════════════════════════════════════════════════════════════════
// Catch-all API error capture — feeds the Admin Control Center Error /
// Incident panel. Only intercepts /api/* so non-API error behavior
// (e.g. static asset serving) is unchanged. Message is redacted by
// recordError() before it is ever persisted — no stack trace is stored.
// ══════════════════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  if (!err) return next();
  if (!req.path.startsWith('/api')) return next(err);

  recordError({
    source: 'server',
    severity: 'error',
    code: err.code || err.name || 'unhandled_error',
    message: err.message || String(err),
    route: req.path,
    userId: req.auth?.userId ?? null,
  }).catch(() => {
    /* error capture must never itself crash the response path */
  });

  console.error('[ATLAS] Unhandled API error:', err.message);
  if (res.headersSent) return next(err);
  return res.status(err.status || 500).json({
    ok: false,
    data: null,
    error: { code: 'internal_error', message: 'Beklenmeyen bir hata oluştu.' },
  });
});

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
    console.log('  Auth:   GET/POST /api/auth/session|login|logout|register, OAuth /api/auth/oauth/* (+ legacy /api/auth/google*)');
    console.log('  Admin:  GET /api/admin/me (admin role required)');
    console.log('  Routes: POST /api/chat, POST /api/atlas/message, GET /api/ai/health, /api/audio/*, /api/voice/*');
    console.log('  SEO:    GET /sitemap.xml, GET /robots.txt');
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
 