// ═══════════════════════════════════════════════════════════════════════
// Error / Incident store — Admin Control Center MVP.
//
// Every recorded entry is redacted before it is ever written to disk:
// no secret, token, API key, Authorization header, password, or raw env
// value is persisted. Repeated occurrences of the same underlying error
// (same fingerprint) increment occurrenceCount on the existing entry
// instead of creating a duplicate row.
//
// Same JSON-file-store shape as server/auth/admin-audit.js: atomic
// write-then-rename, in-process write lock, fail-soft reads.
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
import { randomUUID, createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', '..', 'data', 'admin_errors.json');
const MAX_ENTRIES = 5000;

export const ERROR_SEVERITIES = ['info', 'warning', 'error', 'critical'];
export const ERROR_STATUSES = ['open', 'investigating', 'resolved', 'ignored'];
const MAX_FIELD_LENGTH = 300;
const MAX_MESSAGE_LENGTH = 1000;

/** @type {string} */
let storePath = DEFAULT_PATH;

export function configureErrorLogStore(filePath) {
  storePath = filePath || DEFAULT_PATH;
}

export function getErrorLogStorePath() {
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

// ---- Redaction -------------------------------------------------------
// Deliberately conservative: strips anything that *looks* like a secret
// rather than trying to enumerate every provider's token shape.
const REDACTION_PATTERNS = [
  // Authorization / Bearer headers
  [/authorization\s*[:=]\s*\S+/gi, 'authorization: [REDACTED]'],
  [/bearer\s+[a-z0-9._-]+/gi, 'bearer [REDACTED]'],
  // Common provider secret prefixes (OpenAI, etc.)
  [/\bsk-[a-z0-9]{10,}\b/gi, '[REDACTED_KEY]'],
  // key=value / key: value pairs where the key name implies a secret
  [/\b((?:api[_-]?key|apikey|secret|token|password|passwd|pwd|access[_-]?key|client[_-]?secret)\s*[:=]\s*)([^\s,;'"]+)/gi, '$1[REDACTED]'],
  // ALL_CAPS_ENV_STYLE=value assignments (raw env dumps)
  [/\b([A-Z][A-Z0-9_]{3,}=)([^\s,;]+)/g, '$1[REDACTED]'],
];

/**
 * @param {string} text
 */
export function redactSecrets(text) {
  if (typeof text !== 'string') return '';
  let out = text;
  for (const [pattern, replacement] of REDACTION_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function computeFingerprint({ source, code, route, safeMessage }) {
  const basis = `${source || ''}|${code || ''}|${route || ''}|${(safeMessage || '').slice(0, 200)}`;
  return createHash('sha256').update(basis).digest('hex').slice(0, 32);
}

/**
 * Records an error, deduplicating by fingerprint. Message is redacted
 * before it ever touches disk.
 * @param {{
 *   source: string,
 *   severity?: string,
 *   code?: string,
 *   message: string,
 *   route?: string|null,
 *   userId?: string|null,
 * }} input
 */
export async function recordError(input) {
  const source = boundedString(input?.source, 80) || 'unknown';
  const severity = ERROR_SEVERITIES.includes(input?.severity) ? input.severity : 'error';
  const code = boundedString(input?.code, 120) || 'unknown';
  const rawMessage = typeof input?.message === 'string' ? input.message : String(input?.message ?? '');
  const safeMessage = boundedString(redactSecrets(rawMessage), MAX_MESSAGE_LENGTH) || '(no message)';
  const route = boundedString(input?.route, MAX_FIELD_LENGTH);
  const userId = boundedString(input?.userId, MAX_FIELD_LENGTH);

  const fingerprint = computeFingerprint({ source, code, route, safeMessage });

  return withWriteLock(() => {
    const store = loadStore();
    const now = new Date().toISOString();
    const existing = store.entries.find((e) => e.fingerprint === fingerprint);

    if (existing) {
      existing.occurrenceCount = (existing.occurrenceCount || 1) + 1;
      existing.lastSeen = now;
      // A recurring "resolved" error re-opens itself — it's happening again.
      if (existing.status === 'resolved') existing.status = 'open';
      saveStore(store);
      return { ok: true, error: existing, deduped: true };
    }

    const entry = {
      id: `err_${randomUUID()}`,
      fingerprint,
      timestamp: now,
      firstSeen: now,
      lastSeen: now,
      source,
      severity,
      code,
      safeMessage,
      route,
      userId,
      occurrenceCount: 1,
      status: 'open',
    };
    store.entries.push(entry);
    if (store.entries.length > MAX_ENTRIES) {
      store.entries = store.entries.slice(-MAX_ENTRIES);
    }
    saveStore(store);
    return { ok: true, error: entry, deduped: false };
  });
}

/**
 * @param {{ status?: string, severity?: string, source?: string, limit?: number, offset?: number }} [opts]
 */
export function listErrors(opts = {}) {
  const MAX_LIMIT = 200;
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), MAX_LIMIT);
  const offset = Math.max(Number(opts.offset) || 0, 0);

  const store = loadStore();
  let rows = store.entries.slice().sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1)); // most recently seen first

  if (opts.status) rows = rows.filter((r) => r.status === opts.status);
  if (opts.severity) rows = rows.filter((r) => r.severity === opts.severity);
  if (opts.source) rows = rows.filter((r) => r.source === opts.source);

  const total = rows.length;
  const page = rows.slice(offset, offset + limit);
  return { total, limit, offset, entries: page };
}

export function getErrorById(id) {
  const store = loadStore();
  return store.entries.find((e) => e.id === id) || null;
}

export function countErrorsByStatus() {
  const store = loadStore();
  const counts = { open: 0, investigating: 0, resolved: 0, ignored: 0 };
  for (const e of store.entries) {
    if (counts[e.status] !== undefined) counts[e.status] += 1;
  }
  return counts;
}

/** @param {{ id: string, status: string }} input */
export async function updateErrorStatus({ id, status }) {
  if (!ERROR_STATUSES.includes(status)) {
    return { ok: false, status: 400, error: `status must be one of: ${ERROR_STATUSES.join(', ')}` };
  }
  return withWriteLock(() => {
    const store = loadStore();
    const entry = store.entries.find((e) => e.id === id);
    if (!entry) return { ok: false, status: 404, error: 'Error not found' };
    entry.status = status;
    saveStore(store);
    return { ok: true, error: entry };
  });
}

export async function resetErrorLogStoreForTests(filePath) {
  if (filePath) configureErrorLogStore(filePath);
  ensureDir(storePath);
  writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), 'utf8');
}
