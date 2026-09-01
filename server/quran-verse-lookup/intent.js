/**
 * Quran verse-lookup intent detection — routes to deterministic retrieval only.
 *
 * Strong Qur’an evidence is required. A bare NN:NN token (including clock times
 * like 07:27 / 11:11) must NOT activate lookup. Generic Turkish verbs that
 * merely contain “oku” (e.g. “okumak”) must NOT independently activate lookup.
 */

const QURAN_DOMAIN =
  /(kur[’'`]?an|kuran|\bâyet(?:i|in|ini|inin)?\b|\bayet(?:i|in|ini|inin)?\b|\bsûre\b|\bsure\b|\bsûrenin\b|\bsurenin\b|\bsûresi\b|\bsuresi\b|\bmeal(?:i|ini|in)?\b|\btefsir(?:i|ini|in)?\b)/i;

/**
 * Explicit lookup verbs — word-bounded. “oku” matches “oku” / “okuyun” but NOT
 * as a free substring activator without Qur’an evidence (see active rules).
 */
const LOOKUP_VERB =
  /(\bhangisi\b|\bnedir\b|ne\s+diyor|ne\s+demek|ne\s+anlat[ıi]yor|\boku(?:yun|n[ua]|dum|dun|du)?\b|\bg[öo]ster\b|\bgetir\b|\bbul\b|\byaz\b|\baktar\b|\bs[öo]yle\b|\byorumla\b|\ba[cç][ıi]kla\b|\bmeal(?:i|ini)?\b|\btefsir(?:i|ini)?\b|\bmetn(?:i|ini)?\b|\barap[cç]a(?:s[ıi])?\b)/i;

/** Numeric or named surah:ayah patterns. */
const REF_HINT =
  /(\d{1,3}\s*[:\/]\s*\d{1,3})|(\d{1,3}\s*\.\s*sure)|(\d{1,3}\s*\.\s*s[uû]re)|(\d{1,3}\s*\.\s*ayet)|(\bsure(?:nin|si)?\s+\d{1,3})|(s[uû]re(?:nin|si)?\s+\d{1,3})|(\bayet(?:i|in)?\s+\d{1,3})|(\d{1,3}\s*\.\s*s[uû]renin)/i;

const CLOCK_LIKE =
  /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/;

// Unicode letter boundaries — ASCII \b falsely matches “nas” inside “nasıl”.
const NAMED_SURAH =
  /(?<!\p{L})(enfal|enf[aâ]l|bakara|fatiha|f[aâ]tiha|yasin|y[aâ]s[iî]n|ihlas|[iî]hl[aâ]s|felak|n[aâ]s|kehf|m[uü]lk|rahman|rahman|nis[aâ]|[aâ]l-?i?\s*imran|maide|en'?am|a'?raf|tevbe|yunus|hud|yusuf|ra'?d|ibrahim|hicr|nahl|isra|kehf|meryem|taha|enbiya|hac|muminun|nur|furkan|suara|neml|kasas|ankebut|rum|lokman|secde|ahzab|sebe|fatir|yasin|saffat|sad|zumer|mu'?min|fussilet|sura|zuhruf|duhan|casiye|ahkaf|muhammed|fetih|hucurat|kaf|zariyat|tur|necm|kamer|rahman|vakia|hadid)(?!\p{L})/iu;

/**
 * True when the only colon refs look like clock times and there is no
 * Qur’an/surah/ayah framing around them.
 * @param {string} text
 */
function onlyClockLikeRefs(text) {
  const refs = text.match(/\b\d{1,3}\s*[:\/]\s*\d{1,3}\b/g) || [];
  if (!refs.length) return false;
  return refs.every((r) => CLOCK_LIKE.test(r.replace(/\s/g, '')));
}

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
  const rawRefHint = REF_HINT.test(text);

  const namedRef =
    NAMED_SURAH.test(text) &&
    (/\d/.test(text) || /ayet/i.test(text));

  const hasSureAyetWord =
    /\bsure\b|\bsûre\b|\bayet(?:i|in|ini|inin)?\b|\bâyet(?:i|in|ini|inin)?\b/i.test(text);

  // Clock-like NN:NN alone is NOT a verse reference.
  const clockOnly = onlyClockLikeRefs(text) && !hasQuranDomain && !namedRef && !hasSureAyetWord;
  const hasRefHint = rawRefHint && !clockOnly;

  const strongQuranEvidence = hasQuranDomain || namedRef || hasSureAyetWord;

  // Surah N.ayah patterns without colon (always strong)
  const dottedSurahAyah = /\d{1,3}\s*\.\s*s[uû]renin\s+\d{1,3}\s*\.\s*ayet/i.test(text);

  const active =
    dottedSurahAyah ||
    // Strong evidence + (ref or lookup verb or named)
    (strongQuranEvidence && (hasRefHint || namedRef || hasLookupVerb || /\d/.test(text))) ||
    // Named surah + verse-like digits / colon (e.g. “Bakara 2:255’i oku”)
    (namedRef && (hasRefHint || /[:\/]/.test(text) || /\bayet\b/i.test(text) || hasLookupVerb)) ||
    // Explicit sure/ayet wording with numbers
    (hasSureAyetWord && /\d/.test(text));

  return {
    active: Boolean(active),
    intent: active ? 'quran_verse_lookup' : null,
    hasQuranDomain,
    hasLookupVerb,
    hasRefHint: hasRefHint || namedRef,
  };
}

/**
 * True only when the user (or semantic layer) explicitly opened Qur’an context.
 * Clock-like HH:MM alone never activates this.
 * @param {string} message
 * @param {{ layers?: string[] }|null} [semantic]
 */
export function isQuranContextActive(message, semantic = null) {
  const intent = detectQuranVerseLookupIntent(message);
  if (intent.active) return true;
  if (Array.isArray(semantic?.layers) && semantic.layers.includes('quran')) return true;
  return false;
}

/**
 * Prompt directive for LLM-backed symbolic/numeric/synthesis turns.
 * When Qur’an context is inactive, forbid spontaneous religious verse framing.
 */
export function buildNoSpontaneousQuranDirective() {
  return `[QURAN CONTENT GUARD — CONTEXT INACTIVE]
Kullanıcı bu turda Kur’an / sûre / âyet / meal / tefsir bağlamı açmadı.
Bu yanıtta YASAK:
- Kur’an, sûre, âyet, meal veya tefsirden bahsetmek
- HH:MM / NN:NN zaman veya sayı kalıplarını sûre:âyet sanmak (ör. 07:27 → 7:27 ayet)
- Kendiliğinden dini/âyet çağrışımı üretmek
Sayıları ve saatleri sembolik/sayısal/rüya bağlamında bırak; dini kaynağa çevirme.`;
}

/**
 * When Qur’an context is active on an LLM path: never invent verse/meal text.
 * Only discuss verified payload from the dedicated lookup layer.
 */
export function buildQuranFailClosedDirective() {
  return `[QURAN FAIL-CLOSED — NO HALLUCINATED VERSE]
Doğrulanmış ayet payload’ı (Arapça / meal / sure:âyet metni) yoksa YASAK:
- Arapça ayet metni uydurmak
- Türkçe meal / çeviri uydurmak
- Kur’an alıntısı gibi tırnaklı metin üretmek
- Tefsiri doğrulanmış kaynakmış gibi sunmak
Kaynak yoksa kullanıcıya kontrollü “doğrulayamadım / aktaramıyorum” çerçevesinde kal;
tahmin ederek ayet yazma.`;
}

/**
 * Baseline guard for every other LLM path (plain conversation, history,
 * comparative religion) where the user never opened explicit Qur’an context
 * and none of the narrower guards above already fired. Unlike
 * buildNoSpontaneousQuranDirective(), this does NOT forbid mentioning
 * Qur’an/Islam/tafsir/hadith as topics — a factual or comparative-religion
 * answer legitimately needs to. It only forbids fabricating a specific
 * citation (surah:ayah number, quoted Arabic/meal text) without verified data.
 */
export function buildGeneralScriptureCitationGuard() {
  return `[SCRIPTURE CITATION GUARD — NO VERIFIED PAYLOAD THIS TURN]
Bu turda doğrulanmış ayet/sure numarası verisi yok.
Bu yanıtta YASAK:
- Belirli bir sure:âyet numarası uydurmak (ör. “Bakara 2:255” gibi kesin bir referans vermek)
- Ayet metnini veya mealini tırnak içinde alıntı gibi yazmak
- Tefsiri, hadisi veya sonradan gelişmiş anlatıyı doğrudan Kur’an metniymiş gibi sunmak
İzin verilen: din, kavram veya tarihsel bağlam hakkında genel bilgi vermek. Kesin ayet numarası
veya alıntı gerekiyorsa, doğrulayamadığını aç sözle belirt; kesin referans uydurma.`;
}

/**
 * Single place that decides which scripture-citation directive (if any)
 * applies this turn — extracted so routing/prompt-injection logic can be
 * unit-tested without running the full pipeline.
 * @param {{ needsQuranContentGuard: boolean, quranContextActive: boolean }} flags
 */
export function selectScriptureCitationDirective({ needsQuranContentGuard, quranContextActive }) {
  if (needsQuranContentGuard) return buildNoSpontaneousQuranDirective();
  if (quranContextActive) return buildQuranFailClosedDirective();
  return buildGeneralScriptureCitationGuard();
}
