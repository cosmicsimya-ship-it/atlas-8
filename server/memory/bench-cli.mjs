#!/usr/bin/env node
/**
 * Memory V2 performance + EXPLAIN QUERY PLAN
 *   npm run memory:bench
 *
 * Bulk-seeds via SQL transaction for scale; times real retrieval/lookup paths.
 */
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';

const id = randomUUID();
process.env.MEMORY_V2_ENABLED = '1';
process.env.MEMORY_V2_DUAL_WRITE = '0';
process.env.ATLAS_MEMORY_V2_DB = join(tmpdir(), `atlas-mem-bench-${id}.sqlite`);
process.env.ATLAS_ALLOW_MEMORY_RESET = '1';

const {
  resetMemoryV2StoreForTests,
  closeMemoryDb,
  writeStructuredMemory,
  retrieveRelevantMemories,
  findActiveByKey,
  openMemoryDb,
  softDeleteMemory,
  listActiveCandidates,
} = await import('./index.js');
const { webUserId } = await import('../user-memory-types.js');

function log(...args) {
  console.error('[bench]', ...args);
}

await resetMemoryV2StoreForTests({ force: true });

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function summarize(samples) {
  const s = [...samples].sort((a, b) => a - b);
  return {
    n: s.length,
    p50: Number(pct(s, 50).toFixed(3)),
    p95: Number(pct(s, 95).toFixed(3)),
    max: Number(s[s.length - 1].toFixed(3)),
  };
}

async function timeMany(n, fn) {
  const samples = [];
  for (let i = 0; i < n; i += 1) {
    const t0 = performance.now();
    await fn(i);
    samples.push(performance.now() - t0);
  }
  return summarize(samples);
}

/**
 * Fast transactional seed (bypasses per-row write orchestration).
 */
