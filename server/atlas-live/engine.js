/**
 * ATLAS LIVE — AI Radio Host Engine.
 *
 * Not a chatbot. Not TTS. Not a podcast player.
 * A living late-night radio presenter that creates atmosphere inside
 * Telegram Voice Chat (later Web / Mobile).
 *
 * Isolated module — importable without Express. Wire channels later.
 */

import {
  ATLAS_LIVE_VERSION,
  makeLiveEvent,
  makeSpokenSegment,
  makePresenterBeat,
} from './schema.js';
import {
  createPersonality,
  resolveDaypartMood,
  shapeCuesForPersonality,
} from './personality.js';
import { createHistory } from './history.js';
import { createScheduler } from './scheduler.js';
import { createMusicController } from './music-controller.js';
import { createVoiceFacade, estimateSpeechDurationMs } from './voice.js';
import { createPresenter } from './presenter.js';
import { planTransition } from './transitions.js';
import { cuesToScript } from './prompts.js';

/**
 * @typedef {object} AtlasLiveOptions
 * @property {string} [sessionId]
 * @property {Partial<import('./personality.js').PersonalityProfile>} [personality]
 * @property {Partial<import('./scheduler.js').SchedulerConfig>} [scheduler]
 * @property {Partial<import('./music-controller.js').MusicControllerOptions>} [music]
 * @property {import('./schema.js').VoiceProviderId|object} [voiceProvider]
 * @property {object} [voiceConfig]
 * @property {((cues: string[], meta: object) => Promise<string[]>)|null} [polishScript]
 * @property {(event: string, payload?: object) => void} [onEvent]
 * @property {boolean} [autoLoop]     If true, tick() schedules itself (Node timers).
 * @property {() => number} [rng]
 */

/**
 * Create an Atlas Live engine instance.
 * @param {AtlasLiveOptions} [options]
 */
