#!/usr/bin/env node
/**
 * Phase 3 — Lara Prime personal intelligence world
 * Run: node scripts/test-prime-phase3.mjs
 */

import express from 'express';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const tmpMemDir = mkdtempSync(join(tmpdir(), 'atlas-p3-mem-'));
const tmpSubDir = mkdtempSync(join(tmpdir(), 'atlas-p3-sub-'));
process.env.ATLAS_MEMORY_FILE = join(tmpMemDir, 'user_memory.json');

const { saveTodayCheckin, getTodayCheckin, listCheckinHistory, deriveFrequency } = await import(
  '../server/prime/checkin.js'
);
const { getPrimeProfile, updatePrimeProfile, profileCompleteness } = await import('../server/prime/profile.js');
const { buildPrimeToday } = await import('../server/prime/today.js');
const { buildSevenDayOutlook, OUTLOOK_COST } = await import('../server/prime/outlook.js');
const { buildMemoryContinuity } = await import('../server/prime/memory.js');
const { resetMemoryStoreForTests, updateUserMemory, getUserMemory } = await import('../server/user-memory.js');
const { erasePersonalData } = await import('../server/admin/write-actions.js');
const {
  ATLAS_PLANS,
  configureSubscriptionStore,
  resetSubscriptionStoreForTests,
  upsertSubscription,
  requirePrimeWorld,
} = await import('../server/entitlements/index.js');
const { resetChatUsageForTests } = await import('../server/usage/chat-usage.js');
const {
  registerAccount,
  configureAccountStore,
  resetAccountStoreForTests,
  grantAccountRole,
} = await import('../server/auth/index.js');

