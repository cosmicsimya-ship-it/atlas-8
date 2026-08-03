/**
 * In-memory dream analysis session — follow-ups reuse the same dream.
 */

/** @type {Map<string, DreamSession>} */
const sessions = new Map();

/**
 * @typedef {{
 *   conversationId: string,
 *   userId: string,
 *   narrative: string,
 *   statedSymbols: string|null,
 *   statedEmotion: string|null,
 *   wakingEmotion: string|null,
 *   recurring: boolean|null,
 *   symbolIds: string[],
 *   symbolNames: string[],
 *   emotionLabels: string[],
 *   lastAnalysis: object|null,
 *   lastDepth: number,
 *   layersCovered: string[],
 *   lastFocus: string|null,
 *   awaitingNarrative: boolean,
 *   updatedAt: number,
 * }} DreamSession
 */

export const DREAM_SESSION_IDLE_MS = Number(
  process.env.ATLAS_DREAM_SESSION_IDLE_MS || 20 * 60 * 1000,
);

/**
 * @param {string} conversationId
 * @param {string|null|undefined} userId
 */
export function dreamSessionKey(conversationId, userId) {
  return `${String(conversationId || 'default')}::${String(userId || 'anon')}`;
}

/**
 * @param {string} conversationId
 * @param {string|null|undefined} userId
 * @returns {DreamSession|null}
 */
export function getDreamSession(conversationId, userId) {
  const key = dreamSessionKey(conversationId, userId);
  const s = sessions.get(key);
  if (!s) return null;
  if (Date.now() - s.updatedAt > DREAM_SESSION_IDLE_MS) {
    sessions.delete(key);
    return null;
  }
  return s;
}

/**
 * @param {{
 *   conversationId: string,
 *   userId?: string|null,
 *   narrative?: string,
 *   statedSymbols?: string|null,
 *   statedEmotion?: string|null,
 *   wakingEmotion?: string|null,
 *   recurring?: boolean|null,
 *   symbolIds?: string[],
 *   symbolNames?: string[],
 *   emotionLabels?: string[],
 *   lastAnalysis?: object|null,
 *   depth?: number,
 *   focus?: string|null,
 *   layersCovered?: string[],
 *   awaitingNarrative?: boolean,
 * }} input
 */
export function touchDreamSession(input) {
  const key = dreamSessionKey(input.conversationId, input.userId);
  const prev = sessions.get(key);
  /** @type {DreamSession} */
  const next = {
    conversationId: String(input.conversationId || 'default'),
    userId: String(input.userId || 'anon'),
    narrative: input.narrative ?? prev?.narrative ?? '',
    statedSymbols: input.statedSymbols ?? prev?.statedSymbols ?? null,
    statedEmotion: input.statedEmotion ?? prev?.statedEmotion ?? null,
    wakingEmotion: input.wakingEmotion ?? prev?.wakingEmotion ?? null,
    recurring: input.recurring ?? prev?.recurring ?? null,
    symbolIds: input.symbolIds ?? prev?.symbolIds ?? [],
    symbolNames: input.symbolNames ?? prev?.symbolNames ?? [],
    emotionLabels: input.emotionLabels ?? prev?.emotionLabels ?? [],
    lastAnalysis: input.lastAnalysis ?? prev?.lastAnalysis ?? null,
    lastDepth: input.depth ?? prev?.lastDepth ?? 2,
    layersCovered: [
      ...new Set([...(prev?.layersCovered || []), ...(input.layersCovered || [])]),
    ],
    lastFocus: input.focus ?? prev?.lastFocus ?? null,
    awaitingNarrative:
      input.awaitingNarrative ?? prev?.awaitingNarrative ?? false,
    updatedAt: Date.now(),
  };
  sessions.set(key, next);
  return next;
}

/**
 * @param {string} conversationId
 * @param {string|null|undefined} userId
 */
export function clearDreamSession(conversationId, userId) {
  sessions.delete(dreamSessionKey(conversationId, userId));
}

/** Test helper */
export function _resetAllDreamSessions() {
  sessions.clear();
}
