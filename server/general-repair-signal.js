/**
 * General negative-reaction repair signal — distinct from the narrow
 * zodiac/property REPAIR_RE in conversation-context-engine.js.
 *
 * That existing detector only resolves corrections against tracked
 * property/zodiac state (hasRepairContext). This one resumes the last
 * *engine* turn (Ebced, numerology, ...) when the user reacts negatively
 * ("tövbe yarabbi", "ne diyorsun") after that engine returned an error or
 * ambiguous result — an `ok` deterministic result being called "wrong"
 * stays on the existing zodiac-repair path, not this one.
 */

const GENERAL_NEGATIVE_REACTION_RE =
  /\b(t[oö]vbe(\s+yarabbi)?|ne\s+diyorsun|olmad[ıi]|yanl[ıi][sş]\s+oldu|bu\s+de[gğ]il|sa[cç]mal[ıi]yorsun|hi[cç]\s+alakas[ıi]\s+yok|hi[cç]\s+alakas[ıi]\s+yoktu|ne\s+alakas[ıi]\s+var|ay\s+atlas|allah\s+allah)\b/iu;

/**
 * @param {string} message
 * @param {import('./conversation-context-engine.js').ConversationState|null|undefined} state
 * @returns {{ matched: boolean, hasResumableEngine: boolean, lastEngineInvocation: object|null }}
 */
export function detectGeneralRepairSignal(message, state) {
  const text = String(message ?? '').trim();
  const matched = Boolean(text) && GENERAL_NEGATIVE_REACTION_RE.test(text);
  const lastEngineInvocation = state?.lastEngineInvocation ?? null;
  const hasResumableEngine =
    matched && Boolean(lastEngineInvocation) && lastEngineInvocation.status !== 'ok';
  return { matched, hasResumableEngine, lastEngineInvocation };
}

export { GENERAL_NEGATIVE_REACTION_RE };
