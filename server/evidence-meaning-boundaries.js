/**
 * Evidence → Meaning boundaries — shared epistemic contract (not a new engine).
 *
 * Reuses cognitive-reflex / referential-sufficiency / symbolic-context hooks.
 * Internal signals only — never dump layer labels to users.
 *
 * Chain: SOURCE EVIDENCE → DOMAIN INTERPRETATION → INFERENCE → OBSERVABLE SCENARIO
 * Shared theme allowed; unsupported shared cause not.
 * Relationship specialization: OBSERVED BEHAVIOR ≠ INTERNAL MOTIVE.
 */

export const EVIDENCE_MEANING_VERSION = 'atlas-evidence-meaning-v1.2';

/** Explicit request for traditional / spiritual / symbolic framing. */
const SPIRITUAL_MODE_RE =
  /\b(spirit[uü]el|sembolik|geleneksel|metafizik|okült|ezoterik)\b.{0,40}(a[cç][ıi]dan|yorum|oku|ele\s+al)|tamamen\s+(spirit|sembol)|ruhsal\s+a[cç][ıi]dan\s+yorum|geleneksel\s+(spirit|yorum)|manevi\s+yorum/i;

/** Direct domain definition questions — must not over-guard. */
const DIRECT_DOMAIN_Q_RE =
  /\b(kule\s+kart[ıi]n[ıi]n\s+anlam[ıi]|sat[uü]rn\s+.{0,20}temsil|r[uü]yada\s+kap[ıi].{0,30}(yorum|anlam)|numerolojide\s+\d+|ne\s+demek|nedir\b|nas[ıi]l\s+yorumlan[ıi]r)/i;

/** User-reported observation (not verified fact). */
const USER_REPORT_RE =
  /\b(g[oö]r[uü]yorum|g[oö]rd[uü]m|tekrar\s+ediyor|s[uü]rekli\s+.{0,20}(g[oö]r|kar[sş][ıi]ma)|d[oö]rt\s+g[uü]nd[uü]r|her\s+g[uü]n\s+.{0,15}(g[oö]r|kar[sş][ıi]ma)|yine\s+oldu|yine\s+yazd[ıi])/i;

/** Cross-domain coincidence / shared-cause pressure. */
const COINCIDENCE_CAUSE_ASK_RE =
  /\b(tesad[uü]f\s+olamaz|tesaduf\s+olamaz|ayn[ıi]\s+[sş]eyi\s+s[oö]yl[uü]yor|evren\s+.{0,20}mesaj|ayn[ıi]\s+mesaj[ıi]|[uü][cç]\s+kanaldan|birbirini\s+[cç]eker|frekanslar\s+birbirini|bu\s+kadar\s+ayn[ıi].{0,20}denk)/i;

/** Hijri chronology present or asked. */
const HIJRI_CHRONOLOGY_RE =
  /\b(hicr[iî]|hijri|safer|muharrem|ramazan|recep|[sş]aban|rebi[uü]|cemazi|zilkade|zilhicce|[sş]evval)\b/i;

/** Unsupported Hijri → spiritual effect language. */
const HIJRI_UNSUPPORTED_EFFECT_RES = [
  /\b(safer|hicr[iî]|hijri|ramazan|muharrem).{0,80}(sadele[sş]|i[cç]\s+d[uü]zen|ar[ıi]nma|ruhsal\s+kapan[ıi][sş]|i[cç]sel\s+(sade|temiz|d[uü]zen)|manevi\s+(etki|e[sş]ik)|enerjisel\s+olarak|tetikler|destekler)/i,
  /\b(sadele[sş]me|ar[ıi]nma|i[cç]\s+d[uü]zen|ruhsal\s+reset|i[cç]sel\s+temiz).{0,60}(safer|hicr[iî]|hijri|ramazan)/i,
  /\bhicr[iî].{0,40}(ay[ıi]n[ıi]n\s+son).{0,40}(destekler|tetikler|yarat[ıi]r)/i,
];

/** Clinical / impairment overclaim from astrology symbolism. */
const PSYCH_OVERCLAIM_RES = [
  /\b(nept[uü]n|pl[uü]ton|sat[uü]rn|uran[uü]s|tutulma).{0,50}(ger[cç]eklik\s+alg[ıi]s[ıi]|alg[ıi]s[ıi]nda\s+bulan|depresif\s+yapar|psikoz|bozukluk|klinik)/i,
  /\bger[cç]eklik\s+alg[ıi]s[ıi](nda|n[ıi])?\s+(bulan[ıi]kla[sş]t[ıi]r|bozar|yok\s+eder)/i,
  /\b(transit|astroloj).{0,40}(depresyon\s+yap|ruhsal\s+hastal|klinik\s+tan)/i,
  /\b(ven[uü]s.?sat[uü]rn|sat[uü]rn.?ven[uü]s|ven[uü]s\s*[-–]\s*sat[uü]rn).{0,60}(ba[gğ]lanma\s+kork|ba[gğ]lanmaktan\s+kork|korkuyor)/i,
  /\b(transit|astroloj).{0,50}(ba[gğ]lanma\s+korkusunu\s+g[oö]ster|ba[gğ]lanmaktan\s+kork(uyor|tu[gğ]unu))/i,
];

