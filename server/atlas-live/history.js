/**
 * ATLAS LIVE — session history / anti-repetition memory.
 * Remembers recent topics so the show stays varied.
 */

const DEFAULT_MAX_SEGMENTS = 80;
const DEFAULT_MAX_EVENTS = 40;

/**
 * @typedef {object} HistoryEntry
 * @property {string} id
 * @property {string} blockId
 * @property {string} category
 * @property {string} textPreview
 * @property {string} at
 */

export function createHistory(options = {}) {
  const maxSegments = options.maxSegments ?? DEFAULT_MAX_SEGMENTS;
  const maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;

  /** @type {HistoryEntry[]} */
  const segments = [];
  /** @type {object[]} */
  const events = [];
  /** @type {string[]} */
  const categoryRing = [];
  /** @type {string[]} */
  const blockIdRing = [];

  /**
   * @param {{ blockId: string, category: string, text?: string, id?: string }} entry
   */
  function recordSegment(entry) {
    const row = {
      id: entry.id ?? `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      blockId: entry.blockId,
      category: entry.category,
      textPreview: String(entry.text || '').slice(0, 160),
      at: new Date().toISOString(),
    };
    segments.push(row);
    categoryRing.push(entry.category);
    blockIdRing.push(entry.blockId);
    while (segments.length > maxSegments) segments.shift();
    while (categoryRing.length > maxSegments) categoryRing.shift();
    while (blockIdRing.length > maxSegments) blockIdRing.shift();
    return row;
  }

  /**
   * @param {object} event
   */
  function recordEvent(event) {
    const row = { ...event, recordedAt: new Date().toISOString() };
    events.push(row);
    while (events.length > maxEvents) events.shift();
    return row;
  }

  function recentCategories(n = 6) {
    return categoryRing.slice(-n);
  }

  function recentBlockIds(n = 10) {
    return blockIdRing.slice(-n);
  }

  function lastCategory() {
    return categoryRing.length ? categoryRing[categoryRing.length - 1] : null;
  }

  /**
   * How many times a category appeared in the last N beats.
   * @param {string} category
   * @param {number} [window]
   */
  function categoryFrequency(category, window = 12) {
    return recentCategories(window).filter((c) => c === category).length;
  }

  /**
   * Categories that should be cooled down (appeared too often recently).
   * @param {number} [window]
   * @param {number} [maxHits]
   * @returns {string[]}
   */
  function cooledCategories(window = 10, maxHits = 2) {
    const recent = recentCategories(window);
    /** @type {Map<string, number>} */
    const counts = new Map();
    for (const c of recent) counts.set(c, (counts.get(c) || 0) + 1);
    return [...counts.entries()].filter(([, n]) => n >= maxHits).map(([c]) => c);
  }

  function snapshot() {
    return {
      segmentCount: segments.length,
      eventCount: events.length,
      lastCategory: lastCategory(),
      recentCategories: recentCategories(8),
      recentBlockIds: recentBlockIds(8),
      cooledCategories: cooledCategories(),
    };
  }

  function clear() {
    segments.length = 0;
    events.length = 0;
    categoryRing.length = 0;
    blockIdRing.length = 0;
  }

  return {
    recordSegment,
    recordEvent,
    recentCategories,
    recentBlockIds,
    lastCategory,
    categoryFrequency,
    cooledCategories,
    snapshot,
    clear,
    /** @returns {HistoryEntry[]} */
    getSegments: () => [...segments],
    /** @returns {object[]} */
    getEvents: () => [...events],
  };
}
