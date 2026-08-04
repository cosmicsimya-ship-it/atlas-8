/**
 * ATLAS LIVE — presenter.
 * Chooses content blocks, shapes radio-paced speech, never dumps information.
 */

import { makeSpokenSegment, makePresenterBeat } from './schema.js';
import { selectNextBlock } from './topics.js';
import { shapeCuesForPersonality, resolveDaypartMood, DEFAULT_PERSONALITY } from './personality.js';
import { cuesToScript, fallbackEventCues } from './prompts.js';
import { planTransition, prependTransition, resolveEventInterruptPolicy } from './transitions.js';
import { jitterDuration } from './scheduler.js';

/**
 * @param {{
 *   history: ReturnType<import('./history.js').createHistory>,
 *   personality?: object,
 *   voice?: { speak: Function, estimateSpeechDurationMs?: Function },
 *   polishScript?: ((cues: string[], meta: object) => Promise<string[]>)|null,
 *   rng?: () => number,
 * }} deps
 */
export function createPresenter(deps) {
  const history = deps.history;
  const personality = deps.personality ?? DEFAULT_PERSONALITY;
  const voice = deps.voice ?? null;
  const polishScript = deps.polishScript ?? null;
  const rng = deps.rng ?? Math.random;

  /**
   * Build a speech beat from a content block.
   * @param {import('./schema.js').ContentBlock} block
   * @param {{ mood?: string, daypart?: string }} [ctx]
   */
  async function materializeBlock(block, ctx = {}) {
    let cues = shapeCuesForPersonality(block.cues, {
      mood: /** @type {any} */ (ctx.mood),
    });

    if (typeof polishScript === 'function') {
      try {
        const polished = await polishScript(cues, {
          category: block.category,
          daypart: ctx.daypart,
          mood: ctx.mood,
          recentCategories: history.recentCategories(6),
        });
        if (Array.isArray(polished) && polished.length) {
          cues = shapeCuesForPersonality(polished, { mood: /** @type {any} */ (ctx.mood) });
        }
      } catch {
        /* non-fatal — keep seed cues */
      }
    }

    // Silence category → intentional pause beat, not speech.
    if (block.category === 'silence' || (cues.length === 1 && cues[0] === '...')) {
      const durationMs = jitterDuration(7_500, 0.4, rng);
      return makePresenterBeat({
        kind: 'silence',
        durationMs,
        reason: `block:${block.id}`,
        meta: { blockId: block.id, category: block.category },
      });
    }

    const text = cuesToScript(cues);
    const pauseMsAfter = jitterDuration(
      personality.pacing?.minPauseMs ?? 1200,
      0.5,
      rng,
    );

    const segment = makeSpokenSegment({
      blockId: block.id,
      category: block.category,
      text,
      cues,
      pauseMsAfter,
      status: 'ready',
    });

    let durationMs = 10_000;
    if (voice?.estimateSpeechDurationMs) {
      durationMs = voice.estimateSpeechDurationMs(text, cues) + pauseMsAfter;
    } else if (voice?.speak) {
      // Duration refined later when synthesized.
      durationMs = Math.max(5_000, cues.length * 2_800 + pauseMsAfter);
    } else {
      durationMs = Math.max(5_000, cues.length * 2_800 + pauseMsAfter);
    }

    return makePresenterBeat({
      kind: 'speech',
      segment,
      durationMs,
      reason: `block:${block.id}`,
      meta: { blockId: block.id, category: block.category, title: block.title },
    });
  }

  /**
   * Choose and materialize the next organic beat.
   * @param {{
   *   now?: Date,
   *   canSpeak?: boolean,
   *   musicPlaying?: boolean,
   *   preferCategories?: string[],
   *   forceCategory?: string|null,
   * }} [ctx]
   * @returns {Promise<import('./schema.js').PresenterBeat[]>}
   */
  async function nextBeats(ctx = {}) {
    const now = ctx.now ?? new Date();
    const { daypart, mood, greetingBias } = resolveDaypartMood(now);

    // Soft greeting bias early in a quiet history.
    const prefer = [...(ctx.preferCategories || [])];
    if (history.getSegments().length < 2 && greetingBias) {
      prefer.push(greetingBias);
    }

    const cooled = new Set(history.cooledCategories());
    const block = selectNextBlock({
      daypart,
      recentIds: history.recentBlockIds(10),
      recentCategories: [...history.recentCategories(6), ...cooled],
      preferCategories: prefer,
      forceCategory: ctx.forceCategory ?? null,
      // Keep sky topics rare — not a constant astrology loop.
      allowRareSky: rng() < 0.22,
      rng,
    });

    if (!block) {
      return [
        makePresenterBeat({
          kind: 'silence',
          durationMs: jitterDuration(8_000, 0.3, rng),
          reason: 'no_block_available',
        }),
      ];
    }

    // Music transition blocks: plan a hand-off when appropriate.
    if (block.category === 'music_transition') {
      const plan = planTransition({
        kind: 'to_music',
        canSpeak: ctx.canSpeak,
        musicPlaying: ctx.musicPlaying,
        rng,
      });
      const main = await materializeBlock(block, { mood, daypart });
      history.recordSegment({
        blockId: block.id,
        category: block.category,
        text: main.segment?.text,
        id: main.segment?.id,
      });
      return prependTransition(plan, main);
    }

    if (ctx.musicPlaying && ctx.canSpeak === false && !block.allowDuringMusic) {
      const plan = planTransition({
        kind: 'to_speech',
        canSpeak: false,
        musicPlaying: true,
        rng,
      });
      return plan.beats;
    }

    const main = await materializeBlock(block, { mood, daypart });
    if (main.segment) {
      history.recordSegment({
        blockId: block.id,
        category: block.category,
        text: main.segment.text,
        id: main.segment.id,
      });
    } else {
      history.recordSegment({
        blockId: block.id,
        category: block.category,
        text: '',
      });
    }

    // Occasional soft bridge before speech (organic, not every time).
    if (rng() < 0.2 && main.kind === 'speech') {
      const plan = planTransition({
        kind: 'to_speech',
        canSpeak: ctx.canSpeak !== false,
        musicPlaying: !!ctx.musicPlaying,
        rng,
      });
      return prependTransition(plan, main);
    }

    return [main];
  }

  /**
   * Acknowledge a live event without killing atmosphere.
   * @param {import('./schema.js').LiveEvent} event
   * @param {{ canSpeak?: boolean, musicPlaying?: boolean }} [ctx]
   * @returns {Promise<{ policy: object, beats: import('./schema.js').PresenterBeat[] }>}
   */
  async function acknowledgeEvent(event, ctx = {}) {
    const policy = resolveEventInterruptPolicy({
      priority: event.priority || 'normal',
      canSpeak: ctx.canSpeak !== false,
      musicPlaying: !!ctx.musicPlaying,
    });

    if (!policy.allow) {
      const waitMs = Math.max(policy.delayMs, event.suggestedDelayMs || 0);
      return {
        policy,
        beats: [
          makePresenterBeat({
            kind: 'silence',
            durationMs: waitMs,
            reason: `event_deferred:${event.type}`,
            meta: { eventType: event.type, mode: policy.mode },
          }),
        ],
      };
    }

    const cues = fallbackEventCues(event.type, event.payload);
    const shaped = shapeCuesForPersonality(cues, { mood: 'warm' });
    const text = cuesToScript(shaped);
    const segment = makeSpokenSegment({
      blockId: `event:${event.type}`,
      category: `event:${event.type}`,
      text,
      cues: shaped,
      pauseMsAfter: jitterDuration(1400, 0.4, rng),
      status: 'ready',
      voiceMeta: { event: true },
    });

    history.recordSegment({
      blockId: segment.blockId,
      category: segment.category,
      text: segment.text,
      id: segment.id,
    });
    history.recordEvent(event);

    const bridge = planTransition({
      kind: 'event_soft',
      canSpeak: ctx.canSpeak !== false,
      musicPlaying: !!ctx.musicPlaying,
      rng,
    });

    const speechBeat = makePresenterBeat({
      kind: 'event_ack',
      segment,
      durationMs: Math.max(4_000, shaped.length * 2_500),
      reason: `event:${event.type}`,
      meta: { eventType: event.type, priority: event.priority },
    });

    return {
      policy,
      beats: prependTransition(bridge, speechBeat),
    };
  }

  /**
   * Optionally synthesize voice for a speech/event beat.
   * @param {import('./schema.js').PresenterBeat} beat
   */
  async function synthesizeBeat(beat) {
    if (!voice?.speak || !beat.segment || (beat.kind !== 'speech' && beat.kind !== 'event_ack')) {
      return beat;
    }
    const result = await voice.speak({
      text: beat.segment.text,
      cues: beat.segment.cues,
      style: personality.voiceHints,
    });
    beat.segment.voiceMeta = {
      ...(beat.segment.voiceMeta || {}),
      ...result,
    };
    beat.segment.status = result.ok ? 'ready' : 'failed';
    if (result.ok && result.durationMs) {
      beat.durationMs = result.durationMs + (beat.segment.pauseMsAfter || 0);
    }
    return beat;
  }

  return {
    nextBeats,
    acknowledgeEvent,
    synthesizeBeat,
    materializeBlock,
  };
}
