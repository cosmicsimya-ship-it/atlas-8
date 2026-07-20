// ═══════════════════════════════════════════════════════════════════════
// Pipeline Domain Types
// The canonical types for the production pipeline engine.
// Every service, store, and UI component references these.
// ═══════════════════════════════════════════════════════════════════════

export type StepStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface LogEntry {
  ts: string;
  level: 'INFO' | 'WARN' | 'DEBUG' | 'ERROR';
  msg: string;
}

export interface PipelineStepDef {
  id: string;
  agentId: string;
  agentName: string;
  label: string;
}

export interface PipelineStepState extends PipelineStepDef {
  status: StepStatus;
  logs: LogEntry[];
  durationMs: number;
  startedAt: number | null;
  completedAt: number | null;
  attempts: number;
  maxAttempts: number;
  error: string | null;
}

export interface ShortsPackage {
  topic: string;
  hook: string;
  script: string;
  visualPrompts: { scene: number; prompt: string; duration: string }[];
  thumbnailConcept: string;
  titles: string[];
  description: string;
  hashtags: string[];
  publishingNotes: string[];
  estimatedCost: string;
  totalDuration: string;
}

export type PipelineStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface PipelineRun {
  id: string;
  channelId: string;
  status: PipelineStatus;
  steps: PipelineStepState[];
  result: ShortsPackage | null;
  startedAt: number | null;
  completedAt: number | null;
  totalCost: number;
}

// ═══════════════════════════════════════════════════════════════════════
// AI Provider Types
// Abstraction for OpenAI / Claude / Gemini — provider-agnostic interface.
// ═══════════════════════════════════════════════════════════════════════

export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface AIRequestOptions {
  provider: AIProvider;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
  tokensUsed: number;
  costUsd: number;
  latencyMs: number;
}

// ═══════════════════════════════════════════════════════════════════════
// Queue Types
// ═══════════════════════════════════════════════════════════════════════

export type QueueJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'retry' | 'cancelled';

export interface QueueJob {
  id: string;
  pipelineId: string;
  stepId: string;
  agentId: string;
  agentName: string;
  title: string;
  status: QueueJobStatus;
  priority: number; // 0=critical, 1=high, 2=normal, 3=low
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
}

// ═══════════════════════════════════════════════════════════════════════
// Arsenal Types
// ═══════════════════════════════════════════════════════════════════════

export type ArsenalCategory =
  | 'prompt_templates'
  | 'story_templates'
  | 'thumbnail_templates'
  | 'brand_rules'
  | 'visual_styles'
  | 'voice_presets'
  | 'publishing_presets'
  | 'workflow_templates';

export interface ArsenalAsset {
  id: string;
  name: string;
  category: ArsenalCategory;
  content: string;
  tags: string[];
  uses: number;
  createdAt: number;
  updatedAt: number;
}

// ═══════════════════════════════════════════════════════════════════════
// Agent Execution Types
// ═══════════════════════════════════════════════════════════════════════

export interface AgentExecution {
  id: string;
  agentId: string;
  pipelineId: string;
  stepId: string;
  status: StepStatus;
  startedAt: number;
  completedAt: number | null;
  durationMs: number;
  cost: number;
  tokensUsed: number;
  logs: LogEntry[];
  error: string | null;
  retryCount: number;
}
