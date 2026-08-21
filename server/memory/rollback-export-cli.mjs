#!/usr/bin/env node
/**
 * Export V2 active state → legacy JSON (true rollback safety).
 *
 *   node server/memory/rollback-export-cli.mjs --dry-run
 *   node server/memory/rollback-export-cli.mjs --execute
 */
import { exportV2ToLegacyJson } from './json-mirror.js';

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const dryRun = !execute || args.includes('--dry-run');

if (!execute) {
  console.log('Hint: pass --execute to write JSON (default is dry-run)\n');
}

const report = await exportV2ToLegacyJson({
  dryRun: !execute,
  backup: true,
});
console.log(JSON.stringify(report, null, 2));
