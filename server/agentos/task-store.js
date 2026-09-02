// ═══════════════════════════════════════════════════════════════════════
// AgentOS Task Orchestration — SQLite store (node:sqlite DatabaseSync)
// Mirrors server/memory/store.js's pattern: same WAL/busy-retry/write-lock
// shape. Task-creation volume here is admin-only and low-frequency, so the
// synchronous busy-retry backoff (fine for Memory V2's per-user writes) is
// not a contention risk in this store.
// ═══════════════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { CREATE_TABLES_SQL, SCHEMA_VERSION } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = join(__dirname, '..', '..', 'data', 'agent_tasks.sqlite');

/** @type {DatabaseSync|null} */
let dbInstance = null;
/** @type {string|null} */
let dbPathActive = null;
/** @type {Promise<void>} */
let writeLock = Promise.resolve();

const SQLITE_BUSY_RE = /SQLITE_BUSY|database is locked|database table is locked/i;

function isSqliteBusyError(err) {
  const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err ?? '');
  return SQLITE_BUSY_RE.test(msg);
}

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

export function getAgentTasksDbPath() {
  const override = process.env.ATLAS_AGENT_TASKS_DB?.trim();
  return override || DEFAULT_DB_PATH;
}

function ensureParentDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function openAgentTasksDb(pathOverride) {
  const path = pathOverride || getAgentTasksDbPath();
  if (dbInstance && dbPathActive === path) return dbInstance;
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      /* ignore */
    }
    dbInstance = null;
    dbPathActive = null;
  }
  if (path !== ':memory:') ensureParentDir(path);
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA busy_timeout = 8000;');
  db.exec(CREATE_TABLES_SQL);
  ensureSchemaVersion(db);
  dbInstance = db;
  dbPathActive = path;
  return db;
}

function ensureSchemaVersion(db) {
  const ver = db.prepare('SELECT value FROM schema_meta WHERE key = ?').get('version');
  if (!ver) {
    db.prepare('INSERT INTO schema_meta(key, value) VALUES (?, ?)').run('version', String(SCHEMA_VERSION));
  }
}

export function closeAgentTasksDb() {
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

/** Reset store for tests. Refuses production default unless override/env allows. */
export async function resetAgentTasksStoreForTests(opts = {}) {
  const path = getAgentTasksDbPath();
  const isOverride = Boolean(process.env.ATLAS_AGENT_TASKS_DB?.trim());
  const allow = process.env.ATLAS_ALLOW_AGENT_TASKS_RESET === '1' || opts.force === true;
  if (!isOverride && path === DEFAULT_DB_PATH && !allow) {
    return { ok: false, error: 'refused_production_agent_tasks_reset' };
  }
  return withWriteLock(() => {
    closeAgentTasksDb();
    if (path === ':memory:') {
      openAgentTasksDb(':memory:');
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
    openAgentTasksDb(path);
    return { ok: true };
  });
}

function taskRowToRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    ownerAgent: row.owner_agent,
    mode: row.mode,
    notes: row.notes ?? null,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    finalSynthesis: safeParse(row.final_synthesis_json),
    error: safeParse(row.error_json),
    approvals: safeParse(row.approvals_json) || { implementation: false, commit: false, push: false, deploy: false },
  };
}

function subtaskRowToRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.task_id,
    agentName: row.agent_name,
    label: row.label,
    status: row.status,
    output: safeParse(row.output_json),
    error: safeParse(row.error_json),
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    model: row.model ?? null,
    tokensUsed: row.tokens_used ?? null,
    latencyMs: row.latency_ms ?? null,
  };
}