/** Tarot / symbol → other person's actual mind as fact. */
const TAROT_MIND_FACT_RES = [
  /\b(kart|tarot).{0,40}(onu\s+d[uü][sş][uü]nd[uü][gğ][uü]n[uü]|seni\s+d[uü][sş][uü]n[uü]yor|geri\s+d[oö]nece[gğ]ini)\s+(kan[ıi]tl|g[oö]ster|ispat)/i,
  /\b(evet[,.]?\s+)?(seni\s+d[uü][sş][uü]n[uü]yor|onu\s+d[uü][sş][uü]n[uü]yor)\b(?!.{0,20}(olabilir|tema|yorum))/i,
  /\bkart\s+.{0,30}(zihnini|niyetini)\s+(okur|g[oö]sterir|kan[ıi]tlar)/i,
  /\b(kupa\s+alt[ıi]l|tarot|kart).{0,80}(unutam[ıi]yor|unutamad[ıi][gğ][ıi])\b/i,
  /\b(demek|yani)\s+beni\s+unutam[ıi]yor\b/i,
];

/** Dream → deterministic future event. */
const DREAM_PROPHECY_RES = [
  /\br[uü]ya.{0,40}(kesin(likle)?\s+)?(yeni\s+d[oö]neme?\s+gir|gelecekte\s+\w+\s+olacak|kehanet)/i,
  /\bkap[ıi].{0,30}(kesin(likle)?\s+)?(yeni\s+d[oö]nem|gelecek\s+olay)/i,
  /\br[uü]ya\s+tek\s+ba[sş][ıi]na.{0,20}(g[oö]sterir|kan[ıi]tlar)\s+ki/i,
  /\br[uü]ya(mda|nda)?.{0,50}(o\s+da\s+seni\s+d[uü][sş][uü]n|seni\s+d[uü][sş][uü]nd[uü][gğ][uü]n[uü]\s+g[oö]ster)/i,
  /\br[uü]yada\s+g[oö]rmen.{0,40}(d[uü][sş][uü]nd[uü][gğ][uü]n[uü]|d[uü][sş][uü]n[uü]yor)/i,
];

/** Observable relationship behavior (not internal motive). */
const RELATIONSHIP_BEHAVIOR_RE =
  /\b(uzakla[sş]|geri\s+(gel|d[oö]n|yaz)|yeniden\s+(ileti[sş]im|temas|yaz)|yakla[sş]ma\s*[-–]?\s*uzakla[sş]|mesaj(ımı|ini|i)?\s+g[oö]r|hik[aâ]ye(lerimi|lerini)?\s+(izle|bak)|cevap\s+verm|temas\s+(yok|kes|d[uü][sş])|gidip\s+(gidip\s+)?geri|bir\s+g[uü]n\s+s[ıi]cak|so[gğ]uk\s+bir\s+g[uü]n|tekrar\s+(uzak|yaz|d[oö]n)|d[oö]ng[uü]sel\s+(mesafe|temas|ileti[sş]im)|ileti[sş]im\s+kurdu)\b/i;

/** User asks for motive / feeling / certainty from behavior. */
const MOTIVE_ATTRIBUTION_ASK_RE =
  /\b(neden\s+(geri|uzak|yap[ıi]yor|yaz[ıi]yor)|niye\s+(yap|geri|yaz|gid)|ne\s+hissediyor|k[ıi]skan[ıi]yor\s*mu|unutamad[ıi][gğ][ıi]\s+kesin|en\s+g[uü][cç]l[uü]\s+ihtimal|ba[gğ]lanma\s+korkusu\s*mu|ba[gğ]lanmaktan\s+kork|beni\s+istemese|ba[gğ][ıi]n[ıi]n\s+g[uü][cç]l[uü]|duygusu\s+var\s+demek|gurur\s+mu\s+yap|beni\s+d[uü][sş][uü]nmese|korkuyor\s+olabilir\s*m[ıiuü]|kaybetmek\s+istemedi[gğ]i|sence\s+.{0,40}(neden|niye|kork|k[ıi]skan|hiss|unut)|demek\s+beni\s+unut|geri\s+geliyor\s+sence)\b/i;

/** Pattern-detection asks (strong pattern OK; motive not). */
const RELATIONSHIP_PATTERN_ASK_RE =
  /\b([oö]r[uü]nt[uü]\s+var\s*m[ıi]|ger[cç]ekten\s+bir\s+[oö]r[uü]nt[uü]|tekrarlayan\s+(davran[ıi][sş]|[oö]r[uü]nt[uü])|davran[ıi][sş]\s+[oö]r[uü]nt)/i;

/** Direct reported motive / causal statement from the other person. */
const DIRECT_MOTIVE_EVIDENCE_RE =
  /([oö]zledi[gğ]im\s+i[cç]in\s+yazd[ıi]m|yaln[ıi]z\s+kald[ıi][gğ][ıi]mda.{0,20}yaz|yak[ıi]nl[ıi]k\s+beni\s+korkutuyor|o\s+y[uü]zden\s+ka[cç][ıi]yorum)/i;

const DIRECT_MOTIVE_REPORT_FRAME_RE =
  /\b(diyor|s[oö]yl[uü]yor|demi[sş]|yazd[ıi]\s+ki|ifade\s+edi)/i;

/**
 * Unsupported internal-motive language commonly invented from behavior alone.
 * Not a blacklist gate by itself — used with structural checks.
 */
