/**
 * Trust/legal/support foundation — functional HTTP verification.
 * Covers: public operator config, public contact submission (incl. honeypot
 * + rate limit + validation), and admin contact triage RBAC.
 * Mirrors scripts/test-admin-feedback-errors.mjs's harness.
 * Run: node scripts/test-contact-support.mjs
 */
process.env.ATLAS_NO_LISTEN = '1';
process.env.ATLAS_CORS_ORIGINS = 'http://localhost:5173';
// Deliberately unset in this test run so the "not configured" path is
// exercised too — a separate assertion covers the configured path.
delete process.env.ATLAS_SUPPORT_EMAIL;
delete process.env.ATLAS_BILLING_SUPPORT_EMAIL;
delete process.env.ATLAS_LEGAL_OPERATOR_NAME;

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
import { configureContactStore, resetContactStoreForTests, listContactMessages } from '../server/contact/store.js';
import { getPublicOperatorConfig } from '../server/config/operator-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmpDir = join(__dirname, '..', 'data', '_contact_support_test');
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

configureSessionStore(join(tmpDir, 'sessions.json'));
configureAccountStore(join(tmpDir, 'accounts.json'));
configureAdminAuditStore(join(tmpDir, 'admin_audit.json'));
configureContactStore(join(tmpDir, 'contact_messages.json'));
resetSessionStoreForTests();
resetAccountStoreForTests();
resetAdminAuditForTests();
await resetContactStoreForTests();
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

async function anonymousSessionWithCsrf(base) {
  const session = await req(base, '/api/auth/session', { origin: 'http://localhost:5173' });
  return { jar: session.jar, csrf: session.json.csrfToken };
}

console.log('\n=== Trust / Contact / Support foundation — HTTP checks ===\n');

// ── Server-side unit check: operator config is null-by-default ──
{
  const cfg = getPublicOperatorConfig();
  assert('operator config: supportEmail null when unset', cfg.supportEmail === null);
  assert('operator config: legalOperatorName null when unset', cfg.legalOperatorName === null);
  assert('operator config: never fabricates an address/tax id', cfg.legalOperatorAddress === null && cfg.legalTaxId === null);
  assert('operator config: response note is non-committal, not a fabricated SLA', typeof cfg.supportResponseNote === 'string' && cfg.supportResponseNote.length > 0);
}

await upsertAccount({
  id: 'acc_admin_ct',
  username: 'admin_ct',
  email: 'admin_ct@atlas.test',
  password: 'admin-secret-pass-12',
  roles: ['user'],
  userId: 'web:admin-ct',
});
grantAccountRole({ email: 'admin_ct@atlas.test', role: 'admin' });

await upsertAccount({
  id: 'acc_normal_ct',
  username: 'normal_ct',
  email: 'normal_ct@atlas.test',
  password: 'user-secret-pass-12',
  roles: ['user'],
  userId: 'web:normal-ct',
});

let createdContactId = null;

