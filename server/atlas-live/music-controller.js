/**
 * ATLAS LIVE — independent music layer.
 * Atlas may speak only during fade-in / fade-out windows — never mid-song.
 */

/** @typedef {'stopped'|'loading'|'playing'|'fading_in'|'fading_out'|'paused'} MusicPlaybackState */

/**
 * @typedef {object} Track
 * @property {string} id
 * @property {string} title
 * @property {number} durationMs
 * @property {string} [artist]
 * @property {string} [url]
 * @property {string[]} [tags]
 */

/**
 * @typedef {object} MusicControllerOptions
 * @property {number} [fadeInMs]
 * @property {number} [fadeOutMs]
 * @property {number} [talkOverlayVolume]  Volume during allowed talk windows
 * @property {(event: string, payload?: object) => void} [onEvent]
 */

export const DEFAULT_MUSIC_OPTIONS = Object.freeze({
  fadeInMs: 4_500,
  fadeOutMs: 5_500,
  talkOverlayVolume: 0.28,
});

/**
 * Create an independent music controller.
 * Transport (Telegram / Web / Mobile audio sink) is injected later via adapters.
 * @param {Partial<MusicControllerOptions>} [options]
 */
export function createMusicController(options = {}) {
  const opts = { ...DEFAULT_MUSIC_OPTIONS, ...options };
  const emit = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};

  /** @type {Track[]} */
  const queue = [];
  /** @type {Track|null} */
  let current = null;
  /** @type {MusicPlaybackState} */
  let playback = 'stopped';
  let positionMs = 0;
  let volume = 0.7;
  let startedAt = 0;
  /** Wall-clock anchor for position estimation when no sink reports. */
  let anchorWall = 0;
  let anchorPos = 0;

  function estimatePosition(now = Date.now()) {
    if (playback !== 'playing' && playback !== 'fading_in' && playback !== 'fading_out') {
      return positionMs;
    }
    if (!anchorWall) return positionMs;
    return Math.min(
      current?.durationMs ?? Number.MAX_SAFE_INTEGER,
      anchorPos + (now - anchorWall),
    );
  }

  /**
   * Speak window: only fade edges (and stopped/paused) allow speech.
   * Mid-track `playing` blocks speech.
   * @returns {import('./schema.js').MusicState}
   */
  function getState(now = Date.now()) {
    const pos = estimatePosition(now);
    positionMs = pos;
    const dur = current?.durationMs ?? 0;

    /** @type {import('./schema.js').SpeakWindow} */
    let speakWindow = 'blocked';
    let canSpeak = false;

    if (!current || playback === 'stopped' || playback === 'paused') {
      speakWindow = 'talk_window';
      canSpeak = true;
    } else if (playback === 'fading_in') {
      speakWindow = 'fade_in';
      canSpeak = true;
    } else if (playback === 'fading_out') {
      speakWindow = 'fade_out';
      canSpeak = true;
    } else if (playback === 'playing' && dur > 0) {
      if (pos <= opts.fadeInMs) {
        speakWindow = 'fade_in';
        canSpeak = true;
      } else if (pos >= Math.max(0, dur - opts.fadeOutMs)) {
        speakWindow = 'fade_out';
        canSpeak = true;
      } else {
        speakWindow = 'blocked';
        canSpeak = false;
      }
    }

    return {
      playing: playback === 'playing' || playback === 'fading_in' || playback === 'fading_out',
      trackId: current?.id ?? null,
      title: current?.title ?? null,
      positionMs: pos,
      durationMs: dur,
      volume,
      speakWindow,
      canSpeak,
      playback,
      queueLength: queue.length,
    };
  }

  /** @param {Track|Track[]} tracks */
  function enqueue(tracks) {
    const list = Array.isArray(tracks) ? tracks : [tracks];
    for (const t of list) {
      if (!t?.id || !t?.title || !Number.isFinite(t.durationMs)) {
        throw new Error('Track requires id, title, durationMs');
      }
      queue.push({ ...t, tags: t.tags ? [...t.tags] : [] });
    }
    emit('queue_updated', { queueLength: queue.length });
  }

  function clearQueue() {
    queue.length = 0;
    emit('queue_cleared');
  }

  /**
   * Start next track (or resume current).
   * @param {{ skipFadeIn?: boolean }} [playOpts]
   */
  function play(playOpts = {}) {
    if (!current) {
      current = queue.shift() || null;
      positionMs = 0;
    }
    if (!current) {
      playback = 'stopped';
      emit('empty');
      return getState();
    }

    playback = playOpts.skipFadeIn ? 'playing' : 'fading_in';
    startedAt = Date.now();
    anchorWall = startedAt;
    anchorPos = positionMs;
    volume = playOpts.skipFadeIn ? 0.7 : 0.05;
    emit('play', { track: current, playback });

    // Auto-advance fade_in → playing after fadeInMs (logical; sink may override).
    if (playback === 'fading_in') {
      schedulePhase('playing', opts.fadeInMs, () => {
        volume = 0.7;
      });
    }

    scheduleEndWatch();
    return getState();
  }

  /** @type {ReturnType<typeof setTimeout>|null} */
  let phaseTimer = null;
  /** @type {ReturnType<typeof setTimeout>|null} */
  let endTimer = null;

  function clearTimers() {
    if (phaseTimer) clearTimeout(phaseTimer);
    if (endTimer) clearTimeout(endTimer);
    phaseTimer = null;
    endTimer = null;
  }

  /**
   * @param {MusicPlaybackState} next
   * @param {number} afterMs
   * @param {() => void} [fn]
   */
  function schedulePhase(next, afterMs, fn) {
    if (phaseTimer) clearTimeout(phaseTimer);
    phaseTimer = setTimeout(() => {
      if (playback === 'stopped' || playback === 'paused') return;
      fn?.();
      playback = next;
      anchorWall = Date.now();
      anchorPos = positionMs;
      emit('phase', { playback, trackId: current?.id });
    }, Math.max(0, afterMs));
    if (typeof phaseTimer.unref === 'function') phaseTimer.unref();
  }

  function scheduleEndWatch() {
    if (endTimer) clearTimeout(endTimer);
    if (!current) return;
    const remaining = Math.max(0, current.durationMs - positionMs);
    const fadeStart = Math.max(0, remaining - opts.fadeOutMs);

    endTimer = setTimeout(() => {
      if (!current || playback === 'stopped') return;
      playback = 'fading_out';
      volume = opts.talkOverlayVolume;
      emit('phase', { playback: 'fading_out', trackId: current.id });
      schedulePhase('stopped', opts.fadeOutMs, () => {
        const finished = current;
        current = null;
        positionMs = 0;
        anchorWall = 0;
        emit('track_ended', { track: finished });
        if (queue.length) play();
      });
    }, fadeStart);
    if (typeof endTimer.unref === 'function') endTimer.unref();
  }

  function pause() {
    positionMs = estimatePosition();
    playback = 'paused';
    clearTimers();
    emit('pause', { positionMs });
    return getState();
  }

  function stop() {
    clearTimers();
    current = null;
    positionMs = 0;
    playback = 'stopped';
    anchorWall = 0;
    emit('stop');
    return getState();
  }

  /**
   * Request a fade-out so the presenter can enter a talk window.
   * Does not hard-cut mid-song.
   */
  function requestTalkWindow() {
    const state = getState();
    if (state.canSpeak) return { ok: true, state, waited: false };
    if (!current || playback === 'stopped') {
      return { ok: true, state: getState(), waited: false };
    }

    // Begin early fade-out path without nuking the track instantly.
    positionMs = estimatePosition();
    playback = 'fading_out';
    volume = opts.talkOverlayVolume;
    clearTimers();
    emit('talk_window_requested', { trackId: current.id });
    schedulePhase('stopped', opts.fadeOutMs, () => {
      const finished = current;
      current = null;
      positionMs = 0;
      emit('track_ended', { track: finished, reason: 'talk_window' });
    });
    return { ok: true, state: getState(), waited: true };
  }

  /**
   * External sink can sync real playback position.
   * @param {number} ms
   */
  function reportPosition(ms) {
    positionMs = Math.max(0, ms);
    anchorWall = Date.now();
    anchorPos = positionMs;
  }

  /**
   * Duck volume during an allowed talk window (fade edges).
   */
  function duckForSpeech() {
    const state = getState();
    if (!state.canSpeak || !state.playing) return state;
    volume = opts.talkOverlayVolume;
    emit('duck', { volume });
    return getState();
  }

  function unduck() {
    if (playback === 'playing' || playback === 'fading_in') {
      volume = 0.7;
      emit('unduck', { volume });
    }
    return getState();
  }

  return {
    enqueue,
    clearQueue,
    play,
    pause,
    stop,
    requestTalkWindow,
    reportPosition,
    duckForSpeech,
    unduck,
    getState,
    /** @returns {Track|null} */
    getCurrent: () => (current ? { ...current } : null),
    /** @returns {Track[]} */
    getQueue: () => queue.map((t) => ({ ...t })),
    options: opts,
  };
}