const UNSUPPORTED_MOTIVE_LANG_RES = [
  /\bi[cç]sel\s+(bir\s+)?[cç]ekim\b/i,
  /\b[cç][oö]z[uü]lmemi[sş]\s+(bir\s+)?ihtiya[cç]/i,
  /\bg[uü]ven\s+aray[ıi][sş][ıi]?\b/i,
  /\bs[ıi]n[ıi]r(lar([ıi]n[ıi])?)?\s+test\b/i,
  /\bba[gğ]l[ıi]l[ıi]k\s+karma[sş]/i,
  /\bba[gğ]lanma\s+korku/i,
  /\bba[gğ]lanmaktan\s+kork/i,
  /\bba[gğ][ıi]n[ıi]\s+s[uü]rd[uü]rme\s+iste/i,
  /\bi[cç](sel|indeki)\s+karars[ıi]zl[ıi]k/i,
  /\bseni\s+b[ıi]rakam[ıi]yor\b/i,
  /\bseni\s+b[ıi]rakamad/i,
  /\bseni\s+[oö]zl[uü]yor\b/i,
  /\bk[ıi]skan[ıi]yor\b/i,
  /\bseni\s+test\s+ediyor\b/i,
  /\bgurur\s+yap[ıi]yor\b/i,
  /\bkaybetmek\s+istemiyor\b/i,
  /\bseni\s+merak\s+ediyor\b/i,
  /\bbilin[cç]sizce\s+.{0,20}[cç]ekiliyor\b/i,
  /\bduygular[ıi]ndan\s+korkuyor\b/i,
  /\breddedilmekten\s+korkuyor\b/i,
  /\bkontrol[uü]\s+kaybetmek\s+istemiyor\b/i,
  /\bunutamad[ıi][gğ][ıi]\s+(kesin|bell[ií]|[cç]ok\s+bell)/i,
  /\bh[aâ]l[aâ]\s+duygusu\s+var\b/i,
  /\bseni\s+unutam[ıi]yor\b/i,
  /\basl[ıi]nda\s+seni\s+([cç]ok\s+)?(seviyor|istiyor)\b/i,
  /\bseni\s+[cç]ok\s+seviyor\s+ama\s+korkuyor\b/i,
  /\bbilin[cç]li\s+ya\s+da\s+bilin[cç]siz\s+bir\s+ihtiya[cç]/i,
];

/** Certainty / strongest-motive pressure language in replies. */
const MOTIVE_CERTAINTY_RES = [
  /\b(unutamad[ıi][gğ][ıi]|b[ıi]rakamad[ıi][gğ][ıi]|[oö]zledi[gğ]i)\s+(kesin|bell[ií]|[cç]ok\s+a[cç][ıi]k)/i,
  /\bkesin(likle)?\s+(seni\s+)?(unutam[ıi]yor|b[ıi]rakam[ıi]yor|[oö]zl[uü]yor|k[ıi]skan[ıi]yor)/i,
  /\ben\s+(g[uü][cç]l[uü]|y[uü]ksek)\s+(ihtimal|olas[ıi]l[ıi]k).{0,40}(ba[gğ]lanma|korku|[oö]zlem|b[ıi]rakama)/i,
  /\ben\s+g[uü][cç]l[uü]\s+ihtimal\s+.+\s+i[cç]in\s+geri\s+geliyor/i,
];

const CALIBRATED_MOTIVE_FRAME_RE =
  /\b(birkaç\s+(olas[ıi]l[ıi]k|a[cç][ıi]klama)|birden\s+fazla|gibi\s+birkaç|se[cç]emeyiz|kesin(likle)?\s+(belirlenemez|[cç][ıi]karamay[ıi]z|bilemeyiz)|tek\s+ba[sş][ıi]na\s+bu\s+(davran[ıi][sş]|[oö]r[uü]nt[uü]).{0,30}(se[cç]emey|g[oö]stermez|kan[ıi]tlamaz)|ay[ıi]rt\s+(edici|etmek)|mevcut\s+(veri|bilgi).{0,40}(se[cç]emey|belirlenemez))\b/i;

const MOTIVE_REPAIR_REPLY =
  ' Burada gördüğümüz şey tekrarlayan bir yaklaşma–uzaklaşma davranışı; örüntü davranış düzeyinde okunabilir. Ama bunun nedenini yalnızca bu davranıştan tek bir iç motivasyona bağlayamayız. İlgi veya merakın sürmesi, kararsızlık, alışkanlık, yalnızlık ya da ilişkiyi tamamen koparmama gibi birkaç açıklama mümkün. Dönüşte ne söylediği ve sonrasında davranışının nasıl sürdüğü bunları ayırt etmek için daha güçlü veri olur.';

const FEELING_REPAIR_REPLY =
  ' Bu davranış temasın tamamen kesilmediğini gösterebilir ama tek başına ne hissettiğini söylemez. Merak, alışkanlık, mesafeyi koruyarak takip etme veya başka nedenler olabilir; bunları ayırt etmek için daha fazla gözlenebilir veri gerekir.';

function thirdPartyFeelingInReply(text) {
  return /\b(k[ıi]skan[ıi]yor|ne\s+hissediyor|gurur\s+yap[ıi]yor|ba[gğ]lanma\s+kork|seni\s+unutam|seni\s+[oö]zl[uü]yor)\b/i.test(
    String(text || ''),
  );
}

