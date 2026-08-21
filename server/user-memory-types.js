// ═══════════════════════════════════════════════════════════════════════
// Shared UserMemory shape (storage-agnostic)
// ═══════════════════════════════════════════════════════════════════════

/** @typedef {Record<string, unknown>} JsonObject */

/**
 * @returns {{
 *   profile: {
 *     name: string|null,
 *     timezone: string|null,
 *     location: string|null,
 *     birthDate: string|null,
 *     birthTime: string|null,
 *     birthPlace: string|null,
 *     referenceDate: string|null,
 *     relationshipStatus: string|null,
 *   },
 *   preferences: JsonObject,
 *   facts: JsonObject,
 *   primeCheckins: Array<Record<string, unknown>>,
 *   updatedAt: string|null,
 * }}
 */
export function createEmptyUserMemory() {
  return {
    profile: {
      name: null,
      timezone: null,
      location: null,
      birthDate: null,
      birthTime: null,
      birthPlace: null,
      referenceDate: null,
      relationshipStatus: null,
    },
    preferences: {
      preferredName: null,
      preferredLanguage: null,
      responseStyle: null,
      addressStyle: null,
      memoryEnabled: true,
    },
    facts: {},
    // Opaque legacy extension. Memory V2 never converts check-ins to memory rows.
    primeCheckins: [],
    updatedAt: null,
  };
}

const USER_ID_PATTERN = /^(telegram|web|anonymous):[a-zA-Z0-9_-]{1,128}$/;

/**
 * @param {string} userId
 * @returns {boolean}
 */
export function isValidUserId(userId) {
  return typeof userId === 'string' && USER_ID_PATTERN.test(userId.trim());
}

/**
 * @param {string} telegramUserNumericId
 */
export function telegramUserId(telegramUserNumericId) {
  return `telegram:${String(telegramUserNumericId).trim()}`;
}

/**
 * @param {string} sessionId
 */
export function webUserId(sessionId) {
  return `web:${String(sessionId).trim()}`;
}
