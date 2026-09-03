#!/usr/bin/env node
/**
 * ATLAS Admin <-> AgentOS bridge + primary-owner bootstrap regression.
 * Run: node scripts/test-admin-agentos-bridge.mjs
 *
 * Mirrors server/verify-admin.mjs's convention: import the REAL app from
 * server/index.js (via ATLAS_NO_LISTEN=1) and drive it over real HTTP with
 * real cookies/CSRF, rather than a hand-rolled mini-app - this is the actual
 * route/middleware stack, not a simulation of it. AgentOS itself is mocked
 * with a tiny local HTTP server shaped like its real API, so this test never
 * depends on a real AgentOS process being up, and can deterministically
 * exercise the unreachable/timeout/duplicate-sweep paths.
 */
process.env.ATLAS_NO_LISTEN = '1';
process.env.ATLAS_CORS_ORIGINS = 'http://localhost:5173';
process.env.ATLAS_OWNER_EMAIL = 'owner-test@atlas.test';

import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import net from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dynamic import (not a static `import ... from`): static imports are
// hoisted and would evaluate account-store.js - reading
// process.env.ATLAS_OWNER_EMAIL into its module-level OWNER_EMAIL constant -
// BEFORE the env var assignment above ever ran. A dynamic import executes
// exactly at this point in program order instead, matching the same
// deliberate pattern verify-admin.mjs already uses for ATLAS_NO_LISTEN.
const {
  configureSessionStore,
  resetSessionStoreForTests,
  configureAccountStore,
  resetAccountStoreForTests,
  upsertAccount,
  findAccountByEmail,
  findOrProvisionGoogleAccount,
  configureAdminAuditStore,
  resetAdminAuditForTests,
  resetRateLimitBucketsForTests,
  listAdminAuditEvents,
} = await import('../server/auth/index.js');
const tmpDir = join(__dirname, '..', 'data', '_admin_agentos_bridge_test');
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

configureSessionStore(join(tmpDir, 'sessions.json'));
configureAccountStore(join(tmpDir, 'accounts.json'));
configureAdminAuditStore(join(tmpDir, 'admin_audit.json'));
resetSessionStoreForTests();
resetAccountStoreForTests();
resetAdminAuditForTests();
resetRateLimitBucketsForTests();

let passed = 0;
let failed = 0;
function assert(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const { app } = await import('../server/index.js');

function parseCookies(setCookieHeaders) {
  const jar = {};
  for (const h of setCookieHeaders || []) {
    const part = String(h).split(';')[0];
    const eq = part.indexOf('=');
    if (eq > 0) jar[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return jar;
}
function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}
async function withServer(fn) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
async function req(base, path, { method = 'GET', body, jar = {}, headers = {}, origin } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(jar), ...(origin ? { Origin: origin } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : res.headers.raw?.()['set-cookie'];
  const newJar = { ...jar, ...parseCookies(setCookie || []) };
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, jar: newJar };
}
async function login(base, username, password) {
  const session = await req(base, '/api/auth/session', { origin: 'http://localhost:5173' });
  const jar = session.jar;
  const csrf = session.json.csrfToken;
  return req(base, '/api/auth/login', { method: 'POST', jar, origin: 'http://localhost:5173', headers: { 'X-Atlas-Csrf': csrf }, body: { username, password } });
}

// ---- a minimal mock of AgentOS's real Control Surface API ----
function startMockAgentOs({ summaryStatus = 200, sweepBehavior = 'ok', hang = false } = {}) {
  const requestedPaths = [];
  const server = createServer((httpReq, res) => {
    requestedPaths.push(`${httpReq.method} ${httpReq.url}`);
    if (hang) return; // never respond - exercises the bridge's own timeout
    if (httpReq.method === 'GET' && httpReq.url === '/api/summary') {
      res.writeHead(summaryStatus, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        generatedAt: new Date().toISOString(),
        mode: 'read-only',
        overall: { overall_pct: 87, coverage_pct: 100, overall_confidence: 'high' },
        lastFullSweep: { generatedAt: new Date().toISOString(), reportPath: 'state/reports/daily-mock.md' },
        dataFreshness: new Date().toISOString(),
        agents: [{ agent_id: 'agentos-orchestrator', name: 'Orchestrator', status: 'idle', state: 'idle', operational: true, health: 'healthy', implemented: true }],
        agentSummary: { total: 4, operational: 4, running: 0, failed: 0, unavailable: 0, disabled: 0 },
        qa: { pass: 10, fail: 1, lastRunAt: new Date().toISOString() },
        feedback: { rawCount: 0, themeCount: 0 },
        errors: { count: 0 },
        blockers: ['mock blocker'],
        reportHistory: { count: 3, latestFilename: 'daily-mock.md' },
        recommendations: [],
        humanRecommendations: [{ title: 'Mock: an unmet completion requirement', explanation: 'Mock explanation.', domain: 'Mock', domainId: 'mock', severity: 'high', confidence: 'high', score: 0.5, evidenceSource: '1 evidence-backed finding(s)', evidenceRefs: [], technicalDetails: [{ text: 'raw mock detail', score: 0.5, evidenceRef: null }] }],
        sweep: { status: 'idle', phase: null },
      }));
    }
    if (httpReq.method === 'POST' && httpReq.url === '/api/sweep/run') {
      if (sweepBehavior === 'duplicate') {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ started: false, job: { status: 'running' } }));
      }
      res.writeHead(202, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ started: true, job: { status: 'running' } }));
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, requestedPaths, baseUrl: `http://127.0.0.1:${server.address().port}` }));
  });
}

