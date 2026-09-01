// ═══════════════════════════════════════════════════════════════════════
// Per-message 👍/👎 response rating store.
//
// This is the file server/feedback/store.js and src/services/
// atlas-admin-feedback.ts already referenced by name as the expected home
// for chat-response ratings (see their header comments) — placed at the
// server root to mirror those existing references rather than inventing a
// new location.
//
// Separate from server/feedback/store.js (structured bug/suggestion/
// question triage workflow, its own admin status/priority pipeline) and
// from server/persona-feedback (editorial persona-tuning extraction,
// internal-only). This store links a rating to a chat response's
// requestId only — it never stores the prompt or response body.
//
// Same JSON-file-store shape as server/auth/admin-audit.js and
// server/feedback/store.js: atomic write-then-rename, in-process write
// lock, fail-soft reads, bounded size.
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
const DEFAULT_PATH = join(__dirname, '..', 'data', 'chat_feedback.json');
const MAX_ENTRIES = 20000;

export const RATINGS = ['up', 'down'];

/** @type {string} */
let storePath = DEFAULT_PATH;

export function configureChatFeedbackStore(filePath) {
  storePath = filePath || DEFAULT_PATH;
}

export function getChatFeedbackStorePath() {
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
  writeLock = run.then(
    () => undefined,
    () => undefined,
  );
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
 * Record or update a user's rating for one response (requestId). One
 * rating per (userId, requestId) pair — resubmitting the same or a
 * different rating deterministically overwrites the prior one rather than
 * accumulating duplicates.
 *
 * @param {{ userId: string, requestId: string, rating: 'up'|'down', conversationId?: string|null }} input
 */
export async function recordChatFeedback(input) {
  const userId = boundedString(input?.userId, 200);
  if (!userId) return { ok: false, status: 400, error: 'userId required' };

  const requestId = boundedString(input?.requestId, 200);
  if (!requestId) return { ok: false, status: 400, error: 'requestId required' };

  const rating = RATINGS.includes(input?.rating) ? input.rating : null;
  if (!rating) {
    return { ok: false, status: 400, error: `rating must be one of: ${RATINGS.join(', ')}` };
  }

  const conversationId = boundedString(input?.conversationId, 200);

  return withWriteLock(() => {
    const store = loadStore();
    const now = new Date().toISOString();
    // Cross-user isolation: keyed by (userId, requestId) — one user's
    // rating on a response never affects or reveals another user's rating
    // on the same response.
    const existing = store.entries.find(
      (e) => e.userId === userId && e.requestId === requestId,
    );
    if (existing) {
      existing.rating = rating;
      existing.updatedAt = now;
      if (conversationId) existing.conversationId = conversationId;
      saveStore(store);
      return { ok: true, feedback: existing, updated: true };
    }
    const entry = {
      id: `cf_${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
      userId,
      requestId,
      conversationId,
      rating,
    };
    store.entries.push(entry);
    if (store.entries.length > MAX_ENTRIES) {
      store.entries = store.entries.slice(-MAX_ENTRIES);
    }
    saveStore(store);
    return { ok: true, feedback: entry, updated: false };
  });
}

/** @param {{ userId: string, requestId: string }} params */
export function getChatFeedback({ userId, requestId }) {
  const store = loadStore();
  return store.entries.find((e) => e.userId === userId && e.requestId === requestId) || null;
}

/** Aggregate-only summary — never returns per-user rows. */
export function getChatFeedbackSummary() {
  const store = loadStore();
  let up = 0;
  let down = 0;
  for (const e of store.entries) {
    if (e.rating === 'up') up += 1;
    else if (e.rating === 'down') down += 1;
  }
  return { total: store.entries.length, up, down };
}

export async function resetChatFeedbackForTests(filePath) {
  if (filePath) configureChatFeedbackStore(filePath);
  ensureDir(storePath);
  writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), 'utf8');
}
