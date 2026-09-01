// ═══════════════════════════════════════════════════════════════════════
// Test: server/usage/cost-ledger.js
//
// Covers the Phase 6 minimum list for the cost ledger:
//  - a successful model call records usage
//  - an unknown price does not invent a cost (records null, excluded from totals)
//  - a failed call does not corrupt the ledger
//  - the aggregate matches the entries written
// ═══════════════════════════════════════════════════════════════════════

import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';

import {
  configureCostLedgerStore,
  resetCostLedgerForTests,
  recordCostLedgerEntry,
  getCostLedgerAggregate,
  getCostLedgerStorePath,
} from '../server/usage/cost-ledger.js';

const tmpDir = mkdtempSync(join(tmpdir(), 'atlas-cost-ledger-test-'));
const storeFile = join(tmpDir, 'cost_ledger.test.json');
configureCostLedgerStore(storeFile);
resetCostLedgerForTests(storeFile);

let failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log(`  ok   - ${label}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL - ${label}`);
    console.error(`         ${err.message}`);
  }
}

console.log('[test-cost-ledger] store path:', getCostLedgerStorePath());

check('successful call with a known-price model records real cost', () => {
  const ok = recordCostLedgerEntry({
    provider: 'openai',
    model: 'gpt-4.1-mini',
    userId: 'web:user-1',
    source: 'chat:web',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costUsd: 0.00006,
    success: true,
    latencyMs: 820,
  });
  assert.strictEqual(ok, true);
  const agg = getCostLedgerAggregate();
  assert.strictEqual(agg.totalEntries, 1);
  assert.strictEqual(agg.unknownPriceCount, 0);
  assert.ok(typeof agg.todayEstimatedCost === 'number' && agg.todayEstimatedCost > 0);
});

check('unknown-price model records costUsd: null, never a fabricated number', () => {
  const ok = recordCostLedgerEntry({
    provider: 'openai',
    model: 'some-future-model-not-in-cost-table',
    userId: 'web:user-2',
    source: 'chat:web',
    inputTokens: 200,
    outputTokens: 100,
    totalTokens: 300,
    costUsd: null, // caller (openai-client.js) never fabricates a rate for the ledger
    success: true,
    latencyMs: 900,
  });
  assert.strictEqual(ok, true);
  const store = JSON.parse(readFileSync(storeFile, 'utf8'));
  const entry = store.entries.find((e) => e.userId === 'web:user-2');
  assert.strictEqual(entry.costUsd, null);
});

check('unknown-price entry is excluded from cost totals but counted separately', () => {
  const agg = getCostLedgerAggregate();
  assert.strictEqual(agg.totalEntries, 2);
  assert.strictEqual(agg.unknownPriceCount, 1);
  // Only the first (known-price) entry's cost should be reflected.
  assert.ok(agg.todayEstimatedCost > 0 && agg.todayEstimatedCost < 1);
});

check('a failed call is recorded without corrupting the ledger', () => {
  const before = getCostLedgerAggregate().totalEntries;
  const ok = recordCostLedgerEntry({
    provider: 'openai',
    model: 'gpt-4.1-mini',
    userId: 'web:user-1',
    source: 'chat:web',
    success: false,
    errorCode: 'HTTP_500',
    latencyMs: 50,
  });
  assert.strictEqual(ok, true);
  const store = JSON.parse(readFileSync(storeFile, 'utf8'));
  assert.strictEqual(store.entries.length, before + 1);
  const failed = store.entries[store.entries.length - 1];
  assert.strictEqual(failed.success, false);
  assert.strictEqual(failed.costUsd, null);
  const agg = getCostLedgerAggregate();
  assert.strictEqual(agg.failedCallCount, 1);
  // Failed call must not appear in unknownPriceCount (unknownPriceCount only
  // counts SUCCESSFUL calls with no known price).
  assert.strictEqual(agg.unknownPriceCount, 1);
});

check('aggregate cost matches a hand-summed total of known-cost entries', () => {
  resetCostLedgerForTests(storeFile);
  recordCostLedgerEntry({ provider: 'openai', model: 'gpt-4.1-mini', success: true, costUsd: 0.01, source: 'chat' });
  recordCostLedgerEntry({ provider: 'openai', model: 'gpt-4.1-mini', success: true, costUsd: 0.02, source: 'chat' });
  recordCostLedgerEntry({ provider: 'openai', model: 'gpt-4.1-mini', success: true, costUsd: null, source: 'chat' });
  const agg = getCostLedgerAggregate();
  assert.strictEqual(agg.todayEstimatedCost, 0.03);
  assert.strictEqual(agg.thirtyDayEstimatedCost, 0.03);
  assert.strictEqual(agg.totalEntries, 3);
});

check('recordCostLedgerEntry never throws even with garbage input', () => {
  // @ts-ignore intentional bad input
  const ok = recordCostLedgerEntry(undefined);
  assert.strictEqual(ok, true); // still records a best-effort entry, does not throw
});

rmSync(tmpDir, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n[test-cost-ledger] ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\n[test-cost-ledger] all checks passed.');
