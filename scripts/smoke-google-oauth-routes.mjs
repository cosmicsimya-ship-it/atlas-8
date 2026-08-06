/**
 * Local smoke test for Google OAuth routes (does not modify .env files).
 * Forces empty Google credentials for predictable 503 on start endpoints.
 */
import { createServer } from 'http';

process.env.ATLAS_NO_LISTEN = '1';
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.ATLAS_GOOGLE_CLIENT_ID = '';
process.env.ATLAS_GOOGLE_CLIENT_SECRET = '';

const { app } = await import('../server/index.js');

const server = createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

async function check(path, { headers = {}, expectStatus, expectJson } = {}) {
  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  const okStatus = expectStatus == null || res.status === expectStatus;
  const okJson =
    !expectJson ||
    Object.entries(expectJson).every(([k, v]) => {
      if (v === '*') return k in (json || {});
      return json?.[k] === v;
    });
  const pass = okStatus && okJson;
  console.log(
    `${pass ? 'PASS' : 'FAIL'} ${path} → ${res.status} ${text.slice(0, 180).replace(/\s+/g, ' ')}`,
  );
  if (!pass) process.exitCode = 1;
  return { res, json };
}

await check('/api/ai/health', { expectStatus: 200, expectJson: { status: 'ok' } });
await check('/api/auth/oauth/status', {
  expectStatus: 200,
  expectJson: {
    configured: false,
    redirectUriConfigured: '*',
    redirectUri: '*',
  },
});
await check('/api/auth/google/status', {
  expectStatus: 200,
  expectJson: {
    configured: false,
    redirectUriConfigured: '*',
    redirectUri: '*',
  },
});
await check('/api/auth/oauth/start', {
  headers: { Accept: 'application/json' },
  expectStatus: 503,
  expectJson: { code: 'google_not_configured' },
});
await check('/api/auth/google', {
  headers: { Accept: 'application/json' },
  expectStatus: 503,
  expectJson: { code: 'google_not_configured' },
});

server.close();
console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE OK');
