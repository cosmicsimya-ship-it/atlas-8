// ═══════════════════════════════════════════════════════════════════════
// ATLAS LAB trace store — dev/admin-only append log of RequestTimingSnapshot
// objects (server/request-timing.js), one entry per processAtlasMessage()
// call (Web + Telegram, same convergence point).
//
// Same JSON-file-store shape as server/agentos/tool-audit.js: atomic
// write-then-rename, fail-soft (a store failure must NEVER break the
// message it's recording), bounded size (oldest entries rotate out).
//
// What goes in here is exactly what RequestTimingSnapshot already
// contains — bounded/truncated summaries, hashed refs, phase timings,
// routing labels. No chain-of-thought, no raw message text beyond the
// snapshot's own SUMMARY_MAX_CHARS-bounded userMessageSummary, no
// secrets/tokens. This module does not decide what's safe to log; it
// only persists what request-timing.js already decided was safe to put
// in a snapshot.
//
// Disable entirely with ATLAS_LAB_TRACES_DISABLED=1 (e.g. production).
// ═══════════════════════════════════════════════════════════════════════

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', '..', 'data', 'atlas_lab_traces.json');
const MAX_ENTRIES = 5000;

let storePath = DEFAULT_PATH;

export function isAtlasLabTracingEnabled() {
  return process.env.ATLAS_LAB_TRACES_DISABLED !== '1';
}

export function configureAtlasLabTraceStore(filePath) {
  storePath = filePath || DEFAULT_PATH;
}

export function getAtlasLabTraceStorePath() {
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

// Same rationale as tool-audit.js: concurrent requests can race a rename
// onto this path; a handful of synchronous-backoff retries clears the
// transient Windows EPERM/EBUSY window.
function saveStore(store) {
  ensureDir(storePath);
  const tmp = `${storePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      renameSync(tmp, storePath);
      return;
    } catch (err) {
      if (attempt === maxAttempts || !['EPERM', 'EBUSY', 'EACCES'].includes(err?.code)) throw err;
      const waitUntil = Date.now() + 15 * attempt;
      while (Date.now() < waitUntil) {
        /* brief synchronous backoff — this store's writes are already
           synchronous end-to-end, so there is no async alternative here */
      }
    }
  }
}

/**
 * Record one RequestTimingSnapshot. NEVER throws — a trace-store failure
 * must never block or fail the message request it's recording.
 * @param {import('../request-timing.js').RequestTimingSnapshot} snapshot
 * @returns {boolean}
 */
export function recordAtlasLabTrace(snapshot) {
  if (!isAtlasLabTracingEnabled()) return false;
  if (!snapshot || typeof snapshot !== 'object') return false;
  try {
    const store = loadStore();
    store.entries.push(snapshot);
    if (store.entries.length > MAX_ENTRIES) {
      store.entries = store.entries.slice(-MAX_ENTRIES);
    }
    saveStore(store);
    return true;
  } catch (err) {
    console.error('[AtlasLab TraceStore] record failed (non-fatal):', err?.message ?? err);
    return false;
  }
}

/**
 * @param {{ channel?: string, limit?: number }} [opts]
 * @returns {Array<import('../request-timing.js').RequestTimingSnapshot>}
 */
export function listAtlasLabTraces(opts = {}) {
  try {
    const { entries } = loadStore();
    const filtered = opts.channel ? entries.filter((e) => e.channel === opts.channel) : entries;
    const limit = Number.isFinite(opts.limit) ? Math.max(1, Math.min(1000, opts.limit)) : 200;
    return filtered.slice(-limit).reverse();
  } catch (err) {
    console.error('[AtlasLab TraceStore] list failed (non-fatal):', err?.message ?? err);
    return [];
  }
}

/**
 * @param {string} requestId
 * @returns {import('../request-timing.js').RequestTimingSnapshot|null}
 */
export function getAtlasLabTrace(requestId) {
  if (!requestId) return null;
  try {
    const { entries } = loadStore();
    return entries.find((e) => e.requestId === requestId) ?? null;
  } catch (err) {
    console.error('[AtlasLab TraceStore] get failed (non-fatal):', err?.message ?? err);
    return null;
  }
}
