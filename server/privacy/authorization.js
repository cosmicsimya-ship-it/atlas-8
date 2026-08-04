// ═══════════════════════════════════════════════════════════════════════
// Authorization — verified owner access (default deny)
//
// Founder access requires authenticated session + founder role.
// Env-linked IDs alone are never sufficient at runtime.
// Names, headers, and self-claims never authorize.
// ═══════════════════════════════════════════════════════════════════════

import { isValidUserId } from '../user-memory.js';

/**
 * @typedef {Object} RequesterContext
 * @property {string|null|undefined} [userId]
 * @property {string|null|undefined} [channel]
 * @property {string|null|undefined} [displayName] Never used for auth
 * @property {string|null|undefined} [telegramUsername] Never used for auth
 * @property {string|null|undefined} [claimedIdentity] Never used for auth
 * @property {boolean} [authenticated]
 * @property {string[]} [roles]
 * @property {boolean} [isFounder]
 * @property {string|null|undefined} [authMethod]
 * @property {string|null|undefined} [sessionId]
 */

/**
 * @param {RequesterContext|null|undefined} context
 * @returns {{ userId: string|null, channel: string|null, authenticated: boolean, roles: string[], isFounder: boolean }}
 */
export function getRequesterIdentity(context) {
  const userId =
    typeof context?.userId === 'string' && context.userId.trim()
      ? context.userId.trim()
      : null;

  const valid = Boolean(userId && isValidUserId(userId));
  const channel = context?.channel ?? null;
  const roles = Array.isArray(context?.roles) ? context.roles.map(String) : [];
  const authenticated = Boolean(context?.authenticated === true && valid);
  const isFounder = Boolean(authenticated && (context?.isFounder === true || roles.includes('founder')));

  return {
    userId: authenticated ? userId : null,
    channel,
    authenticated,
    roles: authenticated ? roles : [],
    isFounder,
  };
}

/**
 * True only for an authenticated session with the founder role.
 * Env ID matching, headers, names, and message text never authorize.
 *
 * @param {RequesterContext|null|undefined} context
 * @returns {boolean}
 */
export function isVerifiedOwner(context) {
  const identity = getRequesterIdentity(context);
  if (!identity.authenticated || !identity.userId) return false;
  return identity.isFounder || identity.roles.includes('founder');
}

/**
 * @param {RequesterContext|null|undefined} context
 * @returns {boolean}
 */
export function canAccessFounderPrivateData(context) {
  return isVerifiedOwner(context);
}

/**
 * Same authenticated user only. Name matching never sufficient.
 *
 * @param {RequesterContext|null|undefined} requesterContext
 * @param {string|null|undefined} targetUserId
 * @returns {boolean}
 */
export function canAccessUserMemory(requesterContext, targetUserId) {
  const identity = getRequesterIdentity(requesterContext);
  const target =
    typeof targetUserId === 'string' && targetUserId.trim() ? targetUserId.trim() : null;

  if (!identity.authenticated || !identity.userId || !target) return false;
  if (!isValidUserId(target)) return false;

  return identity.userId === target;
}

/**
 * Build requester context. Prefer authToRequesterContext from auth module.
 * `authenticated` defaults to FALSE — callers must set explicitly from server auth.
 *
 * @param {{
 *   userId?: string|null,
 *   channel?: string|null,
 *   displayName?: string|null,
 *   authenticated?: boolean,
 *   roles?: string[],
 *   isFounder?: boolean,
 *   authMethod?: string|null,
 *   sessionId?: string|null,
 * }} source
 * @returns {RequesterContext}
 */
export function buildRequesterContext(source = {}) {
  return {
    userId: source.userId ?? null,
    channel: source.channel ?? null,
    displayName: source.displayName ?? null,
    authenticated: source.authenticated === true,
    roles: Array.isArray(source.roles) ? [...source.roles] : [],
    isFounder: Boolean(source.isFounder),
    authMethod: source.authMethod ?? null,
    sessionId: source.sessionId ?? null,
  };
}
