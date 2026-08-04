/**
 * HTTP API tests — ATLAS LIVE Web adapter routes.
 * Run: node scripts/test-atlas-live-http.mjs
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import express from 'express';
import { createAtlasLiveRouter } from '../server/atlas-live/http/atlas-live-routes.js';
import { createWebLiveAdapter } from '../server/atlas-live/adapters/web-live-adapter.js';
import { WEB_ADAPTER_ERROR_CODES } from '../server/atlas-live/adapters/web-session-schema.js';
import { makeAdapterError } from '../server/atlas-live/adapters/web-session-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${msg}`);
  }
}

function mockAuth(userId = 'web:user-a') {
  return (req, _res, next) => {
    req.auth = { authenticated: true, userId, roles: ['user'] };
    next();
  };
}

function mockAuthUserB() {
  return mockAuth('web:user-b');
}

function createTestApp(adapter, authMiddleware = mockAuth()) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  const { router } = createAtlasLiveRouter({
    adapter,
    attachAuth: authMiddleware,
    requireAuth: authMiddleware,
    requireCsrf: (_req, _res, next) => next(),
    rateLimit: (_req, _res, next) => next(),
  });
  app.use(router);
  return app;
}

async function withServer(app, fn) {
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

async function api(base, path, { method = 'GET', body, userId } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Test-User': userId ?? 'web:user-a',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, json };
}

console.log('\n[AtlasLiveHTTP] API tests\n');

// 1. Session create — 201
{
  console.log('Create session');
  const adapter = createWebLiveAdapter();
  const app = createTestApp(adapter);
  await withServer(app, async (base) => {
    const res = await api(base, '/api/atlas-live/sessions', {
      method: 'POST',
      body: { topic: 'Günün gökyüzü', language: 'tr', voiceMode: 'text-only', metadata: { mood: 'calm' } },
    });
    assert(res.status === 201, 'create returns 201');
    assert(res.json.ok === true, 'ok true');
    assert(res.json.data?.session?.sessionId?.startsWith('web_'), 'server-generated session id');
    assert(res.json.data.session.status === 'created', 'status created');
    assert(res.json.error === null, 'error null');
  });
}

// 2. Invalid create — 400
{
  console.log('\nInvalid create input');
  const adapter = createWebLiveAdapter();
  const app = createTestApp(adapter);
  await withServer(app, async (base) => {
    const missingTopic = await api(base, '/api/atlas-live/sessions', {
      method: 'POST',
      body: { language: 'tr' },
    });
    assert(missingTopic.status === 400, 'missing topic 400');
    assert(missingTopic.json.ok === false, 'ok false');
    assert(missingTopic.json.error?.code === 'INVALID_INPUT', 'invalid input code');

    const clientSessionId = await api(base, '/api/atlas-live/sessions', {
      method: 'POST',
      body: { topic: 'Test', sessionId: 'web_hack' },
    });
    assert(clientSessionId.status === 400, 'client sessionId rejected');

    const badVoice = await api(base, '/api/atlas-live/sessions', {
      method: 'POST',
      body: { topic: 'Test', voiceMode: 'elevenlabs-stream' },
    });
    assert(badVoice.status === 400, 'invalid voiceMode rejected');
  });
}

// Lifecycle helper
async function createStartedSession(adapter, app) {
  let sessionId = null;
  await withServer(app, async (base) => {
    const created = await api(base, '/api/atlas-live/sessions', {
      method: 'POST',
      body: { topic: 'Night show', language: 'en', voiceMode: 'text-only' },
    });
    sessionId = created.json.data.session.sessionId;
    await api(base, `/api/atlas-live/sessions/${sessionId}/start`, { method: 'POST' });
  });
  return sessionId;
}

// 3–7 lifecycle
{
  console.log('\nLifecycle');
  const adapter = createWebLiveAdapter();
  const app = createTestApp(adapter);
  const sessionId = await createStartedSession(adapter, app);

  await withServer(app, async (base) => {
    const paused = await api(base, `/api/atlas-live/sessions/${sessionId}/pause`, { method: 'POST' });
    assert(paused.status === 200, 'pause 200');
    assert(paused.json.data.session.status === 'paused', 'paused status');

    const resumed = await api(base, `/api/atlas-live/sessions/${sessionId}/resume`, { method: 'POST' });
    assert(resumed.status === 200, 'resume 200');
    assert(resumed.json.data.session.status === 'running', 'running after resume');

    const ticked = await api(base, `/api/atlas-live/sessions/${sessionId}/tick`, { method: 'POST' });
    assert(ticked.status === 200, 'tick 200');
    assert(ticked.json.data.tick?.ok === true, 'tick ok');
    assert(Array.isArray(ticked.json.data.events), 'tick events array');

    const state = await api(base, `/api/atlas-live/sessions/${sessionId}`);
    assert(state.status === 200, 'get state 200');
    assert(state.json.data.session.sessionId === sessionId, 'state session id');

    const events = await api(base, `/api/atlas-live/sessions/${sessionId}/events`);
    assert(events.status === 200, 'events 200');
    assert(Array.isArray(events.json.data.events), 'events list');
    assert(events.json.data.events.length >= 1, 'has events');

    const stopped = await api(base, `/api/atlas-live/sessions/${sessionId}/stop`, { method: 'POST' });
    assert(stopped.status === 200, 'stop 200');
    assert(stopped.json.data.session.status === 'stopped', 'stopped status');
  });
}

// 10. Unknown session — 404
{
  console.log('\nUnknown session');
  const adapter = createWebLiveAdapter();
  const app = createTestApp(adapter);
  await withServer(app, async (base) => {
    const res = await api(base, '/api/atlas-live/sessions/web_missing_abc');
    assert(res.status === 404, 'unknown session 404');
    assert(res.json.error?.code === WEB_ADAPTER_ERROR_CODES.SESSION_NOT_FOUND, 'not found code');
  });
}

// 11. Invalid state transition — 409
{
  console.log('\nInvalid transition');
  const adapter = createWebLiveAdapter();
  const app = createTestApp(adapter);
  await withServer(app, async (base) => {
    const created = await api(base, '/api/atlas-live/sessions', {
      method: 'POST',
      body: { topic: 'Pause early', language: 'en' },
    });
    const id = created.json.data.session.sessionId;
    const pause = await api(base, `/api/atlas-live/sessions/${id}/pause`, { method: 'POST' });
    assert(pause.status === 409, 'pause before start 409');
  });
}

// 12. Long topic rejected
{
  console.log('\nLong topic');
  const adapter = createWebLiveAdapter();
  const app = createTestApp(adapter);
  await withServer(app, async (base) => {
    const res = await api(base, '/api/atlas-live/sessions', {
      method: 'POST',
      body: { topic: 'x'.repeat(250) },
    });
    assert(res.status === 400, 'long topic 400');
  });
}

// 13. Invalid metadata rejected
{
  console.log('\nInvalid metadata');
  const adapter = createWebLiveAdapter();
  const app = createTestApp(adapter);
  await withServer(app, async (base) => {
    const nested = await api(base, '/api/atlas-live/sessions', {
      method: 'POST',
      body: { topic: 'Test', metadata: { nested: { a: 1 } } },
    });
    assert(nested.status === 400, 'nested metadata 400');

    const proto = await api(base, '/api/atlas-live/sessions', {
      method: 'POST',
      body: { topic: 'Test', metadata: JSON.parse('{"__proto__":{"polluted":true}}') },
    });
    assert(proto.status === 400, 'prototype pollution blocked');
  });
}

// 14. Event limit
{
  console.log('\nEvent limit');
  const adapter = createWebLiveAdapter();
  const app = createTestApp(adapter);
  const sessionId = await createStartedSession(adapter, app);
  await withServer(app, async (base) => {
    await api(base, `/api/atlas-live/sessions/${sessionId}/tick`, { method: 'POST' });
    const limited = await api(base, `/api/atlas-live/sessions/${sessionId}/events?limit=2`);
    assert(limited.status === 200, 'events limit 200');
    assert(limited.json.data.events.length <= 2, 'limit enforced');

    const over = await api(base, `/api/atlas-live/sessions/${sessionId}/events?limit=999`);
    assert(over.json.data.events.length <= 100, 'max limit cap 100');
  });
}

// 15. Session id not from client
{
  console.log('\nSession id generation');
  const adapter = createWebLiveAdapter();
  const app = createTestApp(adapter);
  await withServer(app, async (base) => {
    const a = await api(base, '/api/atlas-live/sessions', {
      method: 'POST',
      body: { topic: 'A' },
    });
    const b = await api(base, '/api/atlas-live/sessions', {
      method: 'POST',
      body: { topic: 'B' },
    });
    assert(a.json.data.session.sessionId.startsWith('web_'), 'server-generated id format');
    assert(b.json.data.session.sessionId.startsWith('web_'), 'server-generated id format');
  });
}

// 16. Session isolation + ownership
{
  console.log('\nSession isolation');
  const adapter = createWebLiveAdapter();
  const appA = createTestApp(adapter, mockAuth('web:user-a'));
  const appB = createTestApp(adapter, mockAuth('web:user-b'));

  let sessionId = null;
  await withServer(appA, async (base) => {
    const created = await api(base, '/api/atlas-live/sessions', {
      method: 'POST',
      body: { topic: 'Private' },
    });
    sessionId = created.json.data.session.sessionId;
  });

  await withServer(appB, async (base) => {
    const forbidden = await api(base, `/api/atlas-live/sessions/${sessionId}`);
    assert(forbidden.status === 403, 'other user cannot read session');
    assert(forbidden.json.error?.code === 'SESSION_FORBIDDEN', 'forbidden code');
  });
}

// 17–18. Adapter error safe response, no stack trace
{
  console.log('\nSafe error responses');
  const adapter = {
    createSession: () => {
      throw makeAdapterError(WEB_ADAPTER_ERROR_CODES.SESSION_NOT_FOUND, 'missing');
    },
    getSessionState: () => {
      throw makeAdapterError(WEB_ADAPTER_ERROR_CODES.SESSION_NOT_FOUND, 'missing');
    },
    startSession: async () => ({}),
    pauseSession: () => ({}),
    resumeSession: async () => ({}),
    stopSession: async () => ({}),
    tickSession: async () => ({}),
    getSessionEvents: () => [],
    listSessions: () => [],
  };
  const app = createTestApp(adapter);
  await withServer(app, async (base) => {
    const res = await api(base, '/api/atlas-live/sessions/web_test_abc');
    assert(res.status === 404, 'adapter error mapped to 404');
    assert(res.json.ok === false, 'ok false on error');
    assert(!JSON.stringify(res.json).includes('atlas-live'), 'no internal file paths in response');
    assert(!JSON.stringify(res.json).includes('stack'), 'no stack trace');
  });
}

// 19–21 import isolation
{
  console.log('\nImport isolation');
  const routesSrc = readFileSync(
    join(__dirname, '../server/atlas-live/http/atlas-live-routes.js'),
    'utf8',
  );
  const validationSrc = readFileSync(
    join(__dirname, '../server/atlas-live/http/request-validation.js'),
    'utf8',
  );
  const combined = routesSrc + validationSrc;
  assert(!/from ['"].*\/src\//.test(combined), 'no frontend imports');
  assert(!/daily-analysis/i.test(combined), 'no daily-analysis imports');
  assert(!/telegram/i.test(combined), 'no telegram imports');
}

// Event sequence ordering
{
  console.log('\nEvent sequence');
  const adapter = createWebLiveAdapter();
  const app = createTestApp(adapter);
  const sessionId = await createStartedSession(adapter, app);
  await withServer(app, async (base) => {
    await api(base, `/api/atlas-live/sessions/${sessionId}/tick`, { method: 'POST' });
    const events = await api(base, `/api/atlas-live/sessions/${sessionId}/events`);
    const list = events.json.data.events;
    for (let i = 1; i < list.length; i++) {
      assert(list[i].sequence > list[i - 1].sequence, `sequence order at ${i}`);
    }
  });
}

// afterSequence filter
{
  console.log('\nafterSequence filter');
  const adapter = createWebLiveAdapter();
  const app = createTestApp(adapter);
  const sessionId = await createStartedSession(adapter, app);
  await withServer(app, async (base) => {
    const all = await api(base, `/api/atlas-live/sessions/${sessionId}/events`);
    const firstSeq = all.json.data.events[0]?.sequence ?? 0;
    const filtered = await api(
      base,
      `/api/atlas-live/sessions/${sessionId}/events?afterSequence=${firstSeq}`,
    );
    assert(
      filtered.json.data.events.every((e) => e.sequence > firstSeq),
      'afterSequence filter',
    );
  });
}

console.log(`\n[AtlasLiveHTTP] ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
