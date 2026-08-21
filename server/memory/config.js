// ═══════════════════════════════════════════════════════════════════════
// Memory V2 — config (flags, budgets, limits, maintenance)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Parse boolean-ish env. Invalid / unknown → fallback.
 * @param {string|undefined|null} raw
 * @param {boolean} fallback
 */
export function parseEnvFlag(raw, fallback = false) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return fallback;
  }
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'on', 'yes'].includes(v)) return true;
  if (['0', 'false', 'off', 'no'].includes(v)) return false;
  console.warn(`[Memory] Unrecognized flag value "${raw}"; using ${fallback}`);
  return fallback;
}

/**
 * MEMORY_V2_ENABLED — unset → OFF (safe default).
 */
export function isMemoryV2Enabled() {
  return parseEnvFlag(process.env.MEMORY_V2_ENABLED, false);
}

/**
 * When V2 is on, mirror active legacy blob to JSON after mutations (rollback safety).
 * Default ON. Set MEMORY_V2_DUAL_WRITE=0 to disable.
 */
export function isMemoryV2DualWriteEnabled() {
  if (!isMemoryV2Enabled()) return false;
  return parseEnvFlag(process.env.MEMORY_V2_DUAL_WRITE, true);
}

/** Blocks memory writes during migration / maintenance. */
export function isMemoryWriteFrozen() {
  return parseEnvFlag(process.env.MEMORY_WRITE_FREEZE, false);
}

export function isSemanticRetrievalEnabled() {
  return parseEnvFlag(process.env.MEMORY_SEMANTIC_RETRIEVAL_ENABLED, false);
}

export const MEMORY_RETRIEVAL_WEIGHTS = Object.freeze({
  keyMatch: 0.35,
  typeRelevance: 0.25,
  keywordOverlap: 0.2,
  importance: 0.12,
  recency: 0.08,
  stalePenalty: 0.15,
  alwaysOnBoost: 0.05,
});

export const MEMORY_TOKEN_BUDGET = Object.freeze({
  maxMemories: 8,
  maxCharacters: 1200,
  maxTokensApprox: 300,
});

/** Hard limits for stored memory text (reject over maxReject). */
export const MEMORY_PAYLOAD_LIMITS = Object.freeze({
  maxTextChars: 2000,
  maxRejectChars: 50_000,
  maxMetadataChars: 4_000,
});

export const ALWAYS_ON_KEYS = Object.freeze([
  'profile.name',
  'preferences.preferredName',
  'preferences.preferredLanguage',
  'preferences.responseStyle',
  'preferences.addressStyle',
]);

/**
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  const s = String(text ?? '');
  if (!s) return 0;
  return Math.ceil(s.length / 4);
}
