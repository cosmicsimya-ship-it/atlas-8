// ═══════════════════════════════════════════════════════════════════════
// Atlas Chat Service — frontend client for POST /api/chat
//
// Routes all web chat through the backend Meta Synthesis Engine.
// Prompt assembly stays server-side; API key never reaches the browser.
// ═══════════════════════════════════════════════════════════════════════

import type {
  AtlasChatRequest,
  AtlasChatResponse,
  AtlasChatTurn,
} from '../types/atlas-chat';
import { BACKEND_URL } from '../config';

const BACKEND = BACKEND_URL;

export class AtlasChatService {
  private _backendStatus: 'unknown' | 'up' | 'down' = 'unknown';

  async checkBackend(): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND}/api/ai/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        this._backendStatus = 'down';
        return false;
      }
      const data = await res.json();
      const ok = data.configured === true;
      this._backendStatus = ok ? 'up' : 'down';
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
    options: Omit<AtlasChatRequest, 'message' | 'history'> = {},
  ): Promise<AtlasChatResponse> {
    const res = await fetch(`${BACKEND}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history,
        userId: options.userId,
        ...options,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
      throw new Error(body.error || `Backend error (${res.status})`);
    }

    return (await res.json()) as AtlasChatResponse;
  }
}

export const atlasChat = new AtlasChatService();
