/**
 * Shared topic-shift signals — general-purpose evidence that the CURRENT
 * message should take priority over inherited/stale conversation state.
 *
 * Used by the cross-domain arbiter (symbolic-context.js) and by individual
 * engine intent detectors (tarot, numerology, ebced) so a stale mention of
 * one domain several turns back cannot hijack an unrelated new message.
 * Deliberately narrow, additive, and framework-agnostic — no engine math
 * lives here, only text-level signal detection.
 */

export const TOPIC_SHIFT_VERSION = 'atlas-topic-shift-v1';

const MONTH_TR =
  '(?:ocak|[sş]ubat|mart|nisan|may[iı]s|haziran|temmuz|a[gğ]ustos|eyl[uü]l|ekim|kas[iı]m|aral[iı]k)';

/** Explicit calendar date — numeric (5/9/26, 05.09.2026) or day+month (12 ağustos). */
export const EXPLICIT_DATE_RE = new RegExp(
  String.raw`\b\d{1,2}\s+${MONTH_TR}\w*\b|\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b`,
  'iu',
);

/** Bare relative-day reference — "bugün", "yarın" (today/tomorrow). */
export const RELATIVE_DAY_RE = /\b(bug[uü]n|yar[ıi]n)\b/iu;

/**
 * @param {string} text
 * @returns {{ active: boolean, kind: 'explicit_date'|'relative_day'|null }}
 */
export function detectDateSignal(text) {
  const str = String(text ?? '');
  if (!str.trim()) return { active: false, kind: null };
  if (EXPLICIT_DATE_RE.test(str)) return { active: true, kind: 'explicit_date' };
  if (RELATIVE_DAY_RE.test(str)) return { active: true, kind: 'relative_day' };
  return { active: false, kind: null };
}

/**
 * Strong, unambiguous domain-name keywords — each has essentially no
 * ordinary unrelated Turkish use, so presence is a reliable signal the
 * user is naming that domain (either to switch to it, or — combined with
 * a correction signal — to reject it).
 */
export const DOMAIN_KEYWORDS = {
  tarot: /\btarot\b/iu,
  ebced: /\b(ebced\w*|abjad\w*|cifir)\b/iu,
  numerology: /\bnumerol/iu,
  astrology: /\bastroloj/iu,
  quran: /\b(ayet\w*|sure\w*|kuran|kur['’]an)\b/iu,
  dream: /\br[uü]ya\b/iu,
};

/**
 * Domains explicitly named in the message.
 * @param {string} text
 * @returns {string[]}
 */
export function detectExplicitDomainMentions(text) {
  const str = String(text ?? '');
  const hits = [];
  for (const [domain, re] of Object.entries(DOMAIN_KEYWORDS)) {
    if (re.test(str)) hits.push(domain);
  }
  return hits;
}

/**
 * True when the CURRENT message names a domain other than `currentDomain`,
 * or carries an explicit date — a same-turn signal strong enough to veto
 * stale-history continuation logic (a date alone must never activate a
 * symbolic domain; naming a different domain outright must never be read
 * as "continue the old one").
 * @param {string} text
 * @param {string|null} [currentDomain]
 */
export function hasCompetingDomainSignal(text, currentDomain = null) {
  const mentions = detectExplicitDomainMentions(text);
  const hasOtherDomain = mentions.some((d) => d !== currentDomain);
  return hasOtherDomain || detectDateSignal(text).active;
}

/**
 * Negative / correction reaction — the user is rejecting the domain Atlas
 * just used, not asking a new question inside it. Anchored to phrases with
 * no ordinary unrelated Turkish use so it never fires on normal hedging
 * inside an active reading — bare "istemedim/sormadım/demedim" is common in
 * ordinary follow-up clarifications ("yorum istemedim, açılım yapmalısın")
 * so those verbs only count as a correction when paired with an explicit
 * domain name or a demonstrative pronoun referring back to Atlas's own
 * last action ("onu sormadım").
 */
export const CORRECTION_SIGNAL_RE =
  /\b(?:ne\s+alakas[ıi]\s+var|ne\s+alaka\b|hi[cç]\s+alakas[ıi]\s+yok(?:tu)?|(?:tarot|ebced\w*|abjad\w*|cifir|numeroloji\w*|astroloji\w*|kuran|ayet\w*|sure\w*|r[uü]ya)\s+(?:istemedim|sormad[ıi]m|demedim)|(?:onu|bunu)\s+(?:sormad[ıi]m|demedim)|ba[sş]ka\s+(?:bir\s+)?[sş]eyden\s+bahsediyorum|konumuz\s+bu\s+de[gğ]il)\b/iu;

/**
 * @param {string} text
 * @returns {{ active: boolean, mentionedDomains: string[] }}
 */
export function detectCorrectionSignal(text) {
  const str = String(text ?? '').trim();
  if (!str) return { active: false, mentionedDomains: [] };
  const active = CORRECTION_SIGNAL_RE.test(str);
  return { active, mentionedDomains: active ? detectExplicitDomainMentions(str) : [] };
}
