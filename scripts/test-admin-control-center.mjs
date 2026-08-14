#!/usr/bin/env node
/**
 * Admin Control Center — Phase A regression
 * Run: node scripts/test-admin-control-center.mjs
 *
 * Real HTTP server exercising the actual server/admin/control-center.js
 * functions (same imports as server/index.js).
 */

import express from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const tmpAcct = mkdtempSync(join(tmpdir(), 'atlas-cc-acct-'));
const tmpSub = mkdtempSync(join(tmpdir(), 'atlas-cc-sub-'));
const tmpMem = mkdtempSync(join(tmpdir(), 'atlas-cc-mem-'));
const tmpAudit = mkdtempSync(join(tmpdir(), 'atlas-cc-audit-'));

process.env.ATLAS_MEMORY_FILE = join(tmpMem, 'user_memory.json');
process.env.ATLAS_CHAT_DAILY_QUOTA_FREE = '40';
process.env.ATLAS_CHAT_DAILY_QUOTA_PREMIUM = '200';

const {
  registerAccount,
  grantAccountRole,
  configureAccountStore,
  resetAccountStoreForTests,
} = await import('../server/auth/index.js');
const {
  ATLAS_PLANS,
  configureSubscriptionStore,
  resetSubscriptionStoreForTests,
  upsertSubscription,
} = await import('../server/entitlements/index.js');
const { resetMemoryStoreForTests, updateUserMemory } = await import('../server/user-memory.js');
const { recordChatUsage, resetChatUsageForTests, getChatDailyQuotaConfig } = await import(
  '../server/usage/chat-usage.js'
);
const { configureAdminAuditStore, resetAdminAuditForTests, logAdminAudit } = await import(
  '../server/auth/admin-audit.js'
);
const cc = await import('../server/admin/control-center.js');

configureAccountStore(join(tmpAcct, 'accounts.json'));
configureSubscriptionStore(join(tmpSub, 'subscriptions.json'));
configureAdminAuditStore(join(tmpAudit, 'admin_audit.json'));
resetAccountStoreForTests();
resetSubscriptionStoreForTests();
await resetMemoryStoreForTests();
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
  const admin = [requireAuth, requireRole('admin')];

  // Mirrors every GET /api/admin/* route in server/index.js exactly.
  app.get('/api/admin/overview', ...admin, (req, res) => res.json({ ok: true, overview: cc.getAdminOverview() }));
  app.get('/api/admin/users', ...admin, (req, res) =>
    res.json({
      ok: true,
      ...cc.listAdminUsers({
        search: req.query.search,
        plan: req.query.plan,
        subscriptionStatus: req.query.subscriptionStatus,
        role: req.query.role,
        limit: req.query.limit,
        offset: req.query.offset,
      }),
    }),
  );
  app.get('/api/admin/prime', ...admin, (req, res) =>
    res.json({ ok: true, ...cc.listAdminUsers({ plan: 'premium', limit: req.query.limit, offset: req.query.offset }) }),
  );
  app.get('/api/admin/users/:userId', ...admin, (req, res) => {
    const result = cc.getAdminUserDetail(req.params.userId);
    if (!result.ok) return res.status(404).json({ ok: false, error: result.error });
    return res.json({ ok: true, user: result.user });
  });
  app.get('/api/admin/usage', ...admin, (req, res) => res.json({ ok: true, usage: cc.getAdminUsage() }));
  app.get('/api/admin/costs', ...admin, (req, res) => res.json({ ok: true, costs: cc.getAdminCosts() }));
  app.get('/api/admin/health', ...admin, (req, res) => res.json({ ok: true, health: cc.getAdminHealth() }));
  app.get('/api/admin/audit', ...admin, (req, res) =>
    res.json({ ok: true, ...cc.getAdminAuditLog({ limit: req.query.limit, offset: req.query.offset }) }),
  );

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
  return { 'x-test-user-id': userId, 'x-test-authenticated': authenticated ? '1' : '0', 'x-test-roles': roles.join(',') };
}

