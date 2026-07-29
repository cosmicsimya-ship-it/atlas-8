import { BACKEND_URL, REQUEST_TIMEOUT_MS } from '../config';
import { getCachedCsrfToken, ensureAtlasSession } from '../utils/atlas-session';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, signal, ...init } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  const method = (init.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

  // Cookie session + double-submit CSRF for unsafe methods
  if (method !== 'GET' && method !== 'HEAD') {
    let csrf = getCachedCsrfToken();
    if (!csrf && path !== '/api/auth/session') {
      try {
        await ensureAtlasSession();
        csrf = getCachedCsrfToken();
      } catch {
        /* session bootstrap may fail; server will reject CSRF */
      }
    }
    if (csrf) {
      headers['X-Atlas-Csrf'] = csrf;
    }
  }

  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      method,
      signal: controller.signal,
      credentials: 'include',
      headers,
    });

    let body: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new ApiError('Invalid JSON response from server', res.status, text);
      }
    }

    if (!res.ok) {
      const message =
        typeof body === 'object' && body !== null && 'error' in body
          ? String((body as { error: string }).error)
          : `Request failed (${res.status})`;
      throw new ApiError(message, res.status, body);
    }

    // Refresh CSRF if server returned one
    if (
      typeof body === 'object' &&
      body !== null &&
      'csrfToken' in body &&
      typeof (body as { csrfToken: unknown }).csrfToken === 'string'
    ) {
      sessionStorage.setItem('atlas_csrf', (body as { csrfToken: string }).csrfToken);
    }

    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Request timed out', 408, null);
    }
    throw new ApiError(err instanceof Error ? err.message : 'Network error', 0, null);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}
