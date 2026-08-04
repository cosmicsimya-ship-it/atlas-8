/**
 * ATLAS LIVE — transitions between speech, music, and silence.
 * Soft edges only. Never aggressive cuts over music.
 */

import { makePresenterBeat } from './schema.js';
import { jitterDuration } from './scheduler.js';

/**
 * @typedef {'to_speech'|'to_music'|'to_silence'|'event_soft'|'session_open'|'session_close'} TransitionKind
 */

/**
 * @typedef {object} TransitionPlan
 * @property {TransitionKind} kind
 * @property {import('./schema.js').PresenterBeat[]} beats
 * @property {number} totalMs
 * @property {string} reason
 */

const SOFT_LINERS = Object.freeze({
  to_speech: ["...", "And now..."],
  to_music: ["I'll be right back.", "Stay with this one..."],
  to_silence: ["...", "Let's leave a little space."],
  event_soft: ["...", "Hmm..."],
  session_open: [
    'Good evening...',
    "You're listening to Atlas Live.",
    "I'm Atlas.",
  ],
  session_close: ['Thank you for listening...', 'Until next time.'],
});

/**
 * Build a soft transition plan.
 * Respects music speak windows — if blocked, inserts wait silence first.
 * @param {{
 *   kind: TransitionKind,
 *   canSpeak?: boolean,
 *   musicPlaying?: boolean,
 *   reason?: string,
 *   rng?: () => number,
 * }} input
 * @returns {TransitionPlan}
 */
export function planTransition(input) {
  const rng = input.rng ?? Math.random;
  const kind = input.kind;
  const beats = [];
  let totalMs = 0;

  // If music blocks speech, wait organically instead of interrupting.
  if (
    (kind === 'to_speech' || kind === 'event_soft' || kind === 'session_open') &&
    input.musicPlaying &&
    input.canSpeak === false
  ) {
    const waitMs = jitterDuration(5_500, 0.3, rng);
    beats.push(
      makePresenterBeat({
        kind: 'silence',
        durationMs: waitMs,
        reason: 'wait_music_speak_window',
        meta: { transition: kind },
      }),
    );
    totalMs += waitMs;
  }

  const liners = SOFT_LINERS[kind] || SOFT_LINERS.event_soft;

  if (kind === 'to_silence') {
    const silenceMs = jitterDuration(6_000, 0.35, rng);
    beats.push(
      makePresenterBeat({
        kind: 'silence',
        durationMs: silenceMs,
        reason: input.reason || 'intentional_silence',
        meta: { liners },
      }),
    );
    totalMs += silenceMs;
  } else if (kind === 'to_music') {
    const cueMs = jitterDuration(3_500, 0.25, rng);
    beats.push(
      makePresenterBeat({
        kind: 'music_cue',
        durationMs: cueMs,
        reason: input.reason || 'hand_off_to_music',
        meta: { liners },
      }),
    );
    totalMs += cueMs;
  } else {
    const bridgeMs = jitterDuration(2_800, 0.3, rng);
    beats.push(
      makePresenterBeat({
        kind: 'transition',
        durationMs: bridgeMs,
        reason: input.reason || `transition_${kind}`,
        meta: { liners, kind },
      }),
    );
    totalMs += bridgeMs;
  }

  return {
    kind,
    beats,
    totalMs,
    reason: input.reason || kind,
  };
}

/**
 * Merge transition beats ahead of a main presenter beat.
 * @param {TransitionPlan} plan
 * @param {import('./schema.js').PresenterBeat} mainBeat
 * @returns {import('./schema.js').PresenterBeat[]}
 */
export function prependTransition(plan, mainBeat) {
  return [...plan.beats, mainBeat];
}

/**
 * Decide whether an event may speak now or must wait for a soft edge.
 * @param {{
 *   priority: import('./schema.js').EventPriority,
 *   canSpeak: boolean,
 *   musicPlaying: boolean,
 * }} ctx
 * @returns {{ allow: boolean, mode: 'now'|'wait_window'|'queue', delayMs: number }}
 */
export function resolveEventInterruptPolicy(ctx) {
  const { priority, canSpeak, musicPlaying } = ctx;

  if (!musicPlaying || canSpeak) {
    return { allow: true, mode: 'now', delayMs: priority === 'urgent' ? 0 : 800 };
  }

  // Never aggressively interrupt mid-song — even urgent waits for fade edge,
  // unless future transport exposes a true emergency duck (not default).
  if (priority === 'urgent') {
    return { allow: false, mode: 'wait_window', delayMs: 3_000 };
  }
  if (priority === 'high') {
    return { allow: false, mode: 'wait_window', delayMs: 6_000 };
  }
  return { allow: false, mode: 'queue', delayMs: 12_000 };
}

/**
 * Pick a liner randomly for ad-lib transitions.
 * @param {TransitionKind} kind
 * @param {() => number} [rng]
 */
export function pickTransitionLiner(kind, rng = Math.random) {
  const list = SOFT_LINERS[kind] || SOFT_LINERS.event_soft;
  return list[Math.floor(rng() * list.length)] || '...';
}
