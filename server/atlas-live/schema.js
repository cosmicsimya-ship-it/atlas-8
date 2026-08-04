/**
 * ATLAS LIVE — schema & contracts.
 * Living AI radio presenter engine. Not a chatbot, not TTS-only, not a podcast player.
 */

export const ATLAS_LIVE_VERSION = 'atlas-live-v1';

/** @typedef {'idle'|'speaking'|'music'|'silence'|'transition'|'paused'|'stopped'} EngineState */
/** @typedef {'fade_in'|'fade_out'|'talk_window'|'blocked'} SpeakWindow */
/** @typedef {'low'|'normal'|'high'|'urgent'} EventPriority */
/** @typedef {'elevenlabs'|'openai_realtime'|'azure_tts'|'google_tts'|'local_xtts'|'mock'} VoiceProviderId */
/** @typedef {'queued'|'ready'|'speaking'|'spoken'|'skipped'|'failed'} SegmentStatus */

/**
 * @typedef {object} ContentBlock
 * @property {string} id
 * @property {string} category
 * @property {string} title
 * @property {string[]} cues           Short spoken lines (radio pacing). Each cue is a breath.
 * @property {number} [weight]         Relative selection weight (default 1).
 * @property {string[]} [tags]
 * @property {string[]} [dayparts]     morning|afternoon|evening|night|anytime
 * @property {boolean} [allowDuringMusic]
 */

/**
 * @typedef {object} SpokenSegment
 * @property {string} id
 * @property {string} blockId
 * @property {string} category
 * @property {string} text             Full joined script for this beat.
 * @property {string[]} cues           Individual paced lines.
 * @property {number} pauseMsAfter     Silence after this segment.
 * @property {SegmentStatus} status
 * @property {object} [voiceMeta]
 * @property {string} createdAt
 */

/**
 * @typedef {object} ScheduleDecision
 * @property {'speak'|'silence'|'music'|'transition'|'listen_window'} action
 * @property {number} durationMs
 * @property {string} reason
 * @property {object} [meta]
 */

/**
 * @typedef {object} MusicState
 * @property {boolean} playing
 * @property {string|null} trackId
 * @property {string|null} title
 * @property {number} positionMs
 * @property {number} durationMs
 * @property {number} volume         0..1
 * @property {SpeakWindow} speakWindow
 * @property {boolean} canSpeak
 */

/**
 * @typedef {object} LiveEvent
 * @property {string} type
 * @property {EventPriority} priority
 * @property {object} [payload]
 * @property {number} [suggestedDelayMs]
 * @property {string} createdAt
 */

/**
 * @typedef {object} PresenterBeat
 * @property {string} id
 * @property {'speech'|'silence'|'music_cue'|'transition'|'event_ack'} kind
 * @property {SpokenSegment|null} segment
 * @property {number} durationMs
 * @property {string} reason
 * @property {object} [meta]
 */

/**
 * @typedef {object} EngineSnapshot
 * @property {string} version
 * @property {string} sessionId
 * @property {EngineState} state
 * @property {MusicState} music
 * @property {number} listenerCount
 * @property {string|null} lastCategory
 * @property {string[]} recentCategories
 * @property {number} uptimeMs
 * @property {string} startedAt
 * @property {object} personality
 */

/**
 * @param {Partial<SpokenSegment> & { text: string, blockId: string, category: string }} partial
 * @returns {SpokenSegment}
 */
export function makeSpokenSegment(partial) {
  const cues = Array.isArray(partial.cues) && partial.cues.length
    ? partial.cues
    : String(partial.text || '')
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);

  return {
    id: partial.id ?? `seg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    blockId: partial.blockId,
    category: partial.category,
    text: partial.text || cues.join('\n\n'),
    cues,
    pauseMsAfter: Number.isFinite(partial.pauseMsAfter) ? partial.pauseMsAfter : 1800,
    status: partial.status ?? 'queued',
    voiceMeta: partial.voiceMeta ?? {},
    createdAt: partial.createdAt ?? new Date().toISOString(),
  };
}

/**
 * @param {Partial<LiveEvent> & { type: string }} partial
 * @returns {LiveEvent}
 */
export function makeLiveEvent(partial) {
  return {
    type: partial.type,
    priority: partial.priority ?? 'normal',
    payload: partial.payload && typeof partial.payload === 'object' ? partial.payload : {},
    suggestedDelayMs: Number.isFinite(partial.suggestedDelayMs) ? partial.suggestedDelayMs : 0,
    createdAt: partial.createdAt ?? new Date().toISOString(),
  };
}

/**
 * @param {Partial<PresenterBeat> & { kind: PresenterBeat['kind'], durationMs: number, reason: string }} partial
 * @returns {PresenterBeat}
 */
export function makePresenterBeat(partial) {
  return {
    id: partial.id ?? `beat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind: partial.kind,
    segment: partial.segment ?? null,
    durationMs: Math.max(0, Number(partial.durationMs) || 0),
    reason: partial.reason,
    meta: partial.meta && typeof partial.meta === 'object' ? partial.meta : {},
  };
}

/**
 * Soft structural check for spoken segments.
 * @param {unknown} seg
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSpokenSegment(seg) {
  const errors = [];
  if (!seg || typeof seg !== 'object') return { ok: false, errors: ['segment must be object'] };
  for (const key of ['id', 'blockId', 'category', 'text', 'cues', 'status']) {
    if (!(key in seg)) errors.push(`missing:${key}`);
  }
  if (seg.cues != null && !Array.isArray(seg.cues)) errors.push('cues must be array');
  return { ok: errors.length === 0, errors };
}

/** Known soft live-event types (extensible). */
export const LIVE_EVENT_TYPES = Object.freeze([
  'listener_joined',
  'listener_left',
  'milestone_listeners',
  'midnight',
  'sunrise',
  'sunset',
  'friday_evening',
  'ramadan',
  'eid',
  'astronomical_event',
  'session_start',
  'session_end',
  'manual_cue',
]);

/** Content categories the presenter may choose from. */
export const CONTENT_CATEGORIES = Object.freeze([
  'morning_greeting',
  'night_greeting',
  'astronomy_fact',
  'space_fact',
  'history_fact',
  'psychology_insight',
  'listener_question',
  'todays_reflection',
  'short_philosophy',
  'book_recommendation',
  'movie_recommendation',
  'music_transition',
  'silence',
  'weather_mood',
  'moon_observation',
  'constellation_story',
  'ancient_civilization',
  'science_news',
  'technology_curiosity',
  'random_paradox',
  'thought_experiment',
  'pattern_of_the_day',
  'human_behavior',
  'creative_challenge',
  'memory_exercise',
  'brain_teaser',
  'quote',
  'life_observation',
  'invisible_details',
]);
