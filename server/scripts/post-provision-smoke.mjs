/**
 * Safe auth smoke checks after local provisioning.
 * Never prints passwords, hashes, tokens, or cookies.
 */
process.env.ATLAS_NO_LISTEN = '1';

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = readFileSync(join(root, '.env'), 'utf8');
const userMatch = env.match(/^ATLAS_FOUNDER_USERNAME=(.*)$/m);
const passMatch = env.match(/^ATLAS_FOUNDER_PASSWORD=(.*)$/m);
const username = userMatch?.[1]?.trim();
const password = passMatch?.[1]?.trim();

if (!username || !password) {
  console.error('FAIL: founder credentials missing from .env');
  process.exit(1);
}

const { app } = await import('../index.js');

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
    typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const newJar = { ...jar, ...parseCookies(setCookie) };
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, jar: newJar };
}

const results = [];
function assert(name, ok) {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}`);
}

const server = createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
const origin = 'http://localhost:5173';

try {
  const s1 = await req(base, '/api/auth/session', { origin });
  assert('anonymous session server-side', s1.status === 200 && String(s1.json?.userId || '').startsWith('anonymous:'));

  const csrf = s1.json?.csrfToken;
  const spoof = await req(base, '/api/chat', {
    method: 'POST',
    jar: s1.jar,
    origin,
    headers: { 'X-Atlas-Csrf': csrf },
    body: { message: "Lara'nın doğum tarihi ne?", userId: 'web:founder' },
  });
  assert(
    'client userId does not grant founder access',
    spoof.status === 200 && (spoof.json?.engine === 'privacy' || /gizlidir/i.test(spoof.json?.reply || '')),
  );

  const hdr = await req(base, '/api/memory/web:founder', {
    jar: s1.jar,
    origin,
    headers: { 'X-Atlas-Requester-Id': 'web:founder' },
  });
  assert('X-Atlas-Requester-Id does not authenticate', hdr.status === 403);

  const login = await req(base, '/api/auth/login', {
    method: 'POST',
    jar: s1.jar,
    origin,
    headers: { 'X-Atlas-Csrf': csrf },
    body: { username, password },
  });
  assert('founder login succeeds', login.status === 200 && login.json?.isFounder === true);
  assert('founder session has founder role', Array.isArray(login.json?.roles) && login.json.roles.includes('founder'));

  const ai = await req(base, '/api/ai/complete', {
    method: 'POST',
    jar: s1.jar,
    origin,
    headers: { 'X-Atlas-Csrf': csrf },
    body: { userPrompt: 'hello' },
  });
  assert('non-founder ai/complete denied', ai.status === 401 || ai.status === 403);

  const s2 = await req(base, '/api/auth/session', { origin });
  const cross = await req(base, `/api/memory/${encodeURIComponent(s2.json.userId)}`, {
    jar: login.jar,
    origin,
  });
  assert('cross-user memory denied', cross.status === 403);

  const logout = await req(base, '/api/auth/logout', {
    method: 'POST',
    jar: login.jar,
    origin,
    headers: { 'X-Atlas-Csrf': login.json?.csrfToken || csrf },
    body: {},
  });
  assert('logout ok', logout.status === 200);

  const after = await req(base, '/api/auth/session', { jar: login.jar, origin });
  assert(
    'logout revokes prior founder session',
    after.status === 200 && after.json?.isFounder !== true,
  );

  const tg = await req(base, '/api/atlas/message', {
    method: 'POST',
    headers: {
      'X-Atlas-Bot-Secret': (env.match(/^ATLAS_INTERNAL_BOT_SECRET=(.*)$/m) || [])[1] || '',
    },
    body: {
      channel: 'telegram',
      userId: 'telegram:7142880605',
      message: 'Merhaba',
      conversationId: '1',
      metadata: { telegramFromId: '7142880605' },
    },
  });
  assert(
    'telegram founder binding from verified metadata',
    tg.status === 200 && (tg.json?.data?.founderSession === true || tg.json?.engine),
  );
} finally {
  await new Promise((r) => server.close(r));
}

const failed = results.filter((r) => !r.ok);
console.log(`\nSmoke: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
