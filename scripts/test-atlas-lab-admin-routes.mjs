#!/usr/bin/env node
/**
 * ATLAS LAB admin routes — access control + full real smoke test:
 * message -> response -> trace stored -> trace visible via admin HTTP ->
 * evaluator called manually via admin HTTP -> verdict displayed.
 *
 * Mirrors scripts/test-admin-agentos-bridge.mjs's convention: import the
 * REAL app from server/index.js (via ATLAS_NO_LISTEN=1) and drive it over
 * real HTTP with real cookies/CSRF — the actual route/middleware stack.
 * Run: node scripts/test-atlas-lab-admin-routes.mjs
 * (skips the evaluate-endpoint smoke test if OPENAI_API_KEY is not set)
 */
process.env.ATLAS_NO_LISTEN = '1';
process.env.ATLAS_CORS_ORIGINS = 'http://localhost:5173';
process.env.ATLAS_OWNER_EMAIL = 'owner-test@atlas.test';

import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const {
  configureSessionStore,
  resetSessionStoreForTests,
  configureAccountStore,
  resetAccountStoreForTests,
  upsertAccount,
  configureAdminAuditStore,
  resetAdminAuditForTests,
  resetRateLimitBucketsForTests,
} = await import('../server/auth/index.js');
const { configureAtlasLabTraceStore } = await import('../server/atlas-lab/trace-store.js');
const { processAtlasMessage } = await import('../server/atlas-message-service.js');
const { _resetAllNumerologySessions } = await import('../server/numerology-engine/index.js');

const tmpDir = join(__dirname, '..', 'data', '_atlas_lab_admin_routes_test');
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

configureSessionStore(join(tmpDir, 'sessions.json'));
configureAccountStore(join(tmpDir, 'accounts.json'));
configureAdminAuditStore(join(tmpDir, 'admin_audit.json'));
configureAtlasLabTraceStore(join(tmpDir, 'atlas_lab_traces.json'));
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

await upsertAccount({ id: 'acc_lab_admin', username: 'lab_admin', email: 'lab-admin@atlas.test', password: 'admin-secret-pass-12', roles: ['user', 'admin'], userId: 'web:lab-admin' });
await upsertAccount({ id: 'acc_lab_normal', username: 'lab_normal', email: 'lab-normal@atlas.test', password: 'user-secret-pass-12', roles: ['user'], userId: 'web:lab-normal' });

console.log('\n=== ATLAS LAB admin routes: access control ===\n');

await withServer(async (base) => {
  const anonList = await req(base, '/api/admin/atlas-lab/traces', { origin: 'http://localhost:5173' });
  assert('unauthenticated GET /api/admin/atlas-lab/traces -> 401', anonList.status === 401);

  const anonEval = await req(base, '/api/admin/atlas-lab/traces/req_x/evaluate', { method: 'POST', origin: 'http://localhost:5173' });
  assert('unauthenticated POST .../evaluate -> 401', anonEval.status === 401);

  const normal = await login(base, 'lab_normal', 'user-secret-pass-12');
  const normalList = await req(base, '/api/admin/atlas-lab/traces', { jar: normal.jar, origin: 'http://localhost:5173' });
  assert('non-admin GET /api/admin/atlas-lab/traces -> 403 (admin-only)', normalList.status === 403);

  const normalEval = await req(base, '/api/admin/atlas-lab/traces/req_x/evaluate', { method: 'POST', jar: normal.jar, origin: 'http://localhost:5173' });
  assert('non-admin POST .../evaluate -> 403', normalEval.status === 403);
});

console.log('\n=== ATLAS LAB admin routes: real smoke test (message -> trace -> admin view -> evaluate) ===\n');

_resetAllNumerologySessions();
process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';
const liveResult = await processAtlasMessage(
  {
    message: '27.01.1986 numeroloji analizi yap',
    channel: 'web',
    conversationId: 'atlas-lab-smoke-test',
    userId: 'web:atlas-lab-smoke-user',
    history: [],
  },
  { trustedUserId: 'web:atlas-lab-smoke-user' },
);
const smokeRequestId = liveResult?.data?.requestTiming?.requestId;
assert('smoke: real message produced a response with a requestTiming id', Boolean(smokeRequestId));

await withServer(async (base) => {
  const admin = await login(base, 'lab_admin', 'admin-secret-pass-12');
  assert('admin login succeeded', admin.status === 200);

  const listRes = await req(base, '/api/admin/atlas-lab/traces?channel=web&limit=50', { jar: admin.jar, origin: 'http://localhost:5173' });
  assert('admin GET /api/admin/atlas-lab/traces -> 200', listRes.status === 200);
  assert('trace list contains the real message we just sent', (listRes.json?.traces || []).some((t) => t.requestId === smokeRequestId));

  const oneRes = await req(base, `/api/admin/atlas-lab/traces/${smokeRequestId}`, { jar: admin.jar, origin: 'http://localhost:5173' });
  assert('admin GET single trace -> 200', oneRes.status === 200);
  assert('single trace has the bounded user-message summary', typeof oneRes.json?.trace?.userMessageSummary === 'string' && oneRes.json.trace.userMessageSummary.length > 0);
  assert('single trace carries no chain-of-thought / secret fields', !('reasoning' in (oneRes.json?.trace || {})) && !JSON.stringify(oneRes.json?.trace || {}).toLowerCase().includes('sk-'));

  const missingRes = await req(base, '/api/admin/atlas-lab/traces/req_does_not_exist', { jar: admin.jar, origin: 'http://localhost:5173' });
  assert('admin GET nonexistent trace -> 404', missingRes.status === 404);

  if (process.env.OPENAI_API_KEY) {
    const csrfSession = await req(base, '/api/auth/session', { jar: admin.jar, origin: 'http://localhost:5173' });
    const csrf = csrfSession.json.csrfToken;
    const evalRes = await req(base, `/api/admin/atlas-lab/traces/${smokeRequestId}/evaluate`, {
      method: 'POST',
      jar: admin.jar,
      origin: 'http://localhost:5173',
      headers: { 'X-Atlas-Csrf': csrf },
    });
    assert('admin POST .../evaluate -> 200 (LIVE evaluator call)', evalRes.status === 200, `status=${evalRes.status} body=${JSON.stringify(evalRes.json)}`);
    assert('evaluate response carries a valid verdict', ['PASS', 'WARN', 'FAIL'].includes(evalRes.json?.verdict?.verdict));
    console.log(`  -> verdict=${evalRes.json?.verdict?.verdict} model=${evalRes.json?.model} latencyMs=${evalRes.json?.latencyMs}`);

    const evalMissing = await req(base, '/api/admin/atlas-lab/traces/req_does_not_exist/evaluate', {
      method: 'POST',
      jar: admin.jar,
      origin: 'http://localhost:5173',
      headers: { 'X-Atlas-Csrf': csrf },
    });
    assert('admin POST evaluate on nonexistent trace -> 404', evalMissing.status === 404);
  } else {
    console.log('  (skipping live /evaluate smoke test — OPENAI_API_KEY not set in this environment)');
  }
});

console.log('');
console.log(`ATLAS LAB admin route tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
