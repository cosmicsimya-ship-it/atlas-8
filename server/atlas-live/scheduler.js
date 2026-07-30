/**
 * ATLAS LIVE — organic scheduler.
 * Decides speak / silence / music / transition / listen windows.
 * Never metronomic. Never predictable.
 */

/**
 * @typedef {object} SchedulerConfig
 * @property {number} [minSpeakGapMs]
 * @property {number} [maxSpeakGapMs]
 * @property {number} [minSilenceMs]
 * @property {number} [maxSilenceMs]
 * @property {number} [minMusicMs]
 * @property {number} [maxMusicMs]
 * @property {number} [listenWindowMs]
 * @property {number} [speakBias]          0..1 chance to prefer speak when eligible
 */

export const DEFAULT_SCHEDULER_CONFIG = Object.freeze({
  minSpeakGapMs: 18_000,
  maxSpeakGapMs: 95_000,
  minSilenceMs: 4_000,
  maxSilenceMs: 28_000,
  minMusicMs: 90_000,
  maxMusicMs: 240_000,
  listenWindowMs: 12_000,
  speakBias: 0.55,
});

/**
 * Inclusive random int.
 * @param {number} min
 * @param {number} max
 * @param {() => number} rng
 */
function randInt(min, max, rng) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(rng() * (b - a + 1)) + a;
}

/**
 * Pick from weighted action list.
 * @param {{ action: string, weight: number, durationMs: number, reason: string, meta?: object }[]} items
 * @param {() => number} rng
 */
function pickWeighted(items, rng) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) {
      return {
        action: /** @type {import('./schema.js').ScheduleDecision['action']} */ (item.action),
        durationMs: item.durationMs,
        reason: item.reason,
        meta: item.meta || {},
      };
    }
  }
  const last = items[items.length - 1];
  return {
    action: /** @type {import('./schema.js').ScheduleDecision['action']} */ (last.action),
    durationMs: last.durationMs,
    reason: last.reason,
    meta: last.meta || {},
  };
}

/**
 * Create an organic radio scheduler.
 * @param {Partial<SchedulerConfig>} [config]
 */
