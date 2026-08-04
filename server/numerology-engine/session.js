/**
 * In-memory numerology reading session (per conversation + user).
 * Keeps follow-ups bound to the active chart — not profile resolver.
 */

/** @type {Map<string, NumerologySession>} */
const sessions = new Map();

/**
 * @typedef {{
 *   conversationId: string,
 *   userId: string,
 *   birthDate: string,
 *   fullName: string|null,
 *   lastDepth: number,
 *   layersCovered: string[],
 *   lastFocus: string|null,
 *   chartSnapshot: {
 *     lifePath: string,
 *     personalYear: string|null,
 *     activeCycle: string|null,
 *   }|null,
 *   updatedAt: number,
 * }} NumerologySession
 */

export const NUMEROLOGY_SESSION_IDLE_MS = Number(
  process.env.ATLAS_NUMEROLOGY_SESSION_IDLE_MS || 20 * 60 * 1000,
);

/**
 * @param {string} conversationId
 * @param {string|null|undefined} userId
 */
export function numerologySessionKey(conversationId, userId) {
  return `${String(conversationId || 'default')}::${String(userId || 'anon')}`;
}

/**
 * @param {string} conversationId
 * @param {string|null|undefined} userId
 * @returns {NumerologySession|null}
 */
export function getNumerologySession(conversationId, userId) {
  const key = numerologySessionKey(conversationId, userId);
  const s = sessions.get(key);
  if (!s) return null;
  if (Date.now() - s.updatedAt > NUMEROLOGY_SESSION_IDLE_MS) {
    sessions.delete(key);
    return null;
  }
  return s;
}

/**
 * @param {{
 *   conversationId: string,
 *   userId?: string|null,
 *   birthDate: string,
 *   fullName?: string|null,
 *   depth?: number,
 *   focus?: string|null,
 *   layersCovered?: string[],
 *   chartSnapshot?: NumerologySession['chartSnapshot'],
 * }} input
 */
export function touchNumerologySession(input) {
  const key = numerologySessionKey(input.conversationId, input.userId);
  const prev = sessions.get(key);
  /** @type {NumerologySession} */
  const next = {
    conversationId: String(input.conversationId || 'default'),
    userId: String(input.userId || 'anon'),
    birthDate: input.birthDate,
    fullName: input.fullName ?? prev?.fullName ?? null,
    lastDepth: input.depth ?? prev?.lastDepth ?? 2,
    layersCovered: [
      ...new Set([...(prev?.layersCovered || []), ...(input.layersCovered || [])]),
    ],
    lastFocus: input.focus ?? prev?.lastFocus ?? null,
    chartSnapshot: input.chartSnapshot ?? prev?.chartSnapshot ?? null,
    updatedAt: Date.now(),
  };
  sessions.set(key, next);
  return next;
}

/**
 * @param {string} conversationId
 * @param {string|null|undefined} userId
 */
export function clearNumerologySession(conversationId, userId) {
  sessions.delete(numerologySessionKey(conversationId, userId));
}

/** Test helper */
export function _resetAllNumerologySessions() {
  sessions.clear();
}
