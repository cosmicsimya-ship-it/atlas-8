/**
 * AgentOS Task Orchestration client. Thin wrappers over the real
 * /api/admin/agent-tasks/* endpoints (server/agentos/, server/admin/
 * agentos-task-actions.js). No implementation/commit/push/deploy action
 * ever executes automatically — approve() only ever records a decision.
 */

import { apiRequest } from './api-client';

export type OwnerAgent = 'atlas-core' | 'core-engine' | 'pattern-engine' | 'critic-engine' | 'quality-engine' | 'visual-engine';
export type TaskMode = 'research_only' | 'review_only' | 'implementation_allowed';
export type TaskStatus = 'queued' | 'running' | 'waiting_for_review' | 'completed' | 'failed' | 'cancelled';
export type SubtaskStatus = 'queued' | 'running' | 'completed' | 'failed';
export type ApprovalAction = 'implementation' | 'commit' | 'push' | 'deploy';

export type FinalSynthesis = {
  findings: string[];
  decisions: string[];
  risks: string[];
  next_actions: string[];
};

export type AgentTask = {
  id: string;
  title: string;
  prompt: string;
  ownerAgent: OwnerAgent;
  mode: TaskMode;
  notes: string | null;
  status: TaskStatus;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  finalSynthesis: FinalSynthesis | Record<string, unknown> | null;
  error: { stage?: string; message: string } | null;
  approvals: { implementation: boolean; commit: boolean; push: boolean; deploy: boolean };
};

export type AgentSubtask = {
  id: string;
  taskId: string;
  agentName: string;
  label: string;
  status: SubtaskStatus;
  output: { status?: string; payload?: Record<string, unknown> } | null;
  error: { stage?: string; message: string } | null;
  startedAt: string | null;
  completedAt: string | null;
  model: string | null;
  tokensUsed: number | null;
  latencyMs: number | null;
};

export async function fetchAgentTasks(params: { limit?: number } = {}): Promise<{ ok: boolean; tasks: AgentTask[] }> {
  const qs = params.limit ? `?limit=${params.limit}` : '';
  return apiRequest(`/api/admin/agent-tasks${qs}`, { method: 'GET' });
}

export async function fetchAgentTaskDetail(taskId: string): Promise<{ ok: boolean; task: AgentTask; subtasks: AgentSubtask[] }> {
  return apiRequest(`/api/admin/agent-tasks/${encodeURIComponent(taskId)}`, { method: 'GET' });
}

export async function createAgentTask(input: {
  title: string;
  prompt: string;
  ownerAgent: OwnerAgent;
  mode?: TaskMode;
  notes?: string;
}): Promise<{ ok: boolean; task: AgentTask }> {
  return apiRequest('/api/admin/agent-tasks', { method: 'POST', body: JSON.stringify(input) });
}

export async function cancelAgentTask(taskId: string, reason?: string): Promise<{ ok: boolean; task: AgentTask }> {
  return apiRequest(`/api/admin/agent-tasks/${encodeURIComponent(taskId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function approveAgentTaskAction(
  taskId: string,
  action: ApprovalAction,
  reason?: string,
): Promise<{ ok: boolean; task: AgentTask }> {
  return apiRequest(`/api/admin/agent-tasks/${encodeURIComponent(taskId)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ action, reason }),
  });
}
