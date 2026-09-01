/**
 * General reasoning guards for religion / history / comparative-belief
 * questions — the code-level counterpart of policy that previously existed
 * only as prompt-doc text (atlas_forbidden_patterns.md's "Din/Tarih/Kutsal
 * Metin İddiaları" section, which already names the agreement-bias rule
 * almost verbatim). Generalized from one real routing incident
 * (see domain-detector.js's COMPARATIVE_RELIGION_RE comment and
 * scripts/test-religion-history-routing.mjs) into reusable directive
 * builders + detectors, following the same directive-selection shape
 * quran-verse-lookup/index.js already uses for scripture-citation guards.
 *
 * These are prompt-injection guards (steer the model), not post-hoc text
 * censors — consistent with every other guard in this codebase
 * (evidence-meaning-boundaries.js, cognitive-reflex-guards.js, etc.).
 */

/** @typedef {import('./source-policy.js').KnowledgeDomainId} KnowledgeDomainId */

const RELIGION_HISTORY_DOMAINS = new Set([
  'quran',
  'comparative_religion',
  'mythology',
  'esotericism',
  'hermeticism_alchemy',
  'ancient_traditions',
]);

/** @param {KnowledgeDomainId|null} domain */
export function isReligionHistoryDomain(domain) {
  return Boolean(domain && RELIGION_HISTORY_DOMAINS.has(domain));
}

/** Separates doctrine / history / interpretation instead of blurring them. */
export function buildTheologyFactSeparationDirective() {
  return (
    '[THEOLOGY VS. HISTORY GUARD]\n' +
    'Bu bir din/tarih/karşılaştırmalı inanç sorusu olabilir. Şunları asla birbirine karıştırma:\n' +
    '- "İslam teolojisinde X" (dini doktrin/inanç iddiası)\n' +
    '- "Tarihsel olarak X" (tarihsel/akademik iddia, kaynağa dayanmalı)\n' +
    '- "Sonraki yorum/tasavvufi okuma X\'i böyle görür" (yorum, doktrin değil)\n' +
    'Bir dinin/geleneğin kavramını başka bir dinin/geleneğin kavramının kanıtı gibi sunma.\n' +
    'Tefsir, hadis veya sonraki halk anlatısını doğrudan kutsal metnin kendisiymiş gibi sunma.\n' +
    'Kaynaksız felsefi/tarihsel iddiayı kesin olgu gibi sunma; belirsizse belirsiz olduğunu söyle.'
  );
}

/** Resists validating the user's thesis merely because they assert it firmly. */
export function buildAgreementBiasResistanceDirective() {
  return (
    '[AGREEMENT-BIAS GUARD]\n' +
    'Kullanıcının tezini, sadece ısrarla veya inançla savunduğu için doğrulama.\n' +
    'Öncül tartışmalıysa veya kanıt yetersizse, kibarca sorgula; olguyu yorumdan ayır.\n' +
    'Kullanıcıyla aynı fikirde görünmek yerine doğruluğu ve kanıt durumunu önceliklendir.'
  );
}

/** Blocks unsupported broad ethnic/religious/historical generalizations. */
export function buildGeneralizationGuardDirective() {
  return (
    '[GENERALIZATION GUARD]\n' +
    'Bir etnik grup, din veya tarihi topluluk hakkında geniş/kesin genelleme yapma\n' +
    '("hep", "hepsi", "hiçbiri", "her zaman" gibi) — kanıt açıkça bunu desteklemiyorsa.\n' +
    'Çeşitliliği ve istisnaları kabul et; tek bir kaynağı/örneği bütün bir grup için genelleme.'
  );
}

const AGREEMENT_PRESSURE_RE =
  /\b(degil\s*mi|hakli\s*degil\s*miyim|sen\s*de\s*(?:oyle|katil)|kesinlikle\s*oyle|israrla)\b/iu;

/**
 * Detects the user pressuring the assistant to simply agree with a thesis
 * ("değil mi", "sen de öyle düşünüyorsun değil mi", "ısrarla") — the shape
 * atlas_forbidden_patterns.md's agreement-bias rule describes, generalized
 * to a reusable check instead of being enforced only via prompt text.
 * @param {string} message
 */
export function detectAgreementBiasPressure(message) {
  const folded = String(message ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
  return AGREEMENT_PRESSURE_RE.test(folded);
}

const BROAD_GENERALIZATION_RE =
  /\b(tum|butun|her)\s+[a-z]+(?:lar|ler)\s+(?:hep|her\s*zaman|hicbir\s*zaman|asla)\b/iu;

/**
 * Detects a broad "all X always/never Y" generalization shape in either the
 * user's message or a candidate reply.
 * @param {string} text
 */
export function detectBroadGeneralizationClaim(text) {
  const folded = String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
  return BROAD_GENERALIZATION_RE.test(folded);
}

const SOURCE_DISAGREEMENT_RE =
  /\b(bazi\s+kaynak|kimi\s+kaynak|farkli\s+kaynak|tartismali|gorus\s+ayriligi|net\s+degil|kesin\s+degil|ihtilaf)\b/iu;

/**
 * Heuristic: did the model's own web-retrieved answer already signal that
 * sources disagree? This is the minimum viable cross-source contradiction
 * check the retrieval architecture supports today — retrieveFromWeb() asks
 * one model call to synthesize one answer from multiple sources rather than
 * returning independent per-source claims to diff against each other, so
 * disagreement can only be read off what the model itself surfaced. A
 * stronger check (comparing independently-fetched source texts) would need
 * a retrieval-architecture change, not a guard — see the architecture report.
 * @param {string} answerText
 */
export function detectSourceDisagreementSignal(answerText) {
  const folded = String(answerText ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
  return SOURCE_DISAGREEMENT_RE.test(folded);
}

/**
 * Combines the guards above into the directive set for one message. Always
 * includes the theology/history and generalization guards for the
 * religion/history domain family; agreement-bias and generalization guards
 * also fire independently of domain, since agreement-bias pressure and
 * unsupported generalizations are not religion/history-specific problems.
 * @param {{ message: string, domain: KnowledgeDomainId|null }} input
 * @returns {string[]}
 */
export function selectReasoningGuardDirectives({ message, domain }) {
  const directives = [];
  const inReligionHistoryDomain = isReligionHistoryDomain(domain);

  if (inReligionHistoryDomain) {
    directives.push(buildTheologyFactSeparationDirective());
  }
  if (inReligionHistoryDomain || detectAgreementBiasPressure(message)) {
    directives.push(buildAgreementBiasResistanceDirective());
  }
  if (inReligionHistoryDomain || detectBroadGeneralizationClaim(message)) {
    directives.push(buildGeneralizationGuardDirective());
  }
  return directives;
}
