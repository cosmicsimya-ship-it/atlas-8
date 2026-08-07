/**
 * Quran verse-lookup intent detection — routes to deterministic retrieval only.
 */

const QURAN_DOMAIN =
  /(kur[’'`]?an|kuran|\bâyet\b|\bayet\b|\bâyeti\b|\bayeti\b|\bsûre\b|\bsure\b|\bsûrenin\b|\bsurenin\b|\bsûresi\b|\bsuresi\b|\bmeal\b|\btefsir\b)/i;

/** Explicit "which verse / give me the ayah / meal of…" */
const LOOKUP_VERB =
  /(hangisi|nedir|ne\s+diyor|ne\s+demek|oku|g[öo]ster|getir|bul|yaz|aktar|s[öo]yle|meal(?:i|ini)?|tefsir(?:i|ini)?|metn(?:i|ini)?|arap[cç]a(?:s[ıi])?)/i;

/** Numeric or named surah:ayah patterns (presence alone implies lookup when Quran-ish). */
const REF_HINT =
  /(\d{1,3}\s*[:\/]\s*\d{1,3})|(\d{1,3}\s*\.\s*sure)|(\d{1,3}\s*\.\s*s[uû]re)|(\d{1,3}\s*\.\s*ayet)|(\bsure(?:nin|si)?\s+\d{1,3})|(s[uû]re(?:nin|si)?\s+\d{1,3})|(\bayet(?:i|in)?\s+\d{1,3})|(\d{1,3}\s*\.\s*s[uû]renin)/i;

/**
 * @param {string} message
 * @returns {{
 *   active: boolean,
 *   intent: 'quran_verse_lookup'|null,
 *   hasQuranDomain: boolean,
 *   hasLookupVerb: boolean,
 *   hasRefHint: boolean,
 * }}
 */
export function detectQuranVerseLookupIntent(message) {
  const text = String(message ?? '').trim();
  if (!text) {
    return {
      active: false,
      intent: null,
      hasQuranDomain: false,
      hasLookupVerb: false,
      hasRefHint: false,
    };
  }

  const hasQuranDomain = QURAN_DOMAIN.test(text);
  const hasLookupVerb = LOOKUP_VERB.test(text);
  const hasRefHint = REF_HINT.test(text);

  // Named surah + ayah without "Kur'an" word still counts (e.g. "Enfal 8:8", "Bakara 255").
  const namedRef =
    /\b(enfal|enf[aâ]l|bakara|fatiha|f[aâ]tiha|yasin|y[aâ]s[iî]n|ihlas|[iî]hl[aâ]s|felak|n[aâ]s|kehf|m[uü]lk|rahman|rahman)\b/i.test(
      text,
    ) &&
    (/\d/.test(text) || /ayet/i.test(text));

  const active =
    (hasRefHint && (hasQuranDomain || hasLookupVerb || namedRef || /\bsure\b|\bsûre\b|\bayet\b/i.test(text))) ||
    (hasQuranDomain && hasLookupVerb && hasRefHint) ||
    (namedRef && (hasLookupVerb || /[:\/]/.test(text) || /\bayet\b/i.test(text))) ||
    (hasQuranDomain && hasRefHint) ||
    // "8. surenin 8. ayeti hangisi?" — no "Kur'an" word needed
    (/\d{1,3}\s*\.\s*s[uû]renin\s+\d{1,3}\s*\.\s*ayet/i.test(text) && hasLookupVerb) ||
    (/\d{1,3}\s*\.\s*s[uû]renin\s+\d{1,3}\s*\.\s*ayet/i.test(text));

  return {
    active: Boolean(active),
    intent: active ? 'quran_verse_lookup' : null,
    hasQuranDomain,
    hasLookupVerb,
    hasRefHint: hasRefHint || namedRef,
  };
}