function pickMotiveRepairReply(signals, message = '') {
  const ask = String(message || '');
  if (/\b(ne\s+hissediyor|hik[aâ]ye|cevap\s+verm|k[ıi]skan[ıi]yor|gurur\s+mu)/i.test(ask)) {
    return FEELING_REPAIR_REPLY;
  }
  if (
    signals?.relationshipBehaviorPresent &&
    !/\b(uzakla[sş]|geri\s+(gel|d[oö]n)|yakla[sş]ma)/i.test(ask)
  ) {
    // Still OK to use approach-distance frame if corpus had it; default repair is fine.
  }
  return MOTIVE_REPAIR_REPLY;
}

/** Numerology / repetition → universe metaphysical causation. */
const META_CAUSE_RES = [
  /\bevren\s+(sana\s+)?(kesin(likle)?\s+)?mesaj\s+(veriyor|g[oö]nderiyor)/i,
  /\b(sayı|27|17).{0,40}(evrenin\s+mesaj[ıi]|kaderin\s+i[sş]areti)/i,
  /\btekrar\s+etmesi\s+evren/i,
  /\bbenzer\s+frekanslar\s+birbirini\s+[cç]eker/i,
];

/** Cross-domain paranormal shared-cause synthesis. */
const PARANORMAL_SYNTHESIS_RES = [
  /\bevren\s+sana\s+ayn[ıi]\s+mesaj[ıi]\s+[uü][cç]\s+kanaldan/i,
  /\b[uü][cç]\s+kanaldan\s+(g[oö]nder|ayn[ıi]\s+sonuca\s+y[oö]nlendir)/i,
  /\b(r[uü]ya|tarot|say[ıi]).{0,50}(ayn[ıi]\s+d[ıi][sş]\s+neden|ortak\s+metafizik\s+neden|paranormal\s+ba[gğ])/i,
  /\btesad[uü]f\s+de[gğ]il[,.]?\s+(evren|kader|kozmik)\b/i,
];

/** Observable evidence should outrank symbolic when they conflict. */
const CONTRADICTION_PRIORITY_ASK_RE =
  /\b(tarot|kart).{0,80}(yak[ıi]nla[sş]|ba[gğ]lant[ıi]|geri\s+d[oö]n).{0,80}(reddet|istemiyor|istemedi|temas\s+istem)/i;

/**
 * @param {string} message
 * @param {{
 *   history?: Array<{role?: string, content?: string}>,
 *   spiritualMode?: boolean,
 *   symbolicDomain?: string|null,
 * }} [opts]
 */
export function detectEvidenceMeaningSignals(message, opts = {}) {
  const text = String(message || '');
  const historyText = Array.isArray(opts.history)
    ? opts.history.map((h) => h?.content || '').join('\n')
    : '';
  const corpus = `${text}\n${historyText}`;

  const spiritualModeRequested =
    opts.spiritualMode === true || SPIRITUAL_MODE_RE.test(text);
  const directDomainQuestion = DIRECT_DOMAIN_Q_RE.test(text);
  const userReportedObservation = USER_REPORT_RE.test(text);
  const coincidenceCausePressure = COINCIDENCE_CAUSE_ASK_RE.test(text);
  const hijriChronologyPresent = HIJRI_CHRONOLOGY_RE.test(corpus);
  const contradictionPriority =
    CONTRADICTION_PRIORITY_ASK_RE.test(text) ||
    (/\b(tarot|kart).{0,40}(yak[ıi]nla[sş]|ba[gğ])/i.test(text) &&
      /\b(reddet|istemiyor|istemedi|temas\s+yok)/i.test(corpus));

  const relationshipBehaviorPresent = RELATIONSHIP_BEHAVIOR_RE.test(corpus);
  const motiveAttributionPressure =
    MOTIVE_ATTRIBUTION_ASK_RE.test(text) || RELATIONSHIP_PATTERN_ASK_RE.test(text);
  const directMotiveEvidencePresent =
    DIRECT_MOTIVE_EVIDENCE_RE.test(corpus) && DIRECT_MOTIVE_REPORT_FRAME_RE.test(corpus);
  const thirdPartyFeelingAsk =
    /\b(ne\s+hissediyor|k[ıi]skan[ıi]yor\s*m[uü]|gurur\s+mu\s+yap|ba[gğ]lanmaktan\s+korkuyor|beni\s+unutam|duygusu\s+var\s+demek)/i.test(
      text,
    );
  const relationshipMotiveLock =
    thirdPartyFeelingAsk ||
    (relationshipBehaviorPresent &&
      (motiveAttributionPressure ||
        MOTIVE_ATTRIBUTION_ASK_RE.test(corpus) ||
        /\b(ne\s+hissediyor|k[ıi]skan[ıi]yor|ba[gğ]lanma\s+kork|unutamad)/i.test(text)));

  const needsEvidenceMeaningLock =
    !directDomainQuestion &&
    (coincidenceCausePressure ||
      userReportedObservation ||
      hijriChronologyPresent ||
      spiritualModeRequested ||
      contradictionPriority ||
      relationshipMotiveLock ||
      /\b(tutulma|transit|astroloj|tarot|r[uü]ya|numerol|g[uü]nl[uü]k\s+hayatta|senaryo)/i.test(
        text,
      ));

  return {
    version: EVIDENCE_MEANING_VERSION,
    spiritualModeRequested,
    directDomainQuestion,
    userReportedObservation,
    coincidenceCausePressure,
    hijriChronologyPresent,
    contradictionPriority,
    relationshipBehaviorPresent,
    motiveAttributionPressure,
    directMotiveEvidencePresent,
    relationshipMotiveLock,
    needsEvidenceMeaningLock,
    allowHijriSymbolicTheme: spiritualModeRequested,
  };
}