function safeParse(json) {
  if (json == null) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * @param {{ title: string, prompt: string, ownerAgent: string, mode: string, notes?: string|null, createdBy: string }} input
 */
export async function insertTask(input) {
  return withWriteLock(() => {
    const db = openAgentTasksDb();
    const id = `task_${randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO agent_tasks (id, title, prompt, owner_agent, mode, notes, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
    ).run(id, input.title, input.prompt, input.ownerAgent, input.mode, input.notes ?? null, input.createdBy, now);
    return getTask(id);
  });
}

export function getTask(taskId) {
  const db = openAgentTasksDb();
  const row = db.prepare('SELECT * FROM agent_tasks WHERE id = ?').get(taskId);
  return taskRowToRecord(row);
}

export function listTasks(opts = {}) {
  const db = openAgentTasksDb();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const rows = db.prepare('SELECT * FROM agent_tasks ORDER BY created_at DESC LIMIT ?').all(limit);
  return rows.map(taskRowToRecord);
}

/**
 * Atomic claim: only succeeds when the task is currently in `fromStatus`.
 * This is the no-duplicate-execution guard — a second concurrent attempt
 * to start the same task will find 0 rows changed and back off.
 * @returns {Promise<boolean>} true if this call won the claim
 */
export async function claimTaskStatus(taskId, fromStatus, toStatus, extra = {}) {
  return withWriteLock(() => {
    const db = openAgentTasksDb();
    const now = new Date().toISOString();
    const startedAtSql = extra.setStartedAt ? ', started_at = ?' : '';
    const params = [toStatus];
    if (extra.setStartedAt) params.push(now);
    params.push(taskId, fromStatus);
    const info = db
      .prepare(`UPDATE agent_tasks SET status = ?${startedAtSql} WHERE id = ? AND status = ?`)
      .run(...params);
    return info.changes > 0;
  });
}

export async function setTaskStatus(taskId, status, extra = {}) {
  return withWriteLock(() => {
    const db = openAgentTasksDb();
    const sets = ['status = ?'];
    const params = [status];
    if (extra.completedAt) {
      sets.push('completed_at = ?');
      params.push(extra.completedAt);
    }
    if (extra.finalSynthesis !== undefined) {
      sets.push('final_synthesis_json = ?');
      params.push(extra.finalSynthesis == null ? null : JSON.stringify(extra.finalSynthesis));
    }
    if (extra.error !== undefined) {
      sets.push('error_json = ?');
      params.push(extra.error == null ? null : JSON.stringify(extra.error));
    }
    if (extra.approvals !== undefined) {
      sets.push('approvals_json = ?');
      params.push(JSON.stringify(extra.approvals));
    }
    params.push(taskId);
    db.prepare(`UPDATE agent_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return getTask(taskId);
  });
}

export async function insertSubtask(input) {
  return withWriteLock(() => {
    const db = openAgentTasksDb();
    const id = `subtask_${randomUUID()}`;
    db.prepare(
      `INSERT INTO agent_subtasks (id, task_id, agent_name, label, status)
       VALUES (?, ?, ?, ?, 'queued')`,
    ).run(id, input.taskId, input.agentName, input.label);
    return getSubtask(id);
  });
}

export function getSubtask(id) {
  const db = openAgentTasksDb();
  const row = db.prepare('SELECT * FROM agent_subtasks WHERE id = ?').get(id);
  return subtaskRowToRecord(row);
}

export function listSubtasks(taskId) {
  const db = openAgentTasksDb();
  const rows = db.prepare('SELECT * FROM agent_subtasks WHERE task_id = ? ORDER BY id ASC').all(taskId);
  return rows.map(subtaskRowToRecord);
}

export async function setSubtaskStatus(id, status, extra = {}) {
  return withWriteLock(() => {
    const db = openAgentTasksDb();
    const sets = ['status = ?'];
    const params = [status];
    if (extra.startedAt) {
      sets.push('started_at = ?');
      params.push(extra.startedAt);
    }
    if (extra.completedAt) {
      sets.push('completed_at = ?');
      params.push(extra.completedAt);
    }
    if (extra.output !== undefined) {
      sets.push('output_json = ?');
      params.push(extra.output == null ? null : JSON.stringify(extra.output));
    }
    if (extra.error !== undefined) {
      sets.push('error_json = ?');
      params.push(extra.error == null ? null : JSON.stringify(extra.error));
    }
    if (extra.model !== undefined) {
      sets.push('model = ?');
      params.push(extra.model ?? null);
    }
    if (extra.tokensUsed !== undefined) {
      sets.push('tokens_used = ?');
      params.push(extra.tokensUsed ?? null);
    }
    if (extra.latencyMs !== undefined) {
      sets.push('latency_ms = ?');
      params.push(extra.latencyMs ?? null);
    }
    params.push(id);
    db.prepare(`UPDATE agent_subtasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return getSubtask(id);
  });
}

export { DEFAULT_DB_PATH };
