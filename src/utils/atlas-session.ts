// Server-authenticated web session — no localStorage identity for auth
import { apiRequest } from '../services/api-client';

export type AtlasSessionInfo = {
  authenticated: boolean;
  userId: string | null;
  roles: string[];
  isFounder: boolean;
  isAnonymous: boolean;
  authMethod: string | null;
  csrfToken: string;
};

let cachedSession: AtlasSessionInfo | null = null;

/**
 * Establish or refresh the HttpOnly session cookie + CSRF token.
 * Identity is assigned by the server (anonymous:<uuid> or logged-in user).
 */
export async function ensureAtlasSession(): Promise<AtlasSessionInfo> {
  const data = await apiRequest<AtlasSessionInfo>('/api/auth/session', {
    method: 'GET',
  });
  cachedSession = data;
  if (typeof window !== 'undefined' && data.csrfToken) {
    sessionStorage.setItem('atlas_csrf', data.csrfToken);
  }
  return data;
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

export async function loginAtlas(username: string, password: string): Promise<AtlasSessionInfo> {
  await ensureAtlasSession();
  const data = await apiRequest<{
    ok: boolean;
    userId: string;
    roles: string[];
    isFounder: boolean;
    csrfToken: string;
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return ensureAtlasSession();
}

export async function logoutAtlas(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  cachedSession = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('atlas_csrf');
  }
}
