// ═══════════════════════════════════════════════════════════════════════
// Atlas Chat Service — frontend client for POST /api/chat
// Identity comes from HttpOnly session cookie — not localStorage.
// ═══════════════════════════════════════════════════════════════════════

import type {
  AtlasChatRequest,
  AtlasChatResponse,
  AtlasChatTurn,
} from '../types/atlas-chat';
import { apiRequest } from './api-client';
import { BACKEND_URL } from '../config';
import { ensureAtlasSession } from '../utils/atlas-session';

const BACKEND = BACKEND_URL;

const SOFT_FAIL_CODES = new Set([
  'TIMEOUT',
  'RATE_LIMIT',
  'MODEL_UNAVAILABLE',
  'ENGINE_FAILURE',
  'INCOMPLETE_RESPONSE',
]);

/**
 * Server may return HTTP 200 with a user-visible timeout fallback.
 * Treat those as retryable failures for UI recovery.
 */
export function isRetryableChatResponse(response: AtlasChatResponse): boolean {
  if (response.retryable === true) return true;
  if (response.errorCode && SOFT_FAIL_CODES.has(response.errorCode)) return true;
  if (response.status === 'error' && response.errorCode) return true;
  return false;
}

export class AtlasChatService {
  private _backendStatus: 'unknown' | 'up' | 'down' = 'unknown';

  async checkBackend(): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND}/api/ai/health`, {
        signal: AbortSignal.timeout(3000),
        credentials: 'include',
      });
      if (!res.ok) {
        this._backendStatus = 'down';
        return false;
      }
      const data = await res.json();
      const ok = data.configured === true || data.auth === true;
      this._backendStatus = ok ? 'up' : 'down';
      if (ok) {
        try {
          await ensureAtlasSession();
        } catch {
          /* session optional for health */
        }
      }
      return ok;
    } catch {
      this._backendStatus = 'down';
      return false;
    }
  }

  get backendStatus() {
    return this._backendStatus;
  }

  async sendMessage(
    message: string,
    history: AtlasChatTurn[] = [],
    options: Omit<AtlasChatRequest, 'message' | 'history'> & {
      signal?: AbortSignal;
      requestId?: string;
    } = {},
  ): Promise<AtlasChatResponse> {
    await ensureAtlasSession();
    // userId in body is ignored by server; session cookie is authoritative
    return apiRequest<AtlasChatResponse>('/api/chat', {
      method: 'POST',
      signal: options.signal,
      body: JSON.stringify({
        message,
        history,
        mode: options.mode,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        clientRequestId: options.requestId,
        ...(options.selection ? { selection: options.selection } : {}),
      }),
    });
  }
}

export const atlasChat = new AtlasChatService();
