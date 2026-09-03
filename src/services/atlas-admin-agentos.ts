/**
 * Read-only (+ one sweep-trigger) client for the AgentOS bridge. ATLAS never
 * talks to AgentOS directly from the browser — this still goes through
 * ATLAS's own backend (server/admin/agentos-bridge.js), which is the only
 * thing that ever calls AgentOS's local Control Surface API.
 */

import { apiRequest } from './api-client';

export type AgentOsHumanRecommendation = {
  title: string;
  explanation: string;
  domain: string;
  domainId: string;
  severity: 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  score: number;
  evidenceSource: string;
  evidenceRefs: string[];
  technicalDetails: Array<{ text: string; score: number; evidenceRef: string | null }>;
};

export type AgentOsSummary = {
  generatedAt: string;
  mode: 'read-only';
  overall: { overall_pct: number | null; coverage_pct: number | null; overall_confidence: string };
  lastFullSweep: { generatedAt: string | null; reportPath: string } | null;
  dataFreshness: string | null;
  agents: Array<{ agent_id: string; name: string; status: string; state: string; operational: boolean; health: string; implemented: boolean }>;
  agentSummary: { total: number; operational: number; running: number; failed: number; unavailable: number; disabled: number };
  qa: { pass: number; fail: number; lastRunAt: string } | null;
  feedback: { rawCount: number; themeCount: number } | null;
  errors: { count: number } | null;
  blockers: string[];
  reportHistory: { count: number; latestFilename: string | null };
  recommendations: Array<{ text: string; score: number; reasons: Record<string, unknown> }>;
  humanRecommendations: AgentOsHumanRecommendation[];
  sweep: { status: string; phase: string | null };
};

export type AgentOsBridgeResponse =
  | { ok: true; reachable: true; summary: AgentOsSummary }
  | { ok: true; reachable: false; reason: string };

export async function fetchAgentOsSummary(): Promise<AgentOsBridgeResponse> {
  return apiRequest<AgentOsBridgeResponse>('/api/admin/agentos', { method: 'GET' });
}

export type AgentOsSweepTriggerResponse =
  | { ok: true; reachable: true; started: boolean; job: Record<string, unknown> | null }
  | { ok: true; reachable: false; reason: string };

export async function runAgentOsSweep(): Promise<AgentOsSweepTriggerResponse> {
  return apiRequest<AgentOsSweepTriggerResponse>('/api/admin/agentos/sweep', { method: 'POST' });
}