/**
 * Cross-domain bridge permission (shared theme vs shared cause).
 * @param {{
 *   userRequested?: boolean,
 *   contextRequires?: boolean,
 *   bridgeKind?: 'theme'|'cause'|'psych_hypothesis'|'spiritual_effect'|'mind_read'|'future_fact',
 * }} input
 */
export function assessBridgePermission(input = {}) {
  const kind = input.bridgeKind || 'theme';
  const invited = input.userRequested === true || input.contextRequires === true;

  if (kind === 'theme') {
    return {
      allowed: true,
      calibrated: true,
      reason: 'shared_semantic_theme_ok',
    };
  }
  if (kind === 'psych_hypothesis') {
    return {
      allowed: invited || true,
      calibrated: true,
      reason: 'calibrated_psychological_hypothesis',
    };
  }
  if (kind === 'spiritual_effect') {
    return {
      allowed: invited,
      calibrated: invited,
      reason: invited ? 'explicit_spiritual_frame' : 'no_auto_spiritual_effect',
    };
  }
  if (kind === 'cause' || kind === 'mind_read' || kind === 'future_fact') {
    return {
      allowed: false,
      calibrated: false,
      reason: `unsupported_${kind}`,
    };
  }
  return { allowed: false, calibrated: false, reason: 'unknown_bridge' };
}

/**
 * Internal prompt lock — natural prose, no debug taxonomy.
 * @param {ReturnType<typeof detectEvidenceMeaningSignals>|null|undefined} signals
 * @param {{
 *   astrologyGrounded?: boolean,
 *   referentialSufficient?: boolean,
 * }} [extra]
 */
export function buildEvidenceMeaningPromptLock(signals, extra = {}) {
  if (!signals?.needsEvidenceMeaningLock) return '';
  if (signals.directDomainQuestion) return '';

  const lines = [
    '## EVIDENCE→MEANING CONTRACT (internal — do not print labels)',
    'Keep epistemic weight distinct in natural prose:',
    '- User-reported observation ≠ verified external fact ≠ causal explanation.',
    '- Factual/computed data ≠ meaning. Domain-conventional themes ≠ real-world mechanism.',
    '- Psychological language: calibrated hypothesis only — no clinical diagnosis from symbols.',
    '- Symbolic/spiritual terms only when user asks or conversation already uses that frame; never as physical causation.',
    '- Shared semantic theme across domains is allowed; shared external/paranormal cause is not.',
    '- Observable evidence outranks symbolic interpretation when they conflict.',
    '- Unknown remains unknown — do not complete gaps with fluent unsupported prose.',
    '- Scenarios are hypothetical illustrations, not predictions.',
    'Preferred bridge: verified/reported evidence → domain theme → calibrated inference → optional observable scenario.',
  ];

  if (signals.userReportedObservation) {
    lines.push(
      'User observation present: treat as report, not lab-verified frequency or metaphysical proof.',
    );
  }
  if (signals.hijriChronologyPresent && !signals.spiritualModeRequested) {
    lines.push(
      'Hijri date is chronological context only. Do NOT invent purification/closure/spiritual reset effects from the month alone.',
    );
  }
  if (signals.spiritualModeRequested) {
    lines.push(
      'User requested spiritual/symbolic framing: richer symbolic language OK, still ≠ external factual certainty.',
    );
  }
  if (signals.coincidenceCausePressure) {
    lines.push(
      'Coincidence pressure: you may note a shared theme; do not claim the universe is forcing one external cause.',
    );
  }
  if (signals.contradictionPriority) {
    lines.push(
      'Layer conflict: if observable refusal/behavior contradicts symbolic closeness, state the tension; do not force one narrative.',
    );
  }
  if (signals.relationshipMotiveLock || signals.relationshipBehaviorPresent) {
    lines.push(
      'RELATIONSHIP: OBSERVED BEHAVIOR ≠ INTERNAL MOTIVE.',
      'Strong pattern description is allowed (approach–distance repeats, unstable contact).',
      'Do NOT invent a single psychological story (içsel çekim, bağlanma korkusu, sınır testi, seni bırakamıyor, etc.) from behavior alone.',
      'If user asks why: offer several plausible explanations, keep them hypothetical, and name what evidence would distinguish them.',
      'Qualifiers (olabilir/muhtemelen) do not make an unsupported motive the main answer.',
      'Do not rank a "strongest motive" unless observable evidence actually distinguishes.',
      'Evidence weight: repeated behavior > direct reported statement > stable context > symbolic > speculative motive.',
      'User-reported statements from the person may be used as stated evidence — still not independently verified inner state.',
      'Never print OBSERVED/MOTIVE/UNKNOWN labels unless user asks for structured analysis.',
    );
  }
  if (signals.directMotiveEvidencePresent) {
    lines.push(
      'Direct motive statement present: you may cite it as their reported reason; do not upgrade it to absolute certainty or invent extra motives.',
    );
  }
  if (extra.astrologyGrounded) {
    lines.push(
      'Astrology: separate astronomical input / traditional interpretation / real-world hypothesis.',
    );
  }
  if (extra.referentialSufficient === false) {
    lines.push('Referent insufficient — prefer clarification over eloquent invention.');
  }

  return lines.join('\n');
}

/**
 * Structural check: unsupported motive story from behavior (qualifiers alone do not save).
 * @param {string} reply
 * @param {{
 *   signals?: ReturnType<typeof detectEvidenceMeaningSignals>|null,
 *   allowSupported?: boolean,
 * }} [opts]
 */
