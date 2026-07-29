// ═══════════════════════════════════════════════════════════════════════
// Auth public API
// ═══════════════════════════════════════════════════════════════════════

export {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  getSessionCookieOptions,
  getCsrfCookieOptions,
  getAllowedOrigins,
  isAllowedOrigin,
} from './cookie-config.js';

export {
  hashSessionToken,
  createSession,
  validateSession,
  revokeSession,
  rotateSession,
  configureSessionStore,
  resetSessionStoreForTests,
  sessionStoreContainsRawToken,
  getSessionStorePath,
  isSessionStoreFailedClosed,
  safeEqualHex,
} from './session-store.js';

export {
  hashPassword,
  verifyPassword,
  findAccountByUsername,
  findAccountByUserId,
  findAccountByTelegramBinding,
  getAccountById,
  upsertAccount,
  toPublicAccount,
  configureAccountStore,
  resetAccountStoreForTests,
  accountStoreHasPlaintextPasswordField,
  getAccountStorePath,
} from './account-store.js';

export {
  createUnauthenticatedIdentity,
  buildAuthIdentity,
  createAnonymousSession,
  resolveSessionIdentity,
  loginWithPassword,
  logoutSession,
  buildTelegramAuthIdentity,
  authToRequesterContext,
} from './session-service.js';

export {
  attachAuthFromSession,
  requireTelegramBotSecret,
  requireCsrfProtection,
  requireAuthenticated,
  requireFounder,
  readSessionToken,
  setSessionCookie,
  clearSessionCookie,
  ensureCsrfCookie,
  requesterContextFromRequest,
} from './auth-middleware.js';

export {
  checkRateLimit,
  rateLimitMiddleware,
  resetRateLimitBucketsForTests,
} from './rate-limit.js';

export { evaluateLegacyMemoryClaim } from './legacy-memory.js';
