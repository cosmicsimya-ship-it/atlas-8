// ═══════════════════════════════════════════════════════════════════════
// Structured user feedback store — Admin Control Center MVP.
//
// Separate from server/chat-feedback.js (per-message 👍/👎 ratings, no
// workflow) and from server/persona-feedback (editorial persona-tuning
// extraction, internal-only). This store is for user-submitted feedback
// (bug reports, suggestions, questions, other) that an admin triages
// through a status/priority/note workflow.
//
// Same JSON-file-store shape as admin-audit.js and chat-feedback.js:
// atomic write-then-rename, in-process write lock, fail-soft reads.
// ═══════════════════════════════════════════════════════════════════════

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', '..', 'data', 'admin_feedback.json');
const MAX_ENTRIES = 5000;

export const FEEDBACK_TYPES = ['bug', 'suggestion', 'question', 'other'];
export const FEEDBACK_STATUSES = ['new', 'reviewing', 'resolved', 'dismissed'];
export const FEEDBACK_PRIORITIES = ['low', 'normal', 'high', 'critical'];

const MAX_MESSAGE_LENGTH = 4000;
const MAX_NOTE_LENGTH = 2000;
const MAX_ID_FIELD_LENGTH = 200;

/** @type {string} */
let storePath = DEFAULT_PATH;

export function configureFeedbackStore(filePath) {
  storePath = filePath || DEFAULT_PATH;
}

export function getFeedbackStorePath() {
  return storePath;
}

function emptyStore() {
  return { entries: [] };
}

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadStore() {
  ensureDir(storePath);
  if (!existsSync(storePath)) {
    const empty = emptyStore();
    writeFileSync(storePath, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'));
    if (!parsed || !Array.isArray(parsed.entries)) return emptyStore();
    return { entries: [...parsed.entries] };
  } catch {
    return emptyStore();
  }
}

/** @type {Promise<void>} */
let writeLock = Promise.resolve();

async function withWriteLock(fn) {
  const run = writeLock.then(fn, fn);
  writeLock = run.then(() => undefined, () => undefined);
  return run;
}

function saveStore(store) {
  ensureDir(storePath);
  const tmp = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tmp, storePath);
}

function boundedString(value, maxLength) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (!str) return null;
  return str.slice(0, maxLength);
}

/**
 * @param {{
 *   userId: string,
 *   type: string,
 *   message: string,
 *   route?: string|null,
 *   conversationId?: string|null,
 *   messageId?: string|null,
 * }} input
 */
export async function createFeedback(input) {
  const userId = boundedString(input?.userId, MAX_ID_FIELD_LENGTH);
  if (!userId) return { ok: false, error: 'userId required' };

  const type = FEEDBACK_TYPES.includes(input?.type) ? input.type : null;
  if (!type) return { ok: false, error: `type must be one of: ${FEEDBACK_TYPES.join(', ')}` };

  const message = boundedString(input?.message, MAX_MESSAGE_LENGTH);
  if (!message) return { ok: false, error: 'message required' };

  const route = boundedString(input?.route, 300);
  const conversationId = boundedString(input?.conversationId, MAX_ID_FIELD_LENGTH);
  const messageId = boundedString(input?.messageId, MAX_ID_FIELD_LENGTH);

  return withWriteLock(() => {
    const store = loadStore();
    const now = new Date().toISOString();
    const entry = {
      id: `fb_${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
      userId,
      type,
      message,
      route,
      conversationId,
      messageId,
      status: 'new',
      priority: 'normal',
      adminNote: null,
    };
    store.entries.push(entry);
    if (store.entries.length > MAX_ENTRIES) {
      store.entries = store.entries.slice(-MAX_ENTRIES);
    }
    saveStore(store);
    return { ok: true, feedback: entry };
  });
}

/**
 * @param {{ status?: string, priority?: string, type?: string, limit?: number, offset?: number }} [opts]
 */
export function listFeedback(opts = {}) {
  const MAX_LIMIT = 200;
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), MAX_LIMIT);
  const offset = Math.max(Number(opts.offset) || 0, 0);

  const store = loadStore();
  let rows = store.entries.slice().reverse(); // newest first

  if (opts.status) rows = rows.filter((r) => r.status === opts.status);
  if (opts.priority) rows = rows.filter((r) => r.priority === opts.priority);
  if (opts.type) rows = rows.filter((r) => r.type === opts.type);

  const total = rows.length;
  const page = rows.slice(offset, offset + limit);
  return { total, limit, offset, entries: page };
}

export function getFeedbackById(id) {
  const store = loadStore();
  return store.entries.find((e) => e.id === id) || null;
}

export function countFeedbackByStatus() {
  const store = loadStore();
  const counts = { new: 0, reviewing: 0, resolved: 0, dismissed: 0 };
  for (const e of store.entries) {
    if (counts[e.status] !== undefined) counts[e.status] += 1;
  }
  return counts;
}

async function updateEntry(id, mutate) {
  return withWriteLock(() => {
    const store = loadStore();
    const entry = store.entries.find((e) => e.id === id);
    if (!entry) return { ok: false, status: 404, error: 'Feedback not found' };
    mutate(entry);
    entry.updatedAt = new Date().toISOString();
    saveStore(store);
    return { ok: true, feedback: entry };
  });
}

/** @param {{ id: string, status: string }} input */
export async function updateFeedbackStatus({ id, status }) {
  if (!FEEDBACK_STATUSES.includes(status)) {
    return { ok: false, status: 400, error: `status must be one of: ${FEEDBACK_STATUSES.join(', ')}` };
  }
  return updateEntry(id, (entry) => {
    entry.status = status;
  });
}

/** @param {{ id: string, priority: string }} input */
export async function updateFeedbackPriority({ id, priority }) {
  if (!FEEDBACK_PRIORITIES.includes(priority)) {
    return { ok: false, status: 400, error: `priority must be one of: ${FEEDBACK_PRIORITIES.join(', ')}` };
  }
  return updateEntry(id, (entry) => {
    entry.priority = priority;
  });
}

/** @param {{ id: string, note: string|null }} input */
export async function setFeedbackAdminNote({ id, note }) {
  if (note !== null && note !== undefined && typeof note !== 'string') {
    return { ok: false, status: 400, error: 'note must be a string or null' };
  }
  const bounded = note === null || note === undefined ? null : boundedString(note, MAX_NOTE_LENGTH);
  return updateEntry(id, (entry) => {
    entry.adminNote = bounded;
  });
}

export async function resetFeedbackStoreForTests(filePath) {
  if (filePath) configureFeedbackStore(filePath);
  ensureDir(storePath);
  writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), 'utf8');
}