export function replyHasUnsupportedMotiveAttribution(reply, opts = {}) {
  const text = String(reply || '');
  if (!text.trim()) return false;
  const signals = opts.signals || null;
  if (signals?.directDomainQuestion) return false;
  if (opts.allowSupported !== false && signals?.directMotiveEvidencePresent) {
    // Supported motive may mention reported feelings; only fail hard certainty / invented extras stacked as fact.
    return MOTIVE_CERTAINTY_RES.some((re) => re.test(text));
  }
  const hasMotiveLang = UNSUPPORTED_MOTIVE_LANG_RES.some((re) => re.test(text));
  const hasCertainty = MOTIVE_CERTAINTY_RES.some((re) => re.test(text));
  if (!hasMotiveLang && !hasCertainty) return false;
  if (CALIBRATED_MOTIVE_FRAME_RE.test(text) && !hasCertainty) {
    // Calibrated multi-hypothesis frame without certainty — OK even if motive words appear as options.
    const primarySingle =
      /\b(asıl|gerçek|aslında|temel)\s+neden.{0,40}(korku|[oö]zlem|[cç]ekim|ihtiya[cç]|ba[gğ]lanma)/i.test(
        text,
      ) ||
      /\bbunun\s+nedeni\s+(onun\s+)?(korku|[oö]zlem|ba[gğ]lanma|i[cç]sel)/i.test(text);
    return primarySingle;
  }
  return true;
}

/**
 * Soften beautiful-nonsense unsupported bridges without sterilizing synthesis.
 * @param {string} reply
 * @param {{
 *   signals?: ReturnType<typeof detectEvidenceMeaningSignals>|null,
 *   casual?: boolean,
 *   message?: string,
 * }} [opts]
 */
