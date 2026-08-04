// ═══════════════════════════════════════════════════════════════════════
// Session service — create anonymous / login / logout / resolve auth
// ═══════════════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';
import {
  createSession,
  validateSession,
  revokeSession,
  rotateSession,
  touchSession,
} from './session-store.js';
import {
  findAccountByUsername,
  findAccountByEmail,
  findAccountByTelegramBinding,
  verifyPassword,
  toPublicAccount,
  registerAccount,
  findOrProvisionGoogleAccount,
} from './account-store.js';
import { logPrivacyEvent } from '../privacy/privacy-logger.js';

/**
 * @typedef {Object} AuthIdentity
 * @property {boolean} authenticated
 * @property {string|null} userId
 * @property {string[]} roles
 * @property {string|null} authMethod
 * @property {string|null} sessionId
 * @property {boolean} isFounder
 * @property {boolean} isAnonymous
 */

/**
 * @returns {AuthIdentity}
 */
export function createUnauthenticatedIdentity() {
  return {
    authenticated: false,
    userId: null,
    roles: [],
    authMethod: null,
    sessionId: null,
    isFounder: false,
    isAnonymous: false,
  };
}

/**
 * Only this module / middleware may build AuthIdentity.
 * @param {{
 *   userId: string,
 *   roles?: string[],
 *   authMethod?: string,
 *   sessionId?: string|null,
 * }} input
 * @returns {AuthIdentity}
 */
export function buildAuthIdentity(input) {
  const roles = Array.isArray(input.roles) ? [...input.roles] : ['user'];
  const isFounder = roles.includes('founder');
  const isAnonymous = roles.includes('anonymous') || String(input.userId).startsWith('anonymous:');
  return {
    authenticated: true,
    userId: input.userId,
    roles,
    authMethod: input.authMethod ?? 'session',
    sessionId: input.sessionId ? String(input.sessionId).slice(0, 12) : null,
    isFounder,
    isAnonymous,
  };
}

/**
 * Create a server-generated anonymous session.
 */
export function createAnonymousSession() {
  const userId = `anonymous:${randomUUID()}`;
  const created = createSession({
    userId,
    roles: ['anonymous'],
    authMethod: 'anonymous_session',
  });
  try {
    logPrivacyEvent({
      channel: 'auth',
      requesterId: userId,
      eventType: 'session_creation',
      action: 'created',
      requestType: 'anonymous',
      reason: 'anonymous_session',
    });
  } catch {
    /* non-fatal */
  }
  return {
    rawToken: created.rawToken,
    identity: buildAuthIdentity({
      userId,
      roles: ['anonymous'],
      authMethod: 'anonymous_session',
      sessionId: created.tokenHash,
    }),
    expiresAt: created.expiresAt,
  };
}

/**
 * Resolve identity from raw session cookie token.
 * @param {string|null|undefined} rawToken
 * @returns {{ identity: AuthIdentity, reason?: string }}
 */
export function resolveSessionIdentity(rawToken) {
  if (!rawToken) {
    return { identity: createUnauthenticatedIdentity(), reason: 'missing' };
  }
  const result = validateSession(rawToken);
  if (!result.ok) {
    return { identity: createUnauthenticatedIdentity(), reason: result.reason };
  }
  try {
    touchSession(rawToken);
  } catch {
    /* ignore touch failures */
  }
  const session = result.session;
  return {
    identity: buildAuthIdentity({
      userId: session.userId,
      roles: session.roles,
      authMethod: session.authMethod,
      sessionId: session.tokenHash,
    }),
  };
}

/**
 * @param {{
 *   account: object,
 *   authMethod: string,
 *   previousRawToken?: string|null,
 *   privacyReason?: string,
 * }} input
 */
function establishAccountSession(input) {
  if (input.previousRawToken) {
    try {
      revokeSession(input.previousRawToken);
    } catch {
      /* ignore */
    }
  }

  const created = createSession({
    userId: input.account.userId,
    roles: input.account.roles,
    authMethod: input.authMethod,
  });

  try {
    logPrivacyEvent({
      channel: 'auth',
      requesterId: input.account.userId,
      eventType: 'login_success',
      action: 'allowed',
      reason: input.privacyReason ?? input.authMethod,
    });
  } catch {
    /* non-fatal */
  }

  return {
    ok: true,
    rawToken: created.rawToken,
    expiresAt: created.expiresAt,
    identity: buildAuthIdentity({
      userId: input.account.userId,
      roles: input.account.roles,
      authMethod: input.authMethod,
      sessionId: created.tokenHash,
    }),
    account: toPublicAccount(input.account),
  };
}

/**
 * Login with username or email + password. Regenerates session (new token).
 * @param {{ username?: string, email?: string, password: string, previousRawToken?: string|null }} input
 */
