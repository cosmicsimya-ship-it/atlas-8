// ═══════════════════════════════════════════════════════════════════════
// Memory V2 — SQLite store (node:sqlite DatabaseSync, no extra deps)
// All mutations require userId scope. Transactions for supersede/dedup.
// ═══════════════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, unlinkSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import {
  CREATE_TABLES_SQL,
  SCHEMA_VERSION,
  isValidMemoryType,
  isValidMemoryStatus,
} from './schema.js';
import { MEMORY_PAYLOAD_LIMITS } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = join(__dirname, '..', '..', 'data', 'user_memory_v2.sqlite');

/** @type {DatabaseSync|null} */
let dbInstance = null;
/** @type {string|null} */
let dbPathActive = null;
/** @type {Promise<void>} */
let writeLock = Promise.resolve();

const SQLITE_BUSY_RE = /SQLITE_BUSY|database is locked|database table is locked/i;

/**
 * @param {unknown} err
 */
function isSqliteBusyError(err) {
  const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err ?? '');
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
  const errstr = err && typeof err === 'object' && 'errstr' in err ? String(err.errstr) : '';
  return SQLITE_BUSY_RE.test(msg) || SQLITE_BUSY_RE.test(code) || SQLITE_BUSY_RE.test(errstr);
}

/**
 * Retry sync SQLite work on BUSY/locked (OneDrive/AV/cross-process).
 * @template T
 * @param {() => T} fn
 * @param {{ retries?: number, baseDelayMs?: number }} [opts]
 * @returns {T}
 */
function withBusyRetry(fn, opts = {}) {
  const retries = opts.retries ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 25;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return fn();
    } catch (err) {
      lastErr = err;
      if (!isSqliteBusyError(err) || attempt === retries) throw err;
      const delay = baseDelayMs * (attempt + 1);
      const end = Date.now() + delay;
      while (Date.now() < end) {
        /* sync backoff — DatabaseSync API is synchronous */
      }
    }
  }
  throw lastErr;
}

/**
 * @returns {string}
 */
export function getMemoryV2DbPath() {
  const override = process.env.ATLAS_MEMORY_V2_DB?.trim();
  return override || DEFAULT_DB_PATH;
}

function ensureParentDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * @template T
 * @param {() => T} fn
 * @returns {Promise<T>}
 */
