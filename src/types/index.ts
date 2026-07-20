export type AgentStatus = 'online' | 'idle' | 'processing' | 'error' | 'paused' | 'offline';
export type PipelinePhase = 'research' | 'content' | 'production' | 'optimization' | 'publishing' | 'analytics';
export type PipelineRunStatus = 'queued' | 'processing' | 'review' | 'completed' | 'failed';
export type Priority = 'critical' | 'high' | 'normal' | 'low';

export interface AgentRuntime {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  phase: PipelinePhase;
  model: string;
  currentTask: string | null;
  completedToday: number;
  failedToday: number;
  avgLatencyMs: number;
  costToday: number;
  apiCallsToday: number;
  memoryMb: number;
  uptimeHrs: number;
  lastActive: string;
  queueDepth: number;
  successRate: number;
  description: string;
}

export interface PipelineRun {
  id: string;
  title: string;
  channelId: string;
  channelName: string;
  status: PipelineRunStatus;
  priority: Priority;
  phase: PipelinePhase;
  agentId: string;
  agentName: string;
  progress: number;
  startedAt: string;
  eta: string;
  cost: number;
  error?: string;
}

export interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  time: string;
  read: boolean;
  agentId?: string;
}

export interface Channel {
  id: string;
  name: string;
  handle: string;
  subscribers: string;
  videos: number;
  avgViews: string;
  ctr: number;
  retention: number;
  monthlyRevenue: string;
  status: 'active' | 'paused' | 'setup';
  growthRate: number;
  niche: string;
}

export interface QueueItem {
  id: string;
  pipelineId: string;
  title: string;
  priority: Priority;
  status: 'waiting' | 'processing' | 'retry' | 'done' | 'failed';
  agent: string;
  agentId: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  error?: string;
}

export interface ArsenalItem {
  id: string;
  name: string;
  type: string;
  category: string;
  uses: number;
  lastUsed: string;
  tags: string[];
  description: string;
}

export interface MemoryEntry {
  id: string;
  type: 'learning' | 'mistake' | 'pattern' | 'success';
  source: string;
  content: string;
  confidence: number;
  created: string;
  accesses: number;
  tags: string[];
}

export interface ActivityEvent {
  id: string;
  type: 'agent' | 'pipeline' | 'system';
  message: string;
  time: string;
  agentId?: string;
  variant: 'success' | 'error' | 'info' | 'warning';
}
