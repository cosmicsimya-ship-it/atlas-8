// ═══════════════════════════════════════════════════════════════════════
// Memory V2 — hybrid retrieval (always-on + keyword + typed + ranking)
// Semantic adapter is feature-flagged and optional; deterministic fallback.
// ═══════════════════════════════════════════════════════════════════════

import {
  ALWAYS_ON_KEYS,
  MEMORY_RETRIEVAL_WEIGHTS as W,
  MEMORY_TOKEN_BUDGET,
  estimateTokens,
  isSemanticRetrievalEnabled,
} from './config.js';
import { foldMemoryText } from './normalize.js';
import { listActiveCandidates, touchMemoriesAccessed } from './store.js';
import { detectCurrentMessageOverrides } from './write.js';

/**
 * Topic → keys / type hints for Layer C structured match.
 */
const TOPIC_MAP = [
  {
    id: 'morning_routine',
    patterns: [
      /\bsabah\s*rutin/i,
      /\bsabah.{0,48}rutin/i,
      /\bmorning\s*routine/i,
      /\bsabah\s*(plan|program|alışkan|aliskan)/i,
      /\biyi\s+bir\s+sabah/i,
      /(?:^|[^\p{L}\p{N}])sabah(?:\s+\p{L}+){0,6}\s+rutin/iu,
    ],
    keys: [
      'preference.coffee.sugar',
      'preference.coffee.milk',
      'habit.morning_meetings',
      'preferences.responseStyle',
    ],
    types: ['habit', 'preference'],
    keywords: ['kahve', 'şeker', 'seker', 'süt', 'sut', 'uyku', 'sabah'],
  },
  {
    id: 'coffee',
    patterns: [/\bkahve\b/i, /\bcoffee\b/i],
    keys: ['preference.coffee.sugar', 'preference.coffee.milk'],
    types: ['habit', 'preference'],
    keywords: ['kahve', 'şeker', 'seker', 'süt'],
  },
  {
    id: 'desk_design',
    // Avoid JS \b with Turkish letters (ç/ş/ı are non-\w; \b fails).
    patterns: [
      /(?:^|[^\p{L}\p{N}])(masa|çalışma\s*masas[iı]|calisma\s*masasi|desk|ofis\s*tasar)/iu,
      /(?:^|[^\p{L}\p{N}])(tasarla|tasarım|tasarim)/iu,
    ],
    keys: ['preference.favorite_color', 'preferences.responseStyle'],
    types: ['preference'],
    keywords: ['renk', 'siyah', 'beyaz', 'masa'],
  },
  {
    id: 'color_palette',
    patterns: [
      /(?:^|[^\p{L}\p{N}])renk\s*palet/iu,
      /\bcolor\s*palette/i,
      /(?:^|[^\p{L}\p{N}])(web\s*site|website).{0,40}(renk|color|palet)/iu,
      /(?:^|[^\p{L}\p{N}])(renk|color).{0,40}(öner|oner|palette|palet)/iu,
    ],
    keys: ['preference.favorite_color'],
    types: ['preference'],
    keywords: ['renk', 'palet', 'siyah'],
  },
  {
    id: 'food',
    patterns: [/\b(yemek|tarif|menü|menu|restoran|etli|vegan)\b/i],
    keys: ['preference.diet.vegan'],
    types: ['preference', 'habit'],
    keywords: ['vegan', 'vejetaryen', 'yemek'],
  },
  {
    id: 'birth_astro',
    patterns: [
      /\b(doğum|dogum|burç|burc|astro|numerol|harita|transit|yaşam\s*yolu|yasam\s*yolu)\b/i,
    ],
    keys: [
      'profile.birthDate',
      'profile.birthTime',
      'profile.birthPlace',
      'facts.zodiac',
      'profile.name',
    ],
    types: ['profile', 'fact'],
    keywords: ['doğum', 'burç'],
  },
  {
    id: 'location',
    patterns: [/\b(konum|nerede|saat\s*dilim|timezone|şehir|sehir)\b/i],
    keys: ['profile.location', 'profile.timezone'],
    types: ['profile'],
    keywords: ['konum', 'şehir'],
  },
  {
    id: 'relationship',
    patterns: [/\b(ilişki|iliski|partner|aşk|ask|hediye|anne|baba|kardeş|kardes)\b/i],
    keys: ['profile.relationshipStatus'],
    types: ['profile', 'person', 'relationship'],
    keywords: ['ilişki', 'anne', 'aile'],
  },
];