async function main() {
  const free = await registerAccount({ email: 'free@cc.dev', password: 'CorrectHorse123!' });
  const prime = await registerAccount({ email: 'prime@cc.dev', password: 'CorrectHorse123!' });
  const expired = await registerAccount({ email: 'expired@cc.dev', password: 'CorrectHorse123!' });
  const primeUser = await registerAccount({ email: 'primeuser@cc.dev', password: 'CorrectHorse123!' });
  const admin = await registerAccount({ email: 'admin@cc.dev', password: 'CorrectHorse123!' });
  grantAccountRole({ email: 'admin@cc.dev', role: 'admin' });

  upsertSubscription({ userId: prime.userId, plan: ATLAS_PLANS.PREMIUM, status: 'active' });
  upsertSubscription({ userId: expired.userId, plan: ATLAS_PLANS.PREMIUM, status: 'expired' });
  recordChatUsage(prime.userId);
  recordChatUsage(free.userId);
  for (let i = 0; i < 32; i++) recordChatUsage(primeUser.userId); // 32/40 = 80% exactly for a FREE user near-limit check below
  await updateUserMemory(free.userId, { facts: { f1: 'note one', f2: 'note two' } });
  logAdminAudit({ action: 'test.action', actor: admin.userId, targetUserId: free.userId, result: 'ok' });

  console.log('\n\u2500\u2500 AUTH \u2500\u2500');
  await withServer(async (base) => {
    for (const path of ['/api/admin/overview', '/api/admin/users', '/api/admin/usage', '/api/admin/costs', '/api/admin/health', '/api/admin/audit']) {
      const rGuest = await fetch(`${base}${path}`, { headers: headers('anonymous:x', false) });
      ok(`guest rejected on ${path}`, rGuest.status === 401);
      const rFree = await fetch(`${base}${path}`, { headers: headers(free.userId, true, ['user']) });
      ok(`free user rejected on ${path}`, rFree.status === 403);
      const rPrime = await fetch(`${base}${path}`, { headers: headers(prime.userId, true, ['user']) });
      ok(`prime user (non-admin role) rejected on ${path}`, rPrime.status === 403);
      const rAdmin = await fetch(`${base}${path}`, { headers: headers(admin.userId, true, ['user', 'admin']) });
      ok(`admin allowed on ${path}`, rAdmin.status === 200);
    }
  });

  console.log('\n\u2500\u2500 USERS \u2500\u2500');
  await withServer(async (base) => {
    const adminHdrs = headers(admin.userId, true, ['admin']);

    const rList = await fetch(`${base}/api/admin/users`, { headers: adminHdrs });
    const bList = await rList.json();
    ok('admin can list users', rList.status === 200 && bList.users.length === 5);

    const rSearch = await fetch(`${base}/api/admin/users?search=prime@cc`, { headers: adminHdrs });
    const bSearch = await rSearch.json();
    ok('search works', bSearch.users.length === 1 && bSearch.users[0].email === 'prime@cc.dev');

    const rPlanFilter = await fetch(`${base}/api/admin/users?plan=premium`, { headers: adminHdrs });
    const bPlanFilter = await rPlanFilter.json();
    ok('plan filter works', bPlanFilter.users.every((u) => u.plan === 'premium') && bPlanFilter.users.length === 1);

    const rSubFilter = await fetch(`${base}/api/admin/users?subscriptionStatus=inactive`, { headers: adminHdrs });
    const bSubFilter = await rSubFilter.json();
    ok('subscription status filter works', bSubFilter.users.every((u) => u.subscriptionStatus === 'inactive'));

    const rPage = await fetch(`${base}/api/admin/users?limit=2&offset=0`, { headers: adminHdrs });
    const bPage = await rPage.json();
    ok('pagination bounded (limit respected)', bPage.users.length === 2 && bPage.total === 5);

    const rOverLimit = await fetch(`${base}/api/admin/users?limit=99999`, { headers: adminHdrs });
    const bOverLimit = await rOverLimit.json();
    ok('pagination caps an oversized limit request (max 200, but never more than total)', bOverLimit.limit <= 200);

    const raw = JSON.stringify(bList);
    ok('no secret fields leak (passwordHash)', !raw.includes('passwordHash'));
    ok('no secret fields leak (password)', !/"password"\s*:/.test(raw));
    ok('no session/token fields leak', !/sessionToken|refreshToken|csrfToken/i.test(raw));

    const rDetail = await fetch(`${base}/api/admin/users/${free.userId}`, { headers: adminHdrs });
    const bDetail = await rDetail.json();
    ok('user detail owner/admin-authoritative (real memoryFactCount from real store)', bDetail.user.memoryFactCount === 2);
    ok('user detail never contains raw memory fact values', !JSON.stringify(bDetail).includes('note one'));

    const rMissing = await fetch(`${base}/api/admin/users/web:doesNotExist`, { headers: adminHdrs });
    ok('missing user returns 404, not a crash', rMissing.status === 404);
  });

  console.log('\n\u2500\u2500 PRIME \u2500\u2500');
  await withServer(async (base) => {
    const adminHdrs = headers(admin.userId, true, ['admin']);
    const rPrime = await fetch(`${base}/api/admin/prime`, { headers: adminHdrs });
    const bPrime = await rPrime.json();
    ok('free user not visible in Prime-only view', !bPrime.users.some((u) => u.userId === free.userId));
    ok('prime user visible as prime', bPrime.users.some((u) => u.userId === prime.userId && u.plan === 'premium'));
    ok('expired subscription NOT treated as active premium', !bPrime.users.some((u) => u.userId === expired.userId));

    const rDetail = await fetch(`${base}/api/admin/users/${prime.userId}`, { headers: adminHdrs });
    const bDetail = await rDetail.json();
    ok('entitlements match resolver (voice.lara true for real premium)', bDetail.user.entitlements['voice.lara'] === true);
    ok('usage matches usage store', bDetail.user.usageToday.dailyUsed === 1 && bDetail.user.usageToday.dailyLimit === 200);
  });

  console.log('\n\u2500\u2500 USAGE \u2500\u2500');
  await withServer(async (base) => {
    const adminHdrs = headers(admin.userId, true, ['admin']);
    const r = await fetch(`${base}/api/admin/usage`, { headers: adminHdrs });
    const b = await r.json();
    ok('usage totals correct (sum of recorded usage)', b.usage.totalRequestsToday === 1 + 1 + 32);
    const primeRow = b.usage.users.find((u) => u.userId === prime.userId);
    ok('per-user usage correct', primeRow?.dailyUsed === 1);
    const primeUserRow = b.usage.users.find((u) => u.userId === primeUser.userId);
    ok('limit correct (free tier 40)', primeUserRow?.dailyLimit === 40);
    ok('near-limit classification deterministic (32/40 = 80% >= 0.8 threshold)', primeUserRow?.nearLimit === true);
    ok('near-limit threshold is code-defined, not arbitrary', cc.NEAR_LIMIT_THRESHOLD_RATIO === 0.8);
  });

  console.log('\n\u2500\u2500 COSTS \u2500\u2500');
  await withServer(async (base) => {
    const r = await fetch(`${base}/api/admin/costs`, { headers: headers(admin.userId, true, ['admin']) });
    const b = await r.json();
    ok('costs honestly report not-authoritative rather than fabricate a number', b.costs.authoritative === false && b.costs.todayEstimatedCost === null);
  });

  console.log('\n\u2500\u2500 HEALTH \u2500\u2500');
  await withServer(async (base) => {
    const r = await fetch(`${base}/api/admin/health`, { headers: headers(admin.userId, true, ['admin']) });
    const b = await r.json();
    ok('health response bounded (not an unbounded dump)', b.health.services.length > 0 && b.health.services.length < 20);
    const validStatuses = ['healthy', 'degraded', 'unavailable', 'unknown'];
    ok('service statuses use only the valid enum', b.health.services.every((s) => validStatuses.includes(s.status)));
    ok('missing service dependency does not crash the endpoint', r.status === 200);
  });

  console.log('\n\u2500\u2500 AUDIT \u2500\u2500');
  await withServer(async (base) => {
    const adminHdrs = headers(admin.userId, true, ['admin']);
    const r = await fetch(`${base}/api/admin/audit`, { headers: adminHdrs });
    const b = await r.json();
    ok('admin actions are logged and readable', b.events.length === 1 && b.events[0].action === 'test.action');

    const rGuest = await fetch(`${base}/api/admin/audit`, { headers: headers('anonymous:x', false) });
    ok('audit list is admin-only (guest)', rGuest.status === 401);
    const rFree = await fetch(`${base}/api/admin/audit`, { headers: headers(free.userId, true, ['user']) });
    ok('audit list is admin-only (non-admin)', rFree.status === 403);

    const raw = JSON.stringify(b);
    ok('sensitive payload (meta/reason free-text) not exposed in the list view', !('meta' in b.events[0]) && !('reason' in b.events[0]));
  });

  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  rmSync(tmpAcct, { recursive: true, force: true });
  rmSync(tmpSub, { recursive: true, force: true });
  rmSync(tmpMem, { recursive: true, force: true });
  rmSync(tmpAudit, { recursive: true, force: true });
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
