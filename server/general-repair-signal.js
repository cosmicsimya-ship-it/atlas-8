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

/**
 * Phrases that are unambiguous negative-reaction signals even when embedded
 * inside a longer message — they have no ordinary unrelated use in Turkish.
 */
const EMBEDDED_REACTION_RE =
  /\b(t[oö]vbe(\s+yarabbi)?|ne\s+diyorsun|olmad[ıi]|yanl[ıi][sş]\s+oldu|bu\s+de[gğ]il|sa[cç]mal[ıi]yorsun|hi[cç]\s+alakas[ıi]\s+yok|hi[cç]\s+alakas[ıi]\s+yoktu|ne\s+alakas[ıi]\s+var)\b/iu;

/**
 * "ay atlas" / "allah allah" are common casual interjections (surprise,
 * address) that routinely appear in ordinary, unrelated messages — e.g.
 * "ay atlas, bugün hava nasıl olacak?". Trusting them anywhere in the
 * message (QUALITY REVIEW B1) let a bare address/interjection hijack an
 * unrelated turn into the repair-resumption path. They only count as a
 * repair signal when they make up essentially the whole message (anchored,
 * optional trailing punctuation) — not when embedded in a longer sentence.
 */
const ANCHORED_ONLY_REACTION_RE = /^(?:ay\s+atlas|allah\s+allah)\s*[?.!…]*$/iu;

/**
 * Combined pattern kept for stripping a matched reaction phrase out of the
 * message to isolate any embedded correction (see atlas-message-service.js).
 * Intentionally broader than the detection logic below — safe because
 * stripping only runs after `matched` has already been confirmed true, and
 * for the anchored-only phrases the remainder after stripping is empty
 * anyway (handled by the existing "no extractable correction" fallback).
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
  const matched =
    Boolean(text) &&
    (EMBEDDED_REACTION_RE.test(text) || ANCHORED_ONLY_REACTION_RE.test(text));
  const lastEngineInvocation = state?.lastEngineInvocation ?? null;
  const hasResumableEngine =
    matched && Boolean(lastEngineInvocation) && lastEngineInvocation.status !== 'ok';
  return { matched, hasResumableEngine, lastEngineInvocation };
}

export { GENERAL_NEGATIVE_REACTION_RE };
