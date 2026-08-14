#!/usr/bin/env node
/**
 * Phase 2 regression — Prime Memory UX
 * Run: node scripts/test-prime-memory-ux.mjs
 */

import express from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const tmpDir = mkdtempSync(join(tmpdir(), 'atlas-prime-memux-'));
process.env.ATLAS_MEMORY_FILE = join(tmpDir, 'user_memory.json');

const { listPrimeMemoryFacts, deletePrimeMemoryFact } = await import('../server/prime/memory.js');
const { updateUserMemory, resetMemoryStoreForTests } = await import('../server/user-memory.js');

await resetMemoryStoreForTests();

let passed = 0;
let failed = 0;
function ok(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    failed += 1;
    console.error(`  \u2717 ${name}`);
  }
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const userId = req.header('x-test-user-id');
    const authenticated = req.header('x-test-authenticated') === '1';
    req.auth = authenticated
      ? { authenticated: true, userId, isAnonymous: false }
      : { authenticated: true, userId: userId || 'anonymous:test', isAnonymous: true };
    next();
  });
  function requireAuth(req, res, next) {
    if (!req.auth?.authenticated || req.auth?.isAnonymous || !req.auth?.userId) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    return next();
  }
  // Mirrors GET/DELETE /api/prime/memory[/:factKey] in server/index.js exactly.
  app.get('/api/prime/memory', requireAuth, (req, res) => {
    const result = listPrimeMemoryFacts(req.auth.userId);
    if (!result.ok) return res.status(500).json({ ok: false, error: result.error });
    return res.json({ ok: true, facts: result.facts });
  });
  app.delete('/api/prime/memory/:factKey', requireAuth, async (req, res) => {
    const result = await deletePrimeMemoryFact(req.auth.userId, req.params.factKey);
    if (!result.ok) {
      const status = result.error === 'Fact not found' ? 404 : 400;
      return res.status(status).json({ ok: false, error: result.error });
    }
    return res.json({ ok: true, deleted: true });
  });
  return app;
}

async function withServer(fn) {
  const app = buildApp();
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function headers(userId, authenticated) {
  return { 'x-test-user-id': userId, 'x-test-authenticated': authenticated ? '1' : '0' };
}

async function main() {
  console.log('\n\u2500\u2500 owner list / delete \u2500\u2500');
  await withServer(async (base) => {
    await updateUserMemory('web:memOwner', { facts: { pref_1: 'Kahve seviyor', goal_1: 'Kitap yazmak istiyor' } });

    const rList = await fetch(`${base}/api/prime/memory`, { headers: headers('web:memOwner', true) });
    const bList = await rList.json();
    ok('owner can list own facts', rList.status === 200 && bList.facts.length === 2);

    const rDel = await fetch(`${base}/api/prime/memory/pref_1`, { method: 'DELETE', headers: headers('web:memOwner', true) });
    ok('owner can delete own fact', rDel.status === 200);

    const rAfter = await fetch(`${base}/api/prime/memory`, { headers: headers('web:memOwner', true) });
    const bAfter = await rAfter.json();
    ok('deleted fact is actually gone', bAfter.facts.length === 1 && bAfter.facts[0].key === 'goal_1');
  });

  console.log('\n\u2500\u2500 access control \u2500\u2500');
  await withServer(async (base) => {
    const rGuest = await fetch(`${base}/api/prime/memory`, { headers: headers('anonymous:x', false) });
    ok('guest rejected on list', rGuest.status === 401);
    const rGuestDel = await fetch(`${base}/api/prime/memory/whatever`, { method: 'DELETE', headers: headers('anonymous:x', false) });
    ok('guest rejected on delete', rGuestDel.status === 401);
  });

  console.log('\n\u2500\u2500 cross-user read/delete blocked (IDOR) \u2500\u2500');
  await withServer(async (base) => {
    await updateUserMemory('web:victim', { facts: { secret_1: 'Gizli bilgi' } });

    const rReadAttacker = await fetch(`${base}/api/prime/memory`, { headers: headers('web:attacker', true) });
    const bReadAttacker = await rReadAttacker.json();
    ok("attacker's own list never contains victim's facts (per-user partitioned store)", !JSON.stringify(bReadAttacker).includes('Gizli bilgi'));

    const rDelAttacker = await fetch(`${base}/api/prime/memory/secret_1`, { method: 'DELETE', headers: headers('web:attacker', true) });
    ok("attacker cannot delete victim's fact (404, not found in attacker's own bucket)", rDelAttacker.status === 404);

    const rVictimAfter = await fetch(`${base}/api/prime/memory`, { headers: headers('web:victim', true) });
    const bVictimAfter = await rVictimAfter.json();
    ok("victim's fact survives the attacker's delete attempt", bVictimAfter.facts.some((f) => f.key === 'secret_1'));
  });

  console.log('\n\u2500\u2500 hidden metadata not leaked \u2500\u2500');
  await withServer(async (base) => {
    await updateUserMemory('web:metaCheck', { facts: { note_1: 'Basit bir not' } });
    const r = await fetch(`${base}/api/prime/memory`, { headers: headers('web:metaCheck', true) });
    const raw = await r.text();
    ok('no internal scoring field', !/score|confidence|weight/i.test(raw));
    ok('no system prompt / hidden inference field', !/systemPrompt|inferenceMeta|modelTrace/i.test(raw));
    ok('no security metadata field', !/securityMeta|internal_/i.test(raw));
    const body = JSON.parse(raw);
    ok('each fact is exactly {key, value} — no extra fields', body.facts.every((f) => Object.keys(f).sort().join(',') === 'key,value'));
  });

  console.log('\n\u2500\u2500 profile and facts remain separate \u2500\u2500');
  await withServer(async (base) => {
    const { updatePrimeProfile } = await import('../server/prime/profile.js');
    await updatePrimeProfile('web:separationCheck', { displayName: 'AyriTutulan', birth: { date: '1990-01-01' } });
    await updateUserMemory('web:separationCheck', { facts: { fact_x: 'Bir sohbet notu' } });

    const r = await fetch(`${base}/api/prime/memory`, { headers: headers('web:separationCheck', true) });
    const b = await r.json();
    ok('memory list contains only facts, never profile fields (no displayName/birthDate leak into facts)', !JSON.stringify(b.facts).includes('AyriTutulan') && !JSON.stringify(b.facts).includes('1990-01-01'));
    ok('memory list has exactly the one fact written, not a duplicated profile-derived entry', b.facts.length === 1);
  });

  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
});
