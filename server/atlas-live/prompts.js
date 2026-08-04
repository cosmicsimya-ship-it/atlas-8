/**
 * ATLAS LIVE — prompt builders for script polish / optional LLM assist.
 * Prompts enforce radio pacing. They never ask for dumps or lectures.
 */

import { buildPersonalityBrief, DEFAULT_PERSONALITY } from './personality.js';

/**
 * System prompt for optional script rewriting (LLM assist).
 * The engine works without an LLM — prompts are for enhancement only.
 * @param {{ personality?: object, language?: string }} [opts]
 * @returns {string}
 */
export function buildPresenterSystemPrompt(opts = {}) {
  const personality = opts.personality ?? DEFAULT_PERSONALITY;
  const language = opts.language ?? 'en';

  return [
    buildPersonalityBrief(personality),
    '',
    'FORMAT RULES',
    '- Output short spoken cues only, one breath per line.',
    '- Separate breaths with a blank line.',
    '- Maximum 5 lines.',
    '- Prefer ellipses and soft pauses over dense sentences.',
    '- Never dump facts. Never sound like Wikipedia.',
    '- Never lecture, preach, or over-explain.',
    '- Do not constantly mention astrology or planets.',
    '- Do not say you are an AI unless asked.',
    '- Do not use markdown, bullets, or stage directions in brackets.',
    `- Language: ${language}.`,
    '',
    'EXAMPLE SHAPE',
    'Good evening...',
    '',
    "You're listening to Atlas Live.",
    '',
    "I'm Atlas.",
    '',
    'Tonight feels quieter than usual...',
  ].join('\n');
}

/**
 * User prompt: polish a seed block into radio delivery.
 * @param {{
 *   cues: string[],
 *   category: string,
 *   daypart?: string,
 *   mood?: string,
 *   eventContext?: string|null,
 *   recentCategories?: string[],
 * }} input
 * @returns {string}
 */
export function buildPolishUserPrompt(input) {
  const seed = (input.cues || []).join('\n\n');
  const recent = (input.recentCategories || []).join(', ') || 'none';
  return [
    `Category: ${input.category}`,
    `Daypart: ${input.daypart ?? 'anytime'}`,
    `Mood: ${input.mood ?? 'calm'}`,
    `Recently covered (avoid repeating tone): ${recent}`,
    input.eventContext ? `Soft event context (do not announce aggressively): ${input.eventContext}` : null,
    '',
    'Seed cues to polish (keep meaning, improve radio feel):',
    seed,
    '',
    'Rewrite as Atlas Live spoken cues only.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Prompt for acknowledging a live event without killing the atmosphere.
 * @param {{ type: string, payload?: object, musicPlaying?: boolean }} event
 * @returns {{ system: string, user: string }}
 */
export function buildEventAckPrompts(event) {
  const system = [
    buildPersonalityBrief(),
    '',
    'You acknowledge a live radio event.',
    'Keep it to 1–3 short cues.',
    'Never interrupt the mood.',
    'If music is playing, be even softer and shorter.',
    'Do not sound like a system notification.',
  ].join('\n');

  const user = [
    `Event type: ${event.type}`,
    `Music playing: ${event.musicPlaying ? 'yes' : 'no'}`,
    `Payload: ${JSON.stringify(event.payload || {})}`,
    '',
    'Write a natural on-air acknowledgment.',
  ].join('\n');

  return { system, user };
}

/**
 * Fallback templates when no LLM is configured — already radio-paced.
 * @param {string} eventType
 * @param {object} [payload]
 * @returns {string[]}
 */
export function fallbackEventCues(eventType, payload = {}) {
  switch (eventType) {
    case 'listener_joined':
      return ['Someone new just joined us...', 'Welcome in.'];
    case 'listener_left':
      return ['A quiet goodbye to someone who stepped away...'];
    case 'milestone_listeners': {
      const n = payload.count ?? payload.milestone ?? 100;
      return [`We've reached ${n} listeners...`, 'Thank you for being here.'];
    }
    case 'midnight':
      return ['Midnight...', 'A soft hinge between days.', "Still with me?"];
    case 'sunrise':
      return ['Sunrise is near...', 'The night loosens its grip.'];
    case 'sunset':
      return ['The day is folding...', 'Evening finds us again.'];
    case 'friday_evening':
      return ['Friday evening...', 'A different kind of quiet.'];
    case 'ramadan':
      return ['A blessed night of Ramadan...', 'Softness, patience, presence.'];
    case 'eid':
      return ['Eid blessings to those celebrating...', 'May the day feel light.'];
    case 'astronomical_event':
      return [
        'Something rare is happening in the sky tonight...',
        payload.name ? `${payload.name}.` : 'No lecture. Just wonder.',
        "I'll leave space for it.",
      ];
    case 'session_start':
      return [
        'Good evening...',
        "You're listening to Atlas Live.",
        "I'm Atlas.",
        "Let's stay together for a while.",
      ];
    case 'session_end':
      return ['Thank you for listening...', 'Atlas Live will be here again.', 'Until then...'];
    default:
      return ['Hmm...', 'A little shift in the room.', 'Still here with you.'];
  }
}

/**
 * Join cues into a single speakable script with radio pauses marked.
 * @param {string[]} cues
 * @returns {string}
 */
export function cuesToScript(cues) {
  return (cues || [])
    .map((c) => String(c).trim())
    .filter((c) => c && c !== '...')
    .join('\n\n');
}
