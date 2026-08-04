// ═══════════════════════════════════════════════════════════════════════
// Atlas Chat — HTTP contract types for POST /api/chat
// ═══════════════════════════════════════════════════════════════════════

export type AtlasAnalysisMode = 'conversational' | 'meta-synthesis' | 'daily-guide';

export type AtlasPromptProfile =
  | 'conversational'
  | 'meta-synthesis'
  | 'personal-analysis'
  | 'shorts'
  | 'generic';

export interface AtlasChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AtlasChatRequest {
  message: string;
  history?: AtlasChatTurn[];
  userId?: string;
  mode?: AtlasAnalysisMode;
  profile?: AtlasPromptProfile;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AtlasChatResponse {
  reply: string;
  content: string;
  mode: AtlasAnalysisMode;
  profile: AtlasPromptProfile;
  model: string;
  provider: string;
  tokensUsed: number;
  costUsd: number;
  latencyMs: number;
  memoryUpdated?: boolean;
  memoryHandled?: boolean;
}

export interface AtlasChatErrorResponse {
  error: string;
}

export type AtlasChatResult = AtlasChatResponse | AtlasChatErrorResponse;

export interface AtlasChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: AtlasAnalysisMode;
  profile?: AtlasPromptProfile;
  pending?: boolean;
  error?: boolean;
}
