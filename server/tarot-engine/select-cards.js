/**
 * Card selection — SEPARATE from interpretation.
 * Neutral Classic Tarot draw; does not wish-fulfill or interpret.
 */

import { CLASSIC_TAROT_DECK } from './deck.js';
import { DEFAULT_CARD_COUNT } from './methodology.js';

/**
 * Mulberry32 — deterministic PRNG from 32-bit seed.
 * @param {number} seed
 */
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {string} text
 * @returns {number}
 */
export function hashSeed(text) {
  const s = String(text || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Fisher–Yates shuffle with seeded RNG (does not mutate input).
 * @template T
 * @param {T[]} arr
 * @param {() => number} rng
 * @returns {T[]}
 */
export function seededShuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Select cards from Classic Tarot deck.
 * Pure selection — no meanings, no positions, no narrative.
 *
 * @param {{
 *   count?: number,
 *   seed?: string|number,
 *   excludeIds?: string[],
 *   deck?: import('./deck.js').TarotCard[],
 * }} [opts]
 * @returns {{
 *   cards: import('./deck.js').TarotCard[],
 *   seed: string,
 *   seedHash: number,
 *   deckSize: number,
 *   method: string,
 * }}
 */
export function selectCards(opts = {}) {
  const count = Math.max(1, Math.min(opts.count ?? DEFAULT_CARD_COUNT, 10));
  const seed =
    opts.seed != null
      ? String(opts.seed)
      : `atlas-tarot|${Date.now()}|${Math.random()}`;
  const seedHash = typeof opts.seed === 'number' ? opts.seed >>> 0 : hashSeed(seed);
  const rng = mulberry32(seedHash);
  const exclude = new Set((opts.excludeIds || []).map(String));
  const source = (opts.deck || CLASSIC_TAROT_DECK).filter((c) => !exclude.has(c.id));
  if (source.length < count) {
    throw new Error(`TAROT_DECK_TOO_SMALL: need ${count}, have ${source.length}`);
  }
  const shuffled = seededShuffle(source, rng);
  return {
    cards: shuffled.slice(0, count),
    seed,
    seedHash,
    deckSize: CLASSIC_TAROT_DECK.length,
    method: 'seeded-fisher-yates-classic-78',
  };
}

/**
 * Build a stable seed for a conversation turn (reproducible within tests).
 * @param {{
 *   conversationId?: string,
 *   userId?: string|null,
 *   message?: string,
 *   spreadIndex?: number,
 *   salt?: string,
 * }} parts
 */
export function buildSelectionSeed(parts) {
  return [
    'atlas-classic-tarot-v1',
    parts.conversationId || 'default',
    parts.userId || 'anon',
    parts.message || '',
    String(parts.spreadIndex ?? 0),
    parts.salt || '',
  ].join('|');
}
