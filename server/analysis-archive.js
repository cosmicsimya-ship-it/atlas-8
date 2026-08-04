// ═══════════════════════════════════════════════════════════════════════
// Analysis Archive — persisted reading history (separate from user memory)
// JSON storage; public API is backend-agnostic for future DB migration.
// ═══════════════════════════════════════════════════════════════════════

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { isValidUserId } from './user-memory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const ARCHIVE_FILE = join(DATA_DIR, 'analysis_archive.json');

/** @type {Promise<void>} */
let writeLock = Promise.resolve();

function createEmptyStore() {
  return { users: {} };
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function recoverCorruptFile(raw, err) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const corruptPath = `${ARCHIVE_FILE}.corrupt.${stamp}.json`;
  try {
    writeFileSync(corruptPath, raw, 'utf-8');
    console.error(`[Archive] Corrupt file archived to ${corruptPath}: ${err.message}`);
  } catch {
    /* ignore */
  }
  return createEmptyStore();
}

export function loadArchive() {
  ensureDataDir();
  if (!existsSync(ARCHIVE_FILE)) {
    return createEmptyStore();
  }

  let raw;
  try {
    raw = readFileSync(ARCHIVE_FILE, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read archive file: ${err.message}`);
  }

  if (!raw.trim()) {
    return createEmptyStore();
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.users || typeof parsed.users !== 'object') {
      return recoverCorruptFile(raw, new Error('Invalid archive root'));
    }
    return parsed;
  } catch (err) {
    return recoverCorruptFile(raw, err);
  }
}

export function saveArchive(store) {
  if (!store?.users || typeof store.users !== 'object') {
    return { ok: false, error: 'Invalid archive store' };
  }

  ensureDataDir();
  const payload = `${JSON.stringify(store, null, 2)}\n`;
  const tempPath = `${ARCHIVE_FILE}.${process.pid}.${Date.now()}.tmp`;

  try {
    writeFileSync(tempPath, payload, 'utf-8');
    renameSync(tempPath, ARCHIVE_FILE);
    return { ok: true };
  } catch (err) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {
      /* ignore */
    }
    return { ok: false, error: err.message };
  }
}

async function withWriteLock(fn) {
  const run = writeLock.then(fn, fn);
  writeLock = run.then(() => undefined, () => undefined);
  return run;
}

function normalizeRecord(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? 'Analiz'),
    intention: String(raw.intention ?? ''),
    status: String(raw.status ?? 'complete'),
    name: raw.name ?? null,
    referenceDate: raw.referenceDate ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    formSummary: raw.formSummary ?? {},
    envelope: raw.envelope ?? null,
  };
}

export function listUserAnalyses(userId) {
  if (!isValidUserId(userId)) {
    throw new Error('Invalid user ID');
  }
  const store = loadArchive();
  const records = store.users[userId]?.analyses;
  if (!Array.isArray(records)) {
    return [];
  }
  return records
    .map(normalizeRecord)
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getAnalysisRecord(userId, analysisId) {
  return listUserAnalyses(userId).find((r) => r.id === analysisId) ?? null;
}

export async function saveAnalysisRecord(userId, record) {
  if (!isValidUserId(userId)) {
    return { ok: false, error: 'Invalid user ID' };
  }
  const normalized = normalizeRecord(record);
  if (!normalized?.id) {
    return { ok: false, error: 'Analysis id is required' };
  }

  return withWriteLock(() => {
    const store = loadArchive();
    if (!store.users[userId]) {
      store.users[userId] = { analyses: [] };
    }
    if (!Array.isArray(store.users[userId].analyses)) {
      store.users[userId].analyses = [];
    }

    const now = new Date().toISOString();
    normalized.updatedAt = now;
    if (!normalized.createdAt) {
      normalized.createdAt = now;
    }

    const idx = store.users[userId].analyses.findIndex((a) => a.id === normalized.id);
    if (idx >= 0) {
      normalized.createdAt = store.users[userId].analyses[idx].createdAt ?? now;
      store.users[userId].analyses[idx] = normalized;
    } else {
      store.users[userId].analyses.unshift(normalized);
    }

    const saved = saveArchive(store);
    if (!saved.ok) {
      return saved;
    }
    return { ok: true, record: normalized };
  });
}

export async function deleteAnalysisRecord(userId, analysisId) {
  if (!isValidUserId(userId)) {
    return { ok: false, error: 'Invalid user ID' };
  }

  return withWriteLock(() => {
    const store = loadArchive();
    const bucket = store.users[userId]?.analyses;
    if (!Array.isArray(bucket)) {
      return { ok: false, error: 'Analysis not found' };
    }

    const next = bucket.filter((a) => a.id !== analysisId);
    if (next.length === bucket.length) {
      return { ok: false, error: 'Analysis not found' };
    }

    store.users[userId].analyses = next;
    const saved = saveArchive(store);
    if (!saved.ok) {
      return saved;
    }
    return { ok: true };
  });
}

export function getArchiveFilePath() {
  return ARCHIVE_FILE;
}
