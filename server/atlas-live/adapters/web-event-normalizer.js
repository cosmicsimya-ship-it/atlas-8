/**
 * ATLAS LIVE — Normalize engine output into Web adapter events.
 * No new content generation — mapping only.
 */

import { WEB_ADAPTER_ERROR_CODES } from './web-session-schema.js';

/**
 * @param {string} sessionId
 * @param {number} sequence
 * @param {string} type
 * @param {object} payload
 * @param {string} [timestamp]
 * @returns {import('./web-session-schema.js').WebAdapterEvent}
 */
export function makeWebEvent(sessionId, sequence, type, payload, timestamp) {
  return {
    id: `wev_${sessionId}_${sequence}`,
    sessionId,
    type,
    timestamp: timestamp ?? new Date().toISOString(),
    sequence,
    payload: payload && typeof payload === 'object' ? payload : {},
  };
}

/**
 * Map engine onEvent callback to zero or more web events.
 * @param {string} sessionId
 * @param {number} baseSequence
 * @param {string} engineType
 * @param {object} [payload]
 * @param {string} [timestamp]
 * @returns {import('./web-session-schema.js').WebAdapterEvent[]}
 */
export function normalizeEngineCallback(sessionId, baseSequence, engineType, payload = {}, timestamp) {
  const ts = timestamp ?? new Date().toISOString();
  const events = [];

  const push = (type, pl) => {
    events.push(makeWebEvent(sessionId, baseSequence + events.length, type, pl, ts));
  };

  switch (engineType) {
    case 'speak':
      push('presenter.segment', {
        kind: 'speech',
        text: payload.text ?? null,
        cues: payload.cues ?? [],
        category: payload.category ?? null,
        durationMs: payload.durationMs ?? null,
      });
      if (payload.voiceMeta) {
        push('presenter.voice', extractVoicePayload(payload));
      }
      break;
    case 'silence':
      push('presenter.completed', {
        kind: 'silence',
        durationMs: payload.durationMs ?? null,
        reason: payload.reason ?? null,
      });
      break;
    case 'music_cue':
      push('presenter.music', {
        kind: 'music_cue',
        durationMs: payload.durationMs ?? null,
        meta: payload.meta ?? {},
        audioUrl: null,
        audioState: 'queued',
      });
      break;
    case 'transition':
      push('presenter.transition', {
        kind: 'transition',
        durationMs: payload.durationMs ?? null,
        meta: payload.meta ?? {},
      });
      break;
    default:
      if (engineType.startsWith('music:')) {
        push('presenter.music', {
          kind: 'music_transport',
          engineType,
          meta: payload,
          audioUrl: null,
          audioState: payload?.playback ?? 'unknown',
        });
      }
      break;
  }

  return events;
}

/**
 * Map tick() result beat into web events.
 * @param {string} sessionId
 * @param {number} baseSequence
 * @param {object} tickResult
 * @param {string} [timestamp]
 * @returns {import('./web-session-schema.js').WebAdapterEvent[]}
 */
export function normalizeTickResult(sessionId, baseSequence, tickResult, timestamp) {
  if (!tickResult || tickResult.ok === false) {
    return [
      makeWebEvent(
        sessionId,
        baseSequence,
        'presenter.error',
        {
          code: tickResult?.reason === 'stopped'
            ? 'SESSION_ALREADY_STOPPED'
            : 'TICK_FAILED',
          message: tickResult?.reason ?? 'Tick failed',
        },
        timestamp,
      ),
    ];
  }

  const beat = tickResult.beat;
  if (!beat) return [];

  const ts = timestamp ?? new Date().toISOString();
  const events = [];
  let seq = baseSequence;

  const push = (type, payload) => {
    events.push(makeWebEvent(sessionId, seq, type, payload, ts));
    seq += 1;
  };

  switch (beat.kind) {
    case 'speech':
    case 'event_ack':
      push('presenter.segment', {
        beatId: beat.id,
        kind: beat.kind,
        reason: beat.reason,
        text: beat.segment?.text ?? null,
        cues: beat.segment?.cues ?? [],
        category: beat.segment?.category ?? null,
        durationMs: beat.durationMs ?? tickResult.durationMs ?? null,
        meta: beat.meta ?? {},
      });
      if (beat.segment?.voiceMeta) {
        push('presenter.voice', {
          beatId: beat.id,
          ...extractVoicePayload({
            text: beat.segment.text,
            voiceMeta: beat.segment.voiceMeta,
            durationMs: beat.durationMs,
          }),
        });
      }
      break;
    case 'silence':
      push('presenter.completed', {
        beatId: beat.id,
        kind: 'silence',
        durationMs: beat.durationMs ?? null,
        reason: beat.reason,
        meta: beat.meta ?? {},
      });
      break;
    case 'music_cue':
      push('presenter.music', {
        beatId: beat.id,
        kind: 'music_cue',
        durationMs: beat.durationMs ?? null,
        reason: beat.reason,
        meta: beat.meta ?? {},
        audioUrl: null,
        audioState: beat.meta?.placeholder ? 'placeholder' : 'queued',
      });
      break;
    case 'transition':
      push('presenter.transition', {
        beatId: beat.id,
        kind: 'transition',
        durationMs: beat.durationMs ?? null,
        reason: beat.reason,
        meta: beat.meta ?? {},
      });
      break;
    default:
      push('presenter.error', {
        code: WEB_ADAPTER_ERROR_CODES.EVENT_NORMALIZATION_FAILED,
        message: `Unknown beat kind: ${beat.kind}`,
        beatId: beat.id,
      });
  }

  return events;
}

/**
 * @param {{ text?: string, voiceMeta?: object, durationMs?: number }} payload
 */
function extractVoicePayload(payload) {
  const meta = payload.voiceMeta && typeof payload.voiceMeta === 'object' ? payload.voiceMeta : {};
  return {
    text: payload.text ?? null,
    voiceId: meta.voiceId ?? meta.meta?.voiceId ?? null,
    durationMs: meta.durationMs ?? payload.durationMs ?? null,
    audioUrl: meta.audioUrl ?? null,
    audioState: meta.ok === false ? 'failed' : meta.audioUrl ? 'ready' : 'simulated',
    provider: meta.provider ?? meta.meta?.fallbackFrom ?? null,
    error: meta.error ?? meta.meta?.originalError ?? null,
  };
}
