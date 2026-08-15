#!/usr/bin/env node
/**
 * Phase 2 regression — Prime Home ("Today")
 * Run: node scripts/test-prime-home.mjs
 */

import express from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const tmpMemDir = mkdtempSync(join(tmpdir(), 'atlas-prime-home-mem-'));
const tmpSubDir = mkdtempSync(join(tmpdir(), 'atlas-prime-home-sub-'));
process.env.ATLAS_MEMORY_FILE = join(tmpMemDir, 'user_memory.json');
process.env.ATLAS_CONV_MAX_PER_USER = '30';

const { updatePrimeProfile } = await import('../server/prime/profile.js');
const { buildPrimeToday } = await import('../server/prime/today.js');
const { resetMemoryStoreForTests } = await import('../server/user-memory.js');
const {
  ATLAS_PLANS,
  configureSubscriptionStore,
  resetSubscriptionStoreForTests,
  upsertSubscription,
  resolveEntitlements,
} = await import('../server/entitlements/index.js');
const { appendMessage, configureConversationStore, resetConversationStoreForTests } = await import(
  '../server/conversations.js'
);
const { resetChatUsageForTests, recordChatUsage } = await import('../server/usage/chat-usage.js');

configureSubscriptionStore(join(tmpSubDir, 'subscriptions.json'));
configureConversationStore(join(tmpSubDir, 'conversations.json'));
await resetMemoryStoreForTests();
resetSubscriptionStoreForTests();
resetConversationStoreForTests();
resetChatUsageForTests();

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
  // Mirrors GET /api/prime/today in server/index.js exactly.
  app.get('/api/prime/today', requireAuth, (req, res) => {
    try {
      const today = buildPrimeToday(req.auth.userId, req.auth);
      return res.json({ ok: true, today });
    } catch {
      return res.status(500).json({ ok: false, error: 'Prime home service unavailable' });
    }
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
  console.log('\n\u2500\u2500 access control (Prime Home itself is available to any authenticated account; entitlement-gated capabilities are enforced elsewhere) \u2500\u2500');
  await withServer(async (base) => {
    const rGuest = await fetch(`${base}/api/prime/today`, { headers: headers('anonymous:x', false) });
    ok('guest rejected', rGuest.status === 401);

    const rFree = await fetch(`${base}/api/prime/today`, { headers: headers('web:freeHome', true) });
    ok('free (authenticated) account allowed into Prime Home', rFree.status === 200);
    const bFree = await rFree.json();
    ok(
      'Prime Home correctly reflects free-plan usage limit, not premium (existing entitlement policy)',
      bFree.today.usage.plan === 'free' && bFree.today.usage.dailyLimit === 40,
    );

    upsertSubscription({ userId: 'web:primeHome', plan: ATLAS_PLANS.PREMIUM, status: 'active' });
    const rPrime = await fetch(`${base}/api/prime/today`, { headers: headers('web:primeHome', true) });
    const bPrime = await rPrime.json();
    ok('premium account correctly shown premium usage limit', bPrime.today.usage.plan === 'premium' && bPrime.today.usage.dailyLimit === 200);
  });

  console.log('\n\u2500\u2500 personalized greeting \u2500\u2500');
  await withServer(async (base) => {
    const rNoName = await fetch(`${base}/api/prime/today`, { headers: headers('web:noName', true) });
    const bNoName = await rNoName.json();
    ok('generic greeting when no displayName set (never fabricated)', !bNoName.today.greeting.includes(','));

    await updatePrimeProfile('web:namedUser', { displayName: 'Selin' });
    const rNamed = await fetch(`${base}/api/prime/today`, { headers: headers('web:namedUser', true) });
    const bNamed = await rNamed.json();
    ok('greeting uses real profile displayName once set', bNamed.today.greeting.includes('Selin'));
  });

  console.log('\n\u2500\u2500 Today uses real data — numerology + natal via existing engines \u2500\u2500');
  await withServer(async (base) => {
    await updatePrimeProfile('web:fullProfile', {
      birth: { date: '1988-11-02', time: '09:45', place: 'Izmir, Turkey', timezone: 'Europe/Istanbul' },
    });
    const r = await fetch(`${base}/api/prime/today`, { headers: headers('web:fullProfile', true) });
    const b = await r.json();
    ok('numerology life path computed via real engine', typeof b.today.symbolic.numerology?.lifePath === 'number');
    ok('numerology provenance traces to server/numerology-engine', b.today.symbolic.numerology.provenance.includes('numerology-engine'));
    ok('natal chart computed via real engine (Sun sign present)', typeof b.today.natal?.sunSign === 'string' && b.today.natal.sunSign.length > 0);
    ok('natal fullChartAvailable true when date+time+place all present', b.today.natal.fullChartAvailable === true);
  });

  console.log('\n\u2500\u2500 unknown birth time does not fabricate ascendant/houses \u2500\u2500');
  await withServer(async (base) => {
    await updatePrimeProfile('web:noBirthTime', {
      birth: { date: '1995-06-20', place: 'Bursa, Turkey' }, // no time
    });
    const r = await fetch(`${base}/api/prime/today`, { headers: headers('web:noBirthTime', true) });
    const b = await r.json();
    ok('natal still available (planets) even without birth time', b.today.natal?.available === true);
    ok('fullChartAvailable is false (no ascendant/houses fabricated)', b.today.natal.fullChartAvailable === false);
    ok('birthTimeKnown correctly false', b.today.natal.birthTimeKnown === false);
    ok('honest warning surfaced instead of silent fabrication', b.today.natal.warnings.length > 0);
    ok('profile CTA note explains what unlocks with birth time', b.today.profile.note?.includes('doğum saati') || b.today.profile.note?.toLowerCase().includes('saat'));
  });

  console.log('\n\u2500\u2500 latest conversation is owner-scoped \u2500\u2500');
  await withServer(async (base) => {
    await appendMessage('web:convOwnerA', null, { role: 'user', content: 'ownerA message' });
    await appendMessage('web:convOwnerB', null, { role: 'user', content: 'ownerB message' });

    const rA = await fetch(`${base}/api/prime/today`, { headers: headers('web:convOwnerA', true) });
    const bA = await rA.json();
    ok("owner A's Today shows only owner A's conversation preview", bA.today.continueConversation?.preview === 'ownerA message');

    const rB = await fetch(`${base}/api/prime/today`, { headers: headers('web:convOwnerB', true) });
    const bB = await rB.json();
    ok(
      "owner B's Today never shows owner A's conversation",
      bB.today.continueConversation?.preview === 'ownerB message' && bB.today.continueConversation?.preview !== 'ownerA message',
    );

    const rNone = await fetch(`${base}/api/prime/today`, { headers: headers('web:noConvUser', true) });
    const bNone = await rNone.json();
    ok('account with no conversations gets null, not an error or fake preview', bNone.today.continueConversation === null);
  });

  console.log('\n\u2500\u2500 usage is server-authoritative \u2500\u2500');
  await withServer(async (base) => {
    recordChatUsage('web:usageUser');
    recordChatUsage('web:usageUser');
    recordChatUsage('web:usageUser');
    const r = await fetch(`${base}/api/prime/today`, { headers: headers('web:usageUser', true) });
    const b = await r.json();
    ok('dailyUsed reflects actually recorded usage, not client-suppliable', b.today.usage.dailyUsed === 3);
  });

  console.log('\n\u2500\u2500 no cross-user data leak in the aggregate Today response \u2500\u2500');
  await withServer(async (base) => {
    await updatePrimeProfile('web:secretUser', { displayName: 'PrivateName123' });
    const r = await fetch(`${base}/api/prime/today`, { headers: headers('web:unrelatedUser', true) });
    const raw = await r.text();
    ok("unrelated user's Today response never contains another user's name", !raw.includes('PrivateName123'));
  });

  console.log('\n\u2500\u2500 cost safety on ordinary home refresh \u2500\u2500');
  await withServer(async (base) => {
    const r = await fetch(`${base}/api/prime/today`, { headers: headers('web:costUser', true) });
    const b = await r.json();
    ok('today payload reports zero AI calls', b.today.cost?.aiCalls === 0 && b.today.cost?.mode === 'deterministic');
  });
  {
    const { readFileSync } = await import('fs');
    const { dirname, join } = await import('path');
    const { fileURLToPath } = await import('url');
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const todaySrc = readFileSync(join(root, 'server/prime/today.js'), 'utf8');
    const outlookSrc = readFileSync(join(root, 'server/prime/outlook.js'), 'utf8');
    ok('today.js does not import openai-client', !todaySrc.includes('openai-client'));
    ok('outlook.js does not import openai-client', !outlookSrc.includes('openai-client'));
  }

  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  rmSync(tmpMemDir, { recursive: true, force: true });
  rmSync(tmpSubDir, { recursive: true, force: true });
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  rmSync(tmpMemDir, { recursive: true, force: true });
  rmSync(tmpSubDir, { recursive: true, force: true });
  process.exit(1);
});
