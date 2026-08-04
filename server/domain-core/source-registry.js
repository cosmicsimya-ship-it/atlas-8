/**
 * Source registry — citeable internal corpora seeds.
 */

/**
 * @typedef {object} SourceDescriptor
 * @property {string} sourceId
 * @property {string} title
 * @property {string} kind
 * @property {string} domain
 * @property {string} [path]
 */

/** @type {SourceDescriptor[]} */
const SOURCES = [
  {
    sourceId: 'src.numerology.pythagorean-profiles',
    title: 'Atlas Pythagorean Number Profiles',
    kind: 'internal_corpus',
    domain: 'numerology',
    path: 'server/numerology-engine/meanings.js',
  },
  {
    sourceId: 'src.tarot.classic-deck-78',
    title: 'Atlas Classic Tarot Deck (78)',
    kind: 'internal_corpus',
    domain: 'tarot',
    path: 'server/tarot-engine/deck.js',
  },
  {
    sourceId: 'src.dream.symbol-corpus',
    title: 'Atlas Dream Symbol Corpus',
    kind: 'internal_corpus',
    domain: 'dream',
    path: 'server/dream-engine/symbols.js',
  },
  {
    sourceId: 'src.symbolic.latin-motif',
    title: 'Atlas Latin Letter-Number Motif Tables',
    kind: 'internal_corpus',
    domain: 'symbolic',
    path: 'server/symbolic-analysis',
  },
  {
    sourceId: 'src.daily.layer-registry',
    title: 'Atlas Daily Analysis Layer Registry',
    kind: 'internal_corpus',
    domain: 'daily-time',
    path: 'server/daily-analysis',
  },
];

/**
 * @returns {SourceDescriptor[]}
 */
export function listSources() {
  return SOURCES.map((s) => ({ ...s }));
}

/**
 * @param {string} sourceId
 * @returns {SourceDescriptor|null}
 */
export function getSource(sourceId) {
  const id = String(sourceId || '').trim();
  const found = SOURCES.find((s) => s.sourceId === id);
  return found ? { ...found } : null;
}

/**
 * @param {string[]} sourceIds
 * @returns {{ resolved: SourceDescriptor[], missing: string[] }}
 */
export function resolveSources(sourceIds) {
  /** @type {SourceDescriptor[]} */
  const resolved = [];
  /** @type {string[]} */
  const missing = [];
  for (const raw of sourceIds || []) {
    const src = getSource(raw);
    if (src) resolved.push(src);
    else missing.push(String(raw));
  }
  return { resolved, missing };
}
