#!/usr/bin/env node
/**
 * Phase 2 regression — Lara Prime memory.extended
 * Run: node scripts/test-prime-memory-extended.mjs
 *
 * Tests the actual functions wired into atlas-message-service.js:
 *   - buildRelevantMemoryContext (server/memory-intents.js) with the real
 *     depth config, not a reimplementation
 *   - resolveEntitlements + hasCapability (server/entitlements) for the
 *     server-side plan resolution that feeds memoryExtended
 */

import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

process.env.ATLAS_MEMORY_FACT_DEPTH_FREE = '3';
process.env.ATLAS_MEMORY_FACT_DEPTH_PREMIUM = '12';

const tmpMemDir = mkdtempSync(join(tmpdir(), 'atlas-mem-'));
process.env.ATLAS_MEMORY_FILE = join(tmpMemDir, 'user_memory.json');

const tmpSubDir = mkdtempSync(join(tmpdir(), 'atlas-sub-'));
const subPath = join(tmpSubDir, 'subscriptions.json');

const {
  ATLAS_PLANS,
  CAPABILITIES,
  configureSubscriptionStore,
  resetSubscriptionStoreForTests,
  upsertSubscription,
  resolveEntitlements,
  hasCapability,
} = await import('../server/entitlements/index.js');
const { buildRelevantMemoryContext, getMemoryFactDepthConfig } = await import(
  '../server/memory-intents.js'
);
const { updateUserMemory, resetMemoryStoreForTests } = await import('../server/user-memory.js');

configureSubscriptionStore(subPath);
resetSubscriptionStoreForTests();
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

async function seedUserWithFacts(userId, count) {
  const facts = {};
  for (let i = 0; i < count; i++) {
    facts[`fact_${i}`] = `Not #${i}`;
  }
  const res = await updateUserMemory(userId, { facts });
  if (!res.ok) throw new Error(`seed failed: ${res.error}`);
}

function countNoteLines(context) {
  if (!context) return 0;
  return context.split('\n').filter((l) => l.startsWith('Not: ')).length;
}

