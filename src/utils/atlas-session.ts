// Server-authenticated web session — no localStorage identity for auth
import { BACKEND_URL } from '../config';
import { apiRequest, ApiError } from '../services/api-client';

export type AtlasSessionInfo = {
  authenticated: boolean;
  userId: string | null;
  roles: string[];
  isFounder: boolean;
  isAnonymous: boolean;
  authMethod: string | null;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  plan?: string | null;
  entitlements?: Record<string, boolean> | null;
  experience?: AtlasExperienceInfo | null;
  csrfToken: string;
};

export type AtlasExperienceInfo = {
  layer: 'guest' | 'free' | 'prime' | 'admin' | string;
  plan?: string | null;
  guest?: boolean;
  isAdmin?: boolean;
  isPrime?: boolean;
  canAccessPrime?: boolean;
  canAccessAdmin?: boolean;
  homePath?: string;
};

/** Fired when login/logout/register changes the active userId. */
export const ATLAS_SESSION_CHANGED_EVENT = 'atlas:session-changed';

let cachedSession: AtlasSessionInfo | null = null;

function emitSessionChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ATLAS_SESSION_CHANGED_EVENT));
}

function normalizeSession(data: Partial<AtlasSessionInfo> & { csrfToken: string }): AtlasSessionInfo {
  return {
    authenticated: Boolean(data.authenticated),
    userId: data.userId ?? null,
    roles: Array.isArray(data.roles) ? data.roles : [],
    isFounder: Boolean(data.isFounder),
    isAnonymous: Boolean(data.isAnonymous),
    authMethod: data.authMethod ?? null,
    email: data.email ?? null,
    displayName: data.displayName ?? null,
    avatarUrl: data.avatarUrl ?? null,
    plan: data.plan ?? null,
    entitlements:
      data.entitlements && typeof data.entitlements === 'object' ? data.entitlements : null,
    experience:
      data.experience && typeof data.experience === 'object'
        ? (data.experience as AtlasExperienceInfo)
        : null,
    csrfToken: data.csrfToken,
  };
}

/**
 * Establish or refresh the HttpOnly session cookie + CSRF token.
 * Identity is assigned by the server (anonymous:<uuid> or logged-in user).
 */
export async function ensureAtlasSession(): Promise<AtlasSessionInfo> {
  const previous = cachedSession;
  const previousId = previous?.userId ?? null;
  const previousPlan = previous?.plan ?? null;
  const previousEntitlements = JSON.stringify(previous?.entitlements ?? null);
  const data = await apiRequest<AtlasSessionInfo>('/api/auth/session', {
    method: 'GET',
  });
  cachedSession = normalizeSession(data);
  if (typeof window !== 'undefined' && data.csrfToken) {
    sessionStorage.setItem('atlas_csrf', data.csrfToken);
  }
  const planChanged = previous != null && previousPlan !== cachedSession.plan;
  const entitlementsChanged =
    previous != null && previousEntitlements !== JSON.stringify(cachedSession.entitlements ?? null);
  if (previousId && previousId !== cachedSession.userId) {
    emitSessionChanged();
  } else if (planChanged || entitlementsChanged) {
    emitSessionChanged();
  }
  return cachedSession;
}

export function getCachedCsrfToken(): string | null {
  if (cachedSession?.csrfToken) return cachedSession.csrfToken;
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('atlas_csrf');
}

export function getWebUserId(): string {
  // Prefer server-assigned identity; fallback only for pre-session UI paint.
  if (cachedSession?.userId) return cachedSession.userId;
  return 'anonymous:pending';
}

/** @deprecated localStorage identity is no longer authoritative */
export function getWebSessionId(): string {
  const id = getWebUserId();
  return id.includes(':') ? id.split(':').slice(1).join(':') : id;
}

export async function loginAtlas(emailOrUsername: string, password: string): Promise<AtlasSessionInfo> {
  await ensureAtlasSession();
  await apiRequest<{
    ok: boolean;
    roles: string[];
    isFounder: boolean;
    email?: string | null;
    displayName?: string | null;
    csrfToken: string;
  }>('/api/auth/login', {
    method: 'POST',
    timeoutMs: 30_000,
    body: JSON.stringify({ email: emailOrUsername, username: emailOrUsername, password }),
  });
  const session = await ensureAtlasSession();
  emitSessionChanged();
  return session;
}

