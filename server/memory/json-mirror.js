// ═══════════════════════════════════════════════════════════════════════
// Memory V2 — JSON dual-write mirror + rollback export
// SQLite is authoritative when V2 is enabled; JSON is compatibility mirror.
// ═══════════════════════════════════════════════════════════════════════

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createEmptyUserMemory, isValidUserId } from '../user-memory-types.js';
import { isMemoryV2DualWriteEnabled } from './config.js';
import { listActiveMemories, countDistinctUsers, countMemories, openMemoryDb } from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_JSON = join(__dirname, '..', '..', 'data', 'user_memory.json');

/** @type {Promise<void>} */
let mirrorLock = Promise.resolve();

export function getLegacyJsonPath() {
  return process.env.ATLAS_MEMORY_FILE?.trim() || DEFAULT_JSON;
}

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadJsonStore(path) {
  ensureDir(path);
  if (!existsSync(path)) return { users: {} };
  const raw = readFileSync(path, 'utf-8');
  if (!raw.trim()) return { users: {} };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.users || typeof parsed.users !== 'object') return { users: {} };
    return { users: { ...parsed.users } };
  } catch {
    return { users: {} };
  }
}

function saveJsonStore(path, store) {
  ensureDir(path);
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, 'utf-8');
  renameSync(tmp, path);
  return { ok: true };
}

const OPAQUE_LEGACY_EXTENSION_ALLOWLIST = Object.freeze(['primeCheckins']);

/**
 * Carry explicitly allowed legacy-only fields across a V2 mirror/export.
 * Unknown fields are deliberately dropped rather than copied blindly.
 * @param {unknown} existing
 * @param {ReturnType<typeof createEmptyUserMemory>} rebuilt
 */
function preserveOpaqueLegacyExtensions(existing, rebuilt) {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    return rebuilt;
  }

  for (const field of OPAQUE_LEGACY_EXTENSION_ALLOWLIST) {
    if (field === 'primeCheckins' && Array.isArray(existing[field])) {
      rebuilt.primeCheckins = existing[field];
    }
  }
  return rebuilt;
}
/**
 * Rebuild classic blob from active SQLite rows (no legacy-adapter import — avoids cycles).
 * @param {string} userId
 */
export function rebuildLegacyBlob(userId) {
  const base = createEmptyUserMemory();
  let latest = null;
  for (const mem of listActiveMemories(userId)) {
    if (!latest || mem.updatedAt > latest) latest = mem.updatedAt;
    if (mem.key?.startsWith('profile.')) {
      const field = mem.key.slice('profile.'.length);
      if (field in base.profile) {
        base.profile[field] =
          mem.value == null || mem.value === '' ? null : String(mem.value);
      }
      continue;
    }
    if (mem.key?.startsWith('preferences.')) {
      base.preferences[mem.key.slice('preferences.'.length)] = mem.value;
      continue;
    }
    if (mem.key === 'facts.zodiac') {
      base.facts.zodiac = mem.value;
      continue;
    }
    if (mem.key?.startsWith('preference.') || mem.key?.startsWith('habit.')) {
      base.facts[mem.key] = mem.value;
      continue;
    }
    if (mem.key?.startsWith('facts.')) {
      base.facts[mem.key.slice('facts.'.length)] = mem.value;
      continue;
    }
    if (mem.type === 'fact') {
      const noteKey = mem.key || `note_${String(mem.id).replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`;
      base.facts[noteKey] = mem.value ?? mem.text;
    }
  }
  base.updatedAt = latest;
  return base;
}

/**
 * Mirror one user's active V2 state into legacy JSON (dual-write).
 * @param {string} userId
 */
export async function mirrorUserMemoryToJson(userId) {
  if (!isMemoryV2DualWriteEnabled()) {
    return { ok: true, skipped: true, reason: 'dual_write_off' };
  }
  if (!isValidUserId(userId)) {
    return { ok: false, error: 'invalid_user_id' };
  }

  const run = mirrorLock.then(() => {
    const path = getLegacyJsonPath();
    const store = loadJsonStore(path);
    const existing = store.users[userId];
    const rebuilt = rebuildLegacyBlob(userId);
    store.users[userId] = preserveOpaqueLegacyExtensions(existing, rebuilt);
    saveJsonStore(path, store);
    return { ok: true };
  });
  mirrorLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Remove user from JSON mirror (privacy erase companion).
 * @param {string} userId
 */
export async function removeUserFromJsonMirror(userId) {
  const run = mirrorLock.then(() => {
    const path = getLegacyJsonPath();
    const store = loadJsonStore(path);
    if (store.users[userId]) {
      delete store.users[userId];
      saveJsonStore(path, store);
    }
    return { ok: true };
  });
  mirrorLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Export all V2 active users into legacy JSON (rollback / reconciliation).
 * @param {{
 *   outPath?: string,
 *   dryRun?: boolean,
 *   backup?: boolean,
 * }} [opts]
 */
export async function exportV2ToLegacyJson(opts = {}) {
  openMemoryDb();
  const outPath = opts.outPath || getLegacyJsonPath();
  const dryRun = Boolean(opts.dryRun);
  const report = {
    dryRun,
    outPath,
    usersExported: 0,
    activeMemories: countMemories(),
    distinctUsers: countDistinctUsers(),
    backupPath: /** @type {string|null} */ (null),
  };

  const { listAllUserIds } = await import('./store.js');
  const userIds = listAllUserIds();

  if (dryRun) {
    report.usersExported = userIds.length;
    return report;
  }

  if (opts.backup !== false && existsSync(outPath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${outPath}.pre-rollback-export.${stamp}.bak`;
    copyFileSync(outPath, backupPath);
    report.backupPath = backupPath;
  }

  const store = loadJsonStore(outPath);
  for (const userId of userIds) {
    const existing = store.users[userId];
    const rebuilt = rebuildLegacyBlob(userId);
    store.users[userId] = preserveOpaqueLegacyExtensions(existing, rebuilt);
    report.usersExported += 1;
  }
  saveJsonStore(outPath, store);
  report.exportedAt = new Date().toISOString();
  return report;
}