export function createAtlasLiveEngine(options = {}) {
  const sessionId =
    options.sessionId ||
    `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const emit =
    typeof options.onEvent === 'function'
      ? options.onEvent
      : (type, payload) => {
          if (process.env.ATLAS_LIVE_DEBUG === '1') {
            console.log(`[AtlasLive] ${type}`, payload ?? '');
          }
        };

  const personality = createPersonality(options.personality);
  const history = createHistory();
  const scheduler = createScheduler({ ...options.scheduler, rng: options.rng });
  const music = createMusicController({
    ...options.music,
    onEvent: (type, payload) => emit(`music:${type}`, payload),
  });
  const voice = createVoiceFacade({
    provider: options.voiceProvider || 'mock',
    providerConfig: options.voiceConfig,
  });
  // Expose estimate helper on facade for presenter duration math.
  voice.estimateSpeechDurationMs = estimateSpeechDurationMs;

  const presenter = createPresenter({
    history,
    personality,
    voice,
    polishScript: options.polishScript ?? null,
    rng: options.rng,
  });

  /** @type {import('./schema.js').EngineState} */
  let state = 'idle';
  let listenerCount = 0;
  /** @type {import('./schema.js').LiveEvent[]} */
  const eventQueue = [];
  /** @type {import('./schema.js').PresenterBeat[]} */
  const beatQueue = [];
  /** @type {ReturnType<typeof setTimeout>|null} */
  let loopTimer = null;
  let running = false;
  /** @type {import('./schema.js').PresenterBeat|null} */
  let currentBeat = null;

  function snapshot() {
    const musicState = music.getState();
    return {
      version: ATLAS_LIVE_VERSION,
      sessionId,
      state,
      music: musicState,
      listenerCount,
      lastCategory: history.lastCategory(),
      recentCategories: history.recentCategories(8),
      uptimeMs: Date.now() - startedMs,
      startedAt,
      personality: {
        name: personality.name,
        stationName: personality.stationName,
        defaultMood: personality.defaultMood,
      },
      queues: {
        events: eventQueue.length,
        beats: beatQueue.length,
      },
      currentBeat: currentBeat
        ? { id: currentBeat.id, kind: currentBeat.kind, reason: currentBeat.reason }
        : null,
      history: history.snapshot(),
      scheduler: scheduler.snapshot(),
      voiceProvider: voice.getProvider().id,
      running,
    };
  }

  /**
   * Enqueue a live event (listener join, midnight, Eid, etc.).
   * Soft by default — never aggressively cuts music.
   * @param {string} type
   * @param {object} [payload]
   * @param {import('./schema.js').EventPriority} [priority]
   */
  function pushEvent(type, payload = {}, priority = 'normal') {
    const event = makeLiveEvent({ type, payload, priority });
    eventQueue.push(event);
    emit('event_queued', event);
    return event;
  }

  function setListenerCount(n) {
    const prev = listenerCount;
    listenerCount = Math.max(0, Number(n) || 0);
    if (listenerCount > prev) {
      pushEvent('listener_joined', { count: listenerCount }, 'low');
      // Milestone: every 100, and specifically 100.
      if (listenerCount === 100 || (listenerCount > 100 && listenerCount % 100 === 0)) {
        pushEvent(
          'milestone_listeners',
          { count: listenerCount, milestone: listenerCount },
          'high',
        );
      }
    } else if (listenerCount < prev) {
      pushEvent('listener_left', { count: listenerCount }, 'low');
    }
    emit('listeners', { listenerCount, prev });
    return listenerCount;
  }

  /**
   * Core tick — advances one organic decision / beat.
   * Safe to call manually (tests) or via autoLoop.
   * @returns {Promise<object>}
   */
  async function tick() {
    if (state === 'stopped') {
      return { ok: false, reason: 'stopped' };
    }

    const musicState = music.getState();
    const daypart = resolveDaypartMood().daypart;

    // 1) Drain deferred / pending events first (soft).
    if (eventQueue.length) {
      const event = eventQueue.shift();
      const { policy, beats } = await presenter.acknowledgeEvent(event, {
        canSpeak: musicState.canSpeak,
        musicPlaying: musicState.playing,
      });

      if (!policy.allow) {
        // Re-queue unless wait_window consumed a silence beat.
        if (policy.mode === 'queue') {
          eventQueue.push(event);
        } else {
          // wait_window: keep silence beats, re-queue event after.
          eventQueue.unshift(event);
        }
      }

      for (const b of beats) {
        const synth = await presenter.synthesizeBeat(b);
        beatQueue.push(synth);
      }
    }

    // 2) If no beats ready, ask scheduler what atmosphere to create.
    if (!beatQueue.length) {
      const decision = scheduler.nextDecision({
        musicPlaying: musicState.playing,
        canSpeak: musicState.canSpeak,
        pendingEvent: eventQueue.length > 0,
        daypart,
      });

      emit('schedule', decision);

      if (decision.action === 'speak') {
        if (musicState.playing && !musicState.canSpeak) {
          // Never interrupt mid-song — wait or request talk window gently.
          music.requestTalkWindow();
          const plan = planTransition({
            kind: 'to_speech',
            canSpeak: false,
            musicPlaying: true,
          });
          beatQueue.push(...plan.beats);
        } else {
          if (musicState.playing && musicState.canSpeak) {
            music.duckForSpeech();
          }
          const beats = await presenter.nextBeats({
            canSpeak: true,
            musicPlaying: musicState.playing,
          });
          for (const b of beats) {
            beatQueue.push(await presenter.synthesizeBeat(b));
          }
        }
      } else if (decision.action === 'music') {
        const plan = planTransition({ kind: 'to_music', canSpeak: musicState.canSpeak });
        beatQueue.push(...plan.beats);
        if (!musicState.playing) {
          // Start music bed if queue has tracks; otherwise logical music silence placeholder.
          if (music.getQueue().length || music.getCurrent()) {
            music.play();
          } else {
            beatQueue.push({
              id: `music_placeholder_${Date.now()}`,
              kind: 'music_cue',
              segment: null,
              durationMs: decision.durationMs,
              reason: 'music_bed_no_tracks',
              meta: { placeholder: true },
            });
          }
        }
      } else if (decision.action === 'silence' || decision.action === 'listen_window') {
        beatQueue.push({
          id: `sil_${Date.now()}`,
          kind: 'silence',
          segment: null,
          durationMs: decision.durationMs,
          reason: decision.reason,
          meta: { action: decision.action },
        });
      } else if (decision.action === 'transition') {
        const plan = planTransition({
          kind: musicState.playing ? 'to_speech' : 'to_music',
          canSpeak: musicState.canSpeak,
          musicPlaying: musicState.playing,
        });
        beatQueue.push(...plan.beats);
      }
    }

    // 3) Play next beat (logical delivery — channel sink binds later).
    const beat = beatQueue.shift() || null;
    currentBeat = beat;

    if (!beat) {
      state = 'idle';
      return { ok: true, beat: null, snapshot: snapshot() };
    }

    if (beat.kind === 'speech' || beat.kind === 'event_ack') {
      state = 'speaking';
      if (beat.segment) beat.segment.status = 'speaking';
      emit('speak', {
        text: beat.segment?.text,
        cues: beat.segment?.cues,
        category: beat.segment?.category,
        voiceMeta: beat.segment?.voiceMeta,
      });
      scheduler.markSpoke();
      if (beat.segment) beat.segment.status = 'spoken';
    } else if (beat.kind === 'silence') {
      state = 'silence';
      emit('silence', { durationMs: beat.durationMs, reason: beat.reason });
    } else if (beat.kind === 'music_cue') {
      state = 'music';
      emit('music_cue', { durationMs: beat.durationMs, meta: beat.meta });
      music.unduck();
    } else if (beat.kind === 'transition') {
      state = 'transition';
      emit('transition', { durationMs: beat.durationMs, meta: beat.meta });
    }

    const result = {
      ok: true,
      beat,
      durationMs: beat.durationMs,
      snapshot: snapshot(),
    };

    if (options.autoLoop && running) {
      scheduleNext(beat.durationMs || 3_000);
    }

    return result;
  }

  function scheduleNext(ms) {
    if (loopTimer) clearTimeout(loopTimer);
    loopTimer = setTimeout(() => {
      tick().catch((err) => {
        console.error('[AtlasLive] tick failed', err?.message ?? err);
        if (running && options.autoLoop) scheduleNext(5_000);
      });
    }, Math.max(200, ms));
    if (typeof loopTimer.unref === 'function') loopTimer.unref();
  }

  /**
   * Start the live session.
   * @param {{ openAnnouncer?: boolean }} [opts]
   */
  async function start(opts = {}) {
    if (running) return snapshot();
    running = true;
    state = 'idle';
    pushEvent('session_start', { sessionId }, 'high');

    if (opts.openAnnouncer !== false) {
      const plan = planTransition({ kind: 'session_open', canSpeak: true });
      beatQueue.push(...plan.beats);
    }

    emit('start', { sessionId });

    if (options.autoLoop) {
      // Kick immediately.
      await tick();
    }

    return snapshot();
  }

  async function stop() {
    running = false;
    state = 'stopped';
    if (loopTimer) clearTimeout(loopTimer);
    loopTimer = null;
    pushEvent('session_end', { sessionId }, 'normal');
    music.stop();
    emit('stop', { sessionId });
    return snapshot();
  }

  function pause() {
    state = 'paused';
    running = false;
    if (loopTimer) clearTimeout(loopTimer);
    music.pause();
    emit('pause', { sessionId });
    return snapshot();
  }

  async function resume() {
    if (state === 'stopped') return start();
    running = true;
    state = 'idle';
    emit('resume', { sessionId });
    if (options.autoLoop) await tick();
    return snapshot();
  }

  /**
   * Inject a one-off spoken cue (manual producer control).
   * @param {string[]} cues
   * @param {string} [category]
   */
  async function injectCues(cues, category = 'manual_cue') {
    const shaped = shapeCuesForPersonality(cues);
    const text = cuesToScript(shaped);
    const segment = makeSpokenSegment({
      blockId: `manual_${Date.now()}`,
      category,
      text,
      cues: shaped,
      status: 'ready',
    });
    history.recordSegment({
      blockId: segment.blockId,
      category,
      text,
      id: segment.id,
    });
    const beat = makePresenterBeat({
      kind: 'speech',
      segment,
      durationMs: estimateSpeechDurationMs(text, shaped),
      reason: 'manual_inject',
    });
    beatQueue.push(await presenter.synthesizeBeat(beat));
    emit('inject', { category, text });
    return beat;
  }

  return {
    version: ATLAS_LIVE_VERSION,
    sessionId,
    start,
    stop,
    pause,
    resume,
    tick,
    pushEvent,
    setListenerCount,
    injectCues,
    snapshot,
    // Subsystem access for advanced wiring / tests
    music,
    voice,
    history,
    scheduler,
    presenter,
    personality,
  };
}

export { ATLAS_LIVE_VERSION };
