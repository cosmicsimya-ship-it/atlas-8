#!/usr/bin/env node
/**
 * Admin Control Center — Phase B regression (write actions)
 * Run: node scripts/test-admin-control-actions.mjs
 */

import express from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const tmpAcct = mkdtempSync(join(tmpdir(), 'atlas-ccb-acct-'));
const tmpSub = mkdtempSync(join(tmpdir(), 'atlas-ccb-sub-'));
const tmpMem = mkdtempSync(join(tmpdir(), 'atlas-ccb-mem-'));
const tmpConv = mkdtempSync(join(tmpdir(), 'atlas-ccb-conv-'));
const tmpAudit = mkdtempSync(join(tmpdir(), 'atlas-ccb-audit-'));

process.env.ATLAS_MEMORY_FILE = join(tmpMem, 'user_memory.json');

const { registerAccount, grantAccountRole, configureAccountStore, resetAccountStoreForTests, findAccountByUserId } =
  await import('../server/auth/index.js');
const { ATLAS_PLANS, configureSubscriptionStore, resetSubscriptionStoreForTests, getSubscription } = await import(
  '../server/entitlements/index.js'
);
const { resolveEntitlements } = await import('../server/entitlements/resolve.js');
const { resetMemoryStoreForTests, updateUserMemory, getUserMemory } = await import('../server/user-memory.js');
const { saveTodayCheckin, getTodayCheckin } = await import('../server/prime/checkin.js');
const { configureConversationStore, resetConversationStoreForTests, appendMessage, listUserConversations } =
  await import('../server/conversations.js');
const { recordChatUsage, resetChatUsageForTests, getChatUsageSnapshot } = await import('../server/usage/chat-usage.js');
const { configureAdminAuditStore, resetAdminAuditForTests, listAdminAuditEvents } = await import(
  '../server/auth/admin-audit.js'
);
const wa = await import('../server/admin/write-actions.js');

configureAccountStore(join(tmpAcct, 'accounts.json'));
configureSubscriptionStore(join(tmpSub, 'subscriptions.json'));
configureConversationStore(join(tmpConv, 'conversations.json'));
configureAdminAuditStore(join(tmpAudit, 'admin_audit.json'));
resetAccountStoreForTests();
resetSubscriptionStoreForTests();
await resetMemoryStoreForTests();
resetConversationStoreForTests();
resetChatUsageForTests();
resetAdminAuditForTests();

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

