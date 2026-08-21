#!/usr/bin/env node
/**
 * Memory V2 migration CLI
 *
 * Usage:
 *   node server/memory/migrate-cli.mjs --dry-run
 *   node server/memory/migrate-cli.mjs --execute
 *
 * Production-safe sequence (see docs/memory-v2.md):
 *   1. MEMORY_WRITE_FREEZE=1 + restart writers
 *   2. backup JSON + SQLite
 *   3. --execute
 *   4. verify (memory:status / smoke)
 *   5. MEMORY_V2_ENABLED=1
 *   6. unset MEMORY_WRITE_FREEZE
 *
 * Does NOT delete data/user_memory.json.
 * Creates a .bak backup next to the JSON on --execute.
 */
import { migrateJsonToMemoryV2 } from './migration.js';
import { parseEnvFlag } from './config.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || !args.includes('--execute');
const execute = args.includes('--execute');

if (!execute && !args.includes('--dry-run')) {
  console.log('Hint: pass --dry-run (default) or --execute\n');
}

if (execute && !parseEnvFlag(process.env.MEMORY_WRITE_FREEZE, false)) {
  console.warn(
    '[MemoryV2] WARNING: MEMORY_WRITE_FREEZE is not set. Concurrent JSON writes during migration can be lost. Prefer MEMORY_WRITE_FREEZE=1 for production execute.\n',
  );
}

const report = await migrateJsonToMemoryV2({
  dryRun: !execute,
  backup: true,
});

console.log(JSON.stringify(report, null, 2));
if (report.errors?.length) {
  process.exitCode = 1;
}
