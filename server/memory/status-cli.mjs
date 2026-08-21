#!/usr/bin/env node
/**
 * Memory V2 status (no raw memory content).
 *   npm run memory:status
 */
import { isMemoryV2Enabled, isMemoryV2DualWriteEnabled, isMemoryWriteFrozen } from './config.js';
import {
  checkMemoryDbHealth,
  getMemoryV2DbPath,
  openMemoryDb,
  countDistinctUsers,
  countMemories,
  listAllUserIds,
} from './store.js';
import { SCHEMA_VERSION } from './schema.js';

const enabled = isMemoryV2Enabled();
console.log(`Memory V2: ${enabled ? 'enabled' : 'disabled'}`);
console.log(`Dual-write: ${isMemoryV2DualWriteEnabled() ? 'on' : 'off'}`);
console.log(`Write freeze: ${isMemoryWriteFrozen() ? 'ON' : 'off'}`);
console.log(`Code schema: v${SCHEMA_VERSION}`);
console.log(`DB path: ${getMemoryV2DbPath()}`);

if (!enabled) {
  process.exit(0);
}

try {
  openMemoryDb();
  const health = checkMemoryDbHealth();
  console.log(`DB: ${health.ok ? 'OK' : 'FAIL'}`);
  console.log(`Schema: v${health.version ?? '?'}`);
  console.log(`Integrity: ${health.integrity}`);
  console.log(`Users: ${countDistinctUsers()}`);
  console.log(`Memories (all statuses): ${countMemories()}`);

  const db = openMemoryDb();
  const byStatus = db
    .prepare(`SELECT status, COUNT(*) AS c FROM memories GROUP BY status`)
    .all();
  for (const row of byStatus) {
    console.log(`  ${row.status}: ${row.c}`);
  }
  void listAllUserIds;
} catch (err) {
  console.log(`DB: ERROR`);
  console.log(`Error: ${err.message}`);
  process.exitCode = 1;
}
