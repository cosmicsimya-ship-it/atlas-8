// ═══════════════════════════════════════════════════════════════════════
// AI Provider — V7 (real-only, no mocks)
//
// Every call goes through the backend proxy at localhost:3001.
// The backend reads OPENAI_API_KEY from .env and forwards to OpenAI.
// The API key NEVER reaches the browser.
//
// If the backend is unreachable, complete() throws — the pipeline
// engine catches the error and marks the step as failed with a
// clear message telling the user to start the server.
// ═══════════════════════════════════════════════════════════════════════

import type { AIRequestOptions, AIResponse } from '../types/pipeline';

const BACKEND_URL = 'http://localhost:3001';

export class AIProviderService {
  private _backendStatus: 'unknown' | 'up' | 'down' = 'unknown';

  async checkBackend(): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) { this._backendStatus = 'down'; return false; }
      const data = await res.json();
      const ok = data.configured === true;
      this._backendStatus = ok ? 'up' : 'down';
      return ok;
    } catch {
      this._backendStatus = 'down';
      return false;
    }
  }

  resetDetection(): void { this._backendStatus = 'unknown'; }

  get backendStatus() { return this._backendStatus; }

  async complete(options: AIRequestOptions): Promise<AIResponse> {
    const res = await fetch(`${BACKEND_URL}/api/ai/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    return await res.json() as AIResponse;
  }
}

export const aiProvider = new AIProviderService();
