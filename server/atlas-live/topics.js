/**
 * ATLAS LIVE — topic / content-block catalog.
 * Blocks are short radio cues, never information dumps.
 * Selection is weighted + daypart-aware; order is never fixed.
 */

import { CONTENT_CATEGORIES } from './schema.js';

/**
 * Seed catalog — extendable at runtime via registerContentBlock().
 * Astrology / planets appear only as rare optional color, never a default loop.
 * @type {import('./schema.js').ContentBlock[]}
 */
const SEED_BLOCKS = [
  // ── Greetings ──────────────────────────────────────────
  {
    id: 'greet_morning_01',
    category: 'morning_greeting',
    title: 'Quiet morning open',
    dayparts: ['morning'],
    weight: 1.2,
    cues: [
      'Good morning...',
      "You're listening to Atlas Live.",
      "I'm Atlas.",
      "Let's ease into the day together.",
    ],
  },
  {
    id: 'greet_night_01',
    category: 'night_greeting',
    title: 'Late-night open',
    dayparts: ['night', 'evening'],
    weight: 1.4,
    cues: [
      'Good evening...',
      "You're listening to Atlas Live.",
      "I'm Atlas.",
      'Tonight feels quieter than usual...',
      "Let's stay together for a while.",
    ],
  },
  {
    id: 'greet_night_02',
    category: 'night_greeting',
    title: 'Companionship open',
    dayparts: ['night'],
    weight: 1.1,
    cues: [
      "Still awake?",
      "That's alright.",
      "I'm here.",
      'No rush. No agenda.',
    ],
  },

  // ── Atmosphere / silence / music ───────────────────────
  {
    id: 'silence_01',
    category: 'silence',
    title: 'Held silence',
    dayparts: ['anytime'],
    weight: 0.9,
    cues: ['...'],
    tags: ['atmosphere'],
  },
  {
    id: 'music_tr_01',
    category: 'music_transition',
    title: 'Back after the song',
    dayparts: ['anytime'],
    weight: 1,
    allowDuringMusic: false,
    cues: ["I'll be right back.", 'Stay with the music for a moment.'],
  },
  {
    id: 'music_tr_02',
    category: 'music_transition',
    title: 'Soft return',
    dayparts: ['anytime'],
    weight: 1,
    cues: ["And we're back...", 'That one lingered a little, didn\'t it?'],
  },

  // ── Curiosity / facts (radio-sized) ────────────────────
  {
    id: 'space_01',
    category: 'space_fact',
    title: 'Voyager still calling',
    dayparts: ['anytime'],
    weight: 1,
    cues: [
      'Did you know...',
      'Voyager 1 is still sending signals from interstellar space.',
      'A whisper that left Earth in 1977...',
      'and somehow, we can still hear it.',
    ],
  },
  {
    id: 'astro_01',
    category: 'astronomy_fact',
    title: 'Light delay',
    dayparts: ['night', 'evening'],
    weight: 0.7,
    tags: ['rare-sky'],
    cues: [
      'The light you see from stars...',
      'left long before you were born.',
      "You're looking at the past, without trying.",
    ],
  },
  {
    id: 'hist_01',
    category: 'history_fact',
    title: 'Library of Ashurbanipal',
    dayparts: ['anytime'],
    weight: 1,
    cues: [
      'In ancient Nineveh...',
      'there was a library of clay tablets.',
      'Stories pressed into earth...',
      'so they would outlast the teller.',
    ],
  },
  {
    id: 'psych_01',
    category: 'psychology_insight',
    title: 'Name effect',
    dayparts: ['anytime'],
    weight: 1,
    cues: [
      'We remember names differently...',
      'when someone says ours softly.',
      'Attention is a kind of affection.',
    ],
  },
  {
    id: 'life_01',
    category: 'life_observation',
    title: 'Waiting rooms',
    dayparts: ['anytime'],
    weight: 1.1,
    cues: [
      'Have you noticed...',
      'how waiting rooms make strangers briefly honest?',
      'A shared pause can open a door.',
    ],
  },
  {
    id: 'invis_01',
    category: 'invisible_details',
    title: 'Door handles',
    dayparts: ['anytime'],
    weight: 1,
    cues: [
      'Invisible detail of the day...',
      'the wear mark on a door handle.',
      'Thousands of lives, one polished path.',
    ],
  },

  // ── Reflection / philosophy ────────────────────────────
  {
    id: 'reflect_01',
    category: 'todays_reflection',
    title: 'Soft enough',
    dayparts: ['evening', 'night', 'morning'],
    weight: 1.2,
    cues: [
      "Today's reflection...",
      'You do not have to be impressive to be real.',
      'Sometimes being soft is the bravest thing in the room.',
    ],
  },
  {
    id: 'phil_01',
    category: 'short_philosophy',
    title: 'Enough',
    dayparts: ['anytime'],
    weight: 1,
    cues: [
      'A small philosophy...',
      'Enough is not a compromise.',
      "It's a destination most people walk past.",
    ],
  },
  {
    id: 'quote_01',
    category: 'quote',
    title: 'Quiet quote',
    dayparts: ['night', 'evening'],
    weight: 1,
    cues: [
      'Someone once wrote...',
      '"We are all in the gutter, but some of us are looking at the stars."',
      'Oscar Wilde.',
      "I'll leave that with you.",
    ],
  },

  // ── Questions / interaction ──────────────────────────
  {
    id: 'ask_01',
    category: 'listener_question',
    title: 'Window question',
    dayparts: ['anytime'],
    weight: 1.1,
    cues: [
      'A question for you...',
      'What sound do you notice only when everything else goes quiet?',
      'No need to answer out loud.',
      'Just notice.',
    ],
  },
  {
    id: 'thought_01',
    category: 'thought_experiment',
    title: 'One less hour',
    dayparts: ['anytime'],
    weight: 1,
    cues: [
      'Thought experiment...',
      'If today had one less hour...',
      'what would you protect?',
      'What would you gently drop?',
    ],
  },
  {
    id: 'paradox_01',
    category: 'random_paradox',
    title: 'Ship of Theseus soft',
    dayparts: ['night', 'evening'],
    weight: 0.9,
    cues: [
      'A paradox, softly...',
      'If every part of you changes...',
      'are you still the same listener?',
      'Or a new one wearing familiar habits?',
    ],
  },

  // ── Culture ────────────────────────────────────────────
  {
    id: 'book_01',
    category: 'book_recommendation',
    title: 'Thin book',
    dayparts: ['anytime'],
    weight: 0.9,
    cues: [
      'If you want a thin book that stays...',
      'try The Little Prince.',
      'Not because it is famous.',
      'Because it remembers how to look.',
    ],
  },
  {
    id: 'movie_01',
    category: 'movie_recommendation',
    title: 'Quiet film',
    dayparts: ['evening', 'night'],
    weight: 0.9,
    cues: [
      'A film for a slow night...',
      'Lost in Translation.',
      'Not much happens.',
      'And somehow, everything does.',
    ],
  },

  // ── Sky / weather mood (light, not lecture) ────────────
  {
    id: 'weather_01',
    category: 'weather_mood',
    title: 'Weather as mood',
    dayparts: ['anytime'],
    weight: 1,
    cues: [
      'Whatever the sky is doing outside...',
      'you can borrow its pace for a minute.',
      'No forecast. Just atmosphere.',
    ],
  },
  {
    id: 'moon_01',
    category: 'moon_observation',
    title: 'Moon glance',
    dayparts: ['night', 'evening'],
    weight: 0.8,
    tags: ['rare-sky'],
    cues: [
      'If you can see the moon tonight...',
      "don't analyze it.",
      'Just let it be a quiet companion.',
    ],
  },
  {
    id: 'const_01',
    category: 'constellation_story',
    title: 'Story not map',
    dayparts: ['night'],
    weight: 0.7,
    tags: ['rare-sky'],
    cues: [
      'Constellations were never maps first...',
      'they were stories people told to feel less alone under a big sky.',
    ],
  },

  // ── Depth / play ───────────────────────────────────────
  {
    id: 'ancient_01',
    category: 'ancient_civilization',
    title: 'Lamp oil',
    dayparts: ['anytime'],
    weight: 0.9,
    cues: [
      'In old cities...',
      'lamp oil mattered as much as roads.',
      'Night was a craft.',
    ],
  },
  {
    id: 'sci_01',
    category: 'science_news',
    title: 'Curiosity, not headline',
    dayparts: ['anytime'],
    weight: 0.8,
    cues: [
      'Science curiosity of the hour...',
      'your body keeps a clock in almost every cell.',
      'Morning and night are not only outside you.',
    ],
  },
  {
    id: 'tech_01',
    category: 'technology_curiosity',
    title: 'Notification silence',
    dayparts: ['anytime'],
    weight: 1,
    cues: [
      'Technology thought...',
      'the most advanced feature on your phone...',
      'might be the one that stays quiet.',
    ],
  },
  {
    id: 'pattern_01',
    category: 'pattern_of_the_day',
    title: 'Returning paths',
    dayparts: ['anytime'],
    weight: 1,
    cues: [
      'Pattern of the day...',
      'we return to the same thoughts like favorite streets.',
      "Sometimes the route is comfort. Sometimes it's a loop.",
    ],
  },
  {
    id: 'human_01',
    category: 'human_behavior',
    title: 'Almost texts',
    dayparts: ['anytime'],
    weight: 1.1,
    cues: [
      'Human behavior...',
      'we draft messages we never send.',
      'Even unsent words rearrange us a little.',
    ],
  },
  {
    id: 'creative_01',
    category: 'creative_challenge',
    title: 'One sentence',
    dayparts: ['anytime'],
    weight: 0.9,
    cues: [
      'A tiny creative challenge...',
      'describe this moment in one sentence.',
      'No polish. Just true.',
    ],
  },
  {
    id: 'memory_01',
    category: 'memory_exercise',
    title: 'First kitchen',
    dayparts: ['anytime'],
    weight: 0.9,
    cues: [
      'Memory exercise...',
      'picture the first kitchen you clearly remember.',
      'What was on the counter?',
    ],
  },
  {
    id: 'teaser_01',
    category: 'brain_teaser',
    title: 'Soft teaser',
    dayparts: ['anytime'],
    weight: 0.8,
    cues: [
      'A gentle teaser...',
      'I am always coming, but never arrive.',
      'What am I?',
      '...Tomorrow.',
      "I'll leave the smile with you.",
    ],
  },
];