export function createScheduler(config = {}) {
  const cfg = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
  let lastSpeakAt = 0;
  let lastAction = /** @type {string|null} */ (null);
  let beatCount = 0;
  const rng = config.rng ?? Math.random;

  /**
   * @param {{
   *   now?: number,
   *   musicPlaying?: boolean,
   *   canSpeak?: boolean,
   *   pendingEvent?: boolean,
   *   forceAction?: import('./schema.js').ScheduleDecision['action']|null,
   *   daypart?: string,
   * }} [ctx]
   * @returns {import('./schema.js').ScheduleDecision}
   */
  function nextDecision(ctx = {}) {
    const now = ctx.now ?? Date.now();
    beatCount += 1;

    if (ctx.forceAction) {
      const forced = buildForced(ctx.forceAction, ctx, now);
      lastAction = forced.action;
      if (forced.action === 'speak') lastSpeakAt = now;
      return forced;
    }

    // Pending soft events nudge toward a short speak / transition — never yank music hard.
    if (ctx.pendingEvent) {
      if (ctx.musicPlaying && !ctx.canSpeak) {
        const d = {
          action: /** @type {const} */ ('silence'),
          durationMs: randInt(2_000, 6_000, rng),
          reason: 'event_wait_for_music_window',
          meta: { pendingEvent: true },
        };
        lastAction = d.action;
        return d;
      }
      const d = {
        action: /** @type {const} */ ('speak'),
        durationMs: randInt(6_000, 14_000, rng),
        reason: 'soft_event_ack',
        meta: { pendingEvent: true },
      };
      lastAction = d.action;
      lastSpeakAt = now;
      return d;
    }

    const sinceSpeak = now - lastSpeakAt;
    const speakDue = lastSpeakAt === 0 || sinceSpeak >= randInt(cfg.minSpeakGapMs, cfg.maxSpeakGapMs, rng);

    /** Night leans more silence; morning a bit more presence. */
    const daypart = ctx.daypart || 'anytime';
    const silenceBoost = daypart === 'night' ? 1.35 : daypart === 'morning' ? 0.85 : 1;
    const speakBoost = daypart === 'morning' ? 1.15 : daypart === 'night' ? 0.9 : 1;

    /** Avoid repeating the exact same action class back-to-back too often. */
    const avoidRepeat = (action, weight) =>
      lastAction === action ? weight * 0.45 : weight;

    const candidates = [];

    if (ctx.canSpeak !== false && (speakDue || rng() < cfg.speakBias * 0.25)) {
      candidates.push({
        action: 'speak',
        weight: avoidRepeat('speak', 3.2 * speakBoost),
        durationMs: randInt(8_000, 22_000, rng),
        reason: speakDue ? 'organic_speak_window' : 'soft_presence',
      });
    }

    candidates.push({
      action: 'silence',
      weight: avoidRepeat('silence', 2.4 * silenceBoost),
      durationMs: randInt(cfg.minSilenceMs, cfg.maxSilenceMs, rng),
      reason: 'held_silence',
    });

    if (!ctx.musicPlaying) {
      candidates.push({
        action: 'music',
        weight: avoidRepeat('music', 2.8),
        durationMs: randInt(cfg.minMusicMs, cfg.maxMusicMs, rng),
        reason: 'music_bed',
      });
    } else {
      candidates.push({
        action: 'transition',
        weight: avoidRepeat('transition', ctx.canSpeak ? 1.6 : 0.4),
        durationMs: randInt(3_000, 9_000, rng),
        reason: 'music_edge_transition',
        meta: { needsSpeakWindow: !ctx.canSpeak },
      });
    }

    // Occasional listen window — space for future listener interaction.
    if (beatCount % 7 === 0 || rng() < 0.08) {
      candidates.push({
        action: 'listen_window',
        weight: 1.1,
        durationMs: cfg.listenWindowMs + randInt(-2_000, 4_000, rng),
        reason: 'listener_interaction_timing',
      });
    }

    const decision = pickWeighted(candidates, rng);
    lastAction = decision.action;
    if (decision.action === 'speak') lastSpeakAt = now;
    return decision;
  }

  /**
   * @param {import('./schema.js').ScheduleDecision['action']} action
   * @param {object} ctx
   * @param {number} now
   */
  function buildForced(action, ctx, now) {
    const map = {
      speak: randInt(8_000, 20_000, rng),
      silence: randInt(cfg.minSilenceMs, cfg.maxSilenceMs, rng),
      music: randInt(cfg.minMusicMs, cfg.maxMusicMs, rng),
      transition: randInt(3_000, 8_000, rng),
      listen_window: cfg.listenWindowMs,
    };
    if (action === 'speak') lastSpeakAt = now;
    return {
      action,
      durationMs: map[action] ?? 8_000,
      reason: 'forced',
      meta: { musicPlaying: !!ctx.musicPlaying },
    };
  }

  function markSpoke(at = Date.now()) {
    lastSpeakAt = at;
    lastAction = 'speak';
  }

  function snapshot() {
    return {
      lastSpeakAt,
      lastAction,
      beatCount,
      config: { ...cfg },
    };
  }

  function reset() {
    lastSpeakAt = 0;
    lastAction = null;
    beatCount = 0;
  }

  return {
    nextDecision,
    markSpoke,
    snapshot,
    reset,
    config: cfg,
  };
}

/**
 * Jitter a base duration so loops never feel mechanical.
 * @param {number} baseMs
 * @param {number} [jitterRatio]
 * @param {() => number} [rng]
 */
export function jitterDuration(baseMs, jitterRatio = 0.22, rng = Math.random) {
  const j = baseMs * jitterRatio;
  return Math.max(500, Math.round(baseMs + (rng() * 2 - 1) * j));
}
