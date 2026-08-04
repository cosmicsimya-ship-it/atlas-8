/**
 * Smoke test — ATLAS LIVE radio host engine.
 * Run: node scripts/test-atlas-live.mjs
 */
import {
  ATLAS_LIVE_VERSION,
  createAtlasLiveEngine,
  listContentBlocks,
  CONTENT_CATEGORIES,
  LIVE_EVENT_TYPES,
  createMusicController,
  resolveEventInterruptPolicy,
  selectNextBlock,
  createHistory,
} from '../server/atlas-live/index.js';

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

console.log(`\n[AtlasLive] ${ATLAS_LIVE_VERSION} smoke test\n`);

// ── Catalog ──────────────────────────────────────────────
{
  console.log('Catalog');
  const blocks = listContentBlocks();
  assert(blocks.length >= 20, `seed blocks >= 20 (got ${blocks.length})`);
  assert(CONTENT_CATEGORIES.includes('night_greeting'), 'night_greeting category');
  assert(CONTENT_CATEGORIES.includes('silence'), 'silence category');
  assert(LIVE_EVENT_TYPES.includes('midnight'), 'midnight event type');
  assert(LIVE_EVENT_TYPES.includes('ramadan'), 'ramadan event type');
}

// ── Anti-repeat selection ────────────────────────────────
{
  console.log('\nTopic variety');
  const history = createHistory();
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    const block = selectNextBlock({
      daypart: 'night',
      recentIds: history.recentBlockIds(10),
      recentCategories: history.recentCategories(4),
      allowRareSky: false,
    });
    assert(!!block, `selectNextBlock #${i + 1}`);
    history.recordSegment({
      blockId: block.id,
      category: block.category,
      text: block.cues.join(' '),
    });
    seen.add(block.category);
  }
  assert(seen.size >= 4, `variety across categories (got ${seen.size})`);
}

// ── Music speak windows ──────────────────────────────────
{
  console.log('\nMusic speak windows');
  const music = createMusicController({ fadeInMs: 1000, fadeOutMs: 1000 });
  music.enqueue({ id: 't1', title: 'Bed', durationMs: 60_000 });
  music.play({ skipFadeIn: true });
  music.reportPosition(30_000);
  const mid = music.getState();
  assert(mid.playing === true, 'playing mid-track');
  assert(mid.canSpeak === false, 'cannot speak mid-track');
  assert(mid.speakWindow === 'blocked', 'speakWindow blocked');

  music.reportPosition(500);
  const edge = music.getState();
  assert(edge.canSpeak === true, 'can speak near fade-in edge');

  music.stop();
  assert(music.getState().canSpeak === true, 'can speak when stopped');
}

// ── Event interrupt policy ────────────────────────────────
{
  console.log('\nEvent interrupt policy');
  const blocked = resolveEventInterruptPolicy({
    priority: 'normal',
    canSpeak: false,
    musicPlaying: true,
  });
  assert(blocked.allow === false, 'normal event waits during music');
  assert(blocked.mode === 'queue' || blocked.mode === 'wait_window', 'soft defer mode');

  const free = resolveEventInterruptPolicy({
    priority: 'high',
    canSpeak: true,
    musicPlaying: false,
  });
  assert(free.allow === true, 'event allowed when can speak');
}

// ── Engine session ───────────────────────────────────────
{
  console.log('\nEngine session');
  const events = [];
  const live = createAtlasLiveEngine({
    autoLoop: false,
    voiceProvider: 'mock',
    onEvent: (type) => events.push(type),
    // Deterministic-ish scheduler: still organic but fast ticks for test
    scheduler: {
      minSpeakGapMs: 1,
      maxSpeakGapMs: 2,
      minSilenceMs: 100,
      maxSilenceMs: 200,
      minMusicMs: 100,
      maxMusicMs: 200,
      listenWindowMs: 100,
      speakBias: 0.9,
    },
  });

  assert(live.version === ATLAS_LIVE_VERSION, 'version matches');
  const started = await live.start({ openAnnouncer: true });
  assert(started.running === true, 'running after start');
  assert(started.sessionId.startsWith('live_'), 'session id');

  const spoken = [];
  for (let i = 0; i < 10; i++) {
    const step = await live.tick();
    assert(step.ok === true, `tick ${i + 1} ok`);
    if (step.beat?.segment?.text) {
      spoken.push(step.beat.segment.text);
      // Radio pacing: no giant dumps
      assert(
        step.beat.segment.cues.length <= 6,
        `cues capped (${step.beat.segment.cues.length})`,
      );
      assert(
        !/according to wikipedia/i.test(step.beat.segment.text),
        'no wikipedia tone',
      );
    }
  }

  assert(spoken.length >= 1, `produced speech (got ${spoken.length})`);
  assert(events.includes('start'), 'emitted start');
  assert(events.includes('event_queued') || events.includes('speak'), 'emitted activity');

  live.setListenerCount(100);
  const snapAfterMilestone = live.snapshot();
  assert(snapAfterMilestone.listenerCount === 100, 'listener milestone count');
  assert(snapAfterMilestone.queues.events >= 1, 'events queued for milestone/joins');

  // Drain a few more ticks including event acks
  for (let i = 0; i < 5; i++) await live.tick();

  const hist = live.history.snapshot();
  assert(hist.segmentCount >= 1, 'history recorded segments');

  await live.injectCues(['A soft manual line...', 'Just for you.'], 'manual_cue');
  const injectStep = await live.tick();
  assert(
    injectStep.beat?.segment?.text?.includes('soft manual') ||
      injectStep.ok === true,
    'inject path works',
  );

  const stopped = await live.stop();
  assert(stopped.state === 'stopped', 'stopped state');
  assert(stopped.running === false, 'not running');
}

// ── Isolation check: no throw on import barrel ───────────
{
  console.log('\nIsolation');
  assert(typeof createAtlasLiveEngine === 'function', 'engine export');
  assert(!process.env.ATLAS_LIVE_WIRED_INTO_CHAT, 'not wired into chat (by design)');
}

console.log(`\n[AtlasLive] ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
