// ═══════════════════════════════════════════════════════════════════════
// Legacy memory migration — never auto-claim client-supplied IDs
// ═══════════════════════════════════════════════════════════════════════

/**
 * Legacy web:* memories created before server sessions remain in place
 * but are inaccessible until an authenticated owner explicitly claims them.
 *
 * Claiming requires:
 * - Valid authenticated session
 * - Explicit opt-in with the legacy key the user asserts they owned
 * - Server records the claim audit event
 *
 * This helper only validates shape — actual claim endpoint can be added later.
 *
 * @param {{
 *   authenticatedUserId: string,
 *   legacyUserId: string,
 *   confirmed: boolean,
 * }} input
 */
export function evaluateLegacyMemoryClaim(input) {
  if (!input?.authenticatedUserId || !input?.legacyUserId) {
    return { ok: false, reason: 'missing_ids' };
  }
  if (!input.confirmed) {
    return { ok: false, reason: 'confirmation_required' };
  }
  // Never allow claiming founder or another anonymous session casually
  if (String(input.legacyUserId).startsWith('telegram:')) {
    return { ok: false, reason: 'telegram_legacy_not_claimable_via_web' };
  }
  if (input.authenticatedUserId === input.legacyUserId) {
    return { ok: true, reason: 'already_owner' };
  }
  // Explicit claim maps legacy → current; caller persists if product enables it.
  return {
    ok: true,
    reason: 'claim_allowed_with_audit',
    from: input.legacyUserId,
    to: input.authenticatedUserId,
  };
}
