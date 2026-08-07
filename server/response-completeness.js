// ═══════════════════════════════════════════════════════════════════════
// Response completeness — detect truncated / incomplete model output
// Never treat mid-word cuts as successful completed replies.
// ═══════════════════════════════════════════════════════════════════════

const SHORT_COMPLETE_ACK =
  /^(merhaba|selam|selamlar|tamam|anlad[ıi]m|rica ederim|iyiyim|buraday[ıi]m|evet|hay[ıi]r|peki|tabii|tabi|olur|sa[gğ]ol|te[sş]ekk[uü]rler)[.!…]*$/iu;

/**
 * Heuristic: reply looks cut off mid-generation (e.g. "za").
 * @param {string} text
 * @returns {boolean}
 */
export function looksTruncatedReply(text) {
  const t = String(text ?? '').trim();
  if (!t) return true;

  // Clear sentence / emoji end → complete
  if (/[.!?…)]$/.test(t)) return false;
  if (/\p{Extended_Pictographic}$/u.test(t)) return false;
  if (SHORT_COMPLETE_ACK.test(t)) return false;

  // Ultra-short fragment without punctuation (the reported "za" case)
  if (t.length <= 12 && !/\s/.test(t)) return true;

  // Trailing connector / unfinished clause
  if (/[-–—,;:]$/.test(t)) return true;
  if (/\b(ve|veya|ama|fakat|çünkü|cunku|ki|için|icin|ile|olan|olarak)\s*$/iu.test(t)) {
    return true;
  }

  // Longer body with no terminal punctuation → likely token-budget cut
  if (t.length >= 48) return true;

  return false;
}

/**
 * @param {{
 *   status?: string|null,
 *   incomplete_details?: { reason?: string }|null,
 *   incompleteReason?: string|null,
 * }} meta
 * @param {string} content
 * @returns {{ incomplete: boolean, reason: string|null }}
 */
export function assessResponseCompleteness(meta, content) {
  const status = String(meta?.status ?? '').toLowerCase();
  const apiReason =
    meta?.incompleteReason ||
    meta?.incomplete_details?.reason ||
    null;

  if (status === 'incomplete' || apiReason) {
    return {
      incomplete: true,
      reason: apiReason || 'incomplete_status',
    };
  }

  if (looksTruncatedReply(content)) {
    return { incomplete: true, reason: 'heuristic_truncation' };
  }

  return { incomplete: false, reason: null };
}

/**
 * Next token budget after an incomplete generation.
 * @param {number} current
 * @param {number} [cap]
 */
export function nextRetryTokenBudget(current, cap = 1400) {
  const base = Number(current) > 0 ? Number(current) : 320;
  return Math.min(Math.max(Math.ceil(base * 2.25), base + 200), cap);
}