const IRRELEVANT_HARD = [
  /\b(döviz|doviz|kur|usd|eur|bitcoin|async\s+iterator|python|javascript|sql\s+query|oauth|jwt|kubernetes|docker\s+compose)\b/i,
];

/** Design queries where favorite color may be relevant */
const COLOR_RELEVANT = [
  /(?:^|[^\p{L}\p{N}])(masa|desk|renk\s*palet|color\s*palette|color\s*scheme|web\s*site|tasar[ıi]m|tasarla|dekor|boya|paint|k[ıi]yafet|gard[ıi]rop|sevdi[gğ]i?\s*renk|favorite\s*colou?r)/iu,
];

/**
 * @param {string} message
 * @param {string} mode
 */
function matchTopics(message, mode) {
  const topics = [];
  for (const topic of TOPIC_MAP) {
    if (topic.patterns.some((p) => p.test(message))) {
      topics.push(topic);
    }
  }
  if (mode === 'meta-synthesis' || mode === 'daily-guide') {
    const birth = TOPIC_MAP.find((t) => t.id === 'birth_astro');
    if (birth && !topics.includes(birth)) topics.push(birth);
  }
  return topics;
}

/**
 * @param {import('./schema.js').MemoryRecord} mem
 * @param {string} message
 * @param {ReturnType<typeof matchTopics>} topics
 * @param {Set<string>} suppressedKeys
 * @param {boolean} hardIrrelevant
 */
function scoreMemory(mem, message, topics, suppressedKeys, hardIrrelevant) {
  if (mem.status !== 'active') return null;
  if (mem.key && suppressedKeys.has(mem.key)) return null;

  const foldedMsg = foldMemoryText(message);
  const foldedText = foldMemoryText(mem.text);
  let score = 0;
  /** @type {string[]} */
  const reasons = [];

  const alwaysOn = Boolean(mem.key && ALWAYS_ON_KEYS.includes(mem.key));
  if (alwaysOn) {
    score += W.alwaysOnBoost + 0.4;
    reasons.push('always_on');
  }

  if (hardIrrelevant && mem.key === 'preference.favorite_color') {
    return null;
  }
  if (!COLOR_RELEVANT.some((p) => p.test(message)) && mem.key === 'preference.favorite_color') {
    if (!topics.some((t) => t.id === 'desk_design' || t.id === 'color_palette')) {
      return null;
    }
  }
  if (hardIrrelevant && !alwaysOn) {
    if (!mem.key || !ALWAYS_ON_KEYS.includes(mem.key)) {
      return null;
    }
  }

  for (const topic of topics) {
    if (mem.key && topic.keys.includes(mem.key)) {
      score += W.keyMatch;
      reasons.push(`topic_key:${topic.id}`);
    }
    if (topic.types.includes(mem.type)) {
      score += W.typeRelevance * 0.5;
      reasons.push(`topic_type:${topic.id}`);
    }
  }

  const msgTokens = foldedMsg.split(/[^a-z0-9çğıöşü]+/i).filter((t) => t.length > 3);
  let overlap = 0;
  for (const tok of msgTokens.slice(0, 24)) {
    if (foldedText.includes(tok)) overlap += 1;
  }
  if (overlap > 0) {
    score += Math.min(W.keywordOverlap, overlap * 0.05);
    reasons.push(`overlap:${overlap}`);
  }

  score += (mem.importance ?? 0.5) * W.importance;

  const updated = Date.parse(mem.updatedAt || mem.createdAt || '') || 0;
  const ageDays = updated ? (Date.now() - updated) / (86400 * 1000) : 365;
  const recency = Math.max(0, 1 - ageDays / 365);
  score += recency * W.recency;
  if (ageDays > 400) score -= W.stalePenalty;

  if (!mem.key && topics.length === 0 && !alwaysOn && overlap < 2) {
    return null;
  }

  if (topics.some((t) => t.id === 'morning_routine' || t.id === 'coffee')) {
    if (mem.key?.startsWith('preference.coffee') || mem.key?.startsWith('habit.')) {
      score += 0.35;
      reasons.push('morning_boost');
    }
  }

  if (score < 0.12 && !alwaysOn) return null;

  return { memory: mem, score, reasons };
}

