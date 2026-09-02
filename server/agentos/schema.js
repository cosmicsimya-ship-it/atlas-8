// ═══════════════════════════════════════════════════════════════════════
// AgentOS Task Orchestration — schema constants + SQLite DDL
// ═══════════════════════════════════════════════════════════════════════

export const TASK_OWNER_AGENTS = Object.freeze([
  'atlas-core',
  'core-engine',
  'pattern-engine',
  'critic-engine',
  'quality-engine',
  'visual-engine',
]);

// Maps an Admin-facing owner-agent id (above) to the actual runner/agents/
// prompt file invoked for it. atlas-core has no direct single-call mapping
// here — it never runs as a delegate itself, only as the synthesis stage
// (see server/agentos/orchestrator.js).
export const OWNER_TO_DELEGATE_AGENT = Object.freeze({
  'core-engine': 'research-core-engine',
  'pattern-engine': 'research-pattern-engine',
  'critic-engine': 'research-critic-engine',
  'quality-engine': 'research-quality-engine',
  'visual-engine': 'research-visual-engine',
});

export const TASK_MODES = Object.freeze(['research_only', 'review_only', 'implementation_allowed']);
export const DEFAULT_TASK_MODE = 'research_only';

export const TASK_STATUSES = Object.freeze([
  'queued',
  'running',
  'waiting_for_review',
  'completed',
  'failed',
  'cancelled',
]);

export const SUBTASK_STATUSES = Object.freeze(['queued', 'running', 'completed', 'failed']);

export const APPROVAL_ACTIONS = Object.freeze(['implementation', 'commit', 'push', 'deploy']);
// push/deploy have no execution engine behind them in Phase 1 — always
// rejected by server/admin/agentos-task-actions.js regardless of mode.
export const PHASE1_DISABLED_APPROVAL_ACTIONS = Object.freeze(['push', 'deploy']);

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  owner_agent TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'research_only',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  final_synthesis_json TEXT,
  error_json TEXT,
  approvals_json TEXT NOT NULL DEFAULT '{"implementation":false,"commit":false,"push":false,"deploy":false}',
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS agent_subtasks (
  id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  output_json TEXT,
  error_json TEXT,
  started_at TEXT,
  completed_at TEXT,
  model TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_at ON agent_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_subtasks_task ON agent_subtasks(task_id);
`;

/**
 * @param {string} owner
 */
export function isValidOwnerAgent(owner) {
  return TASK_OWNER_AGENTS.includes(owner);
}

/**
 * @param {string} mode
 */
export function isValidTaskMode(mode) {
  return TASK_MODES.includes(mode);
}

/**
 * @param {string} action
 */
export function isValidApprovalAction(action) {
  return APPROVAL_ACTIONS.includes(action);
}
