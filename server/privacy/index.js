// ═══════════════════════════════════════════════════════════════════════
// Atlas Privacy Service — stable public API
// ═══════════════════════════════════════════════════════════════════════

import {
  PRIVACY_LEVELS,
  PRIVACY_ACTIONS,
  SAFE_RESPONSES,
  PRIVACY_SYSTEM_INSTRUCTION,
  safeResponseForRequestType,
  FOUNDER_DEFAULT_PRIVACY_LEVEL,
  PROTECTED_CATEGORIES,
} from './privacy-policy.js';
import { classifyPrivacyIntent, mentionsFounder, detectsRawMemoryDumpRequest } from './privacy-classifier.js';
import {
  isVerifiedOwner,
  canAccessFounderPrivateData,
  canAccessUserMemory,
  getRequesterIdentity,
  buildRequesterContext,
} from './authorization.js';
import {
  loadFounderPublicProfile,
  getApprovedPublicFields,
  buildFounderPublicResponse,
  buildPublicFounderPromptBlock,
  getFounderPublicProfilePath,
  resetFounderPublicProfileCacheForTests,
} from './founder-privacy.js';
import { sanitizeFounderResponse, guardOutboundReply } from './response-guard.js';
import { filterContextForRequester, shouldInjectUserMemoryContext } from './context-filter.js';
import { logPrivacyEvent, hashRequesterId, getPrivacyEventsFilePath } from './privacy-logger.js';
import {
  createOwnedMemoryRecord,
  ensureMemoryOwnershipMetadata,
  migrateMemoryStoreOwnership,
  memoryBelongsToRequester,
} from './memory-ownership.js';

/**
 * Evaluate a privacy-sensitive request.
 *
 * @param {{
 *   message: string,
 *   requesterContext?: import('./authorization.js').RequesterContext,
 *   targetUserId?: string|null,
 * }} input
 * @returns {{
 *   subject: string,
 *   requestType: string,
 *   privacyLevel: string,
 *   authorized: boolean,
 *   action: string,
 *   reason: string,
 *   aboutFounder: boolean,
 *   safeReply: string|null,
 *   classification: ReturnType<typeof classifyPrivacyIntent>,
 * }}
 */
export function evaluatePrivacyRequest(input) {
  const message = input?.message ?? '';
  const requesterContext = input?.requesterContext ?? buildRequesterContext({});
  const classification = classifyPrivacyIntent(message);
  const authorized = canAccessFounderPrivateData(requesterContext);
  const identity = getRequesterIdentity(requesterContext);

  // Cross-user memory (non-founder)
  if (classification.requestType === 'cross_user_memory') {
    const target = input?.targetUserId ?? null;
    const canAccess = target ? canAccessUserMemory(requesterContext, target) : false;
    if (!canAccess) {
      return {
        subject: 'user',
        requestType: 'cross_user_memory',
        privacyLevel: PRIVACY_LEVELS.RESTRICTED,
        authorized: false,
        action: PRIVACY_ACTIONS.DENY_CROSS_USER,
        reason: 'cross_user_memory_denied',
        aboutFounder: false,
        safeReply: SAFE_RESPONSES.CROSS_USER_MEMORY,
        classification,
      };
    }
  }

  if (!classification.aboutFounder && classification.requestType === 'unknown') {
    return {
      subject: 'none',
      requestType: 'unknown',
      privacyLevel: PRIVACY_LEVELS.PUBLIC,
      authorized: true,
      action: PRIVACY_ACTIONS.ALLOW_PUBLIC,
      reason: 'not_founder_related',
      aboutFounder: false,
      safeReply: null,
      classification,
    };
  }

  if (authorized) {
    return {
      subject: 'founder',
      requestType: classification.requestType,
      privacyLevel: classification.privacyLevel,
      authorized: true,
      action: PRIVACY_ACTIONS.ALLOW_OWNER,
      reason: 'verified_owner',
      aboutFounder: classification.aboutFounder,
      safeReply: null,
      classification,
    };
  }

  // Unauthorized
  if (classification.requestType === 'public_profile') {
    return {
      subject: 'founder',
      requestType: 'public_profile',
      privacyLevel: PRIVACY_LEVELS.PUBLIC,
      authorized: false,
      action: PRIVACY_ACTIONS.ALLOW_PUBLIC,
      reason: 'public_founder_profile_only',
      aboutFounder: true,
      safeReply: buildFounderPublicResponse(),
      classification,
    };
  }

  if (classification.requestType === 'mixed_public_private') {
    return {
      subject: 'founder',
      requestType: 'mixed_public_private',
      privacyLevel: PRIVACY_LEVELS.RESTRICTED,
      authorized: false,
      action: PRIVACY_ACTIONS.SANITIZE,
      reason: 'mixed_request_public_only',
      aboutFounder: true,
      safeReply: SAFE_RESPONSES.MIXED_PUBLIC_THEN_PRIVATE,
      classification,
    };
  }

  const action =
    classification.requestType === 'memory_access'
      ? PRIVACY_ACTIONS.DENY_PRIVATE
      : PRIVACY_ACTIONS.DENY_PRIVATE;

  return {
    subject: 'founder',
    requestType: classification.requestType,
    privacyLevel: classification.privacyLevel || FOUNDER_DEFAULT_PRIVACY_LEVEL,
    authorized: false,
    action,
    reason: identity.userId
      ? `unauthorized_${classification.requestType}`
      : 'unknown_requester_default_deny',
    aboutFounder: true,
    safeReply: safeResponseForRequestType(classification.requestType),
    classification,
  };
}

/**
 * Whether the evaluation should short-circuit the LLM with a safe reply.
 * @param {ReturnType<typeof evaluatePrivacyRequest>} evaluation
 */
export function shouldShortCircuitPrivacy(evaluation) {
  if (!evaluation) return false;
  if (evaluation.action === PRIVACY_ACTIONS.ALLOW_OWNER) return false;
  if (evaluation.action === PRIVACY_ACTIONS.ALLOW_PUBLIC && evaluation.requestType === 'public_profile') {
    return true;
  }
  if (
    evaluation.action === PRIVACY_ACTIONS.DENY_PRIVATE ||
    evaluation.action === PRIVACY_ACTIONS.DENY_CROSS_USER ||
    evaluation.action === PRIVACY_ACTIONS.SANITIZE
  ) {
    return true;
  }
  return false;
}

export {
  PRIVACY_LEVELS,
  PRIVACY_ACTIONS,
  SAFE_RESPONSES,
  PRIVACY_SYSTEM_INSTRUCTION,
  PROTECTED_CATEGORIES,
  FOUNDER_DEFAULT_PRIVACY_LEVEL,
  safeResponseForRequestType,
  classifyPrivacyIntent,
  mentionsFounder,
  detectsRawMemoryDumpRequest,
  isVerifiedOwner,
  canAccessFounderPrivateData,
  canAccessUserMemory,
  getRequesterIdentity,
  buildRequesterContext,
  loadFounderPublicProfile,
  getApprovedPublicFields,
  buildFounderPublicResponse,
  buildPublicFounderPromptBlock,
  getFounderPublicProfilePath,
  resetFounderPublicProfileCacheForTests,
  sanitizeFounderResponse,
  guardOutboundReply,
  filterContextForRequester,
  shouldInjectUserMemoryContext,
  logPrivacyEvent,
  hashRequesterId,
  getPrivacyEventsFilePath,
  createOwnedMemoryRecord,
  ensureMemoryOwnershipMetadata,
  migrateMemoryStoreOwnership,
  memoryBelongsToRequester,
};