function bulkSeed(userId, count, keyedEvery = 50) {
  const db = openMemoryDb();
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO memories (
      id, user_id, type, canonical_key, value_json, text, status, source,
      confidence, importance, created_at, updated_at, last_accessed_at,
      conversation_id, source_message_id, supersedes_id, superseded_by_id, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'system', 1, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL)
  `);
  const t0 = performance.now();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (let i = 0; i < count; i += 1) {
      const keyed = i % keyedEvery === 0;
      if (keyed && i === 0) {
        insert.run(
          randomUUID(),
          userId,
          'habit',
          'preference.coffee.sugar',
          JSON.stringify(false),
          'Kahvesini şekersiz içer.',
          0.8,
          now,
          now,
        );
      } else {
        insert.run(
          randomUUID(),
          userId,
          'fact',
          null,
          JSON.stringify(i),
          `bulk note ${i} unrelated fluff content kahve sabah`,
          0.2,
          now,
          now,
        );
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  }
  return performance.now() - t0;
}

const report = { scales: {}, explain: [], concurrency: {}, writePath: {}, eventLoop: {} };

// Sample real write path (orchestrated) — not 10k of them
log('timing orchestrated writes (200)...');
await resetMemoryV2StoreForTests({ force: true });
const wUser = webUserId('write-sample');
report.writePath.insert = await timeMany(100, async (i) => {
  await writeStructuredMemory(wUser, {
    type: 'fact',
    key: null,
    text: `orchestrated note ${i}`,
    value: i,
    source: 'system',
    importance: 0.3,
  });
});
report.writePath.contradiction = await timeMany(20, async (i) => {
  await writeStructuredMemory(wUser, {
    type: 'habit',
    key: 'preference.coffee.sugar',
    value: i % 2 === 0,
    text: i % 2 === 0 ? 'Kahvesini şekerli içer.' : 'Kahvesini şekersiz içer.',
    source: 'system',
    importance: 0.8,
  });
});
report.writePath.dedupLookup = await timeMany(50, async () => {
  await writeStructuredMemory(wUser, {
    type: 'habit',
    key: 'preference.coffee.sugar',
    value: false,
    text: 'Kahvesini şekersiz içer.',
    source: 'system',
    importance: 0.8,
  });
});

for (const n of [100, 1000, 10000]) {
  log(`scale ${n}: bulk seed...`);
  await resetMemoryV2StoreForTests({ force: true });
  const user = webUserId(`bench-${n}`);
  const insertMs = bulkSeed(user, n);

  log(`scale ${n}: lookups / retrieval...`);
  const keyLookup = await timeMany(80, () => findActiveByKey(user, 'preference.coffee.sugar'));
  const candidates = await timeMany(80, () =>
    listActiveCandidates(user, {
      keys: ['preference.coffee.sugar', 'preference.favorite_color'],
      alwaysIncludeKeys: ['profile.name'],
      includeNullKeysLimit: 40,
    }),
  );
  const retrieval = await timeMany(80, () =>
    retrieveRelevantMemories({ userId: user, message: 'Bana iyi bir sabah rutini hazırla' }),
  );
  const forgetMem = findActiveByKey(user, 'preference.coffee.sugar');
  const forget = await timeMany(1, async () => {
    if (forgetMem) await softDeleteMemory(user, forgetMem.id);
  });

  report.scales[n] = {
    insertTotalMs: Number(insertMs.toFixed(1)),
    insertPerOpMs: Number((insertMs / n).toFixed(4)),
    seedMethod: 'bulk_transaction',
    keyLookup,
    candidates,
    retrieval,
    forget,
  };
  log(`scale ${n}: retrieval p50=${retrieval.p50}ms p95=${retrieval.p95}ms`);
}

log('multi-user 100×100...');
await resetMemoryV2StoreForTests({ force: true });
const tMu0 = performance.now();
for (let u = 0; u < 100; u += 1) {
  bulkSeed(webUserId(`mu-${u}`), 100, 25);
}
report.multiUser = {
  users: 100,
  memoriesEach: 100,
  seedMs: Number((performance.now() - tMu0).toFixed(1)),
  retrieval: await timeMany(80, () =>
    retrieveRelevantMemories({
      userId: webUserId('mu-42'),
      message: 'Sabah rutini öner',
    }),
  ),
};

log('concurrency...');
await resetMemoryV2StoreForTests({ force: true });
const cUser = webUserId('conc');
bulkSeed(cUser, 1000, 40);

// Rough event-loop delay probe during retrieval burst
function measureEventLoopDelay(ms) {
  return new Promise((resolve) => {
    const samples = [];
    const start = performance.now();
    let expected = start + 10;
    const tick = () => {
      const now = performance.now();
      samples.push(Math.max(0, now - expected));
      expected = now + 10;
      if (now - start >= ms) resolve(summarize(samples));
      else setTimeout(tick, 10);
    };
    setTimeout(tick, 10);
  });
}

for (const conc of [1, 10, 25, 50]) {
  const samples = [];
  const rounds = 8;
  for (let r = 0; r < rounds; r += 1) {
    const t0 = performance.now();
    await Promise.all(
      Array.from({ length: conc }, () =>
        Promise.resolve(
          retrieveRelevantMemories({ userId: cUser, message: 'Sabah rutini hazırla' }),
        ),
      ),
    );
    samples.push(performance.now() - t0);
  }
  report.concurrency[conc] = summarize(samples);
}

report.eventLoop.duringIdle = await measureEventLoopDelay(200);
const elPromise = measureEventLoopDelay(400);
await Promise.all(
  Array.from({ length: 40 }, () =>
    Promise.resolve(retrieveRelevantMemories({ userId: cUser, message: 'Sabah rutini' })),
  ),
);
report.eventLoop.duringRetrievalBurst = await elPromise;

log('EXPLAIN QUERY PLAN...');
const db = openMemoryDb();
for (const item of [
  {
    sql: `EXPLAIN QUERY PLAN SELECT * FROM memories WHERE user_id = ? AND status = 'active' AND canonical_key = ?`,
    args: ['web:x', 'preference.coffee.sugar'],
  },
  {
    sql: `EXPLAIN QUERY PLAN SELECT * FROM memories WHERE user_id = ? AND status = 'active' AND canonical_key IN (?,?)`,
    args: ['web:x', 'preference.coffee.sugar', 'profile.name'],
  },
  {
    sql: `EXPLAIN QUERY PLAN SELECT * FROM memories WHERE user_id = ? AND status = 'active'`,
    args: ['web:x'],
  },
]) {
  const rows = db.prepare(item.sql).all(...item.args);
  report.explain.push({
    sql: item.sql,
    plan: rows.map((r) => Object.values(r).join(' | ')),
  });
}

closeMemoryDb();
console.log(JSON.stringify(report, null, 2));

const p95_10k = report.scales[10000]?.retrieval?.p95 ?? 9999;
const usesIndex = report.explain.some((e) =>
  e.plan.some((p) => /USING INDEX|SEARCH/i.test(p) && !/SCAN memories/i.test(p)),
);
if (p95_10k > 500) {
  console.error(`FAIL: 10k retrieval p95 ${p95_10k}ms exceeds 500ms budget`);
  process.exitCode = 1;
} else {
  console.error(`OK: 10k retrieval p95=${p95_10k}ms indexEvidence=${usesIndex}`);
}