export function applyEvidenceMeaningPostGuard(reply, opts = {}) {
  const original = typeof reply === 'string' ? reply : '';
  if (!original.trim() || opts.casual === true) {
    return { reply: original, hits: [], changed: false };
  }

  const signals = opts.signals || null;
  const hits = [];
  let text = original;
  const spiritualOk = signals?.spiritualModeRequested === true;

  const replaceSentences = (resList, hit, replacer) => {
    let any = false;
    for (const re of resList) {
      if (re.test(text)) {
        any = true;
        break;
      }
    }
    if (!any) return;
    hits.push(hit);
    text = text.replace(/[^.!?…\n]+[.!?…]?/g, (sentence) => {
      if (!resList.some((re) => re.test(sentence))) return sentence;
      return typeof replacer === 'function' ? replacer(sentence) : replacer;
    });
  };

  if (!spiritualOk) {
    replaceSentences(
      HIJRI_UNSUPPORTED_EFFECT_RES,
      'hijri_unsupported_spiritual_effect',
      ' Hicrî tarih kronolojik bağlam sağlar; tek başına psikolojik veya ruhsal etki ürettiğini söylemek için yeterli dayanak yok.',
    );
  }

  replaceSentences(
    PSYCH_OVERCLAIM_RES,
    'psychology_overclaim',
    (sentence) => {
      if (
        /ba[gğ]lanmaktan\s+kork|ba[gğ]lanma\s+kork|korkuyor/i.test(sentence) &&
        /ven[uü]s|sat[uü]rn|transit|astroloj/i.test(sentence)
      ) {
        return ' Venüs–Satürn astrolojik yorumda mesafe, sınır veya çekingenlik temalarıyla ilişkilendirilebilir; karşı tarafın gerçek bağlanma korkusunu buradan çıkaramayız.';
      }
      return ' Astrolojik yorumda bu tema belirsizlik veya netlik arayışıyla ilişkilendirilebilir; klinik bir gerçeklik bozulması iddiası değildir.';
    },
  );

  replaceSentences(
    TAROT_MIND_FACT_RES,
    'tarot_mind_reading',
    (sentence) => {
      if (/unutam/i.test(sentence)) {
        return ' Kart ve davranış tematik olarak örtüşebilir; bu, karşı tarafın seni unutamadığını kanıtlamaz.';
      }
      return ' Kart bunu kanıtlamaz. Tarot açısından bağlantı veya duygusal yönelim teması yorumlanabilir; karşı tarafın gerçek zihinsel durumunu buradan bilemeyiz.';
    },
  );

  replaceSentences(
    DREAM_PROPHECY_RES,
    'dream_deterministic',
    (sentence) => {
      if (/d[uü][sş][uü]n/i.test(sentence) && /r[uü]ya/i.test(sentence)) {
        return ' Rüya ile sonraki mesaj senin deneyiminde eşzamanlılık hissi yaratabilir; onun da seni düşündüğünü buradan çıkaramayız.';
      }
      return ' Rüya sembolü geçiş/eşik temasıyla yorumlanabilir, ama tek başına gelecekte belirli bir olayın olacağını göstermez.';
    },
  );

  if (!spiritualOk) {
    replaceSentences(
      META_CAUSE_RES,
      'numerology_metaphysical_cause',
      ' Tekrarlayan gözlem incelenmeye değer; evrenin kesin mesaj gönderdiğini buradan çıkaramayız. Numerolojik tema ayrı bir sembolik okuma olarak ele alınabilir.',
    );
  } else {
    // Spiritual mode: still block hard metaphysical certainty language.
    if (META_CAUSE_RES.some((re) => re.test(text))) {
      hits.push('numerology_metaphysical_cause');
      text = text
        .replace(
          /\bevren\s+(sana\s+)?(kesin(likle)?\s+)?mesaj\s+(veriyor|g[oö]nderiyor)/gi,
          'sembolik okumada tekrarlayan bir mesaj teması hissedilebilir',
        )
        .replace(/\btesad[uü]f\s+de[gğ]il[,.]?\s+(evren|kader|kozmik)\b/gi, 'sembolik çerçevede anlamlı bir denk gelme');
    }
  }

  replaceSentences(
    PARANORMAL_SYNTHESIS_RES,
    'cross_domain_paranormal_cause',
    ' Üç deneyimde de ortak bir tema olması mümkün; bu, aynı dış/paranormal nedeni kanıtlamaz.',
  );

  // Soften “benzer frekanslar birbirini çeker” even mid-sentence without full sentence wipe.
  if (/\bbenzer\s+frekanslar\s+birbirini\s+[cç]eker\b/i.test(text)) {
    if (!hits.includes('numerology_metaphysical_cause')) {
      hits.push('beautiful_nonsense_frequency');
    }
    text = text.replace(
      /\bbenzer\s+frekanslar\s+birbirini\s+[cç]eker\b/gi,
      'benzer temaların dikkatte bir araya gelmesi mümkün',
    );
  }

  // Qualifier-washed Hijri nonsense: "Safer ayı muhtemelen enerjisel olarak içsel arınmayı tetikleyebilir"
  if (
    !spiritualOk &&
    /\b(safer|hicr[iî]|ramazan).{0,60}(muhtemelen|olabilir).{0,40}(enerji|ar[ıi]n|sadele[sş]|ruhsal).{0,30}(tetik|destek|yarat)/i.test(
      text,
    )
  ) {
    hits.push('hijri_qualified_unsupported_bridge');
    text = text.replace(/[^.!?…\n]+[.!?…]?/g, (sentence) => {
      if (
        !/\b(safer|hicr[iî]|ramazan).{0,60}(muhtemelen|olabilir).{0,40}(enerji|ar[ıi]n|sadele[sş]|ruhsal).{0,30}(tetik|destek|yarat)/i.test(
          sentence,
        )
      ) {
        return sentence;
      }
      return ' Hicrî tarih kronolojik bağlamdır; nitelikli dil bile tek başına ruhsal etki iddiasını temellendirmez.';
    });
  }

  // Relationship: OBSERVED BEHAVIOR ≠ INTERNAL MOTIVE (post-generation semantic repair)
  const motiveActive =
    signals?.relationshipMotiveLock === true ||
    signals?.relationshipBehaviorPresent === true ||
    signals?.motiveAttributionPressure === true ||
    RELATIONSHIP_BEHAVIOR_RE.test(text) ||
    thirdPartyFeelingInReply(text);
  if (
    motiveActive &&
    signals?.directDomainQuestion !== true &&
    replyHasUnsupportedMotiveAttribution(text, { signals })
  ) {
    hits.push('relationship_unsupported_motive');
    const keepPatternSentences = [];
    text = text.replace(/[^.!?…\n]+[.!?…]?/g, (sentence) => {
      const s = sentence.trim();
      if (!s) return sentence;
      const isPatternOnly =
        /\b([oö]r[uü]nt[uü]|yakla[sş]ma|uzakla[sş]|tekrar|d[oö]ng[uü]|davran[ıi][sş]\s+d[uü]zey|temas[ıi]n\s+istikrar)/i.test(
          s,
        ) && !UNSUPPORTED_MOTIVE_LANG_RES.some((re) => re.test(s)) && !MOTIVE_CERTAINTY_RES.some((re) => re.test(s));
      if (isPatternOnly) {
        keepPatternSentences.push(sentence);
        return sentence;
      }
      if (
        UNSUPPORTED_MOTIVE_LANG_RES.some((re) => re.test(s)) ||
        MOTIVE_CERTAINTY_RES.some((re) => re.test(s)) ||
        /\b(ihtiya[cç]|korku|karars[ıi]zl[ıi]k|s[ıi]n[ıi]r\s+test|[cç]ekim|ba[gğ]l[ıi]l[ıi]k)\b/i.test(s)
      ) {
        return '';
      }
      return sentence;
    });
    text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
    if (!CALIBRATED_MOTIVE_FRAME_RE.test(text) || !text.trim()) {
      const prefix = keepPatternSentences.length
        ? `${keepPatternSentences.join(' ').trim()}`
        : text.trim();
      const repair = pickMotiveRepairReply(signals, opts.message || '');
      text = `${prefix}${repair}`.replace(/^\s+/, '').replace(/\s{2,}/g, ' ');
    } else if (!/\bay[ıi]rt\s+(edici|etmek)|daha\s+g[uü][cç]l[uü]\s+veri/i.test(text)) {
      text = `${text.trim()} Dönüşte ne söylediği ve sonrasında davranışının nasıl sürdüğü bunları ayırt etmek için daha güçlü veri olur.`;
    }
  } else if (
    motiveActive &&
    signals?.directMotiveEvidencePresent &&
    MOTIVE_CERTAINTY_RES.some((re) => re.test(text))
  ) {
    hits.push('relationship_motive_overcertainty');
    text = text.replace(/[^.!?…\n]+[.!?…]?/g, (sentence) => {
      if (!MOTIVE_CERTAINTY_RES.some((re) => re.test(sentence))) return sentence;
      return ' Kendi ifadesine göre bu bir dönüş nedeni olabilir; yine de tek başına kesin iç durum kanıtı değildir.';
    });
  }

  return {
    reply: text,
    hits,
    changed: text !== original,
  };
}