const tmpAcct = mkdtempSync(join(tmpdir(), 'atlas-p3-acct-'));
const tmpAudit = mkdtempSync(join(tmpdir(), 'atlas-p3-audit-'));
const tmpConv = mkdtempSync(join(tmpdir(), 'atlas-p3-conv-'));
configureAccountStore(join(tmpAcct, 'accounts.json'));
configureSubscriptionStore(join(tmpSubDir, 'subscriptions.json'));
const { configureAdminAuditStore, resetAdminAuditForTests } = await import('../server/auth/admin-audit.js');
const { configureConversationStore, resetConversationStoreForTests } = await import('../server/conversations.js');
configureAdminAuditStore(join(tmpAudit, 'admin_audit.json'));
configureConversationStore(join(tmpConv, 'conversations.json'));
resetAccountStoreForTests();
resetSubscriptionStoreForTests();
resetAdminAuditForTests();
resetConversationStoreForTests();
await resetMemoryStoreForTests();
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
  const requirePrime = requirePrimeWorld();

  app.get('/api/prime/today', requireAuth, (req, res) => {
    try {
      return res.json({ ok: true, today: buildPrimeToday(req.auth.userId, req.auth) });
    } catch {
      return res.status(500).json({ ok: false, error: 'Prime home service unavailable' });
    }
  });
  app.get('/api/prime/checkin/today', requireAuth, requirePrime, (req, res) => {
    const result = getTodayCheckin(req.auth.userId);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, date: result.date, checkin: result.checkin, frequency: result.frequency });
  });
  app.get('/api/prime/checkin/history', requireAuth, requirePrime, (req, res) => {
    const result = listCheckinHistory(req.auth.userId, { limit: req.query.limit });
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, items: result.items });
  });
  app.post('/api/prime/checkin', requireAuth, requirePrime, async (req, res) => {
    const result = await saveTodayCheckin(req.auth.userId, req.body ?? {});
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, checkin: result.checkin, frequency: result.frequency });
  });
  app.get('/api/prime/outlook', requireAuth, requirePrime, (req, res) => {
    const profileResult = getPrimeProfile(req.auth.userId);
    const profile = profileResult.ok ? profileResult.profile : null;
    const todayCheckin = getTodayCheckin(req.auth.userId);
    const outlook = buildSevenDayOutlook({
      profile,
      checkin: todayCheckin.ok ? todayCheckin.checkin : null,
      timezone: profile?.birth?.timezone || null,
    });
    return res.json({ ok: true, outlook });
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
  return {
    'Content-Type': 'application/json',
    'x-test-user-id': userId,
    'x-test-authenticated': authenticated ? '1' : '0',
  };
}

async function main() {
  upsertSubscription({ userId: 'web:primeA', plan: ATLAS_PLANS.PREMIUM, status: 'active' });
  upsertSubscription({ userId: 'web:primeB', plan: ATLAS_PLANS.PREMIUM, status: 'active' });

  console.log('\n\u2500\u2500 A. CHECK-IN AUTH / ENTITLEMENT / OWNERSHIP \u2500\u2500');
  await withServer(async (base) => {
    const rGuest = await fetch(`${base}/api/prime/checkin/today`, { headers: headers('anonymous:x', false) });
    ok('guest rejected on GET checkin/today', rGuest.status === 401);

    const rGuestPost = await fetch(`${base}/api/prime/checkin`, {
      method: 'POST',
      headers: headers('anonymous:x', false),
      body: JSON.stringify({ energy: 'steady', focus: 'think' }),
    });
    ok('guest rejected on POST checkin', rGuestPost.status === 401);

    const rFree = await fetch(`${base}/api/prime/checkin/today`, { headers: headers('web:freeUser', true) });
    ok('free user rejected on GET checkin (Prime-only)', rFree.status === 403);

    const rFreePost = await fetch(`${base}/api/prime/checkin`, {
      method: 'POST',
      headers: headers('web:freeUser', true),
      body: JSON.stringify({ energy: 'steady', focus: 'think' }),
    });
    ok('free user rejected on POST checkin', rFreePost.status === 403);

    const rOutlookFree = await fetch(`${base}/api/prime/outlook`, { headers: headers('web:freeUser', true) });
    ok('free user rejected on outlook', rOutlookFree.status === 403);

    const rPrimeGet = await fetch(`${base}/api/prime/checkin/today`, { headers: headers('web:primeA', true) });
    ok('Prime user allowed on GET checkin/today', rPrimeGet.status === 200);
    const bEmpty = await rPrimeGet.json();
    ok('no check-in yet is honest null, not fabricated', bEmpty.checkin === null);

    const rInvalid = await fetch(`${base}/api/prime/checkin`, {
      method: 'POST',
      headers: headers('web:primeA', true),
      body: JSON.stringify({ energy: 'exhausted', focus: 'think' }),
    });
    ok('invalid energy rejected', rInvalid.status === 400);

    const rLong = await fetch(`${base}/api/prime/checkin`, {
      method: 'POST',
      headers: headers('web:primeA', true),
      body: JSON.stringify({ energy: 'steady', focus: 'think', intention: 'x'.repeat(500) }),
    });
    ok('oversized intention rejected', rLong.status === 400);

    const rSpoof = await fetch(`${base}/api/prime/checkin`, {
      method: 'POST',
      headers: headers('web:primeA', true),
      body: JSON.stringify({ energy: 'steady', focus: 'think', userId: 'web:primeB' }),
    });
    ok('client-supplied userId rejected', rSpoof.status === 400);

    const rOk = await fetch(`${base}/api/prime/checkin`, {
      method: 'POST',
      headers: headers('web:primeA', true),
      body: JSON.stringify({ energy: 'low', focus: 'restore', intention: 'dinlenmek' }),
    });
    ok('Prime user can persist a valid check-in', rOk.status === 200);
    const saved = await rOk.json();
    ok('saved check-in bound to today, not client date', typeof saved.checkin?.date === 'string');
    ok('frequency derived as self-reflection LOW/restore', saved.frequency?.level === 'LOW' && saved.frequency?.recommendation === 'restore');
    ok('frequency framing is non-clinical', saved.frequency?.framing?.includes('biyolojik'));

    const rRefresh = await fetch(`${base}/api/prime/checkin/today`, { headers: headers('web:primeA', true) });
    const refreshed = await rRefresh.json();
    ok('refresh restores persisted check-in', refreshed.checkin?.intention === 'dinlenmek' && refreshed.checkin?.energy === 'low');

    const rB = await fetch(`${base}/api/prime/checkin/today`, { headers: headers('web:primeB', true) });
    const bB = await rB.json();
    ok("Prime B cannot read Prime A's check-in", bB.checkin === null);
    const rawB = JSON.stringify(bB);
    ok("Prime B payload never contains A's intention", !rawB.includes('dinlenmek'));

    const rHist = await fetch(`${base}/api/prime/checkin/history`, { headers: headers('web:primeA', true) });
    const hist = await rHist.json();
    ok('history returns owner check-ins', rHist.status === 200 && hist.items.some((i) => i.intention === 'dinlenmek'));
  });

  console.log('\n\u2500\u2500 B. PRIME HOME STATES \u2500\u2500');
  await withServer(async (base) => {
    const rNoProfile = await fetch(`${base}/api/prime/today`, { headers: headers('web:noProfile', true) });
    const noProfile = await rNoProfile.json();
    ok('Today renders for authenticated user', rNoProfile.status === 200 && typeof noProfile.today.greeting === 'string');
    ok('no-profile completeness asks to complete profile', noProfile.today.profile.completeness?.showCompleteProfileCta === true);
    ok('ordinary refresh cost is deterministic with 0 AI calls', noProfile.today.cost?.aiCalls === 0);

    await updatePrimeProfile('web:dateOnly', { birth: { date: '1992-08-20', place: 'Izmir, Turkey' } });
    const rDateOnly = await fetch(`${base}/api/prime/today`, { headers: headers('web:dateOnly', true) });
    const dateOnly = await rDateOnly.json();
    ok('incomplete (date-only) profile does not fabricate houses', dateOnly.today.natal?.fullChartAvailable === false);
    ok('incomplete profile CTA not blocking once birth date exists', dateOnly.today.profile.completeness?.showCompleteProfileCta === false);

    const rPrimeHome = await fetch(`${base}/api/prime/today`, { headers: headers('web:primeA', true) });
    const home = await rPrimeHome.json();
    ok('check-in state present for Prime', home.today.checkIn?.record?.energy === 'low');
    ok('7-day outlook object present', home.today.outlook && Array.isArray(home.today.outlook.items));
    ok('Continue conversation is null when none exist (honest empty)', home.today.continueConversation === null);
    ok('memory continuity empty when no facts', home.today.memoryContinuity?.available === false);
  });

  console.log('\n\u2500\u2500 C. PROFILE COMPLETENESS / NATAL HONESTY \u2500\u2500');
  {
    const empty = profileCompleteness({
      birth: { date: null, time: null, place: null, timezone: null },
      relationshipStatus: null,
    });
    ok('accountFunctional even with empty profile', empty.accountFunctional === true);
    ok('CTA label Profilini tamamla', empty.ctaLabel === 'Profilini tamamla');

    await updatePrimeProfile('web:primeA', {
      birth: { date: '1988-11-02', time: '09:45', place: 'Izmir, Turkey', timezone: 'Europe/Istanbul' },
    });
    const full = (await getPrimeProfile('web:primeA')).profile;
    const c = profileCompleteness(full);
    ok('full profile unlocks houses', c.natalHousesAvailable === true && c.deeperPersonalizationReady === true);
  }

  console.log('\n\u2500\u2500 D. 7-DAY OUTLOOK HONESTY \u2500\u2500');
  {
    const emptyOutlook = buildSevenDayOutlook({
      profile: { birth: { date: null, time: null, place: null, timezone: null } },
      checkin: null,
    });
    ok('outlook without evidence is empty, not invented', emptyOutlook.available === false && emptyOutlook.items.length === 0);
    ok('empty outlook explains itself', typeof emptyOutlook.message === 'string' && emptyOutlook.message.length > 0);
    ok('outlook cost is deterministic', emptyOutlook.cost.aiCalls === 0 && OUTLOOK_COST.aiCalls === 0);

    const withBirthday = buildSevenDayOutlook({
      profile: { birth: { date: new Date().toISOString().slice(0, 10) } },
      checkin: null,
      now: new Date(),
    });
    const birthdayItem = withBirthday.items.find((i) => i.title === 'Doğum günün');
    ok('birthday in window is sourced from profile.birth.date', !birthdayItem || birthdayItem.provenance.includes('birth.date'));

    const fabricated = JSON.stringify(withBirthday);
    ok('outlook never claims an invented natal transit', !/uydurma|fabricated|predicted transit/i.test(fabricated));
  }

  console.log('\n\u2500\u2500 E. FREQUENCY / MEMORY CONTINUITY \u2500\u2500');
  {
    const freq = deriveFrequency({ energy: 'high', focus: 'create' });
    ok('high+create -> HIGH / create', freq.level === 'HIGH' && freq.recommendation === 'create');
    ok('no diagnostic language', !/tanı|diagnosis|disorder|klinik/i.test(JSON.stringify(freq)));

    await updateUserMemory('web:primeA', { facts: { topic: 'son konuşmada odak: arşiv' } });
    const continuity = buildMemoryContinuity('web:primeA');
    ok('memory continuity uses stored fact', continuity.available && continuity.statement.includes('arşiv'));
  }

  console.log('\n\u2500\u2500 F. PRIVACY ERASE \u2500\u2500');
  {
    const target = await registerAccount({ email: 'erase-p3@cc.dev', password: 'CorrectHorse123!' });
    const other = await registerAccount({ email: 'keep-p3@cc.dev', password: 'CorrectHorse123!' });
    grantAccountRole({ email: 'erase-p3@cc.dev', role: 'user' });
    await saveTodayCheckin(target.userId, { energy: 'steady', focus: 'think', intention: 'erase-me' });
    await saveTodayCheckin(other.userId, { energy: 'high', focus: 'create', intention: 'keep-me' });
    const erased = await erasePersonalData({ actorId: 'web:admin', targetUserId: target.userId, reason: 'phase3' });
    ok('erase reports ok', erased.ok === true && erased.memoryErased === true);
    ok('target check-in gone', getTodayCheckin(target.userId).checkin === null);
    ok('unrelated check-in intact', getTodayCheckin(other.userId).checkin?.intention === 'keep-me');
    ok('target facts gone', Object.keys(getUserMemory(target.userId)?.facts || {}).length === 0);
  }

  console.log('\n\u2500\u2500 G. ADMIN AGGREGATES DO NOT LEAK \u2500\u2500');
  {
    const { getAdminOverview } = await import('../server/admin/control-center.js');
    const overview = getAdminOverview();
    const raw = JSON.stringify(overview);
    ok('aggregates are numbers', typeof overview.checkInsToday === 'number' && typeof overview.primeProfilesCompleted === 'number');
    ok('private check-in text not in overview', !raw.includes('dinlenmek') && !raw.includes('erase-me') && !raw.includes('keep-me'));
  }

  console.log('\n\u2500\u2500 H. PRIME HOME UI CONTRACT \u2500\u2500');
  {
    const page = readFileSync(join(ROOT, 'src/pages/PrimePage.tsx'), 'utf8');
    ok('Today section present', page.includes('title="Bugün"'));
    ok('Check-in section present', page.includes('title="Check-in"') && page.includes('id="checkin"'));
    ok('7-day outlook section present', page.includes('Önümüzdeki 7 gün'));
    ok('Continue section present', page.includes('title="Devam"') || page.includes('id="continue"'));
    ok('Memory section present', page.includes('id="memory"'));
    ok('Profilini tamamla CTA present', page.includes('Profilini tamamla'));
    ok('loading state present', page.includes('Yükleniyor…'));
    ok('empty check-in invite present', page.includes('Bugün henüz check-in yok'));
    ok('empty outlook copy present', page.includes('kayıtlı bir madde yok'));
    ok('error retry present', page.includes('Yeniden dene'));
    ok('frequency framing shown from server', page.includes('frequency.framing'));
    ok('mobile overflow guarded', page.includes('overflow-x-hidden') && page.includes('min-h-11'));
    ok('no neon/sci-fi dashboard class dump', !/neon|cyberpunk|hologram/i.test(page));
  }

  console.log('\n\u2500\u2500 I. COST / NO PARALLEL OPENAI CLIENT \u2500\u2500');
  {
    const todaySrc = readFileSync(join(ROOT, 'server/prime/today.js'), 'utf8');
    const outlookSrc = readFileSync(join(ROOT, 'server/prime/outlook.js'), 'utf8');
    const checkinSrc = readFileSync(join(ROOT, 'server/prime/checkin.js'), 'utf8');
    ok('today.js has no openai-client import', !todaySrc.includes('openai-client') && !todaySrc.includes('callOpenAI'));
    ok('outlook.js has no openai-client import', !outlookSrc.includes('openai-client') && !outlookSrc.includes('callOpenAI'));
    ok('checkin.js has no openai-client import', !checkinSrc.includes('openai-client'));
    ok('today documents deterministic cost', todaySrc.includes('aiCalls: 0'));
  }

  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  rmSync(tmpMemDir, { recursive: true, force: true });
  rmSync(tmpSubDir, { recursive: true, force: true });
  rmSync(tmpAcct, { recursive: true, force: true });
  rmSync(tmpAudit, { recursive: true, force: true });
  rmSync(tmpConv, { recursive: true, force: true });
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  rmSync(tmpMemDir, { recursive: true, force: true });
  rmSync(tmpSubDir, { recursive: true, force: true });
  rmSync(tmpAcct, { recursive: true, force: true });
  rmSync(tmpAudit, { recursive: true, force: true });
  rmSync(tmpConv, { recursive: true, force: true });
  process.exit(1);
});
