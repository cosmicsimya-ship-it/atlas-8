/**
 * Admin Control Center — Feedback & Error/Incident panel verification.
 * Mirrors server/verify-admin.mjs's harness (same auth/session/CSRF flow).
 * Run: node scripts/test-admin-feedback-errors.mjs
 */
process.env.ATLAS_NO_LISTEN = '1';
process.env.ATLAS_CORS_ORIGINS = 'http://localhost:5173';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import { createServer } from 'http';
import {
  configureSessionStore,
  resetSessionStoreForTests,
  configureAccountStore,
  resetAccountStoreForTests,
  upsertAccount,
  grantAccountRole,
  configureAdminAuditStore,
  resetAdminAuditForTests,
  resetRateLimitBucketsForTests,
} from '../server/auth/index.js';
import { configureFeedbackStore, resetFeedbackStoreForTests } from '../server/feedback/store.js';
import { configureErrorLogStore, resetErrorLogStoreForTests } from '../server/admin/error-log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmpDir = join(__dirname, '..', 'data', '_admin_feedback_errors_test');
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

configureSessionStore(join(tmpDir, 'sessions.json'));
configureAccountStore(join(tmpDir, 'accounts.json'));
configureAdminAuditStore(join(tmpDir, 'admin_audit.json'));
configureFeedbackStore(join(tmpDir, 'admin_feedback.json'));
configureErrorLogStore(join(tmpDir, 'admin_errors.json'));
resetSessionStoreForTests();
resetAccountStoreForTests();
resetAdminAuditForTests();
await resetFeedbackStoreForTests();
await resetErrorLogStoreForTests();
resetRateLimitBucketsForTests();

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}
function assert(name, condition, detail = '') {
  if (condition) pass(name, detail);
  else fail(name, detail);
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
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
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
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(jar),
      ...(origin ? { Origin: origin } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.raw?.()['set-cookie'];
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
  const loginRes = await req(base, '/api/auth/login', {
    method: 'POST',
    jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': csrf },
    body: { username, password },
  });
  return loginRes;
}

async function csrfFor(base, jar) {
  return (await req(base, '/api/auth/session', { jar, origin: 'http://localhost:5173' })).json.csrfToken;
}

console.log('\n=== Feedback & Error panel HTTP checks ===\n');

await upsertAccount({
  id: 'acc_admin_fe',
  username: 'admin_fe',
  email: 'admin_fe@atlas.test',
  password: 'admin-secret-pass-12',
  roles: ['user'],
  userId: 'web:admin-fe',
});
grantAccountRole({ email: 'admin_fe@atlas.test', role: 'admin' });

await upsertAccount({
  id: 'acc_normal_fe',
  username: 'normal_fe',
  email: 'normal_fe@atlas.test',
  password: 'user-secret-pass-12',
  roles: ['user'],
  userId: 'web:normal-fe',
});

let createdFeedbackId = null;

await withServer(async (base) => {
  const normalLogin = await login(base, 'normal_fe', 'user-secret-pass-12');
  assert('normal login ok', normalLogin.status === 200 && normalLogin.json?.ok);
  const adminLogin = await login(base, 'admin_fe', 'admin-secret-pass-12');
  assert('admin login ok', adminLogin.status === 200 && adminLogin.json?.roles?.includes('admin'));

  // --- RBAC: feedback list is admin-only ---
  const normalFeedbackList = await req(base, '/api/admin/feedback', { jar: normalLogin.jar, origin: 'http://localhost:5173' });
  assert('non-admin cannot list admin feedback', normalFeedbackList.status === 403);

  const adminFeedbackList = await req(base, '/api/admin/feedback', { jar: adminLogin.jar, origin: 'http://localhost:5173' });
  assert('admin can list feedback', adminFeedbackList.status === 200 && adminFeedbackList.json?.ok === true);

  // --- RBAC: errors list is admin-only ---
  const normalErrorsList = await req(base, '/api/admin/errors', { jar: normalLogin.jar, origin: 'http://localhost:5173' });
  assert('non-admin cannot list admin errors', normalErrorsList.status === 403);

  const adminErrorsList = await req(base, '/api/admin/errors', { jar: adminLogin.jar, origin: 'http://localhost:5173' });
  assert('admin can list errors', adminErrorsList.status === 200 && adminErrorsList.json?.ok === true);

  // --- Feedback create (any authenticated non-anonymous user) ---
  const normalCsrf = await csrfFor(base, normalLogin.jar);
  const createRes = await req(base, '/api/feedback', {
    method: 'POST',
    jar: normalLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': normalCsrf },
    body: { type: 'bug', message: 'Prime paywall flashes twice', route: '/prime' },
  });
  assert('feedback create ok (200)', createRes.status === 200 && createRes.json?.ok === true);
  createdFeedbackId = createRes.json?.feedback?.id ?? null;
  assert('feedback create returns new status', createRes.json?.feedback?.status === 'new');

  // --- invalid payload rejection ---
  const badCreate = await req(base, '/api/feedback', {
    method: 'POST',
    jar: normalLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': normalCsrf },
    body: { type: 'not-a-real-type', message: 'x' },
  });
  assert('feedback create rejects invalid type (400)', badCreate.status === 400);

  const emptyCreate = await req(base, '/api/feedback', {
    method: 'POST',
    jar: normalLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': normalCsrf },
    body: { type: 'bug', message: '' },
  });
  assert('feedback create rejects empty message (400)', emptyCreate.status === 400);

  // --- non-admin cannot submit-as-admin-triage (status/priority/note are admin-only) ---
  const normalPatchStatus = await req(base, `/api/admin/feedback/${createdFeedbackId}/status`, {
    method: 'PATCH',
    jar: normalLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': normalCsrf },
    body: { status: 'resolved' },
  });
  assert('non-admin cannot update feedback status', normalPatchStatus.status === 403);

  // --- admin status/priority/note updates ---
  const adminCsrf = await csrfFor(base, adminLogin.jar);

  const statusUpd = await req(base, `/api/admin/feedback/${createdFeedbackId}/status`, {
    method: 'PATCH',
    jar: adminLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': adminCsrf },
    body: { status: 'reviewing' },
  });
  assert('admin feedback status update ok', statusUpd.status === 200 && statusUpd.json?.feedback?.status === 'reviewing');

  const badStatusUpd = await req(base, `/api/admin/feedback/${createdFeedbackId}/status`, {
    method: 'PATCH',
    jar: adminLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': adminCsrf },
    body: { status: 'not-a-status' },
  });
  assert('admin feedback status rejects invalid enum (400)', badStatusUpd.status === 400);

  const priorityUpd = await req(base, `/api/admin/feedback/${createdFeedbackId}/priority`, {
    method: 'PATCH',
    jar: adminLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': adminCsrf },
    body: { priority: 'high' },
  });
  assert('admin feedback priority update ok', priorityUpd.status === 200 && priorityUpd.json?.feedback?.priority === 'high');

  const noteUpd = await req(base, `/api/admin/feedback/${createdFeedbackId}/note`, {
    method: 'PATCH',
    jar: adminLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': adminCsrf },
    body: { note: 'confirmed, filed as ATL-142' },
  });
  assert('admin feedback note update ok', noteUpd.status === 200 && noteUpd.json?.feedback?.adminNote === 'confirmed, filed as ATL-142');

  const resolvedUpd = await req(base, `/api/admin/feedback/${createdFeedbackId}/status`, {
    method: 'PATCH',
    jar: adminLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': adminCsrf },
    body: { status: 'resolved' },
  });
  assert('admin feedback resolved flow ok', resolvedUpd.status === 200 && resolvedUpd.json?.feedback?.status === 'resolved');

  // --- forbidden authority-field spoofing rejected on writes ---
  const spoofAttempt = await req(base, `/api/admin/feedback/${createdFeedbackId}/status`, {
    method: 'PATCH',
    jar: adminLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': adminCsrf },
    body: { status: 'new', role: 'admin' },
  });
  assert('admin write rejects spoofed authority field', spoofAttempt.status === 400);

  // --- error report + duplicate fingerprint/count + resolved flow ---
  const err1 = await req(base, '/api/admin/errors/report', {
    method: 'POST',
    jar: adminLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': adminCsrf },
    body: { source: 'admin_manual', severity: 'warning', code: 'TEST_INCIDENT', message: 'voice synth degraded, token=abc123', route: '/api/voice/speak' },
  });
  assert('error report create ok', err1.status === 200 && err1.json?.ok === true && err1.json?.error?.occurrenceCount === 1);
  assert('error report redacts secret at rest', !String(err1.json?.error?.safeMessage ?? '').includes('abc123'));
  const errorId = err1.json?.error?.id;

  const err2 = await req(base, '/api/admin/errors/report', {
    method: 'POST',
    jar: adminLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': adminCsrf },
    body: { source: 'admin_manual', severity: 'warning', code: 'TEST_INCIDENT', message: 'voice synth degraded, token=abc123', route: '/api/voice/speak' },
  });
  assert('duplicate error fingerprint increments occurrenceCount', err2.status === 200 && err2.json?.error?.occurrenceCount === 2 && err2.json?.error?.id === errorId);

  const errStatusUpd = await req(base, `/api/admin/errors/${errorId}/status`, {
    method: 'PATCH',
    jar: adminLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': adminCsrf },
    body: { status: 'resolved' },
  });
  assert('admin error resolved flow ok', errStatusUpd.status === 200 && errStatusUpd.json?.error?.status === 'resolved');

  const normalErrorReport = await req(base, '/api/admin/errors/report', {
    method: 'POST',
    jar: normalLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': normalCsrf },
    body: { source: 'admin_manual', severity: 'info', code: 'X', message: 'x' },
  });
  assert('non-admin cannot report errors', normalErrorReport.status === 403);

  // --- overview surfaces the new counts ---
  const overview = await req(base, '/api/admin/overview', { jar: adminLogin.jar, origin: 'http://localhost:5173' });
  assert(
    'overview exposes feedback/error counts and backend health',
    overview.status === 200 &&
      typeof overview.json?.overview?.openFeedbackCount === 'number' &&
      typeof overview.json?.overview?.openErrorCount === 'number' &&
      typeof overview.json?.overview?.backendStatus === 'string',
  );
});

const failed = results.filter((r) => !r.ok);
console.log(`\n=== Feedback/Error results: ${results.length - failed.length}/${results.length} passed ===\n`);
if (failed.length) {
  for (const f of failed) console.error(`FAIL: ${f.name} — ${f.detail}`);
  process.exit(1);
}
process.exit(0);
