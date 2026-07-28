// ═══════════════════════════════════════════════════════════════════════
// Atlas Session — stable web chat user identifier (localStorage)
// ═══════════════════════════════════════════════════════════════════════

const SESSION_KEY = 'atlas_web_session_id';

function createSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getWebSessionId(): string {
  if (typeof window === 'undefined') {
    return createSessionId();
  }

  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = createSessionId();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function getWebUserId(): string {
  return `web:${getWebSessionId()}`;
}