/**
 * Semantic search stub — user-scoped interface reserved. Returns [] unless enabled.
 * Never searches across users.
 * @param {{ userId: string, message: string, limit: number }} _input
 */
function semanticSearch(_input) {
  if (!isSemanticRetrievalEnabled()) return [];
  return [];
}

/**
 * @param {{
 *   userId: string,
 *   message: string,
 *   mode?: string,
 *   limit?: number,
 *   tokenBudget?: number,
 * }} input
 * @returns {{
 *   memories: import('./schema.js').MemoryRecord[],
 *   diagnostics: Record<string, unknown>,
 * }}
 */
export function retrieveRelevantMemories(input) {
  const userId = input.userId;
  const message = String(input.message ?? '');
  const mode = input.mode || 'conversational';
  const limit = input.limit ?? MEMORY_TOKEN_BUDGET.maxMemories;
  const tokenBudget = input.tokenBudget ?? MEMORY_TOKEN_BUDGET.maxTokensApprox;

  const diagnostics = {
    candidateCount: 0,
    selectedCount: 0,
    retrievalMode: 'structured',
    tokenEstimate: 0,
    semanticUsed: false,
    topics: /** @type {string[]} */ ([]),
    suppressedKeys: /** @type {string[]} */ ([]),
  };

  if (!userId) {
    return { memories: [], diagnostics };
  }

  const suppressedKeys = new Set(detectCurrentMessageOverrides(message));
  diagnostics.suppressedKeys = [...suppressedKeys];

  const hardIrrelevant = IRRELEVANT_HARD.some((p) => p.test(message));
  const topics = matchTopics(message, mode);
  diagnostics.topics = topics.map((t) => t.id);

  const topicKeys = [];
  for (const t of topics) topicKeys.push(...t.keys);
  if (COLOR_RELEVANT.some((p) => p.test(message)) && !hardIrrelevant) {
    topicKeys.push('preference.favorite_color');
  }

  const active = listActiveCandidates(userId, {
    keys: [...new Set(topicKeys)],
    alwaysIncludeKeys: [...ALWAYS_ON_KEYS],
    includeNullKeysLimit: topics.length > 0 || COLOR_RELEVANT.some((p) => p.test(message)) ? 40 : 0,
  });
  diagnostics.candidateCount = active.length;
  diagnostics.candidateNarrowing = true;

  /** @type {{ memory: import('./schema.js').MemoryRecord, score: number, reasons: string[] }[]} */
  const scored = [];
  for (const mem of active) {
    const s = scoreMemory(mem, message, topics, suppressedKeys, hardIrrelevant);
    if (s) scored.push(s);
  }

  const semanticHits = semanticSearch({ userId, message, limit });
  if (semanticHits.length) {
    diagnostics.semanticUsed = true;
    diagnostics.retrievalMode = 'structured+semantic';
  }

  scored.sort((a, b) => b.score - a.score);

  const selected = [];
  const seen = new Set();
  for (const item of scored) {
    if (selected.length >= limit) break;
    if (seen.has(item.memory.id)) continue;
    selected.push(item);
    seen.add(item.memory.id);
  }

  const kept = [];
  let chars = 0;
  let tokens = 0;
  for (const item of selected) {
    const line = `- ${item.memory.text}`;
    const addTokens = estimateTokens(line);
    if (
      kept.length > 0 &&
      (tokens + addTokens > tokenBudget ||
        chars + line.length > MEMORY_TOKEN_BUDGET.maxCharacters)
    ) {
      break;
    }
    kept.push(item.memory);
    chars += line.length;
    tokens += addTokens;
  }

  diagnostics.selectedCount = kept.length;
  diagnostics.tokenEstimate = tokens;

  touchMemoriesAccessed(
    userId,
    kept.map((m) => m.id),
  ).catch(() => {});

  return { memories: kept, diagnostics };
}

export { TOPIC_MAP, scoreMemory, matchTopics };