console.log('\n=== Primary-owner bootstrap (account-store.js) ===\n');

{
  const acc = await findOrProvisionGoogleAccount({ googleSub: 'g-owner-1', email: 'owner-test@atlas.test', emailVerified: true, displayName: 'Owner' });
  assert('primary owner email is granted admin on first login', acc.roles.includes('admin'));
  assert('primary owner email is granted owner on first login', acc.roles.includes('owner'));
}

{
  // Exact normalized-email comparison: different case/whitespace still
  // matches. Same googleSub as the first login (the same real Google
  // account) - a differently-cased email string here only exercises
  // normalizeEmail(), not the separate "email already linked to a
  // different Google identity" conflict guard.
  const acc = await findOrProvisionGoogleAccount({ googleSub: 'g-owner-1', email: '  Owner-Test@ATLAS.test  ', emailVerified: true });
  assert('owner match is case/whitespace-insensitive via normalizeEmail (same account)', acc.email === 'owner-test@atlas.test');
  assert('owner match is case/whitespace-insensitive via normalizeEmail (still owner)', acc.roles.includes('owner'));
}

{
  const acc = await findOrProvisionGoogleAccount({ googleSub: 'g-other-1', email: 'not-the-owner@atlas.test', emailVerified: true });
  assert('a non-owner email is never granted owner', !acc.roles.includes('owner'));
  assert('a non-owner email is never granted admin just for logging in', !acc.roles.includes('admin'));
  assert('a non-owner email still gets the normal default role', acc.roles.includes('user'));
}

{
  const before = await findOrProvisionGoogleAccount({ googleSub: 'g-owner-1', email: 'owner-test@atlas.test', emailVerified: true });
  const again = await findOrProvisionGoogleAccount({ googleSub: 'g-owner-1', email: 'owner-test@atlas.test', emailVerified: true });
  assert('repeated owner login is idempotent (no duplicate roles)', again.roles.filter((r) => r === 'owner').length === 1 && again.roles.filter((r) => r === 'admin').length === 1);
  void before;
}

{
  const events = listAdminAuditEvents({ limit: 50 }).filter((e) => e.actor === 'system:owner-bootstrap');
  assert('owner-role bootstrap is audit-logged', events.length >= 1);
  assert('audit event never contains a password/secret field', events.every((e) => !('password' in e) && !('passwordHash' in e)));
}

{
  // An unverified email must never be trusted, owner or not - this is the
  // exact same guard findOrProvisionGoogleAccount already enforces for
  // everyone; confirms the owner bootstrap adds no bypass.
  let threw = false;
  try {
    await findOrProvisionGoogleAccount({ googleSub: 'g-owner-3', email: 'owner-test@atlas.test', emailVerified: false });
  } catch (err) {
    threw = err.code === 'google_email_unverified';
  }
  assert('unverified email is rejected even for the owner address', threw);
}

console.log('\n=== Admin bridge HTTP: auth gating ===\n');

await upsertAccount({ id: 'acc_bridge_admin', username: 'bridge_admin', email: 'bridge-admin@atlas.test', password: 'admin-secret-pass-12', roles: ['user', 'admin'], userId: 'web:bridge-admin' });
await upsertAccount({ id: 'acc_bridge_normal', username: 'bridge_normal', email: 'bridge-normal@atlas.test', password: 'user-secret-pass-12', roles: ['user'], userId: 'web:bridge-normal' });