async function withWriteLock(fn) {
  const run = writeLock.then(
    () => withBusyRetry(fn),
    () => withBusyRetry(fn),
  );
  writeLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * @param {string} [pathOverride]
 * @returns {DatabaseSync}
 */
export function openMemoryDb(pathOverride) {
  const path = pathOverride || getMemoryV2DbPath();
  if (dbInstance && dbPathActive === path) {
    return dbInstance;
  }
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      /* ignore */
    }
    dbInstance = null;
    dbPathActive = null;
  }
  if (path !== ':memory:') {
    ensureParentDir(path);
  }
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  // NORMAL balances durability vs fsync cost on single-node persistent FS.
  db.exec('PRAGMA synchronous = NORMAL;');
  // Wait up to 8s for locks (cross-process CLI, AV, cloud-synced dirs).
  db.exec('PRAGMA busy_timeout = 8000;');
  db.exec(CREATE_TABLES_SQL);
  // Partial unique: at most one active row per (user, canonical_key)
  try {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_user_active_key
      ON memories(user_id, canonical_key)
      WHERE status = 'active' AND canonical_key IS NOT NULL
    `);
  } catch (err) {
    console.warn('[MemoryV2] unique active-key index:', err.message);
  }
  ensureSchemaVersion(db);
  dbInstance = db;
  dbPathActive = path;
  return db;
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
function ensureSchemaVersion(db) {
  const ver = db.prepare('SELECT value FROM schema_meta WHERE key = ?').get('version');
  if (!ver) {
    db.prepare('INSERT INTO schema_meta(key, value) VALUES (?, ?)').run(
      'version',
      String(SCHEMA_VERSION),
    );
    return;
  }
  const current = Number(ver.value);
  if (Number.isNaN(current)) {
    throw new Error(`memory_schema_invalid_version:${ver.value}`);
  }
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `memory_schema_newer_than_code:db=${current},code=${SCHEMA_VERSION}`,
    );
  }
  if (current < SCHEMA_VERSION) {
    runSchemaMigrations(db, current, SCHEMA_VERSION);
  }
}

/**
 * Forward-only schema migrations. Add steps when SCHEMA_VERSION increases.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {number} from
 * @param {number} to
 */
function runSchemaMigrations(db, from, to) {
  let v = from;
  while (v < to) {
    const next = v + 1;
    // Baseline is v1 (CREATE_TABLES_SQL). Future migrations go here:
    // if (next === 2) { db.exec('ALTER TABLE ...'); }
    db.prepare(`DELETE FROM schema_meta WHERE key = ?`).run('version');
    db.prepare(`INSERT INTO schema_meta(key, value) VALUES (?, ?)`).run(
      'version',
      String(next),
    );
    v = next;
  }
}

/** Close DB (tests). */
export function closeMemoryDb() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      /* ignore */
    }
  }
  dbInstance = null;
  dbPathActive = null;
}

/**
 * Reset store for tests. Refuses production default unless override/env allows.
 * @param {{ force?: boolean }} [opts]
 */
export async function resetMemoryV2StoreForTests(opts = {}) {
  const path = getMemoryV2DbPath();
  const isOverride = Boolean(process.env.ATLAS_MEMORY_V2_DB?.trim());
  const allow = process.env.ATLAS_ALLOW_MEMORY_RESET === '1' || opts.force === true;
  if (!isOverride && path === DEFAULT_DB_PATH && !allow) {
    return { ok: false, error: 'refused_production_memory_v2_reset' };
  }
  return withWriteLock(() => {
    closeMemoryDb();
    if (path === ':memory:') {
      openMemoryDb(':memory:');
      return { ok: true };
    }
    try {
      if (existsSync(path)) unlinkSync(path);
      for (const suffix of ['-wal', '-shm']) {
        const p = `${path}${suffix}`;
        if (existsSync(p)) unlinkSync(p);
      }
    } catch {
      /* ignore */
    }
    openMemoryDb(path);
    return { ok: true };
  });
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {object} row
 * @returns {import('./schema.js').MemoryRecord}
 */
function rowToRecord(row) {
  let value = null;
  let metadata = null;
  try {
    value = row.value_json != null ? JSON.parse(row.value_json) : null;
  } catch {
    value = row.value_json;
  }
  try {
    metadata = row.metadata_json != null ? JSON.parse(row.metadata_json) : null;
  } catch {
    metadata = null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    key: row.canonical_key ?? null,
    value,
    text: row.text,
    status: row.status,
    source: row.source,
    confidence: Number(row.confidence),
    importance: Number(row.importance),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at ?? null,
    conversationId: row.conversation_id ?? null,
    sourceMessageId: row.source_message_id ?? null,
    supersedesId: row.supersedes_id ?? null,
    supersededById: row.superseded_by_id ?? null,
    metadata,
  };
}

/**
 * @param {Partial<import('./schema.js').MemoryRecord> & { userId: string, text: string, type: string }} input
 * @returns {Promise<{ ok: true, memory: import('./schema.js').MemoryRecord } | { ok: false, error: string }>}
 */
export async function insertMemoryRecord(input) {
  if (!input?.userId || typeof input.userId !== 'string') {
    return { ok: false, error: 'invalid_user_id' };
  }
  if (!isValidMemoryType(input.type)) {
    return { ok: false, error: 'invalid_type' };
  }
  const text = String(input.text ?? '').trim();
  if (!text) {
    return { ok: false, error: 'invalid_text' };
  }
  if (text.length > MEMORY_PAYLOAD_LIMITS.maxRejectChars) {
    return { ok: false, error: 'payload_too_large' };
  }
  if (text.length > MEMORY_PAYLOAD_LIMITS.maxTextChars) {
    return { ok: false, error: 'text_exceeds_limit' };
  }

  const confidence = clamp01(input.confidence ?? 1);
  const importance = clamp01(input.importance ?? 0.5);

  return withWriteLock(() => {
    const db = openMemoryDb();
    const now = new Date().toISOString();
    const id = input.id || `mem_${randomUUID()}`;
    const status = input.status && isValidMemoryStatus(input.status) ? input.status : 'active';
    try {
      db.prepare(
        `INSERT INTO memories (
          id, user_id, type, canonical_key, value_json, text, status, source,
          confidence, importance, created_at, updated_at, last_accessed_at,
          conversation_id, source_message_id, supersedes_id, superseded_by_id, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.userId,
        input.type,
        input.key ?? null,
        input.value === undefined ? null : JSON.stringify(input.value),
        text,
        status,
        input.source || 'explicit_user',
        confidence,
        importance,
        input.createdAt || now,
        input.updatedAt || now,
        input.lastAccessedAt ?? null,
        input.conversationId ?? null,
        input.sourceMessageId ?? null,
        input.supersedesId ?? null,
        input.supersededById ?? null,
        input.metadata ? JSON.stringify(input.metadata).slice(0, MEMORY_PAYLOAD_LIMITS.maxMetadataChars) : null,
      );
    } catch (err) {
      return { ok: false, error: err.message };
    }
    const row = db.prepare('SELECT * FROM memories WHERE id = ? AND user_id = ?').get(id, input.userId);
    return { ok: true, memory: rowToRecord(row) };
  });
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0.5;
  return Math.min(1, Math.max(0, x));
}

