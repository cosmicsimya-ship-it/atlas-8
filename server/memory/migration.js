// ═══════════════════════════════════════════════════════════════════════
// Memory V2 — JSON → SQLite migration (idempotent, non-destructive)
// Does NOT delete data/user_memory.json
// ═══════════════════════════════════════════════════════════════════════

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createEmptyUserMemory, isValidUserId } from '../user-memory-types.js';
import { normalizeLegacyFact, formatMemoryText } from './normalize.js';
import {
  countDistinctUsers,
  countMemories,
  findActiveByKey,
  listActiveMemories,
  openMemoryDb,
  getMemoryV2DbPath,
} from './store.js';
import { writeStructuredMemory } from './write.js';

function getLegacyMemoryFilePath() {
  const override = process.env.ATLAS_MEMORY_FILE?.trim();
  if (override) return override;
  const root = dirname(fileURLToPath(import.meta.url));
  return join(root, '..', '..', 'data', 'user_memory.json');
}

/**
 * @param {string} [jsonPath]
 */
export function loadLegacyJsonStore(jsonPath) {
  const path = jsonPath || getLegacyMemoryFilePath();
  if (!existsSync(path)) {
    return { users: {}, path, missing: true };
  }
  const raw = readFileSync(path, 'utf-8');
  if (!raw.trim()) return { users: {}, path, missing: false };
  const parsed = JSON.parse(raw);
  const users =
    parsed?.users && typeof parsed.users === 'object' && !Array.isArray(parsed.users)
      ? parsed.users
      : {};
  return { users, path, missing: false };
}

/**
 * Migration id for idempotency per user field.
 * @param {string} userId
 * @param {string} key
 */
function migrationMarkerKey(userId, key) {
  return `migration:${userId}:${key}`;
}

/**
 * @param {{
 *   dryRun?: boolean,
 *   jsonPath?: string,
 *   backup?: boolean,
 * }} [opts]
 */
export async function migrateJsonToMemoryV2(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const legacy = loadLegacyJsonStore(opts.jsonPath);
  const report = {
    dryRun,
    jsonPath: legacy.path,
    dbPath: getMemoryV2DbPath(),
    usersSeen: 0,
    usersMigrated: 0,
    profileFields: 0,
    preferenceFields: 0,
    facts: 0,
    skippedDuplicates: 0,
    errors: /** @type {string[]} */ ([]),
    backupPath: /** @type {string|null} */ (null),
  };

  // Avoid dual-write mutating the JSON source mid-migration (idempotency + race).
  const prevDual = process.env.MEMORY_V2_DUAL_WRITE;
  if (!dryRun) {
    process.env.MEMORY_V2_DUAL_WRITE = '0';
  }

  try {
  if (!dryRun) {
    openMemoryDb();
    if (opts.backup !== false && existsSync(legacy.path) && !legacy.missing) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${legacy.path}.pre-v2-migration.${stamp}.bak`;
      copyFileSync(legacy.path, backupPath);
      report.backupPath = backupPath;
    }
  }

  for (const [userId, rawMem] of Object.entries(legacy.users)) {
    report.usersSeen += 1;
    if (!isValidUserId(userId)) {
      report.errors.push(`invalid_user_id:${userId}`);
      continue;
    }

    const mem = normalizeLegacyBlob(rawMem);
    let wroteAny = false;

    for (const [field, value] of Object.entries(mem.profile)) {
      if (value == null || value === '') continue;
      report.profileFields += 1;
      const key = `profile.${field}`;
      if (!dryRun) {
        const existing = findActiveByKey(userId, key);
        if (existing && String(existing.value) === String(value)) {
          report.skippedDuplicates += 1;
          continue;
        }
        if (existing) {
          report.skippedDuplicates += 1;
          continue;
        }
        const r = await writeStructuredMemory(userId, {
          type: 'profile',
          key,
          value: String(value),
          text: formatMemoryText(key, String(value)),
          source: 'migration',
          importance: 0.9,
          metadata: { migration: true, marker: migrationMarkerKey(userId, key) },
        });
        if (r.ok && r.written) wroteAny = true;
        if (r.duplicate) report.skippedDuplicates += 1;
      }
    }

    for (const [field, value] of Object.entries(mem.preferences)) {
      if (value == null || value === '') continue;
      report.preferenceFields += 1;
      const key = `preferences.${field}`;
      if (!dryRun) {
        const existing = findActiveByKey(userId, key);
        if (existing) {
          report.skippedDuplicates += 1;
          continue;
        }
        const r = await writeStructuredMemory(userId, {
          type: 'preference',
          key,
          value,
          text: formatMemoryText(key, value, String(value)),
          source: 'migration',
          importance: 0.75,
          metadata: { migration: true },
        });
        if (r.ok && r.written) wroteAny = true;
        if (r.duplicate) report.skippedDuplicates += 1;
      }
    }

    for (const [factKey, factValue] of Object.entries(mem.facts)) {
      if (factValue == null) continue;
      report.facts += 1;
      const normalized = normalizeLegacyFact(factKey, factValue);
      if (!dryRun) {
        if (normalized.key) {
          const existing = findActiveByKey(userId, normalized.key);
          if (existing) {
            report.skippedDuplicates += 1;
            continue;
          }
        } else {
          // Free-form: skip if identical text already active
          const active = listActiveMemories(userId);
          if (active.some((m) => m.text === normalized.text)) {
            report.skippedDuplicates += 1;
            continue;
          }
        }
        const r = await writeStructuredMemory(userId, {
          type: normalized.type,
          key: normalized.key,
          value: normalized.value,
          text: normalized.text,
          source: 'migration',
          importance: normalized.importance,
          metadata: { migration: true, legacyFactKey: factKey },
        });
        if (r.ok && r.written) wroteAny = true;
        if (r.duplicate) report.skippedDuplicates += 1;
      }
    }

    if (wroteAny || dryRun) report.usersMigrated += 1;
  }

  if (!dryRun) {
    report.dbUsers = countDistinctUsers();
    report.dbMemories = countMemories();
    const manifestPath = join(
      dirname(getMemoryV2DbPath() === ':memory:' ? legacy.path : getMemoryV2DbPath()),
      'user_memory_v2_migration_manifest.json',
    );
    try {
      writeFileSync(
        manifestPath,
        `${JSON.stringify({ ...report, migratedAt: new Date().toISOString() }, null, 2)}\n`,
        'utf-8',
      );
      report.manifestPath = manifestPath;
    } catch (err) {
      report.errors.push(`manifest_write:${err.message}`);
    }
  }

  return report;
  } finally {
    if (!dryRun) {
      if (prevDual === undefined) delete process.env.MEMORY_V2_DUAL_WRITE;
      else process.env.MEMORY_V2_DUAL_WRITE = prevDual;
    }
  }
}

function normalizeLegacyBlob(raw) {
  const base = createEmptyUserMemory();
  if (!raw || typeof raw !== 'object') return base;
  if (raw.profile && typeof raw.profile === 'object') {
    for (const k of Object.keys(base.profile)) {
      const v = raw.profile[k];
      base.profile[k] = typeof v === 'string' && v.trim() ? v.trim() : null;
    }
  }
  if (raw.preferences && typeof raw.preferences === 'object') {
    base.preferences = { ...base.preferences, ...raw.preferences };
  }
  if (raw.facts && typeof raw.facts === 'object') {
    base.facts = { ...raw.facts };
  }
  return base;
}
