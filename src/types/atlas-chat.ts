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

export interface AtlasSelectionPayload {
  label?: string;
  semanticTarget?: string;
  semanticIntent?: string;
  index?: number;
  sourceMessageId?: string;
  domain?: string;
}

export interface AtlasImageAttachment {
  mimeType: string;
  base64: string;
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
  /** Structured payload when user clicks an Atlas-offered option */
  selection?: AtlasSelectionPayload;
  /** Lara Prime — image.analysis capability required server-side */
  image?: AtlasImageAttachment;
  /** Active conversation to append to; server creates a new one if omitted/unowned */
  conversationId?: string;
  /** Client-generated id for retry-safe persistence (not a security token) */
  clientRequestId?: string;
}

export interface AtlasChatUsage {
  plan: 'guest' | 'free' | 'premium';
  dailyUsed: number;
  dailyLimit: number;
}

export interface AtlasConversationSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
}

export interface AtlasConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  hasImage: boolean;
  imageMimeType: string | null;
}

export interface AtlasConversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: AtlasConversationMessage[];
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
  status?: string;
  errorCode?: string | null;
  errorCategory?: string | null;
  retryable?: boolean;
  requestId?: string | null;
  completionStatus?: string | null;
  incompleteReason?: string | null;
  completenessRetryCount?: number;
  usage?: AtlasChatUsage;
  conversationId?: string;
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
  /** Soft server fallback (HTTP 200 + TIMEOUT) — still retryable in UI */
  retryable?: boolean;
  requestId?: string | null;
  /** Stable id linking a user turn to its assistant response for retry without duplication */
  turnId?: string;
  errorCode?: string | null;
  completionStatus?: string | null;
}
