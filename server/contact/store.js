// ═══════════════════════════════════════════════════════════════════════
// Public contact/support message store.
//
// Same JSON-file-store shape as server/feedback/store.js and
// server/admin-audit.js: atomic write-then-rename, in-process write lock,
// fail-soft reads. This is the real, persistent backend path for the
// public Contact/Support forms — submissions are never faked or dropped
// silently, but note this store does NOT send email; there is currently no
// transactional email provider configured anywhere in this stack (see
// .env.example — no SMTP/email vars exist). A submission is durably saved
// for admin review, not emailed to anyone. That gap is reported explicitly
// in the trust/support implementation report rather than papered over.
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
const DEFAULT_PATH = join(__dirname, '..', '..', 'data', 'contact_messages.json');
const MAX_ENTRIES = 5000;

export const CONTACT_TOPICS = ['general', 'billing', 'privacy', 'other'];
export const CONTACT_STATUSES = ['new', 'reviewing', 'resolved'];

const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 320;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_NOTE_LENGTH = 2000;
const MAX_ROUTE_LENGTH = 300;
const MAX_ID_FIELD_LENGTH = 200;

// Loose RFC-5322-ish check — good enough to catch typos, not a validator.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @type {string} */
let storePath = DEFAULT_PATH;

export function configureContactStore(filePath) {
  storePath = filePath || DEFAULT_PATH;
}

export function getContactStorePath() {
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
 *   name?: string,
 *   email: string,
 *   topic: string,
 *   message: string,
 *   route?: string|null,
 *   userId?: string|null,
 *   honeypot?: string,
 * }} input
 */
export async function createContactMessage(input) {
  // Honeypot: a hidden field real users never fill. Any non-empty value here
  // means a bot filled the form — accept silently (return ok) without
  // persisting, so the bot gets no signal that it was caught.
  const honeypot = boundedString(input?.honeypot, 500);
  if (honeypot) {
    return { ok: true, dropped: true };
  }

  const email = boundedString(input?.email, MAX_EMAIL_LENGTH);
  if (!email || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: 'Geçerli bir e-posta adresi gerekli.' };
  }

  const topic = CONTACT_TOPICS.includes(input?.topic) ? input.topic : null;
  if (!topic) {
    return { ok: false, error: `topic must be one of: ${CONTACT_TOPICS.join(', ')}` };
  }

  const message = boundedString(input?.message, MAX_MESSAGE_LENGTH);
  if (!message || message.length < 10) {
    return { ok: false, error: 'Mesaj çok kısa. Lütfen sorununu biraz daha detaylandır.' };
  }

  const name = boundedString(input?.name, MAX_NAME_LENGTH);
  const route = boundedString(input?.route, MAX_ROUTE_LENGTH);
  const userId = boundedString(input?.userId, MAX_ID_FIELD_LENGTH);

  return withWriteLock(() => {
    const store = loadStore();
    const now = new Date().toISOString();
    const entry = {
      id: `ct_${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
      name,
      email,
      topic,
      message,
      route,
      userId,
      status: 'new',
      adminNote: null,
    };
    store.entries.push(entry);
    if (store.entries.length > MAX_ENTRIES) {
      store.entries = store.entries.slice(-MAX_ENTRIES);
    }
    saveStore(store);
    return { ok: true, dropped: false, message: entry };
  });
}

/**
 * @param {{ status?: string, topic?: string, limit?: number, offset?: number }} [opts]
 */
export function listContactMessages(opts = {}) {
  const MAX_LIMIT = 200;
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), MAX_LIMIT);
  const offset = Math.max(Number(opts.offset) || 0, 0);

  const store = loadStore();
  let rows = store.entries.slice().reverse(); // newest first

  if (opts.status) rows = rows.filter((r) => r.status === opts.status);
  if (opts.topic) rows = rows.filter((r) => r.topic === opts.topic);

  const total = rows.length;
  const page = rows.slice(offset, offset + limit);
  return { total, limit, offset, entries: page };
}

export function getContactMessageById(id) {
  const store = loadStore();
  return store.entries.find((e) => e.id === id) || null;
}

export function countContactMessagesByStatus() {
  const store = loadStore();
  const counts = { new: 0, reviewing: 0, resolved: 0 };
  for (const e of store.entries) {
    if (counts[e.status] !== undefined) counts[e.status] += 1;
  }
  return counts;
}

/** @param {{ id: string, status: string }} input */
export async function updateContactMessageStatus({ id, status }) {
  if (!CONTACT_STATUSES.includes(status)) {
    return { ok: false, status: 400, error: `status must be one of: ${CONTACT_STATUSES.join(', ')}` };
  }
  return withWriteLock(() => {
    const store = loadStore();
    const entry = store.entries.find((e) => e.id === id);
    if (!entry) return { ok: false, status: 404, error: 'Contact message not found' };
    entry.status = status;
    entry.updatedAt = new Date().toISOString();
    saveStore(store);
    return { ok: true, message: entry };
  });
}

/** @param {{ id: string, note: string|null }} input */
export async function setContactMessageAdminNote({ id, note }) {
  if (note !== null && note !== undefined && typeof note !== 'string') {
    return { ok: false, status: 400, error: 'note must be a string or null' };
  }
  const bounded = note === null || note === undefined ? null : boundedString(note, MAX_NOTE_LENGTH);
  return withWriteLock(() => {
    const store = loadStore();
    const entry = store.entries.find((e) => e.id === id);
    if (!entry) return { ok: false, status: 404, error: 'Contact message not found' };
    entry.adminNote = bounded;
    entry.updatedAt = new Date().toISOString();
    saveStore(store);
    return { ok: true, message: entry };
  });
}

export async function resetContactStoreForTests(filePath) {
  if (filePath) configureContactStore(filePath);
  ensureDir(storePath);
  writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), 'utf8');
}