export async function loginWithPassword(input) {
  const identifier = String(input.username ?? input.email ?? '').trim();
  const fail = () => ({
    ok: false,
    error: 'Invalid username or password',
    code: 'invalid_credentials',
  });

  if (!identifier || !input.password) {
    return fail();
  }

  let account = findAccountByUsername(identifier);
  if (!account) {
    account = findAccountByEmail(identifier);
  }

  if (!account || account.disabled) {
    try {
      logPrivacyEvent({
        channel: 'auth',
        requesterId: null,
        eventType: 'login_failure',
        action: 'denied',
        reason: 'invalid_credentials',
      });
    } catch {
      /* non-fatal */
    }
    return fail();
  }

  if (!account.passwordHash) {
    try {
      logPrivacyEvent({
        channel: 'auth',
        requesterId: account.userId,
        eventType: 'login_failure',
        action: 'denied',
        reason: 'password_not_set',
      });
    } catch {
      /* non-fatal */
    }
    return fail();
  }

  const valid = await verifyPassword(input.password, account.passwordHash);
  if (!valid) {
    try {
      logPrivacyEvent({
        channel: 'auth',
        requesterId: account.userId,
        eventType: 'login_failure',
        action: 'denied',
        reason: 'invalid_credentials',
      });
    } catch {
      /* non-fatal */
    }
    return fail();
  }

  return establishAccountSession({
    account,
    authMethod: 'password',
    previousRawToken: input.previousRawToken,
    privacyReason: 'password_login',
  });
}

/**
 * Public email registration + immediate authenticated session.
 * Does not merge prior anonymous conversational memory.
 * @param {{
 *   email: string,
 *   password: string,
 *   displayName?: string|null,
 *   previousRawToken?: string|null,
 * }} input
 */
export async function registerWithEmail(input) {
  try {
    const account = await registerAccount({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
    });
    // reload full account for passwordHash presence in store
    const full = findAccountByEmail(input.email) ?? findAccountByUsername(account.username);
    return establishAccountSession({
      account: full ?? account,
      authMethod: 'password',
      previousRawToken: input.previousRawToken,
      privacyReason: 'email_register',
    });
  } catch (err) {
    const code = err?.code || 'register_failed';
    try {
      logPrivacyEvent({
        channel: 'auth',
        requesterId: null,
        eventType: 'register_failure',
        action: 'denied',
        reason: String(code).slice(0, 64),
      });
    } catch {
      /* non-fatal */
    }
    return {
      ok: false,
      code,
      error:
        code === 'duplicate_email'
          ? 'An account with this email already exists'
          : code === 'invalid_email'
            ? 'Invalid email address'
            : code === 'weak_password'
              ? err.message || 'Password does not meet requirements'
              : 'Registration failed',
    };
  }
}

/**
 * Complete Google OAuth after verified Google userinfo.
 * @param {{
 *   googleSub: string,
 *   email: string,
 *   emailVerified: boolean,
 *   displayName?: string|null,
 *   avatarUrl?: string|null,
 *   previousRawToken?: string|null,
 * }} input
 */
export async function loginWithGoogleIdentity(input) {
  try {
    const account = await findOrProvisionGoogleAccount(input);
    const full = findAccountByEmail(input.email) ?? findAccountByUsername(account.username);
    return establishAccountSession({
      account: full ?? account,
      authMethod: 'google',
      previousRawToken: input.previousRawToken,
      privacyReason: 'google_oauth',
    });
  } catch (err) {
    const code = err?.code || 'google_auth_failed';
    try {
      logPrivacyEvent({
        channel: 'auth',
        requesterId: null,
        eventType: 'login_failure',
        action: 'denied',
        reason: String(code).slice(0, 64),
      });
    } catch {
      /* non-fatal */
    }
    return {
      ok: false,
      code,
      error: 'Google authentication failed',
    };
  }
}

/**
 * @param {string|null|undefined} rawToken
 */
export function logoutSession(rawToken) {
  if (!rawToken) return { ok: true };
  try {
    const resolved = resolveSessionIdentity(rawToken);
    revokeSession(rawToken);
    try {
      logPrivacyEvent({
        channel: 'auth',
        requesterId: resolved.identity.userId,
        eventType: 'logout',
        action: 'revoked',
        reason: 'user_logout',
      });
    } catch {
      /* non-fatal */
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/**
 * Build Telegram auth from verified bot update metadata only.
 * Requires bot shared secret already validated by middleware.
 * @param {{ telegramFromId: string|number, displayName?: string|null }} input
 */
export function buildTelegramAuthIdentity(input) {
  const fromId = String(input.telegramFromId ?? '').trim();
  if (!/^\d+$/.test(fromId)) {
    return createUnauthenticatedIdentity();
  }
  const userId = `telegram:${fromId}`;
  const account = findAccountByTelegramBinding(userId);
  const roles = account && !account.disabled
    ? [...(account.roles ?? ['user'])]
    : ['user'];

  // Memory key: prefer account.userId if bound, else telegram platform id
  const memoryUserId = account?.userId && roles.includes('founder') ? account.userId : userId;

  // For founder telegram binding, use telegram:id as userId for memory continuity
  // unless account explicitly maps userId to telegram binding.
  const resolvedUserId = account?.userId ?? userId;

  return buildAuthIdentity({
    userId: resolvedUserId.startsWith('telegram:') ? resolvedUserId : userId,
    roles,
    authMethod: 'telegram_verified',
    sessionId: null,
  });
}

/**
 * Convert AuthIdentity → privacy requester context (server-only).
 * @param {AuthIdentity} auth
 * @param {{ channel?: string, displayName?: string|null }} [extra]
 */
export function authToRequesterContext(auth, extra = {}) {
  return {
    userId: auth?.authenticated ? auth.userId : null,
    channel: extra.channel ?? null,
    displayName: extra.displayName ?? null,
    authenticated: Boolean(auth?.authenticated),
    roles: auth?.roles ?? [],
    isFounder: Boolean(auth?.isFounder),
    authMethod: auth?.authMethod ?? null,
    sessionId: auth?.sessionId ?? null,
  };
}

export { rotateSession };