await withServer(async (base) => {
  const anon = await req(base, '/api/admin/agentos', { origin: 'http://localhost:5173' });
  assert('unauthenticated GET /api/admin/agentos -> 401', anon.status === 401);

  const anonSweep = await req(base, '/api/admin/agentos/sweep', { method: 'POST', origin: 'http://localhost:5173' });
  assert('unauthenticated POST /api/admin/agentos/sweep -> 401', anonSweep.status === 401);

  const normal = await login(base, 'bridge_normal', 'user-secret-pass-12');
  const normalRes = await req(base, '/api/admin/agentos', { jar: normal.jar, origin: 'http://localhost:5173' });
  assert('non-admin GET /api/admin/agentos -> 403 (Operations is admin-only)', normalRes.status === 403);

  const normalSweep = await req(base, '/api/admin/agentos/sweep', { method: 'POST', jar: normal.jar, origin: 'http://localhost:5173' });
  assert('non-admin POST /api/admin/agentos/sweep -> 403', normalSweep.status === 403);
});

console.log('\n=== Admin bridge HTTP: AgentOS reachable ===\n');

{
  const mock = await startMockAgentOs({});
  process.env.ATLAS_AGENTOS_BASE_URL = mock.baseUrl;
  await withServer(async (base) => {
    const admin = await login(base, 'bridge_admin', 'admin-secret-pass-12');
    const res = await req(base, '/api/admin/agentos', { jar: admin.jar, origin: 'http://localhost:5173' });
    assert('admin GET /api/admin/agentos -> 200', res.status === 200);
    assert('AgentOS status loads correctly (reachable:true)', res.json?.reachable === true);
    assert('summary carries overall completion', res.json?.summary?.overall?.overall_pct === 87);
    assert('summary carries operational agent counts', res.json?.summary?.agentSummary?.operational === 4);
    assert('summary carries report history', res.json?.summary?.reportHistory?.count === 3);
    assert('summary carries human-readable recommendation, not just raw', typeof res.json?.summary?.humanRecommendations?.[0]?.title === 'string');
    assert('no secret leakage: base URL / env value never appears in the response body', !JSON.stringify(res.json).includes(mock.baseUrl.replace('http://', '')));
  });
  await new Promise((resolve) => mock.server.close(resolve));
}

console.log('\n=== Admin bridge HTTP: AgentOS unavailable (graceful failure) ===\n');

{
  process.env.ATLAS_AGENTOS_BASE_URL = 'http://127.0.0.1:1'; // nothing listens on port 1
  await withServer(async (base) => {
    const admin = await login(base, 'bridge_admin', 'admin-secret-pass-12');
    const res = await req(base, '/api/admin/agentos', { jar: admin.jar, origin: 'http://localhost:5173' });
    assert('AgentOS-unavailable still returns 200, never a hang/crash', res.status === 200);
    assert('AgentOS-unavailable state is explicit (reachable:false)', res.json?.reachable === false);
    assert('a clear reason is given, never invented data', typeof res.json?.reason === 'string' && res.json.reason.length > 0);
  });
}

console.log('\n=== Admin bridge HTTP: timeout handling ===\n');

{
  // A raw TCP listener that accepts the connection but never writes a
  // response - the bridge's own AbortController must fire, not hang forever.
  const hangSockets = [];
  const hangServer = net.createServer((socket) => {
    hangSockets.push(socket); // deliberately never respond; destroyed explicitly below
  });
  await new Promise((resolve) => hangServer.listen(0, '127.0.0.1', resolve));
  process.env.ATLAS_AGENTOS_BASE_URL = `http://127.0.0.1:${hangServer.address().port}`;
  await withServer(async (base) => {
    const admin = await login(base, 'bridge_admin', 'admin-secret-pass-12');
    const startedAt = Date.now();
    const res = await req(base, '/api/admin/agentos', { jar: admin.jar, origin: 'http://localhost:5173' });
    const elapsedMs = Date.now() - startedAt;
    assert('a hung AgentOS connection times out rather than hanging indefinitely', elapsedMs < 6000, `took ${elapsedMs}ms`);
    assert('timeout is surfaced as reachable:false with a timeout reason', res.json?.reachable === false && /time/i.test(res.json?.reason || ''));
  });
  for (const socket of hangSockets) socket.destroy(); // force-close, or hangServer.close() below never settles
  await new Promise((resolve) => hangServer.close(resolve));
}

console.log('\n=== Admin bridge HTTP: no arbitrary proxy target ===\n');