/**
 * @param {string} userId
 * @param {string} memoryId
 */
export function getMemoryById(userId, memoryId) {
  const db = openMemoryDb();
  const row = db
    .prepare('SELECT * FROM memories WHERE id = ? AND user_id = ?')
    .get(memoryId, userId);
  return row ? rowToRecord(row) : null;
}

/**
 * @param {string} userId
 * @param {{ status?: string|string[], type?: string, key?: string|null, limit?: number }} [opts]
 * @returns {import('./schema.js').MemoryRecord[]}
 */
export function listMemories(userId, opts = {}) {
  const db = openMemoryDb();
  const clauses = ['user_id = ?'];
  /** @type {unknown[]} */
  const params = [userId];

  if (opts.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
    clauses.push(`status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }
  if (opts.type) {
    clauses.push('type = ?');
    params.push(opts.type);
  }
  if (opts.key !== undefined) {
    if (opts.key === null) {
      clauses.push('canonical_key IS NULL');
    } else {
      clauses.push('canonical_key = ?');
      params.push(opts.key);
    }
  }

  const limit = Math.min(Math.max(opts.limit ?? 5000, 1), 50000);
  const sql = `SELECT * FROM memories WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC LIMIT ?`;
  params.push(limit);
  const rows = db.prepare(sql).all(...params);
  return rows.map(rowToRecord);
}

/**
 * @param {string} userId
 * @returns {import('./schema.js').MemoryRecord[]}
 */
export function listActiveMemories(userId) {
  return listMemories(userId, { status: 'active' });
}

/**
 * Find active memory by canonical key (user scoped).
 * @param {string} userId
 * @param {string} key
 */
export function findActiveByKey(userId, key) {
  if (!key) return null;
  const db = openMemoryDb();
  const row = db
    .prepare(
      `SELECT * FROM memories WHERE user_id = ? AND status = 'active' AND canonical_key = ?
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(userId, key);
  return row ? rowToRecord(row) : null;
}

/**
 * Exact text duplicate among active memories (normalized comparison done by caller).
 * @param {string} userId
 * @param {string} normalizedText
 * @param {string|null} [key]
 */
export function findActiveExactText(userId, normalizedText, key = null) {
  const db = openMemoryDb();
  const rows = key
    ? db
        .prepare(
          `SELECT * FROM memories WHERE user_id = ? AND status = 'active' AND canonical_key = ?`,
        )
        .all(userId, key)
    : db
        .prepare(`SELECT * FROM memories WHERE user_id = ? AND status = 'active'`)
        .all(userId);

  for (const row of rows) {
    const rec = rowToRecord(row);
    if (normalizeCompareText(rec.text) === normalizedText) {
      return rec;
    }
    if (
      key &&
      rec.key === key &&
      JSON.stringify(rec.value) === JSON.stringify(undefined)
    ) {
      /* continue */
    }
  }
  return null;
}

function normalizeCompareText(text) {
  return String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} userId
 * @param {string} memoryId
 * @param {Partial<import('./schema.js').MemoryRecord>} patch
 */
export async function updateMemoryRecord(userId, memoryId, patch) {
  return withWriteLock(() => {
    const db = openMemoryDb();
    const existing = db
      .prepare('SELECT * FROM memories WHERE id = ? AND user_id = ?')
      .get(memoryId, userId);
    if (!existing) return { ok: false, error: 'not_found' };

    const next = rowToRecord(existing);
    if (patch.type !== undefined) {
      if (!isValidMemoryType(patch.type)) return { ok: false, error: 'invalid_type' };
      next.type = patch.type;
    }
    if (patch.key !== undefined) next.key = patch.key;
    if (patch.value !== undefined) next.value = patch.value;
    if (patch.text !== undefined) next.text = String(patch.text).trim();
    if (patch.status !== undefined) {
      if (!isValidMemoryStatus(patch.status)) return { ok: false, error: 'invalid_status' };
      next.status = patch.status;
    }
    if (patch.source !== undefined) next.source = patch.source;
    if (patch.confidence !== undefined) next.confidence = patch.confidence;
    if (patch.importance !== undefined) next.importance = patch.importance;
    if (patch.lastAccessedAt !== undefined) next.lastAccessedAt = patch.lastAccessedAt;
    if (patch.conversationId !== undefined) next.conversationId = patch.conversationId;
    if (patch.sourceMessageId !== undefined) next.sourceMessageId = patch.sourceMessageId;
    if (patch.supersedesId !== undefined) next.supersedesId = patch.supersedesId;
    if (patch.supersededById !== undefined) next.supersededById = patch.supersededById;
    if (patch.metadata !== undefined) next.metadata = patch.metadata;
    next.updatedAt = new Date().toISOString();

    db.prepare(
      `UPDATE memories SET
        type = ?, canonical_key = ?, value_json = ?, text = ?, status = ?, source = ?,
        confidence = ?, importance = ?, updated_at = ?, last_accessed_at = ?,
        conversation_id = ?, source_message_id = ?, supersedes_id = ?, superseded_by_id = ?,
        metadata_json = ?
       WHERE id = ? AND user_id = ?`,
    ).run(
      next.type,
      next.key,
      next.value === undefined ? null : JSON.stringify(next.value),
      next.text,
      next.status,
      next.source,
      next.confidence,
      next.importance,
      next.updatedAt,
      next.lastAccessedAt ?? null,
      next.conversationId ?? null,
      next.sourceMessageId ?? null,
      next.supersedesId ?? null,
      next.supersededById ?? null,
      next.metadata ? JSON.stringify(next.metadata) : null,
      memoryId,
      userId,
    );

    return { ok: true, memory: getMemoryById(userId, memoryId) };
  });
}

/**
 * Soft-delete: status=deleted. Always scoped by userId.
 * @param {string} userId
 * @param {string} memoryId
 */
export async function softDeleteMemory(userId, memoryId) {
  return updateMemoryRecord(userId, memoryId, { status: 'deleted' });
}

/**
 * Hard delete one record (privacy erase). Scoped by userId.
 * @param {string} userId
 * @param {string} memoryId
 */
export async function hardDeleteMemory(userId, memoryId) {
  return withWriteLock(() => {
    const db = openMemoryDb();
    const info = db
      .prepare('DELETE FROM memories WHERE id = ? AND user_id = ?')
      .run(memoryId, userId);
    return { ok: info.changes > 0, deleted: info.changes };
  });
}

/**
 * Hard-delete all memories for a user (account erase).
 * @param {string} userId
 */
export async function hardDeleteAllUserMemories(userId) {
  return withWriteLock(() => {
    const db = openMemoryDb();
    const info = db.prepare('DELETE FROM memories WHERE user_id = ?').run(userId);
    return { ok: true, deleted: info.changes };
  });
}

/**
 * Soft-delete all active (and optionally superseded) for user.
 * @param {string} userId
 */
export async function softDeleteAllUserMemories(userId) {
  return withWriteLock(() => {
    const db = openMemoryDb();
    const now = new Date().toISOString();
    const info = db
      .prepare(
        `UPDATE memories SET status = 'deleted', updated_at = ?
         WHERE user_id = ? AND status != 'deleted'`,
      )
      .run(now, userId);
    return { ok: true, deleted: info.changes };
  });
}

/**
 * Atomic supersede: mark old superseded, insert new active linked.
 * @param {string} userId
 * @param {string} oldMemoryId
 * @param {Partial<import('./schema.js').MemoryRecord> & { text: string, type: string }} newInput
 */
export async function supersedeMemory(userId, oldMemoryId, newInput) {
  return withWriteLock(() => {
    const db = openMemoryDb();
    const old = db
      .prepare('SELECT * FROM memories WHERE id = ? AND user_id = ?')
      .get(oldMemoryId, userId);
    if (!old) return { ok: false, error: 'old_not_found' };
    if (!isValidMemoryType(newInput.type)) return { ok: false, error: 'invalid_type' };

    const now = new Date().toISOString();
    const newId = newInput.id || `mem_${randomUUID()}`;

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `UPDATE memories SET status = 'superseded', superseded_by_id = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      ).run(newId, now, oldMemoryId, userId);

      if (process.env.ATLAS_MEMORY_FAULT_INJECT === 'supersede_mid') {
        throw new Error('fault_inject_supersede_mid');
      }

      db.prepare(
        `INSERT INTO memories (
          id, user_id, type, canonical_key, value_json, text, status, source,
          confidence, importance, created_at, updated_at, last_accessed_at,
          conversation_id, source_message_id, supersedes_id, superseded_by_id, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      ).run(
        newId,
        userId,
        newInput.type,
        newInput.key ?? old.canonical_key,
        newInput.value === undefined ? old.value_json : JSON.stringify(newInput.value),
        String(newInput.text).trim(),
        newInput.source || 'explicit_user',
        newInput.confidence ?? 1,
        newInput.importance ?? 0.5,
        now,
        now,
        null,
        newInput.conversationId ?? null,
        newInput.sourceMessageId ?? null,
        oldMemoryId,
        newInput.metadata ? JSON.stringify(newInput.metadata) : null,
      );
      db.exec('COMMIT');
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return { ok: false, error: err.message };
    }

    return {
      ok: true,
      old: getMemoryById(userId, oldMemoryId),
      memory: getMemoryById(userId, newId),
    };
  });
}

/**
 * Touch last_accessed_at for ranking (best-effort).
 * @param {string} userId
 * @param {string[]} memoryIds
 */
export async function touchMemoriesAccessed(userId, memoryIds) {
  if (!memoryIds?.length) return;
  try {
    return await withWriteLock(() => {
      const db = openMemoryDb();
      const now = new Date().toISOString();
      const stmt = db.prepare(
        `UPDATE memories SET last_accessed_at = ? WHERE id = ? AND user_id = ?`,
      );
      for (const id of memoryIds) {
        stmt.run(now, id, userId);
      }
    });
  } catch (err) {
    // Ranking touch must never fail chat/retrieval (esp. SQLITE_BUSY).
    if (isSqliteBusyError(err)) {
      console.warn('[MemoryV2] touch last_accessed skipped (busy):', err.message);
      return;
    }
    console.warn('[MemoryV2] touch last_accessed failed:', err.message);
  }
}

/**
 * Count memories for diagnostics / migration verify.
 * @param {string} [userId]
 */
export function countMemories(userId) {
  const db = openMemoryDb();
  if (userId) {
    const row = db
      .prepare(`SELECT COUNT(*) AS c FROM memories WHERE user_id = ?`)
      .get(userId);
    return Number(row?.c ?? 0);
  }
  const row = db.prepare(`SELECT COUNT(*) AS c FROM memories`).get();
  return Number(row?.c ?? 0);
}

/**
 * Distinct user count in V2 store.
 */
export function countDistinctUsers() {
  const db = openMemoryDb();
  const row = db.prepare(`SELECT COUNT(DISTINCT user_id) AS c FROM memories`).get();
  return Number(row?.c ?? 0);
}

/**
 * @returns {string[]}
 */
export function listAllUserIds() {
  const db = openMemoryDb();
  const rows = db.prepare(`SELECT DISTINCT user_id AS user_id FROM memories`).all();
  return rows.map((r) => String(r.user_id));
}

/**
 * Narrow active candidates by canonical keys (+ optional recent free-form).
 * Uses indexed (user_id, status, canonical_key) access patterns.
 * @param {string} userId
 * @param {{
 *   keys?: string[],
 *   includeNullKeysLimit?: number,
 *   alwaysIncludeKeys?: string[],
 * }} [opts]
 */
export function listActiveCandidates(userId, opts = {}) {
  const db = openMemoryDb();
  const keySet = new Set([
    ...(opts.keys || []),
    ...(opts.alwaysIncludeKeys || []),
  ]);
  /** @type {import('./schema.js').MemoryRecord[]} */
  const out = [];
  const seen = new Set();

  if (keySet.size > 0) {
    const keys = [...keySet];
    const placeholders = keys.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT * FROM memories
         WHERE user_id = ? AND status = 'active' AND canonical_key IN (${placeholders})`,
      )
      .all(userId, ...keys);
    for (const row of rows) {
      const rec = rowToRecord(row);
      if (!seen.has(rec.id)) {
        seen.add(rec.id);
        out.push(rec);
      }
    }
  }

  const nullLimit = Math.min(Math.max(opts.includeNullKeysLimit ?? 0, 0), 200);
  if (nullLimit > 0) {
    const rows = db
      .prepare(
        `SELECT * FROM memories
         WHERE user_id = ? AND status = 'active' AND canonical_key IS NULL
         ORDER BY updated_at DESC LIMIT ?`,
      )
      .all(userId, nullLimit);
    for (const row of rows) {
      const rec = rowToRecord(row);
      if (!seen.has(rec.id)) {
        seen.add(rec.id);
        out.push(rec);
      }
    }
  }

  return out;
}

/**
 * @returns {{ ok: boolean, version: number|null, integrity: string, error?: string }}
 */
export function checkMemoryDbHealth() {
  try {
    const db = openMemoryDb();
    const ver = db.prepare('SELECT value FROM schema_meta WHERE key = ?').get('version');
    const integrity = db.prepare('PRAGMA integrity_check').get();
    const integrityMsg =
      integrity && typeof integrity === 'object'
        ? String(Object.values(integrity)[0] ?? 'unknown')
        : String(integrity ?? 'unknown');
    return {
      ok: integrityMsg === 'ok',
      version: ver ? Number(ver.value) : null,
      integrity: integrityMsg,
    };
  } catch (err) {
    return { ok: false, version: null, integrity: 'error', error: err.message };
  }
}

/**
 * Online backup via SQLite backup API when available; else VACUUM INTO / file copy after checkpoint.
 * @param {string} destPath
 */
export function backupMemoryDb(destPath) {
  const db = openMemoryDb();
  ensureParentDir(destPath);
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    /* ignore */
  }
  // Node sqlite DatabaseSync.backup if present
  if (typeof db.backup === 'function') {
    db.backup(destPath);
    return { ok: true, method: 'backup' };
  }
  try {
    db.exec(`VACUUM INTO '${destPath.replace(/'/g, "''")}'`);
    return { ok: true, method: 'vacuum_into' };
  } catch (err) {
    const src = getMemoryV2DbPath();
    copyFileSync(src, destPath);
    return { ok: true, method: 'file_copy_after_checkpoint', warning: err.message };
  }
}

export { normalizeCompareText, withWriteLock, DEFAULT_DB_PATH, SCHEMA_VERSION };