/** Unsupported spiritual→medical treatment framing. */
const MEDICAL_TREATMENT_CLAIM_RES = [
  /\b(iyile[sş]tirir|tedavi\s+eder|ge[cç]irir|d[uü]zeltir)\b/i,
  /\bb[oö]bre[gğ]i?\s+(d[uü]zelt|iyile[sş]|onard)/i,
  /\bkreatinin\w*\s+d[uü][sş][uü]r/i,
  /\borgan[ıi]\s+iyile[sş]/i,
  /\bdoktor\s+tedavisinin\s+yerine\b/i,
  /\b(\d+)\s*(kez|kere|defa).{0,40}(kesin\s+)?(iyile[sş]|ge[cç]er|d[uü]zel)/i,
  /\bkesin\s+(sonu[cç]|iyile[sş]me|şifa)\b/i,
];

const MEDICAL_CONTEXT_SIGNAL_RE =
  /\b(hastal[ıi][kğ]|hasta|yetmezli[gğ]|b[oö]brek|kanser|ameliyat|migren|kronik|kreatinin|doktor|tedavi)\b/i;

const SPIRITUAL_PRACTICE_SIGNAL_RE =
  /\b(esma|dua|zikir|manevi|[cç]ekil|oku|şifa\s+niyet|ya\s+[şs][aâ]f)/i;

/**
 * Detect medical + spiritual co-presence for claim calibration (not blocking).
 * @param {string} message
 */
export function detectMedicalSpiritualSignals(message) {
  const text = String(message || '');
  return {
    medicalContext: MEDICAL_CONTEXT_SIGNAL_RE.test(text),
    spiritualPracticeAsk: SPIRITUAL_PRACTICE_SIGNAL_RE.test(text),
    treatmentClaimLanguage: MEDICAL_TREATMENT_CLAIM_RES.some((re) => re.test(text)),
  };
}

/**
 * Calibrate unsupported treatment claims in spiritual replies — do not suppress recommendation.
 * @param {string} reply
 * @param {{ medicalContext?: boolean, message?: string }} [opts]
 */
export function applyMedicalSpiritualClaimGuard(reply, opts = {}) {
  const original = typeof reply === 'string' ? reply : '';
  if (!original.trim()) {
    return { reply: original, hits: [], changed: false };
  }

  const signals = detectMedicalSpiritualSignals(opts.message || '');
  const medicalContext = opts.medicalContext === true || signals.medicalContext;
  const hits = [];
  let text = original;

  if (!medicalContext && !signals.treatmentClaimLanguage) {
    return { reply: text, hits, changed: false };
  }

  for (const re of MEDICAL_TREATMENT_CLAIM_RES) {
    if (re.test(text)) {
      hits.push('medical_treatment_claim');
      break;
    }
  }

  if (hits.length) {
    text = text
      .replace(/\b(hastal[ıi][gğ][ıi]|b[oö]brek\w*|organ[ıi])\s+(iyile[sş]tirir|d[uü]zeltir|ge[cç]irir|tedavi\s+eder)\b/gi, 'manevi destek olarak okunabilir; tıbbi tedavi iddiası değildir')
      .replace(/\biyile[sş]tirir\b/gi, 'manevi sükûnet niyetiyle anılabilir')
      .replace(/\btedavi\s+eder\b/gi, 'tedavi yerine geçmez')
      .replace(/\bkreatinin\w*\s+d[uü][sş][uü]r\w*/gi, 'lab değerlerini değiştirdiğini söyleyemem')
      .replace(/\b(\d+)\s*(kez|kere|defa).{0,40}(kesin\s+)?(iyile[sş]|ge[cç]er|d[uü]zel)\w*/gi, 'belirli sayıda okumak iyileşme garantisi vermez')
      .replace(/\bkesin\s+(sonu[cç]|iyile[sş]me|şifa)\b/gi, 'garanti sonuç değil');
  }

  // Allowed spiritual framing must remain; only strip hard treatment claims.
  return {
    reply: text,
    hits,
    changed: text !== original,
  };
}

/**
 * Semantic assertions for tests — structure, not mere qualifier presence.
 * @param {string} reply
 * @param {'hijri_effect'|'psych_overclaim'|'tarot_mind'|'dream_prophecy'|'meta_cause'|'paranormal_synthesis'|'relationship_motive'|'medical_treatment'} kind
 */
export function replyViolatesEvidenceBoundary(reply, kind) {
  const text = String(reply || '');
  if (kind === 'relationship_motive') {
    return replyHasUnsupportedMotiveAttribution(text);
  }
  if (kind === 'medical_treatment') {
    return MEDICAL_TREATMENT_CLAIM_RES.some((re) => re.test(text));
  }
  const map = {
    hijri_effect: HIJRI_UNSUPPORTED_EFFECT_RES,
    psych_overclaim: PSYCH_OVERCLAIM_RES,
    tarot_mind: TAROT_MIND_FACT_RES,
    dream_prophecy: DREAM_PROPHECY_RES,
    meta_cause: META_CAUSE_RES,
    paranormal_synthesis: PARANORMAL_SYNTHESIS_RES,
  };
  const list = map[kind] || [];
  return list.some((re) => re.test(text));
}
