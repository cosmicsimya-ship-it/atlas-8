/**
 * Request CosmicNav AuthSessionControl to open login/register.
 * Avoids a second auth system; return-to-Lara-Prime is best-effort via sessionStorage.
 */

export const ATLAS_AUTH_REQUEST_EVENT = 'atlas:request-auth';
export const ATLAS_RETURN_PATH_KEY = 'atlas_auth_return_path';

export function requestAtlasAuth(mode: 'login' | 'register' | 'chooser' = 'login') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(ATLAS_AUTH_REQUEST_EVENT, {
      detail: { mode },
    }),
  );
}

export function rememberAuthReturnPath(path: string) {
  try {
    sessionStorage.setItem(ATLAS_RETURN_PATH_KEY, path);
  } catch {
    /* ignore quota / private mode */
  }
}

export function consumeAuthReturnPath(): string | null {
  try {
    const v = sessionStorage.getItem(ATLAS_RETURN_PATH_KEY);
    sessionStorage.removeItem(ATLAS_RETURN_PATH_KEY);
    // Same-app relative path only — reject protocol-relative / absolute URLs.
    if (!v || !v.startsWith('/') || v.startsWith('//') || v.includes('://') || v.includes('\\')) {
      return null;
    }
    return v;
  } catch {
    return null;
  }
}
