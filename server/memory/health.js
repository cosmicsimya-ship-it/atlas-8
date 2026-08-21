// ═══════════════════════════════════════════════════════════════════════
// Memory V2 — startup health + multi-process advisory
// Failure does not crash the process; logs and returns degraded status.
// ═══════════════════════════════════════════════════════════════════════

import { isMemoryV2Enabled } from './config.js';
import {
  checkMemoryDbHealth,
  getMemoryV2DbPath,
  openMemoryDb,
  countDistinctUsers,
  countMemories,
} from './store.js';
import { SCHEMA_VERSION } from './schema.js';

let warnedMultiProcess = false;

/**
 * @returns {{
 *   enabled: boolean,
 *   ok: boolean,
 *   degraded: boolean,
 *   dbPath?: string,
 *   schemaVersion?: number|null,
 *   integrity?: string,
 *   users?: number,
 *   memories?: number,
 *   error?: string,
 *   warnings: string[],
 * }}
 */
export function runMemoryV2StartupCheck() {
  const warnings = [];
  if (!isMemoryV2Enabled()) {
    return { enabled: false, ok: true, degraded: false, warnings };
  }

  if (process.env.NODE_APP_INSTANCE || process.env.pm_id || process.env.CLUSTER_WORKER_ID) {
    warnings.push(
      'Multi-process/cluster detected. Memory V2 SQLite is designed for a single Node writer process.',
    );
    if (!warnedMultiProcess) {
      console.warn(
        '[MemoryV2] WARNING: multi-process environment detected. Prefer a single API process for SQLite, or migrate to Postgres before clustering.',
      );
      warnedMultiProcess = true;
    }
  }

  try {
    openMemoryDb();
    const health = checkMemoryDbHealth();
    if (!health.ok) {
      console.error('[MemoryV2] Startup integrity check failed:', health.error || health.integrity);
      return {
        enabled: true,
        ok: false,
        degraded: true,
        dbPath: getMemoryV2DbPath(),
        schemaVersion: health.version,
        integrity: health.integrity,
        error: health.error || health.integrity,
        warnings,
      };
    }
    const users = countDistinctUsers();
    const memories = countMemories();
    console.log(
      `[MemoryV2] OK schema=v${health.version ?? SCHEMA_VERSION} users=${users} memories=${memories}`,
    );
    return {
      enabled: true,
      ok: true,
      degraded: false,
      dbPath: getMemoryV2DbPath(),
      schemaVersion: health.version,
      integrity: health.integrity,
      users,
      memories,
      warnings,
    };
  } catch (err) {
    console.error('[MemoryV2] Startup failed (chat continues without V2 writes):', err.message);
    return {
      enabled: true,
      ok: false,
      degraded: true,
      dbPath: getMemoryV2DbPath(),
      error: err.message,
      warnings,
    };
  }
}