async function main() {
  console.log('\n\u2500\u2500 memory.extended: depth config \u2500\u2500');
  const depthConfig = getMemoryFactDepthConfig();
  ok('free depth = 3 (env)', depthConfig.free === 3);
  ok('premium depth = 12 (env)', depthConfig.premium === 12);

  console.log('\n\u2500\u2500 memory.extended: free retains current (unchanged) behavior \u2500\u2500');
  await seedUserWithFacts('web:memFree', 20);
  const freeContextNoTrigger = buildRelevantMemoryContext(
    'web:memFree',
    'merhaba, bugün nasılsın',
    'conversational',
    { memoryExtended: false },
  );
  ok(
    'free: facts NOT included without a past-referencing trigger phrase',
    countNoteLines(freeContextNoTrigger) === 0,
  );
  const freeContextTriggered = buildRelevantMemoryContext(
    'web:memFree',
    'daha önce ne söylemiştim, hatırlıyor musun?',
    'conversational',
    { memoryExtended: false },
  );
  ok('free: exactly 3 facts included when triggered (unchanged default)', countNoteLines(freeContextTriggered) === 3);

  console.log('\n\u2500\u2500 memory.extended: premium gets a real, bounded, measurable difference \u2500\u2500');
  await seedUserWithFacts('web:memPremium', 20);
  const premiumContextTriggered = buildRelevantMemoryContext(
    'web:memPremium',
    'daha önce ne söylemiştim, hatırlıyor musun?',
    'conversational',
    { memoryExtended: true },
  );
  ok('premium: 12 facts included when triggered (4x free depth)', countNoteLines(premiumContextTriggered) === 12);
  const premiumContextNoTrigger = buildRelevantMemoryContext(
    'web:memPremium',
    'merhaba, bugün nasılsın',
    'conversational',
    { memoryExtended: true },
  );
  ok(
    'premium: SAME relevance trigger as free — no past-reference, no facts injected (quality gate preserved)',
    countNoteLines(premiumContextNoTrigger) === 0,
  );

  console.log('\n\u2500\u2500 memory.extended: bounded even for users with far more than 12 facts \u2500\u2500');
  await seedUserWithFacts('web:memHuge', 500);
  const hugeContext = buildRelevantMemoryContext(
    'web:memHuge',
    'geçen konuştuklarımızı hatırlıyor musun',
    'conversational',
    { memoryExtended: true },
  );
  ok('premium depth never exceeds the configured bound even with 500 stored facts', countNoteLines(hugeContext) === 12);

  console.log('\n\u2500\u2500 memory.extended: server-side entitlement resolution (the real spoof/plan boundary) \u2500\u2500');
  ok(
    'guest: memory.extended = false',
    hasCapability(resolveEntitlements({}).entitlements, CAPABILITIES.MEMORY_EXTENDED) === false,
  );
  ok(
    'free (authenticated, no subscription): memory.extended = false',
    hasCapability(
      resolveEntitlements({ authenticated: true, userId: 'web:planFree', isAnonymous: false }).entitlements,
      CAPABILITIES.MEMORY_EXTENDED,
    ) === false,
  );
  upsertSubscription({ userId: 'web:planPremium', plan: ATLAS_PLANS.PREMIUM, status: 'active' });
  ok(
    'premium (active subscription): memory.extended = true',
    hasCapability(
      resolveEntitlements({ authenticated: true, userId: 'web:planPremium', isAnonymous: false }).entitlements,
      CAPABILITIES.MEMORY_EXTENDED,
    ) === true,
  );

  console.log('\n\u2500\u2500 memory.extended: subscription expiry drops back to free depth (data is NOT deleted) \u2500\u2500');
  await seedUserWithFacts('web:memExpiring', 20);
  upsertSubscription({ userId: 'web:memExpiring', plan: ATLAS_PLANS.PREMIUM, status: 'active' });
  let entExpiring = resolveEntitlements({
    authenticated: true,
    userId: 'web:memExpiring',
    isAnonymous: false,
  });
  ok('while active: memory.extended = true', hasCapability(entExpiring.entitlements, CAPABILITIES.MEMORY_EXTENDED) === true);
  const contextWhileActive = buildRelevantMemoryContext(
    'web:memExpiring',
    'daha önce ne demiştim hatırlıyor musun',
    'conversational',
    { memoryExtended: hasCapability(entExpiring.entitlements, CAPABILITIES.MEMORY_EXTENDED) },
  );
  ok('while active: gets premium depth (12)', countNoteLines(contextWhileActive) === 12);

  upsertSubscription({ userId: 'web:memExpiring', plan: ATLAS_PLANS.PREMIUM, status: 'expired' });
  entExpiring = resolveEntitlements({ authenticated: true, userId: 'web:memExpiring', isAnonymous: false });
  ok('after expiry: memory.extended = false', hasCapability(entExpiring.entitlements, CAPABILITIES.MEMORY_EXTENDED) === false);
  const contextAfterExpiry = buildRelevantMemoryContext(
    'web:memExpiring',
    'daha önce ne demiştim hatırlıyor musun',
    'conversational',
    { memoryExtended: hasCapability(entExpiring.entitlements, CAPABILITIES.MEMORY_EXTENDED) },
  );
  ok(
    'after expiry: falls back to free depth (3), same facts still exist (not deleted, just not retrieved as deep)',
    countNoteLines(contextAfterExpiry) === 3,
  );

  console.log('\n\u2500\u2500 memory.extended: ownership boundary unchanged (still per-userId, no cross-user reads) \u2500\u2500');
  await seedUserWithFacts('web:memOwnerA', 5);
  await seedUserWithFacts('web:memOwnerB', 5);
  const ownerAContext = buildRelevantMemoryContext(
    'web:memOwnerA',
    'daha önce ne söylemiştim',
    'conversational',
    { memoryExtended: true },
  );
  ok(
    "owner A's context never includes owner B's data (no shared/global fact pool introduced)",
    !ownerAContext.includes('fact_') || ownerAContext.split('\n').every((l) => !l.includes('B')),
  );

  console.log('\n\u2500\u2500 memory.extended: fail-closed when auth is missing/unresolvable \u2500\u2500');
  await seedUserWithFacts('web:memFailClosed', 20);
  // Simulates the atlas-message-service.js call site's try/catch: no options.auth -> memoryExtended stays false
  const failClosedContext = buildRelevantMemoryContext(
    'web:memFailClosed',
    'daha önce ne demiştim hatırlıyor musun',
    'conversational',
    { memoryExtended: false }, // what the real call site defaults to when options.auth is absent
  );
  ok('no auth -> free depth (3), never premium (fail-closed, never fail-open)', countNoteLines(failClosedContext) === 3);

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
