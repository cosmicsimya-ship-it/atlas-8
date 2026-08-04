// ═══════════════════════════════════════════════════════════════════════
// AI Provider — V7 (real-only, no mocks)
//
// Every call goes through the backend `/api` proxy (same-origin in production).
// The backend reads OPENAI_API_KEY from .env and forwards to OpenAI.
// The API key NEVER reaches the browser.
// ═══════════════════════════════════════════════════════════════════════

import type { AIRequestOptions, AIResponse } from '../types/pipeline';
import { BACKEND_URL } from '../config';

const API_BASE = BACKEND_URL.replace(/\/$/, '');

export class AIProviderService {
  private _backendStatus: 'unknown' | 'up' | 'down' = 'unknown';

  async checkBackend(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/api/ai/health`, {
        signal: AbortSignal.timeout(3000),
        credentials: 'include',
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

  resetDetection(): void {
    this._backendStatus = 'unknown';
  }

  get backendStatus() {
    return this._backendStatus;
  }

  async complete(options: AIRequestOptions): Promise<AIResponse> {
    const res = await fetch(`${API_BASE}/api/ai/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        model: options.model,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 2048,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
      throw new Error(body.error || `Backend error (${res.status})`);
    }

    return (await res.json()) as AIResponse;
  }
}

export const aiProvider = new AIProviderService();