{
  const mock = await startMockAgentOs({});
  process.env.ATLAS_AGENTOS_BASE_URL = mock.baseUrl;
  await withServer(async (base) => {
    const admin = await login(base, 'bridge_admin', 'admin-secret-pass-12');
    // Attempt to smuggle an alternate target/path via query string and body -
    // the bridge takes no such input anywhere, so these must be silently ignored.
    await req(base, '/api/admin/agentos?path=/etc/passwd&url=http://evil.example', { jar: admin.jar, origin: 'http://localhost:5173' });
    await req(base, '/api/admin/agentos/sweep?path=/api/state', { method: 'POST', jar: admin.jar, origin: 'http://localhost:5173', headers: { 'X-Atlas-Csrf': admin.json?.csrfToken || '' } });
    const onlyAllowed = mock.requestedPaths.every((p) => p === 'GET /api/summary' || p === 'POST /api/sweep/run');
    assert('AgentOS mock only ever received the two allowlisted calls, regardless of client-supplied query params', onlyAllowed, mock.requestedPaths.join(', '));
  });
  await new Promise((resolve) => mock.server.close(resolve));
}

console.log('\n=== Admin bridge HTTP: Run Full Sweep + duplicate protection ===\n');

{
  const mock = await startMockAgentOs({ sweepBehavior: 'ok' });
  process.env.ATLAS_AGENTOS_BASE_URL = mock.baseUrl;
  await withServer(async (base) => {
    const sessionForCsrf = await req(base, '/api/auth/session', { origin: 'http://localhost:5173' });
    const admin = await login(base, 'bridge_admin', 'admin-secret-pass-12');
    const csrf = sessionForCsrf.json.csrfToken;
    void csrf;
    const adminSession = await req(base, '/api/auth/session', { jar: admin.jar, origin: 'http://localhost:5173' });
    const adminCsrf = adminSession.json.csrfToken;

    const first = await req(base, '/api/admin/agentos/sweep', { method: 'POST', jar: admin.jar, origin: 'http://localhost:5173', headers: { 'X-Atlas-Csrf': adminCsrf } });
    assert('admin can trigger Run Full Sweep via the bridge', first.status === 200 && first.json?.started === true);
  });
  await new Promise((resolve) => mock.server.close(resolve));
}

{
  const mock = await startMockAgentOs({ sweepBehavior: 'duplicate' });
  process.env.ATLAS_AGENTOS_BASE_URL = mock.baseUrl;
  await withServer(async (base) => {
    const admin = await login(base, 'bridge_admin', 'admin-secret-pass-12');
    const adminSession = await req(base, '/api/auth/session', { jar: admin.jar, origin: 'http://localhost:5173' });
    const adminCsrf = adminSession.json.csrfToken;
    const res = await req(base, '/api/admin/agentos/sweep', { method: 'POST', jar: admin.jar, origin: 'http://localhost:5173', headers: { 'X-Atlas-Csrf': adminCsrf } });
    assert('AgentOS-side duplicate-sweep guard (409) is surfaced as started:false, not an error', res.status === 200 && res.json?.reachable === true && res.json?.started === false);
  });
  await new Promise((resolve) => mock.server.close(resolve));
}

console.log('\n=== Frontend responsive smoke check (static) ===\n');

{
  const fs = await import('fs');
  const panelSrc = fs.readFileSync(join(__dirname, '..', 'src', 'components', 'admin', 'AdminAgentOsPanel.tsx'), 'utf8');
  assert('panel uses a responsive grid (mobile default, sm: breakpoint for wider)', /grid-cols-2/.test(panelSrc) && /sm:grid-cols-4/.test(panelSrc));
  assert('panel renders the exact required AgentOS-unavailable message', panelSrc.includes('AgentOS şu anda bağlı değil.') && panelSrc.includes('Son doğrulanmış operasyon verileri gösterilemiyor.'));
  assert('panel never renders raw zero feedback/errors as if verified without saying so', panelSrc.includes('doğrulanmış — boş'));

  const controlCenterSrc = fs.readFileSync(join(__dirname, '..', 'src', 'components', 'admin', 'AdminControlCenter.tsx'), 'utf8');
  assert('Operations tab exists and is registered as the default admin landing tab', /useState<Tab>\('agentos'\)/.test(controlCenterSrc));
  assert('existing admin sections (Feedback/Errors/Users/etc.) remain registered alongside Operations', ['feedback', 'errors', 'users', 'usage', 'costs', 'analytics', 'health', 'audit'].every((t) => controlCenterSrc.includes(`id: '${t}'`)));
}

console.log(`\nTotal: ${passed} passed, ${failed} failed\n`);

const fsCleanup = await import('fs');
fsCleanup.rmSync(tmpDir, { recursive: true, force: true });
process.exit(failed > 0 ? 1 : 0);
