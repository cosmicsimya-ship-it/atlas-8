// ═══════════════════════════════════════════════════════════════════════
// Context filter — strip unauthorized memory before prompt construction
// ═══════════════════════════════════════════════════════════════════════

import { canAccessFounderPrivateData, canAccessUserMemory } from './authorization.js';
import { buildPublicFounderPromptBlock } from './founder-privacy.js';
import { isFounderUser } from '../founder-knowledge.js';
import { isValidUserId } from '../user-memory.js';

/**
 * Filter memories / history for the requester before prompt assembly.
 *
 * @param {{
 *   requesterContext: import('./authorization.js').RequesterContext,
 *   targetUserId?: string|null,
 *   memories?: object|null,
 *   conversationHistory?: Array<{role?: string, content?: string}>|null,
 *   aboutFounder?: boolean,
 *   allowPublicFounderProfile?: boolean,
 * }} input
 * @returns {{
 *   memories: object|null,
 *   conversationHistory: Array<{role?: string, content?: string}>,
 *   publicFounderPromptBlock: string|null,
 *   strippedFounderPrivate: boolean,
 *   strippedCrossUser: boolean,
 * }}
 */
export function filterContextForRequester(input) {
  const requesterContext = input.requesterContext ?? {};
  const targetUserId = input.targetUserId ?? requesterContext.userId ?? null;
  const aboutFounder = Boolean(input.aboutFounder);
  const allowPublic = input.allowPublicFounderProfile !== false;

  let memories = input.memories ?? null;
  let conversationHistory = Array.isArray(input.conversationHistory)
    ? [...input.conversationHistory]
    : [];
  let strippedFounderPrivate = false;
  let strippedCrossUser = false;
  let publicFounderPromptBlock = null;

  const ownerAccess = canAccessFounderPrivateData(requesterContext);
  const ownMemoryAccess = canAccessUserMemory(requesterContext, targetUserId);

  // Cross-user: never inject another user's memory
  if (memories && targetUserId && !ownMemoryAccess) {
    memories = null;
    strippedCrossUser = true;
  }

  // Unauthorized founder questions: drop private founder memory + history about Lara
  if (aboutFounder && !ownerAccess) {
    if (targetUserId && isFounderUserSafe(targetUserId)) {
      memories = null;
      strippedFounderPrivate = true;
    }
    // Also drop history that looks like it contains Lara private dumps
    conversationHistory = conversationHistory.filter((turn) => {
      const content = String(turn?.content ?? '');
      if (/do[gğ]um\s+tarih|birthDate|user_memory|linkedUserIds/i.test(content)) {
        strippedFounderPrivate = true;
        return false;
      }
      return true;
    });
    if (allowPublic) {
      publicFounderPromptBlock = buildPublicFounderPromptBlock();
    }
  }

  // Never send entire memory store objects that look like multi-user dumps
  if (memories && typeof memories === 'object' && memories.users) {
    memories = null;
    strippedCrossUser = true;
  }

  return {
    memories,
    conversationHistory,
    publicFounderPromptBlock,
    strippedFounderPrivate,
    strippedCrossUser,
  };
}

function isFounderUserSafe(userId) {
  try {
    return Boolean(userId && isValidUserId(userId) && isFounderUser(userId));
  } catch {
    return false;
  }
}

/**
 * Decide whether requester memory context string may be injected.
 * @param {string|null|undefined} userId
 * @param {import('./authorization.js').RequesterContext} requesterContext
 * @param {{ aboutFounder?: boolean }} [opts]
 */
export function shouldInjectUserMemoryContext(userId, requesterContext, opts = {}) {
  if (!userId || userId === 'web:anonymous') return false;
  if (!canAccessUserMemory(requesterContext, userId)) return false;
  // Founder's own session may use their memory; others asking about founder must not get it
  if (opts.aboutFounder && !canAccessFounderPrivateData(requesterContext)) {
    // If the requester is asking about Lara but is not Lara, don't inject requester memory
    // that might be confused — still OK to inject THEIR own memory for their own questions.
    // Only block when target is founder store.
    return true;
  }
  return true;
}
