/**
 * Admin access layer verification.
 * Run: node server/verify-admin.mjs
 */
process.env.ATLAS_NO_LISTEN = '1';
process.env.ATLAS_CORS_ORIGINS = 'http://localhost:5173';

import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import {
  configureSessionStore,
  resetSessionStoreForTests,
  configureAccountStore,
  resetAccountStoreForTests,
  upsertAccount,
  grantAccountRole,
  findAccountByEmail,
  findAccountByUsername,
  configureAdminAuditStore,
  resetAdminAuditForTests,
  resetRateLimitBucketsForTests,
} from './auth/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmpDir = join(__dirname, '..', 'data', '_admin_test');
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

configureSessionStore(join(tmpDir, 'sessions.json'));
configureAccountStore(join(tmpDir, 'accounts.json'));
configureAdminAuditStore(join(tmpDir, 'admin_audit.json'));
resetSessionStoreForTests();
resetAccountStoreForTests();
resetAdminAuditForTests();
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

const { app } = await import('./index.js');

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

console.log('\n=== Admin unit checks ===\n');

await upsertAccount({
  id: 'acc_admin_user',
  username: 'admin_user',
  email: 'admin@atlas.test',
  password: 'admin-secret-pass-12',
  roles: ['user'],
  userId: 'web:admin-user',
});

await upsertAccount({
  id: 'acc_normal_user',
  username: 'normal_user',
  email: 'user@atlas.test',
  password: 'user-secret-pass-12',
  roles: ['user'],
  userId: 'web:normal-user',
});

{
  let threw = false;
  let code = '';
  try {
    grantAccountRole({ email: 'missing@atlas.test', role: 'admin' });
  } catch (err) {
    threw = true;
    code = err.code || err.message;
  }
  assert('CLI grant unknown user errors', threw && code === 'account_not_found');
  assert('unknown user path throws before mutation', threw);
}

{
  const result = grantAccountRole({ email: 'admin@atlas.test', role: 'admin' });
  assert('CLI role grant successful', result.rolesAfter.includes('admin') && !result.alreadyHadRole);
  const acc = findAccountByEmail('admin@atlas.test');
  assert('account has admin role', acc?.roles?.includes('admin'));
  assert('password hash unchanged shape', Boolean(acc?.passwordHash?.startsWith('$2')));
  assert('no plaintext password field', !('password' in (acc ?? {})));
}

{
  const again = grantAccountRole({ email: 'admin@atlas.test', role: 'admin' });
  assert('idempotent grant', again.alreadyHadRole && again.rolesAfter.filter((r) => r === 'admin').length === 1);
}

console.log('\n=== Admin HTTP checks ===\n');

await withServer(async (base) => {
  const anon = await req(base, '/api/admin/me', { origin: 'http://localhost:5173' });
  assert('unauthenticated admin/me → 401', anon.status === 401);

  const sessionOnly = await req(base, '/api/auth/session', { origin: 'http://localhost:5173' });
  const anonMe = await req(base, '/api/admin/me', {
    jar: sessionOnly.jar,
    origin: 'http://localhost:5173',
  });
  assert('anonymous session admin/me → 401', anonMe.status === 401);

  const normalLogin = await login(base, 'normal_user', 'user-secret-pass-12');
  assert('normal login ok', normalLogin.status === 200 && normalLogin.json?.ok);
  const normalMe = await req(base, '/api/admin/me', {
    jar: normalLogin.jar,
    origin: 'http://localhost:5173',
  });
  assert('normal user admin/me → 403', normalMe.status === 403);

  const adminLogin = await login(base, 'admin_user', 'admin-secret-pass-12');
  assert('admin login ok', adminLogin.status === 200 && adminLogin.json?.roles?.includes('admin'));
  const adminMe = await req(base, '/api/admin/me', {
    jar: adminLogin.jar,
    origin: 'http://localhost:5173',
  });
  assert('admin access succeeds', adminMe.status === 200 && adminMe.json?.ok === true);
  assert('admin/me returns safe profile', adminMe.json?.username === 'admin_user');
  assert('admin/me has roles', Array.isArray(adminMe.json?.roles) && adminMe.json.roles.includes('admin'));
  assert(
    'admin/me has no password hash',
    !('passwordHash' in (adminMe.json ?? {})) && !('password' in (adminMe.json ?? {})),
  );

  const selfRolePost = await req(base, '/api/me/roles', {
    method: 'POST',
    jar: normalLogin.jar,
    origin: 'http://localhost:5173',
    headers: { 'X-Atlas-Csrf': (await req(base, '/api/auth/session', { jar: normalLogin.jar, origin: 'http://localhost:5173' })).json.csrfToken },
    body: { roles: ['admin'] },
  });
  assert('user cannot change own roles via API', selfRolePost.status === 405);

  const adminRolesPost = await req(base, '/api/admin/roles', {
    method: 'POST',
    jar: adminLogin.jar,
    origin: 'http://localhost:5173',
    headers: {
      'X-Atlas-Csrf': (
        await req(base, '/api/auth/session', {
          jar: adminLogin.jar,
          origin: 'http://localhost:5173',
        })
      ).json.csrfToken,
    },
    body: { email: 'user@atlas.test', roles: ['admin'] },
  });
  assert('no HTTP role grant endpoint', adminRolesPost.status === 405);

  const stillNormal = findAccountByUsername('normal_user');
  assert('normal user roles unchanged', !stillNormal?.roles?.includes('admin'));
});

const failed = results.filter((r) => !r.ok);
console.log(`\n=== Admin results: ${results.length - failed.length}/${results.length} passed ===\n`);
if (failed.length) {
  for (const f of failed) console.error(`FAIL: ${f.name} — ${f.detail}`);
  process.exit(1);
}
process.exit(0);
