// ═══════════════════════════════════════════════════════════════════════
// Memory V2 — schema constants + SQLite DDL
// ═══════════════════════════════════════════════════════════════════════

export const MEMORY_TYPES = Object.freeze([
  'profile',
  'preference',
  'habit',
  'fact',
  'goal',
  'person',
  'relationship',
  'project',
  'episodic',
]);

export const MEMORY_STATUSES = Object.freeze(['active', 'superseded', 'deleted']);

export const MEMORY_SOURCES = Object.freeze([
  'explicit_user',
  'profile_form',
  'analysis_flow',
  'system',
  'inferred',
  'migration',
]);

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  canonical_key TEXT,
  value_json TEXT,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'explicit_user',
  confidence REAL NOT NULL DEFAULT 1.0,
  importance REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_accessed_at TEXT,
  conversation_id TEXT,
  source_message_id TEXT,
  supersedes_id TEXT,
  superseded_by_id TEXT,
  metadata_json TEXT,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_user_status ON memories(user_id, status);
CREATE INDEX IF NOT EXISTS idx_memories_user_type ON memories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_memories_user_key ON memories(user_id, canonical_key);
CREATE INDEX IF NOT EXISTS idx_memories_user_status_key ON memories(user_id, status, canonical_key);
`;

/**
 * @typedef {{
 *   id: string,
 *   userId: string,
 *   type: string,
 *   key: string|null,
 *   value: unknown,
 *   text: string,
 *   status: string,
 *   source: string,
 *   confidence: number,
 *   importance: number,
 *   createdAt: string,
 *   updatedAt: string,
 *   lastAccessedAt?: string|null,
 *   conversationId?: string|null,
 *   sourceMessageId?: string|null,
 *   supersedesId?: string|null,
 *   supersededById?: string|null,
 *   metadata?: Record<string, unknown>|null,
 * }} MemoryRecord
 */

/**
 * @param {string} type
 */
export function isValidMemoryType(type) {
  return MEMORY_TYPES.includes(type);
}

/**
 * @param {string} status
 */
export function isValidMemoryStatus(status) {
  return MEMORY_STATUSES.includes(status);
}