const ADMIN_WRITE_FORBIDDEN_FIELDS = ['adminId', 'actorId', 'entitlements', 'role', 'roles', 'isAdmin', 'plan', 'capabilities'];
function rejectAdminAuthoritySpoof(req, res, next) {
  for (const key of ADMIN_WRITE_FORBIDDEN_FIELDS) {
    if (req.body && typeof req.body === 'object' && key in req.body) {
      return res.status(400).json({ ok: false, error: `Field not allowed: ${key}` });
    }
  }
  return next();
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const userId = req.header('x-test-user-id');
    const authenticated = req.header('x-test-authenticated') === '1';
    const roles = (req.header('x-test-roles') || '').split(',').filter(Boolean);
    req.auth = authenticated
      ? { authenticated: true, userId, isAnonymous: false, roles }
      : { authenticated: true, userId: userId || 'anonymous:test', isAnonymous: true, roles: [] };
    next();
  });
  function requireAuth(req, res, next) {
    if (!req.auth?.authenticated || req.auth?.isAnonymous || !req.auth?.userId) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    return next();
  }
  function requireRole(role) {
    return (req, res, next) => {
      const have = Array.isArray(req.auth?.roles) ? req.auth.roles : [];
      if (!have.includes(role)) return res.status(403).json({ ok: false, error: 'Forbidden' });
      return next();
    };
  }
  const admin = [requireAuth, requireRole('admin'), rejectAdminAuthoritySpoof];

  // Mirrors every POST/PATCH /api/admin/users/:userId/* route in server/index.js exactly.
  app.post('/api/admin/users/:userId/prime/grant', ...admin, (req, res) => {
    const result = wa.grantPrime({ actorId: req.auth.userId, targetUserId: req.params.userId, durationDays: req.body?.durationDays, reason: req.body?.reason });
    res.status(result.ok ? 200 : result.status ?? 400).json(result);
  });
  app.post('/api/admin/users/:userId/prime/revoke', ...admin, (req, res) => {
    const result = wa.revokePrime({ actorId: req.auth.userId, targetUserId: req.params.userId, reason: req.body?.reason });
    res.status(result.ok ? 200 : result.status ?? 400).json(result);
  });
  app.post('/api/admin/users/:userId/prime/extend', ...admin, (req, res) => {
    const result = wa.extendPrime({ actorId: req.auth.userId, targetUserId: req.params.userId, durationDays: req.body?.durationDays, reason: req.body?.reason });
    res.status(result.ok ? 200 : result.status ?? 400).json(result);
  });
  app.patch('/api/admin/users/:userId/prime/expiry', ...admin, (req, res) => {
    const result = wa.setPrimeExpiry({ actorId: req.auth.userId, targetUserId: req.params.userId, expiryDate: req.body?.expiryDate, reason: req.body?.reason });
    res.status(result.ok ? 200 : result.status ?? 400).json(result);
  });
  app.post('/api/admin/users/:userId/usage/reset', ...admin, (req, res) => {
    const result = wa.resetUsageToday({ actorId: req.auth.userId, targetUserId: req.params.userId, reason: req.body?.reason });
    res.status(result.ok ? 200 : result.status ?? 400).json(result);
  });
  app.post('/api/admin/users/:userId/account/disable', ...admin, async (req, res) => {
    const result = await wa.setAccountDisabled({ actorId: req.auth.userId, targetUserId: req.params.userId, disabled: true, reason: req.body?.reason });
    res.status(result.ok ? 200 : result.status ?? 400).json(result);
  });
  app.post('/api/admin/users/:userId/account/enable', ...admin, async (req, res) => {
    const result = await wa.setAccountDisabled({ actorId: req.auth.userId, targetUserId: req.params.userId, disabled: false, reason: req.body?.reason });
    res.status(result.ok ? 200 : result.status ?? 400).json(result);
  });
  app.post('/api/admin/users/:userId/privacy/erase', ...admin, async (req, res) => {
    const result = await wa.erasePersonalData({ actorId: req.auth.userId, targetUserId: req.params.userId, reason: req.body?.reason });
    res.status(result.ok ? 200 : result.status ?? 400).json(result);
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

function headers(userId, authenticated, roles = []) {
  return {
    'Content-Type': 'application/json',
    'x-test-user-id': userId,
    'x-test-authenticated': authenticated ? '1' : '0',
    'x-test-roles': roles.join(','),
  };
}

async function main() {
  const admin = await registerAccount({ email: 'admin@ccb.dev', password: 'CorrectHorse123!' });
  grantAccountRole({ email: 'admin@ccb.dev', role: 'admin' });
  const free = await registerAccount({ email: 'free@ccb.dev', password: 'CorrectHorse123!' });
  const targetPool = async (n) => {
    const accts = [];
    for (let i = 0; i < n; i++) accts.push(await registerAccount({ email: `t${i}@ccb.dev`, password: 'CorrectHorse123!' }));
    return accts;
  };
  const [t1, t2, t3, t4, t5, t6, t7, t8, t9] = await targetPool(9);

  console.log('\n\u2500\u2500 AUTH \u2500\u2500');
  await withServer(async (base) => {
    const rGuest = await fetch(`${base}/api/admin/users/${t1.userId}/prime/grant`, {
      method: 'POST',
      headers: headers('anonymous:x', false),
      body: JSON.stringify({ durationDays: 30 }),
    });
    ok('guest rejected', rGuest.status === 401);

    const rFree = await fetch(`${base}/api/admin/users/${t1.userId}/prime/grant`, {
      method: 'POST',
      headers: headers(free.userId, true, ['user']),
      body: JSON.stringify({ durationDays: 30 }),
    });
    ok('free rejected', rFree.status === 403);

    const rAdmin = await fetch(`${base}/api/admin/users/${t1.userId}/prime/grant`, {
      method: 'POST',
      headers: headers(admin.userId, true, ['admin']),
      body: JSON.stringify({ durationDays: 30 }),
    });
    ok('admin allowed', rAdmin.status === 200);
  });

  console.log('\n\u2500\u2500 PRIME \u2500\u2500');
  await withServer(async (base) => {
    const adminHdrs = headers(admin.userId, true, ['admin']);

    const rGrant = await fetch(`${base}/api/admin/users/${t2.userId}/prime/grant`, { method: 'POST', headers: adminHdrs, body: JSON.stringify({ durationDays: 30 }) });
    const bGrant = await rGrant.json();
    ok('grant Prime works', rGrant.status === 200 && bGrant.plan === 'premium');

    const rDup = await fetch(`${base}/api/admin/users/${t2.userId}/prime/grant`, { method: 'POST', headers: adminHdrs, body: JSON.stringify({ durationDays: 30 }) });
    ok('duplicate grant safe (409, no duplicate record)', rDup.status === 409);

    const rExtend = await fetch(`${base}/api/admin/users/${t2.userId}/prime/extend`, { method: 'POST', headers: adminHdrs, body: JSON.stringify({ durationDays: 10 }) });
    const bExtend = await rExtend.json();
    const beforeEnd = new Date(bGrant.subscription.currentPeriodEnd).getTime();
    const afterEnd = new Date(bExtend.subscription.currentPeriodEnd).getTime();
    ok('extend Prime works (end date moved forward)', rExtend.status === 200 && afterEnd > beforeEnd);

    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const rExpiry = await fetch(`${base}/api/admin/users/${t2.userId}/prime/expiry`, { method: 'PATCH', headers: adminHdrs, body: JSON.stringify({ expiryDate: pastDate }) });
    const bExpiry = await rExpiry.json();
    ok('set expiry works', rExpiry.status === 200);
    ok('expired date resolves correctly (status=expired, plan=free)', bExpiry.subscription.status === 'expired' && bExpiry.plan === 'free');

    const entAfterExpiry = resolveEntitlements({ authenticated: true, userId: t2.userId, isAnonymous: false });
    ok('entitlements update after subscription mutation (voice.lara false post-expiry)', entAfterExpiry.entitlements['voice.lara'] === false);

    const rRevoke = await fetch(`${base}/api/admin/users/${t3.userId}/prime/grant`, { method: 'POST', headers: adminHdrs, body: JSON.stringify({ durationDays: 30 }) });
    ok('setup: grant before revoke test', rRevoke.status === 200);
    const rRevokeReal = await fetch(`${base}/api/admin/users/${t3.userId}/prime/revoke`, { method: 'POST', headers: adminHdrs });
    const bRevokeReal = await rRevokeReal.json();
    ok('revoke Prime works', rRevokeReal.status === 200 && bRevokeReal.subscription.status === 'canceled');

    const rGrantForBilling = await fetch(`${base}/api/admin/users/${t4.userId}/prime/grant`, { method: 'POST', headers: adminHdrs, body: JSON.stringify({ durationDays: 30 }) });
    const bGrantForBilling = await rGrantForBilling.json();
    ok('billing separation: admin grant recorded with admin_manual provider, not a real payment provider', bGrantForBilling.subscription && getSubscription(t4.userId).provider === 'admin_manual');
  });

  console.log('\n\u2500\u2500 VALIDATION \u2500\u2500');
  await withServer(async (base) => {
    const adminHdrs = headers(admin.userId, true, ['admin']);

    const rBadDate = await fetch(`${base}/api/admin/users/${t5.userId}/prime/expiry`, { method: 'PATCH', headers: adminHdrs, body: JSON.stringify({ expiryDate: 'not-a-date' }) });
    ok('invalid date rejected', rBadDate.status === 400);

    const rBadDuration = await fetch(`${base}/api/admin/users/${t5.userId}/prime/grant`, { method: 'POST', headers: adminHdrs, body: JSON.stringify({ durationDays: -5 }) });
    ok('invalid duration rejected (negative)', rBadDuration.status === 400);

    const rNanDuration = await fetch(`${base}/api/admin/users/${t5.userId}/prime/grant`, { method: 'POST', headers: adminHdrs, body: JSON.stringify({ durationDays: 'abc' }) });
    ok('invalid duration rejected (NaN)', rNanDuration.status === 400);

    const rAbsurdDuration = await fetch(`${base}/api/admin/users/${t5.userId}/prime/grant`, { method: 'POST', headers: adminHdrs, body: JSON.stringify({ durationDays: 999999 }) });
    ok('invalid duration rejected (absurd)', rAbsurdDuration.status === 400);

    for (const field of ['adminId', 'actorId', 'entitlements', 'role', 'roles', 'isAdmin', 'plan', 'capabilities']) {
      const r = await fetch(`${base}/api/admin/users/${t5.userId}/prime/grant`, { method: 'POST', headers: adminHdrs, body: JSON.stringify({ durationDays: 30, [field]: 'x' }) });
      ok(`unknown authority field "${field}" rejected`, r.status === 400);
    }

    const rOversizedReason = await fetch(`${base}/api/admin/users/${t5.userId}/prime/grant`, { method: 'POST', headers: adminHdrs, body: JSON.stringify({ durationDays: 30, reason: 'x'.repeat(500) }) });
    ok('oversized reason rejected', rOversizedReason.status === 400);
  });

  console.log('\n\u2500\u2500 USAGE \u2500\u2500');
  await withServer(async (base) => {
    const adminHdrs = headers(admin.userId, true, ['admin']);
    recordChatUsage(t6.userId);
    recordChatUsage(t6.userId);
    recordChatUsage(t7.userId);

    const ent = resolveEntitlements({ authenticated: true, userId: t6.userId, isAnonymous: false });
    const before = getChatUsageSnapshot(t6.userId, ent.plan);
    ok('setup: t6 has usage before reset', before.used === 2);

    const r = await fetch(`${base}/api/admin/users/${t6.userId}/usage/reset`, { method: 'POST', headers: adminHdrs });
    const b = await r.json();
    ok('usage reset works', r.status === 200 && b.usage.dailyUsed === 0);
    ok("usage reset doesn't change plan/limit", b.usage.dailyLimit === before.limit);

    const t7After = getChatUsageSnapshot(t7.userId, 'free');
    ok("usage reset doesn't erase other users", t7After.used === 1);
  });

  console.log('\n\u2500\u2500 ACCOUNT (disable/enable) \u2500\u2500');
  await withServer(async (base) => {
    const adminHdrs = headers(admin.userId, true, ['admin']);
    const rDisable = await fetch(`${base}/api/admin/users/${t8.userId}/account/disable`, { method: 'POST', headers: adminHdrs });
    ok('disable works', rDisable.status === 200);
    ok('account actually disabled in store', findAccountByUserId(t8.userId)?.disabled === true);
    ok('userId preserved after disable (regression for the upsertAccount bug fixed in this phase)', findAccountByUserId(t8.userId)?.userId === t8.userId);

    const rEnable = await fetch(`${base}/api/admin/users/${t8.userId}/account/enable`, { method: 'POST', headers: adminHdrs });
    ok('enable works', rEnable.status === 200);
    ok('account re-enabled in store', findAccountByUserId(t8.userId)?.disabled === false);

    const rSelfDisable = await fetch(`${base}/api/admin/users/${admin.userId}/account/disable`, { method: 'POST', headers: adminHdrs });
    ok('self-protection: admin cannot disable own account', rSelfDisable.status === 400);
  });

  console.log('\n\u2500\u2500 PRIVACY \u2500\u2500');
  await withServer(async (base) => {
    const adminHdrs = headers(admin.userId, true, ['admin']);
    await updateUserMemory(t9.userId, { facts: { f1: 'secret note' } });
    await appendMessage(t9.userId, null, { role: 'user', content: 'a message' });
    await updateUserMemory(free.userId, { facts: { f_other: 'unrelated' } });
    await saveTodayCheckin(t9.userId, { energy: 'steady', focus: 'think', intention: 'phase3-private-intention' });
    await saveTodayCheckin(free.userId, { energy: 'high', focus: 'create', intention: 'unrelated-checkin' });

    const r = await fetch(`${base}/api/admin/users/${t9.userId}/privacy/erase`, { method: 'POST', headers: adminHdrs, body: JSON.stringify({ reason: 'support request' }) });
    const b = await r.json();
    ok('erase only intended scope (works)', r.status === 200 && b.memoryErased === true && b.conversationsDeleted === 1);
    ok('memory actually gone', Object.keys(getUserMemory(t9.userId)?.facts || {}).length === 0);
    ok('conversations actually gone', listUserConversations(t9.userId).length === 0);
    ok('phase 3 check-in erased with privacy erase', getTodayCheckin(t9.userId).checkin === null);
    ok("cross-user erase impossible (unrelated user's data survives)", Object.keys(getUserMemory(free.userId)?.facts || {}).length === 1);
    ok("unrelated account's check-in survives erase", getTodayCheckin(free.userId).checkin?.intention === 'unrelated-checkin');
  });

  console.log('\n\u2500\u2500 AUDIT \u2500\u2500');
  await withServer(async () => {
    const events = listAdminAuditEvents();
    ok('successful actions logged', events.some((e) => e.action === 'admin.prime.grant' && e.result === 'ok'));
    ok('target correct on a logged event', events.some((e) => e.action === 'admin.privacy.erase' && e.targetUserId === t9.userId));
    const raw = JSON.stringify(events);
    ok('no full account object / secret payload leaked into audit', !raw.includes('passwordHash') && !raw.includes('secret note'));
    const eraseEvent = events.find((e) => e.action === 'admin.privacy.erase' && e.targetUserId === t9.userId);
    ok('before/after are short summaries, not raw dumps', typeof eraseEvent?.meta?.before === 'string' && eraseEvent.meta.before.length < 100);
  });

  console.log('\n\u2500\u2500 SECURITY \u2500\u2500');
  await withServer(async (base) => {
    const rNonAdmin = await fetch(`${base}/api/admin/users/${t1.userId}/prime/revoke`, {
      method: 'POST',
      headers: headers(free.userId, true, ['user']), // "user A" without admin role trying to write on "user B"
    });
    ok('user A cannot admin-write user B without admin role', rNonAdmin.status === 403);

    const rSpoofAdmin = await fetch(`${base}/api/admin/users/${t1.userId}/prime/grant`, {
      method: 'POST',
      headers: headers(free.userId, true, ['user']),
      body: JSON.stringify({ durationDays: 30, adminId: admin.userId }),
    });
    ok('client cannot spoof adminId to gain access (still 403, role check runs first)', rSpoofAdmin.status === 403);

    const adminHdrs = headers(admin.userId, true, ['admin']);
    const rEntSpoof = await fetch(`${base}/api/admin/users/${t1.userId}/prime/grant`, {
      method: 'POST',
      headers: adminHdrs,
      body: JSON.stringify({ durationDays: 30, entitlements: { 'voice.lara': true } }),
    });
    ok('client cannot write entitlements directly even as admin', rEntSpoof.status === 400);

    const rArbitrarySub = await fetch(`${base}/api/admin/users/${t1.userId}/prime/grant`, {
      method: 'POST',
      headers: adminHdrs,
      body: JSON.stringify({ durationDays: 30, plan: 'super-ultra-plan' }),
    });
    ok('client cannot write arbitrary subscription fields (plan is not an accepted body field)', rArbitrarySub.status === 400);
  });

  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  rmSync(tmpAcct, { recursive: true, force: true });
  rmSync(tmpSub, { recursive: true, force: true });
  rmSync(tmpMem, { recursive: true, force: true });
  rmSync(tmpConv, { recursive: true, force: true });
  rmSync(tmpAudit, { recursive: true, force: true });
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
