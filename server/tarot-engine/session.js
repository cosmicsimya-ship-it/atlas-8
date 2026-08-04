/**
 * In-memory tarot spread session — follow-ups reuse the same cards.
 */

/** @type {Map<string, TarotSession>} */
const sessions = new Map();

/**
 * @typedef {{
 *   conversationId: string,
 *   userId: string,
 *   intention: string,
 *   topic: string|null,
 *   spreadKind: string,
 *   cardIds: string[],
 *   cardNames: string[],
 *   positions: { id: string, label: string, role: string }[],
 *   selectionSeed: string,
 *   lastDepth: number,
 *   layersCovered: string[],
 *   lastFocus: string|null,
 *   spreadIndex: number,
 *   updatedAt: number,
 * }} TarotSession
 */

export const TAROT_SESSION_IDLE_MS = Number(
  process.env.ATLAS_TAROT_SESSION_IDLE_MS || 20 * 60 * 1000,
);

/**
 * @param {string} conversationId
 * @param {string|null|undefined} userId
 */
export function tarotSessionKey(conversationId, userId) {
  return `${String(conversationId || 'default')}::${String(userId || 'anon')}`;
}

/**
 * @param {string} conversationId
 * @param {string|null|undefined} userId
 * @returns {TarotSession|null}
 */
export function getTarotSession(conversationId, userId) {
  const key = tarotSessionKey(conversationId, userId);
  const s = sessions.get(key);
  if (!s) return null;
  if (Date.now() - s.updatedAt > TAROT_SESSION_IDLE_MS) {
    sessions.delete(key);
    return null;
  }
  return s;
}

/**
 * @param {{
 *   conversationId: string,
 *   userId?: string|null,
 *   intention: string,
 *   topic?: string|null,
 *   spreadKind: string,
 *   cardIds: string[],
 *   cardNames: string[],
 *   positions: TarotSession['positions'],
 *   selectionSeed: string,
 *   depth?: number,
 *   focus?: string|null,
 *   layersCovered?: string[],
 *   spreadIndex?: number,
 * }} input
 */
export function touchTarotSession(input) {
  const key = tarotSessionKey(input.conversationId, input.userId);
  const prev = sessions.get(key);
  /** @type {TarotSession} */
  const next = {
    conversationId: String(input.conversationId || 'default'),
    userId: String(input.userId || 'anon'),
    intention: input.intention || prev?.intention || '',
    topic: input.topic ?? prev?.topic ?? null,
    spreadKind: input.spreadKind,
    cardIds: input.cardIds,
    cardNames: input.cardNames,
    positions: input.positions,
    selectionSeed: input.selectionSeed,
    lastDepth: input.depth ?? prev?.lastDepth ?? 2,
    layersCovered: [
      ...new Set([...(prev?.layersCovered || []), ...(input.layersCovered || [])]),
    ],
    lastFocus: input.focus ?? prev?.lastFocus ?? null,
    spreadIndex: input.spreadIndex ?? prev?.spreadIndex ?? 0,
    updatedAt: Date.now(),
  };
  sessions.set(key, next);
  return next;
}

/**
 * @param {string} conversationId
 * @param {string|null|undefined} userId
 */
export function clearTarotSession(conversationId, userId) {
  sessions.delete(tarotSessionKey(conversationId, userId));
}

/** Test helper */
export function _resetAllTarotSessions() {
  sessions.clear();
}