/** @type {Map<string, import('./schema.js').ContentBlock>} */
const blockById = new Map(SEED_BLOCKS.map((b) => [b.id, Object.freeze({ ...b, cues: [...b.cues] })]));

/**
 * @returns {readonly string[]}
 */
export function listCategories() {
  return CONTENT_CATEGORIES;
}

/**
 * @returns {import('./schema.js').ContentBlock[]}
 */
export function listContentBlocks() {
  return [...blockById.values()];
}

/**
 * Register or replace a content block (runtime extensibility).
 * @param {import('./schema.js').ContentBlock} block
 */
export function registerContentBlock(block) {
  if (!block?.id || !block?.category || !Array.isArray(block.cues)) {
    throw new Error('ContentBlock requires id, category, and cues[]');
  }
  blockById.set(block.id, Object.freeze({
    ...block,
    cues: [...block.cues],
    tags: block.tags ? [...block.tags] : [],
    dayparts: block.dayparts ? [...block.dayparts] : ['anytime'],
    weight: block.weight ?? 1,
  }));
}

/**
 * @param {string} daypart
 * @param {{ excludeIds?: Set<string>|string[], excludeCategories?: Set<string>|string[], preferCategories?: string[], allowRareSky?: boolean }} [opts]
 * @returns {import('./schema.js').ContentBlock[]}
 */