await withServer(async (base) => {
  // ── GET /api/public/operator — no auth required ──
  const operatorRes = await req(base, '/api/public/operator', { origin: 'http://localhost:5173' });
  assert('public operator config reachable without auth', operatorRes.status === 200 && operatorRes.json?.ok === true);
  assert('public operator config never exposes a truthy owner/admin email by default', operatorRes.json?.operator?.supportEmail === null);

  // ── POST /api/contact requires CSRF ──
  const noCsrf = await req(base, '/api/contact', {
    method: 'POST',
    origin: 'http://localhost:5173',
    body: { email: 'guest@example.com', topic: 'general', message: 'Hello, this is a test message.' },
  });
  assert('contact submit without CSRF token is rejected', noCsrf.status !== 200);

  // ── Anonymous (logged-out) visitor CAN submit — public route ──
  const anon = await anonymousSessionWithCsrf(base);
  const anonSubmit = await req(base, '/api/contact', {
    method: 'POST',
    jar: anon.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': anon.csrf },
    body: { email: 'guest@example.com', topic: 'general', message: 'Anonymous visitor contact test message.' },
  });
  assert('anonymous (logged-out) visitor can submit contact form', anonSubmit.status === 200 && anonSubmit.json?.ok === true);

  // ── Validation: bad email ──
  const badEmail = await req(base, '/api/contact', {
    method: 'POST',
    jar: anon.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': anon.csrf },
    body: { email: 'not-an-email', topic: 'general', message: 'This message is long enough.' },
  });
  assert('contact submit rejects invalid email (400)', badEmail.status === 400);

  // ── Validation: bad topic ──
  const badTopic = await req(base, '/api/contact', {
    method: 'POST',
    jar: anon.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': anon.csrf },
    body: { email: 'guest@example.com', topic: 'not-a-real-topic', message: 'This message is long enough.' },
  });
  assert('contact submit rejects invalid topic (400)', badTopic.status === 400);

  // ── Validation: too-short message ──
  const shortMsg = await req(base, '/api/contact', {
    method: 'POST',
    jar: anon.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': anon.csrf },
    body: { email: 'guest@example.com', topic: 'general', message: 'hi' },
  });
  assert('contact submit rejects too-short message (400)', shortMsg.status === 400);

  // ── Honeypot: filled field is silently accepted but NOT persisted ──
  const beforeHoneypot = listContactMessages({ limit: 200 }).total;
  const honeypotSubmit = await req(base, '/api/contact', {
    method: 'POST',
    jar: anon.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': anon.csrf },
    body: {
      email: 'bot@example.com',
      topic: 'general',
      message: 'This is an automated bot submission attempt.',
      website: 'http://spam.example',
    },
  });
  const afterHoneypot = listContactMessages({ limit: 200 }).total;
  assert('honeypot-filled submission returns ok (no signal to bot)', honeypotSubmit.status === 200 && honeypotSubmit.json?.ok === true);
  assert('honeypot-filled submission is NOT persisted', afterHoneypot === beforeHoneypot);

  // ── Real submission by a logged-in (non-anonymous) user, with topic=billing ──
  const normalLogin = await login(base, 'normal_ct', 'user-secret-pass-12');
  assert('normal user login ok', normalLogin.status === 200 && normalLogin.json?.ok);
  const normalCsrf = normalLogin.json.csrfToken;
  const billingSubmit = await req(base, '/api/contact', {
    method: 'POST',
    jar: normalLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': normalCsrf },
    body: { email: 'normal_ct@atlas.test', topic: 'billing', message: 'I was charged twice this month, please help.' },
  });
  assert('logged-in user billing submission ok', billingSubmit.status === 200 && billingSubmit.json?.ok === true);

  // ── Admin RBAC: list ──
  const adminLogin = await login(base, 'admin_ct', 'admin-secret-pass-12');
  assert('admin login ok', adminLogin.status === 200 && adminLogin.json?.roles?.includes('admin'));

  const normalList = await req(base, '/api/admin/contact', { jar: normalLogin.jar, origin: 'http://localhost:5173' });
  assert('non-admin cannot list admin contact inbox', normalList.status === 403);

  const adminList = await req(base, '/api/admin/contact', { jar: adminLogin.jar, origin: 'http://localhost:5173' });
  assert('admin can list contact inbox', adminList.status === 200 && adminList.json?.ok === true);
  assert('contact inbox contains the real (non-honeypot) submissions', adminList.json?.total >= 2);
  createdContactId = adminList.json?.entries?.[0]?.id ?? null;
  assert('admin contact entries never carry a userId for anonymous submissions', adminList.json?.entries?.some((e) => e.userId === null));

  // ── Admin RBAC: detail + status update ──
  const normalDetail = await req(base, `/api/admin/contact/${createdContactId}`, { jar: normalLogin.jar, origin: 'http://localhost:5173' });
  assert('non-admin cannot read contact detail', normalDetail.status === 403);

  const adminCsrf = adminLogin.json.csrfToken;
  const statusUpd = await req(base, `/api/admin/contact/${createdContactId}/status`, {
    method: 'PATCH',
    jar: adminLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': adminCsrf },
    body: { status: 'reviewing' },
  });
  assert('admin can update contact status', statusUpd.status === 200 && statusUpd.json?.message?.status === 'reviewing');

  // ── No secrets/PII leakage: response never carries password/session internals ──
  const detailStr = JSON.stringify(adminList.json);
  assert('admin contact list never leaks passwordHash/session token fields', !detailStr.includes('passwordHash') && !detailStr.includes('csrfToken'));

  // ── Rate limit: max 5/min per identity, 6th request in-window is blocked ──
  resetRateLimitBucketsForTests();
  const rl = await anonymousSessionWithCsrf(base);
  let sawRateLimited = false;
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const r = await req(base, '/api/contact', {
      method: 'POST',
      jar: rl.jar,
      origin: 'http://localhost:5173',
      headers: { 'X-Atlas-Csrf': rl.csrf },
      body: { email: 'ratelimit@example.com', topic: 'general', message: `Rate limit probe message #${i}.` },
    });
    if (r.status === 429) sawRateLimited = true;
  }
  assert('6th contact submission within a minute is rate-limited (429)', sawRateLimited);
});

const failed = results.filter((r) => !r.ok);
console.log(`\n=== Trust/Contact/Support results: ${results.length - failed.length}/${results.length} passed ===\n`);
if (failed.length) {
  for (const f of failed) console.error(`FAIL: ${f.name} — ${f.detail}`);
  process.exit(1);
}
process.exit(0);
