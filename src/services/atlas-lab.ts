/**
 * Read-only client for ATLAS LAB — recent request traces captured by
 * server/atlas-lab/trace-store.js. Diagnostic-only: this module never
 * mutates a conversation or rewrites a response.
 */

import { apiRequest } from './api-client';

export type AtlasLabTrace = {
  version: string;
  interactionId: string;
  requestId: string;
  timestamp: string;
  conversationRef: string | null;
  userRef: string | null;
  channel: string | null;
  userMessageSummary: string | null;
  contextMessageCount: number | null;
  intent: string | null;
  engine: string | null;
  selectedDomain: string | null;
  selectedTools: string[];
  routingDecision: string | null;
  retrievalSources: string[];
  modelUsed: string | null;
  requestedModel: string | null;
  fallbackPath: string | null;
  postProcessors: string[];
  responseSummary: string | null;
  errorState: string | null;
  phases: Array<{ name: string; durationMs: number; startedAtMs: number; endedAtMs: number }>;
  totalDurationMs: number;
  llmCallCount: number;
  usedRetryOrFallback: boolean;
};

export async function fetchAtlasLabTraces(opts: { channel?: string; limit?: number } = {}): Promise<{ ok: true; traces: AtlasLabTrace[] }> {
  const qs = new URLSearchParams({
    ...(opts.channel ? { channel: opts.channel } : {}),
    ...(opts.limit ? { limit: String(opts.limit) } : {}),
  }).toString();
  return apiRequest<{ ok: true; traces: AtlasLabTrace[] }>(`/api/admin/atlas-lab/traces${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export async function fetchAtlasLabTrace(requestId: string): Promise<{ ok: true; trace: AtlasLabTrace }> {
  return apiRequest<{ ok: true; trace: AtlasLabTrace }>(`/api/admin/atlas-lab/traces/${encodeURIComponent(requestId)}`, { method: 'GET' });
}

export type AtlasLabEvaluationVerdict = {
  verdict: 'PASS' | 'WARN' | 'FAIL';
  categories: string[];
  explanation: string;
  expectedBehavior: string;
  confidence: 'high' | 'medium' | 'low';
};

export type AtlasLabEvaluateResponse = { ok: true; verdict: AtlasLabEvaluationVerdict; model: string; latencyMs: number };

/**
 * Triggers a manual, on-demand, observational evaluation of one trace.
 * Never rewrites the underlying interaction — read-only diagnostic action.
 * On failure (evaluator unavailable, malformed model output, etc.) the
 * backend responds non-2xx and apiRequest throws ApiError — callers should
 * catch it and read err.body?.error / err.body?.blocked for detail.
 */
export async function evaluateAtlasLabTrace(requestId: string): Promise<AtlasLabEvaluateResponse> {
  return apiRequest<AtlasLabEvaluateResponse>(`/api/admin/atlas-lab/traces/${encodeURIComponent(requestId)}/evaluate`, { method: 'POST' });
}