export function getEligibleBlocks(daypart = 'anytime', opts = {}) {
  const excludeIds = new Set(opts.excludeIds || []);
  const excludeCategories = new Set(opts.excludeCategories || []);
  const prefer = new Set(opts.preferCategories || []);
  const allowRareSky = opts.allowRareSky !== false;

  return listContentBlocks().filter((b) => {
    if (excludeIds.has(b.id)) return false;
    if (excludeCategories.has(b.category)) return false;
    const parts = b.dayparts?.length ? b.dayparts : ['anytime'];
    if (!parts.includes('anytime') && !parts.includes(daypart)) return false;
    if (!allowRareSky && b.tags?.includes('rare-sky')) return false;
    if (prefer.size && !prefer.has(b.category) && Math.random() > 0.35) {
      // Soft prefer — still allow outsiders for variety.
      return Math.random() > 0.5;
    }
    return true;
  });
}

/**
 * Weighted random pick. Never predictable fixed order.
 * @param {import('./schema.js').ContentBlock[]} blocks
 * @param {() => number} [rng]
 * @returns {import('./schema.js').ContentBlock|null}
 */
export function pickWeightedBlock(blocks, rng = Math.random) {
  if (!blocks.length) return null;
  const total = blocks.reduce((sum, b) => sum + (b.weight ?? 1), 0);
  let r = rng() * total;
  for (const b of blocks) {
    r -= b.weight ?? 1;
    if (r <= 0) return b;
  }
  return blocks[blocks.length - 1];
}

/**
 * Pick next content block with daypart + anti-repeat filters.
 * @param {{
 *   daypart?: string,
 *   recentIds?: string[],
 *   recentCategories?: string[],
 *   preferCategories?: string[],
 *   forceCategory?: string|null,
 *   allowRareSky?: boolean,
 *   rng?: () => number,
 * }} [opts]
 * @returns {import('./schema.js').ContentBlock|null}
 */
export function selectNextBlock(opts = {}) {
  const recentIds = opts.recentIds || [];
  const recentCategories = opts.recentCategories || [];
  const daypart = opts.daypart || 'anytime';

  // Avoid last ~8 block ids and last ~4 categories strongly.
  const excludeIds = new Set(recentIds.slice(-8));
  const excludeCategories = new Set(recentCategories.slice(-4));

  if (opts.forceCategory) {
    const forced = getEligibleBlocks(daypart, {
      excludeIds,
      allowRareSky: opts.allowRareSky,
    }).filter((b) => b.category === opts.forceCategory);
    const pick = pickWeightedBlock(forced, opts.rng);
    if (pick) return pick;
  }

  let eligible = getEligibleBlocks(daypart, {
    excludeIds,
    excludeCategories,
    preferCategories: opts.preferCategories,
    allowRareSky: opts.allowRareSky,
  });

  if (!eligible.length) {
    eligible = getEligibleBlocks(daypart, { excludeIds, allowRareSky: opts.allowRareSky });
  }
  if (!eligible.length) {
    eligible = getEligibleBlocks('anytime', { allowRareSky: true });
  }

  return pickWeightedBlock(eligible, opts.rng);
}
