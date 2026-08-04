/**
 * Unit tests — ATLAS LIVE Web adapter.
 * Run: node scripts/test-web-live-adapter.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  createWebLiveAdapter,
} from '../server/atlas-live/adapters/web-live-adapter.js';
import {
  WEB_ADAPTER_ERROR_CODES,
  validateTransition,
} from '../server/atlas-live/adapters/web-session-schema.js';
import { createAtlasLiveEngine } from '../server/atlas-live/engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
let seq = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${msg}`);
  }
}

function assertThrows(fn, code, msg) {
  try {
    fn();
    failed += 1;
    console.error(`  ✗ ${msg} (no throw)`);
  } catch (err) {
    if (err.code === code) {
      passed += 1;
      console.log(`  ✓ ${msg}`);
    } else {
      failed += 1;
      console.error(`  ✗ ${msg} (got ${err.code})`);
    }
  }
}

async function assertThrowsAsync(fn, code, msg) {
  try {
    await fn();
    failed += 1;
    console.error(`  ✗ ${msg} (no throw)`);
  } catch (err) {
    if (err.code === code) {
      passed += 1;
      console.log(`  ✓ ${msg}`);
    } else {
      failed += 1;
      console.error(`  ✗ ${msg} (got ${err.code})`);
    }
  }
}

function makeClock() {
  let t = 1_700_000_000_000;
  return {
    now: () => t,
    iso: () => new Date(t).toISOString(),
    advance: (ms) => {
      t += ms;
    },
  };
}

function makeAdapter(overrides = {}) {
  const clock = makeClock();
  const adapter = createWebLiveAdapter({
    clock,
    idFactory: () => `web_test_${++seq}`,
    engineFactory: (opts) =>
      createAtlasLiveEngine({
        autoLoop: false,
        voiceProvider: 'mock',
        scheduler: {
          minSpeakGapMs: 1,
          maxSpeakGapMs: 2,
          minSilenceMs: 50,
          maxSilenceMs: 100,
          minMusicMs: 50,
          maxMusicMs: 100,
          listenWindowMs: 50,
          speakBias: 0.9,
        },
        ...opts,
      }),
    ...overrides,
  });
  return { adapter, clock };
}

console.log('\n[WebLiveAdapter] unit tests\n');

// 1. Session creation
{
  console.log('Session creation');
  const { adapter } = makeAdapter();
  const session = adapter.createSession({ topic: 'night', language: 'en', voiceMode: 'mock' });
  assert(session.sessionId.startsWith('web_test_'), 'session id generated');
  assert(session.status === 'created', 'status created');
  assert(session.topic === 'night', 'topic stored');
  assert(session.language === 'en', 'language stored');
  assert(session.voiceMode === 'mock', 'voiceMode stored');
  const events = adapter.getSessionEvents(session.sessionId);
  assert(events.length === 1, 'one creation event');
  assert(events[0].type === 'session.created', 'session.created emitted');
  assert(events[0].sequence === 1, 'first sequence is 1');
}

// 2. Session start
{
  console.log('\nSession start');
  const { adapter } = makeAdapter();
  const session = adapter.createSession();
  const started = await adapter.startSession(session.sessionId, { openAnnouncer: false });
  assert(started.status === 'running', 'status running');
  assert(started.startedAt != null, 'startedAt set');
  const events = adapter.getSessionEvents(session.sessionId);
  assert(events.some((e) => e.type === 'session.started'), 'session.started emitted');
}

// 3. Pause
{
  console.log('\nPause');
  const { adapter } = makeAdapter();
  const session = adapter.createSession();
  await adapter.startSession(session.sessionId, { openAnnouncer: false });
  const paused = adapter.pauseSession(session.sessionId);
  assert(paused.status === 'paused', 'status paused');
  assert(paused.pausedAt != null, 'pausedAt set');
  const events = adapter.getSessionEvents(session.sessionId);
  assert(events.some((e) => e.type === 'session.paused'), 'session.paused emitted');
}

// 4. Resume
{
  console.log('\nResume');
  const { adapter } = makeAdapter();
  const session = adapter.createSession();
  await adapter.startSession(session.sessionId, { openAnnouncer: false });
  adapter.pauseSession(session.sessionId);
  const resumed = await adapter.resumeSession(session.sessionId);
  assert(resumed.status === 'running', 'status running after resume');
  assert(resumed.pausedAt === null, 'pausedAt cleared');
  const events = adapter.getSessionEvents(session.sessionId);
  assert(events.some((e) => e.type === 'session.resumed'), 'session.resumed emitted');
}

// 5. Stop
{
  console.log('\nStop');
  const { adapter } = makeAdapter();
  const session = adapter.createSession();
  await adapter.startSession(session.sessionId, { openAnnouncer: false });
  const stopped = await adapter.stopSession(session.sessionId);
  assert(stopped.status === 'stopped', 'status stopped');
  assert(stopped.stoppedAt != null, 'stoppedAt set');
  const events = adapter.getSessionEvents(session.sessionId);
  assert(events.some((e) => e.type === 'session.stopped'), 'session.stopped emitted');
}

// 6. Invalid state transitions
{
  console.log('\nInvalid state transitions');
  const { adapter } = makeAdapter();
  const session = adapter.createSession();
  await adapter.startSession(session.sessionId, { openAnnouncer: false });
  await assertThrowsAsync(
    () => adapter.startSession(session.sessionId),
    WEB_ADAPTER_ERROR_CODES.INVALID_STATE_TRANSITION,
    'cannot start running session again',
  );
  await assertThrowsAsync(
    () => adapter.resumeSession(session.sessionId),
    WEB_ADAPTER_ERROR_CODES.INVALID_STATE_TRANSITION,
    'cannot resume non-paused session',
  );
  adapter.pauseSession(session.sessionId);
  await adapter.stopSession(session.sessionId);
  await assertThrowsAsync(
    () => adapter.resumeSession(session.sessionId),
    WEB_ADAPTER_ERROR_CODES.SESSION_ALREADY_STOPPED,
    'cannot resume stopped session',
  );
}

// 7. Unknown session
{
  console.log('\nUnknown session');
  const { adapter } = makeAdapter();
  assertThrows(
    () => adapter.getSessionState('missing'),
    WEB_ADAPTER_ERROR_CODES.SESSION_NOT_FOUND,
    'unknown session state',
  );
  await assertThrowsAsync(
    () => adapter.startSession('missing'),
    WEB_ADAPTER_ERROR_CODES.SESSION_NOT_FOUND,
    'unknown session start',
  );
}

// 8. Tick production
{
  console.log('\nTick production');
  const { adapter } = makeAdapter();
  const session = adapter.createSession();
  await adapter.startSession(session.sessionId, { openAnnouncer: false });
  const result = await adapter.tickSession(session.sessionId);
  assert(result.tick.ok === true, 'tick ok');
  assert(Array.isArray(result.events), 'tick returns events array');
  const state = adapter.getSessionState(session.sessionId);
  assert(state.status === 'running', 'still running after tick');
}

// 9. Event ordering
{
  console.log('\nEvent ordering');
  const { adapter } = makeAdapter();
  const session = adapter.createSession();
  await adapter.startSession(session.sessionId, { openAnnouncer: false });
  await adapter.tickSession(session.sessionId);
  await adapter.tickSession(session.sessionId);
  const events = adapter.getSessionEvents(session.sessionId);
  for (let i = 1; i < events.length; i++) {
    assert(events[i].sequence > events[i - 1].sequence, `sequence increases at index ${i}`);
  }
}

// 10. Sequence monotonic increase
{
  console.log('\nSequence monotonic increase');
  const { adapter } = makeAdapter();
  const session = adapter.createSession();
  const eventsAfterCreate = adapter.getSessionEvents(session.sessionId);
  const lastSeq = eventsAfterCreate[eventsAfterCreate.length - 1].sequence;
  await adapter.startSession(session.sessionId, { openAnnouncer: false });
  await adapter.tickSession(session.sessionId);
  const all = adapter.getSessionEvents(session.sessionId);
  assert(all[all.length - 1].sequence > lastSeq, 'sequence advanced after lifecycle');
}

// 11. Engine error controlled return
{
  console.log('\nEngine error handling');
  const { adapter } = makeAdapter({
    engineFactory: () => ({
      version: 'mock',
      sessionId: 'broken',
      start: async () => {
        throw new Error('boom');
      },
      stop: async () => ({}),
      pause: () => ({}),
      resume: async () => ({}),
      tick: async () => ({ ok: true }),
      snapshot: () => ({ state: 'idle', listenerCount: 0 }),
    }),
  });
  const session = adapter.createSession();
  await assertThrowsAsync(
    () => adapter.startSession(session.sessionId),
    WEB_ADAPTER_ERROR_CODES.ENGINE_START_FAILED,
    'engine start failure surfaces',
  );
  const state = adapter.getSessionState(session.sessionId);
  assert(state.status === 'error', 'session marked error');
}

// 12. Session isolation
{
  console.log('\nSession isolation');
  const { adapter } = makeAdapter();
  const a = adapter.createSession({ topic: 'a' });
  const b = adapter.createSession({ topic: 'b' });
  await adapter.startSession(a.sessionId, { openAnnouncer: false });
  assert(adapter.getSessionState(a.sessionId).status === 'running', 'session A running');
  assert(adapter.getSessionState(b.sessionId).status === 'created', 'session B still created');
  const eventsA = adapter.getSessionEvents(a.sessionId);
  const eventsB = adapter.getSessionEvents(b.sessionId);
  assert(eventsA.every((e) => e.sessionId === a.sessionId), 'A events scoped');
  assert(eventsB.every((e) => e.sessionId === b.sessionId), 'B events scoped');
}

// 13. No frontend imports
{
  console.log('\nImport isolation — frontend');
  const adapterSrc = readFileSync(
    join(__dirname, '../server/atlas-live/adapters/web-live-adapter.js'),
    'utf8',
  );
  const normalizerSrc = readFileSync(
    join(__dirname, '../server/atlas-live/adapters/web-event-normalizer.js'),
    'utf8',
  );
  const schemaSrc = readFileSync(
    join(__dirname, '../server/atlas-live/adapters/web-session-schema.js'),
    'utf8',
  );
  const combined = adapterSrc + normalizerSrc + schemaSrc;
  assert(!/from ['"].*src\//.test(combined), 'no src/ frontend imports');
  assert(!/telegram/i.test(combined), 'no telegram imports in adapter layer');
}

// 14. No daily-analysis imports
{
  console.log('\nImport isolation — daily analysis');
  const adapterSrc = readFileSync(
    join(__dirname, '../server/atlas-live/adapters/web-live-adapter.js'),
    'utf8',
  );
  assert(!/daily-analysis/i.test(adapterSrc), 'no daily-analysis import');
}

// 15. State transition matrix sanity
{
  console.log('\nTransition matrix');
  assert(validateTransition('created', 'start').allowed === true, 'created→start');
  assert(validateTransition('running', 'pause').allowed === true, 'running→pause');
  assert(validateTransition('paused', 'resume').allowed === true, 'paused→resume');
  assert(validateTransition('running', 'stop').allowed === true, 'running→stop');
  assert(validateTransition('stopped', 'resume').allowed === false, 'stopped→resume blocked');
  assert(validateTransition('running', 'start').allowed === false, 'running→start blocked');
}

// Tick while paused should fail
{
  console.log('\nTick while paused');
  const { adapter } = makeAdapter();
  const session = adapter.createSession();
  await adapter.startSession(session.sessionId, { openAnnouncer: false });
  adapter.pauseSession(session.sessionId);
  await assertThrowsAsync(
    () => adapter.tickSession(session.sessionId),
    WEB_ADAPTER_ERROR_CODES.INVALID_STATE_TRANSITION,
    'tick blocked while paused',
  );
}

// getSessionEvents sinceSequence filter
{
  console.log('\nEvent filter sinceSequence');
  const { adapter } = makeAdapter();
  const session = adapter.createSession();
  await adapter.startSession(session.sessionId, { openAnnouncer: false });
  const all = adapter.getSessionEvents(session.sessionId);
  const since = adapter.getSessionEvents(session.sessionId, { sinceSequence: 1 });
  assert(since.every((e) => e.sequence > 1), 'sinceSequence filter works');
  assert(since.length === all.length - 1, 'sinceSequence count');
}

console.log(`\n[WebLiveAdapter] ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