export async function registerAtlas(
  email: string,
  password: string,
  passwordConfirm: string,
  displayName?: string,
): Promise<AtlasSessionInfo> {
  await ensureAtlasSession();
  await apiRequest<{
    ok: boolean;
    roles: string[];
    csrfToken: string;
  }>('/api/auth/register', {
    method: 'POST',
    timeoutMs: 30_000,
    body: JSON.stringify({
      email,
      password,
      passwordConfirm,
      ...(displayName ? { displayName } : {}),
    }),
  });
  const session = await ensureAtlasSession();
  emitSessionChanged();
  return session;
}

export async function logoutAtlas(): Promise<void> {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  } finally {
    cachedSession = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('atlas_csrf');
    }
    emitSessionChanged();
  }
}

export type GoogleAuthStatus = {
  configured: boolean;
  redirectUriConfigured: boolean;
  redirectUri?: string | null;
};

export async function fetchGoogleAuthStatus(): Promise<GoogleAuthStatus> {
  try {
    // Prefer path without "/google/" — LiteSpeed/ModSecurity may 503 those URLs.
    return await apiRequest<GoogleAuthStatus>('/api/auth/oauth/status', { method: 'GET' });
  } catch {
    try {
      return await apiRequest<GoogleAuthStatus>('/api/auth/google/status', { method: 'GET' });
    } catch {
      return { configured: false, redirectUriConfigured: false };
    }
  }
}

/** Full-page navigation to Google OAuth (PKCE + state on server). */
export function startGoogleAuth(): void {
  const returnOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const qs = returnOrigin ? `?returnOrigin=${encodeURIComponent(returnOrigin)}` : '';
  window.location.assign(`${BACKEND_URL}/api/auth/oauth/start${qs}`);
}

export function mapAuthError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { code?: string; error?: string } | null;
    const code = body?.code;
    switch (code) {
      case 'duplicate_email':
        return 'Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.';
      case 'invalid_email':
        return 'Geçerli bir e-posta adresi girin.';
      case 'weak_password':
        return 'Şifre en az 8 karakter olmalı ve harf ile rakam içermelidir.';
      case 'password_mismatch':
        return 'Şifreler eşleşmiyor.';
      case 'invalid_credentials':
        return 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.';
      case 'google_not_configured':
        return 'Google ile giriş şu an yapılandırılmamış. E-posta ile devam edebilirsiniz.';
      case 'google_cancelled':
        return 'Google girişi iptal edildi.';
      default:
        break;
    }
    if (err.status === 0 || err.message.includes('abort') || err.message.includes('Failed to fetch')) {
      return 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.';
    }
    if (err.status === 408 || err.message.includes('timed out') || err.message.includes('Request timed out')) {
      return 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
    }
    if (err.status === 503) {
      return 'Kimlik doğrulama servisi geçici olarak kullanılamıyor. Lütfen biraz sonra tekrar deneyin.';
    }
    if (err.status === 429) {
      return 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.';
    }
  }
  if (err instanceof TypeError) {
    return 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.';
  }
  return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
}

/** Read OAuth return query from HashRouter (`/#/?auth=...`) or search. */
export function consumeAuthCallbackParams(): { auth: string | null; code: string | null } {
  if (typeof window === 'undefined') return { auth: null, code: null };

  const fromSearch = new URLSearchParams(window.location.search);
  const hash = window.location.hash || '';
  const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const fromHash = new URLSearchParams(hashQuery);

  const auth = fromHash.get('auth') || fromSearch.get('auth');
  const code = fromHash.get('code') || fromSearch.get('code');

  if (auth) {
    // Clean URL without losing the route
    const path = hash.split('?')[0] || '#/';
    window.history.replaceState(null, '', `${window.location.pathname}${path}`);
  }

  return { auth, code };
}

export function oauthErrorMessage(code: string | null): string {
  switch (code) {
    case 'google_cancelled':
      return 'Google girişi iptal edildi.';
    case 'google_not_configured':
      return 'Google ile giriş henüz yapılandırılmamış.';
    case 'oauth_state_invalid':
    case 'oauth_state_mismatch':
      return 'Oturum doğrulaması başarısız. Lütfen tekrar deneyin.';
    case 'oauth_token_exchange_failed':
    case 'oauth_profile_failed':
    case 'oauth_provider_error':
    case 'oauth_failed':
    case 'google_auth_failed':
      return 'Google ile giriş tamamlanamadı. Lütfen tekrar deneyin.';
    case 'redirect_uri_mismatch':
      return 'Google giriş yapılandırması uyuşmuyor. Lütfen e-posta ile giriş yapın veya daha sonra tekrar deneyin.';
    default:
      return 'Giriş tamamlanamadı. Lütfen tekrar deneyin.';
  }
}
