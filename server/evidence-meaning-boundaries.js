/**
 * Evidence → Meaning boundaries — shared epistemic contract (not a new engine).
 *
 * Reuses cognitive-reflex / referential-sufficiency / symbolic-context hooks.
 * Internal signals only — never dump layer labels to users.
 *
 * Chain: SOURCE EVIDENCE → DOMAIN INTERPRETATION → INFERENCE → OBSERVABLE SCENARIO
 * Shared theme allowed; unsupported shared cause not.
 */

export const EVIDENCE_MEANING_VERSION = 'atlas-evidence-meaning-v1';

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
];

/** Tarot / symbol → other person's actual mind as fact. */
const TAROT_MIND_FACT_RES = [
  /\b(kart|tarot).{0,40}(onu\s+d[uü][sş][uü]nd[uü][gğ][uü]n[uü]|seni\s+d[uü][sş][uü]n[uü]yor|geri\s+d[oö]nece[gğ]ini)\s+(kan[ıi]tl|g[oö]ster|ispat)/i,
  /\b(evet[,.]?\s+)?(seni\s+d[uü][sş][uü]n[uü]yor|onu\s+d[uü][sş][uü]n[uü]yor)\b(?!.{0,20}(olabilir|tema|yorum))/i,
  /\bkart\s+.{0,30}(zihnini|niyetini)\s+(okur|g[oö]sterir|kan[ıi]tlar)/i,
];

/** Dream → deterministic future event. */
const DREAM_PROPHECY_RES = [
  /\br[uü]ya.{0,40}(kesin(likle)?\s+)?(yeni\s+d[oö]neme?\s+gir|gelecekte\s+\w+\s+olacak|kehanet)/i,
  /\bkap[ıi].{0,30}(kesin(likle)?\s+)?(yeni\s+d[oö]nem|gelecek\s+olay)/i,
  /\br[uü]ya\s+tek\s+ba[sş][ıi]na.{0,20}(g[oö]sterir|kan[ıi]tlar)\s+ki/i,
];

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

  const needsEvidenceMeaningLock =
    !directDomainQuestion &&
    (coincidenceCausePressure ||
      userReportedObservation ||
      hijriChronologyPresent ||
      spiritualModeRequested ||
      contradictionPriority ||
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
 * Soften beautiful-nonsense unsupported bridges without sterilizing synthesis.
 * @param {string} reply
 * @param {{
 *   signals?: ReturnType<typeof detectEvidenceMeaningSignals>|null,
 *   casual?: boolean,
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
    ' Astrolojik yorumda bu tema belirsizlik veya netlik arayışıyla ilişkilendirilebilir; klinik bir gerçeklik bozulması iddiası değildir.',
  );

  replaceSentences(
    TAROT_MIND_FACT_RES,
    'tarot_mind_reading',
    ' Kart bunu kanıtlamaz. Tarot açısından bağlantı veya duygusal yönelim teması yorumlanabilir; karşı tarafın gerçek zihinsel durumunu buradan bilemeyiz.',
  );

  replaceSentences(
    DREAM_PROPHECY_RES,
    'dream_deterministic',
    ' Rüya sembolü geçiş/eşik temasıyla yorumlanabilir, ama tek başına gelecekte belirli bir olayın olacağını göstermez.',
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

  return {
    reply: text,
    hits,
    changed: text !== original,
  };
}

/**
 * Semantic assertions for tests — structure, not mere qualifier presence.
 * @param {string} reply
 * @param {'hijri_effect'|'psych_overclaim'|'tarot_mind'|'dream_prophecy'|'meta_cause'|'paranormal_synthesis'} kind
 */
export function replyViolatesEvidenceBoundary(reply, kind) {
  const text = String(reply || '');
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
