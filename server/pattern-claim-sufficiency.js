/**
 * Pattern claim sufficiency — narrow shared invariant.
 *
 * PATTERN QUESTION ≠ PATTERN EXISTS.
 * Claim strength cannot exceed observational sufficiency.
 * Pattern existence ≠ cause / motive / spiritual mechanism.
 *
 * Extends referential-sufficiency + cognitive-reflex + evidence-meaning.
 * Not a second router / reasoning engine / keyword blacklist.
 */

export const PATTERN_CLAIM_SUFFICIENCY_VERSION = 'atlas-pattern-claim-sufficiency-v1';

/** @typedef {'insufficient'|'partial'|'sufficient'} PatternSufficiency */
/** @typedef {'repeated_event'|'repeated_behavior'|'temporal'|'relational'|'symbolic'|'explicit_user_report'|'conversation_context'|'numerology'} PatternEvidenceType */

const DIRECT_DEFINITION_RE =
  /(?:^|[^\p{L}\p{N}])([oö]r[uü]nt[uü]\s+kelimesi|davran[ıi][sş]\s+[oö]r[uü]nt[uü]s[uü]\s+nedir|tekrarlayan\s+ondal[ıi]k|[oö]r[uü]nt[uü]\s+ne\s+demek|psikolojide\s+.{0,20}[oö]r[uü]nt)/iu;

/** Explicit invite to interpret across domains after pattern is established. */
const INTERPRETATION_INVITE_RE =
  /(?:psikolojik|astroloj|sembolik|spirit|numerol|tarot).{0,40}(?:taraf|a[cç][ıi]|yorum|anlat)|ayr[ıi]\s+ayr[ıi]\s+anlat|bilin[cç]alt[ıi]\s+m[ıi]|karma.{0,20}olabilir\s*m[ıi]/i;

/** Asks that pressure pattern / coincidence / cycle claims. */
const PATTERN_CLAIM_ASK_RES = [
  /tesad[uü]f\s+m[uü]/i,
  /tesad[uü]f\s+de[gğ]il/i,
  /tesad[uü]ften\s+[oö]te/i,
  /(?:bir\s+)?tekrar\s+m[ıi]/i,
  /tekrar\s+m[ıi]/i,
  /yoksa\s+bir\s+tekrar/i,
  /yine\s+ayn[ıi]\s+[sş]ey/i,
  /bu\s+d[oö]ng[uü]\s+m[uü]/i,
  /d[oö]ng[uü]\s+m[uü]/i,
  /hep\s+ayn[ıi]\s+yere/i,
  /bir\s+[sş]ey\s+s[uü]rekli\s+kendini\s+tekrar/i,
  /kendini\s+tekrar\s+ediyor/i,
  /bu\s+kadar\s+denk\s+gel/i,
  /denk\s+gelmesi\s+normal/i,
  /[oö]r[uü]nt[uü]\s+(?:var\s+m[ıi]|say[ıi]l[ıi]r|m[ıi])/i,
  /iki\s+kere\s+oldu.{0,30}[oö]r[uü]nt/i,
  /[uü][cç][uü]nc[uü]\s+kez/i,
  /yine\s+oldu/i,
  /neden\s+hep\s+oluyor/i,
  /hep\s+oluyor/i,
  /bilin[cç]alt[ıi]\s+m[ıi]/i,
  /karman[ıi]n\s+tekrar/i,
  /karma.{0,20}tekrar/i,
  /evren\s+ayn[ıi]\s+[sş]eyi/i,
  /evren.{0,30}tekrar/i,
  /bu\s+yine\s+ayn[ıi]/i,
  /bence\s+bu\s+tesad[uü]f\s+de[gğ]il/i,
  /tekrar[ıi]n\s+(psikolojik|astroloj|sembolik|anlam)/i,
  /tekrar\s+bir\s+[iİ][sş]aret|[iİ][sş]aret\s+m[ıi]/i,
  /bu\s+tekrar/i,
];

const EXPLICIT_COUNT_RE =
  /(?:^|[^\p{L}\p{N}])((?:bir|iki|[uü][cç]|d[oö]rt|be[sş]|alt[ıi]|yedi|sekiz|dokuz|on|\d{1,2})\s+(?:kez|kere|defa|ili[sş]kide|r[uü]yamda|gece|g[uü]nd[uü]r)|[uü][cç][uü]nc[uü]\s+kez|ikinci\s+kez|d[oö]rd[uü]nc[uü]\s+kez)(?=$|[^\p{L}\p{N}])/iu;

const OBSERVATION_CUE_RE =
  /(?:arad[ıi]|mesaj\s+gel|yazd[ıi]|uzakla[sş]|geri\s+(?:gel|d[oö]n|yaz)|g[oö]rd[uü]m|g[oö]r[uü]yorum|r[uü]yamda|kap[ıi]|yo[gğ]unla[sş]|yakla[sş]|temas|ili[sş]ki|ayn[ıi]\s+saat|ay[ıi]n\s+\d{1,2}|plaka|say[ıi]s[ıi]n[ıi]|kar[sş][ıi]ma\s+[cç][ıi]kt)/i;

const BEHAVIOR_CHAIN_RE =
  /(?:yo[gğ]unla[sş].{0,60}uzakla[sş]|yakla[sş].{0,40}uzakla[sş]|uzakla[sş].{0,40}(?:yeniden\s+)?(?:yaz|d[oö]n|geri)|yak[ıi]nla[sş].{0,40}geri\s+[cç]ekil)/i;

const SYMBOLIC_REPEAT_RE =
  /(?:r[uü]ya.{0,40}(?:ayn[ıi]|tekrar)|ayn[ıi]\s+(?:kap[ıi]|sembol|ki[sş]i).{0,30}(?:r[uü]ya|g[oö]r)|[uü][cç]\s+r[uü]ya)/i;

const TEMPORAL_REPEAT_RE =
  /(?:ayn[ıi]\s+saat|ay[ıi]n\s+\d{1,2}|her\s+ay|ge[cç]en\s+ay.{0,40}bu\s+ay|g[uü]nd[uü]r\s+\d)/i;

const NUMEROLOGY_REPEAT_RE =
  /(?:\d{1,4}\s+say[ıi]|say[ıi]s[ıi]n[ıi]\s+g[oö]r|s[uü]rekli\s+.{0,10}\d{1,4}|d[oö]rt\s+g[uü]nd[uü]r\s+.{0,10}\d)/i;

/** High-threshold claims in assistant replies. */
const PATTERN_EXISTENCE_ASSERT_RES = [
  /tekrar[ıi]n\s+[iİ]zleri/i,
  /tekrarlayan\s+bir\s+(yap[ıi]|[oö]r[uü]nt[uü]|d[oö]ng[uü])/i,
  /\ba[cç][ıi]k\s+bir\s+[oö]r[uü]nt[uü]/i,
  /\bkesin\s+(bir\s+)?(tekrar|[oö]r[uü]nt[uü]|d[oö]ng[uü])/i,
  /\bayn[ıi]\s+d[oö]ng[uü]\b/i,
  /\bbu\s+bir\s+[oö]r[uü]nt[uü]\b/i,
  /\b[oö]r[uü]nt[uü]\s+var\b/i,
  /\btekrar\s+ediyor\b/i,
];

const NON_COINCIDENCE_ASSERT_RES = [
  /tesad[uü]ften\s+[oö]te/i,
  /tesad[uü]f\s+de[gğ]il/i,
  /tesad[uü]f\s+olamaz/i,
  /tesad[uü]ften\s+[cç]ok/i,
];

const PSYCH_CAUSE_ASSERT_RES = [
  /bilin[cç]alt[ıi].{0,40}(yans[ıi]ma|tekrar|yarat|ettir)/i,
  /bilin[cç]alt[ıi]n[ıi]n\s+veya/i,
  /travma.{0,30}(yarat|neden|tekrar)/i,
  /ba[gğ]lanma\s+korkusu.{0,20}(y[uü]z[uü]nden|neden)/i,
];

const SPIRITUAL_CAUSE_ASSERT_RES = [
  /ya[sş]am\s+d[oö]ng[uü]s[uü].{0,30}(yans[ıi]ma|tekrar)/i,
  /karma\s+(d[oö]ng[uü]|tekrar)/i,
  /kadersel\s+tekrar/i,
  /evren\s+.{0,30}(mesaj|g[oö]ster|g[oö]nder)/i,
  /ruhsal\s+d[oö]ng[uü]/i,
  /enerji\s+.{0,20}(tekrar|d[oö]ng[uü])/i,
];

const STRONG_PATTERN_ONLY_RES = [
  /kesin\s+(bir\s+)?(tekrar|[oö]r[uü]nt[uü])/i,
  /a[cç][ıi]k\s+bir\s+[oö]r[uü]nt[uü]/i,
  /tesad[uü]ften\s+[oö]te/i,
  /tesad[uü]f\s+de[gğ]il/i,
];

const INSUFFICIENT_CLARIFY =
  'Bunu ayırmak için neyin tekrar ettiğini görmem lazım. Aynı olay mı, aynı kişi tipi mi, benzer zamanlama mı, yoksa sende aynı tepki mi tekrar ediyor? Bir-iki örneği yan yana koyarsak tesadüf ile örüntüyü daha sağlıklı ayırabiliriz.';

const PARTIAL_SOFTEN =
  ' Benzerlik var; ancak eldeki örnekler tek başına güçlü bir örüntü demek için sınırlı veri. Daha fazla karşılaştırılabilir olay olursa tekrar iddiasını güçlendirebiliriz.';

/**
 * Turkish-safe lowercase for regex matching (JS `i` flag is not locale-aware for İ/I).
 * @param {string} text
 */
function trLower(text) {
  return String(text || '').toLocaleLowerCase('tr-TR');
}

/**
 * @param {string} message
 */
export function isDirectPatternDefinitionAsk(message) {
  return DIRECT_DEFINITION_RE.test(trLower(message));
}

/**
 * @param {string} message
 */
export function isPatternClaimAsk(message) {
  const text = trLower(message).trim();
  if (!text) return false;
  if (isDirectPatternDefinitionAsk(text)) return false;
  return PATTERN_CLAIM_ASK_RES.some((re) => re.test(text));
}

/**
 * Normalize a user turn into a coarse fingerprint for independence dedupe.
 * @param {string} text
 */
function fingerprintObservation(text) {
  const t = String(text || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Collapse common rephrase markers
  return t
    .replace(/\b(evet|yine|bahsettigim|bahsediyorum|soylemistim|dedigim)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/**
 * @param {string} text
 * @returns {{ type: PatternEvidenceType, fingerprint: string, source: 'user'|'explicit' }|null}
 */
function observationFromText(text) {
  const raw = String(text || '').trim();
  if (!raw || raw.length < 6) return null;
  const lower = trLower(raw);

  // Pure pattern questions are not observations
  if (
    isPatternClaimAsk(lower) &&
    !OBSERVATION_CUE_RE.test(lower) &&
    !EXPLICIT_COUNT_RE.test(lower) &&
    !BEHAVIOR_CHAIN_RE.test(lower)
  ) {
    return null;
  }

  if (EXPLICIT_COUNT_RE.test(lower) && (OBSERVATION_CUE_RE.test(lower) || /oluyor|oldu|bitti|yazd/i.test(lower))) {
    return {
      type: 'explicit_user_report',
      fingerprint: fingerprintObservation(lower),
      source: 'explicit',
    };
  }

  if (SYMBOLIC_REPEAT_RE.test(lower) || /r[uü]ya.{0,40}(tekrar|ayn[ıi]\s+kap[ıi])/i.test(lower)) {
    return {
      type: 'symbolic',
      fingerprint: fingerprintObservation(lower),
      source: 'user',
    };
  }

  if (NUMEROLOGY_REPEAT_RE.test(lower)) {
    return {
      type: 'numerology',
      fingerprint: fingerprintObservation(lower),
      source: 'user',
    };
  }

  if (BEHAVIOR_CHAIN_RE.test(lower) || /[uü][cç]\s+ili[sş]kide/i.test(lower)) {
    return {
      type: 'repeated_behavior',
      fingerprint: fingerprintObservation(lower),
      source: 'user',
    };
  }

  if (TEMPORAL_REPEAT_RE.test(lower)) {
    return {
      type: 'temporal',
      fingerprint: fingerprintObservation(lower),
      source: 'user',
    };
  }

  if (/(uzakla[sş]|geri\s+(gel|yaz|d[oö]n)|mesaj|arad)/i.test(lower) && EXPLICIT_COUNT_RE.test(lower)) {
    return {
      type: 'relational',
      fingerprint: fingerprintObservation(lower),
      source: 'user',
    };
  }

  if (OBSERVATION_CUE_RE.test(lower)) {
    return {
      type: 'repeated_event',
      fingerprint: fingerprintObservation(lower),
      source: 'user',
    };
  }

  return null;
}

/**
 * Count how many distinct events a single rich message claims.
 * @param {string} text
 */
function countEmbeddedExamples(text) {
  const t = trLower(text);
  const countMatch = t.match(
    /(?:^|[^\p{L}\p{N}])(iki|üç|uc|dört|dort|beş|bes|2|3|4|5)\s+(kez|kere|defa|ilişkide|iliskide|rüyamda|ruyamda|gece|gün|gun|ayda|ay)/u,
  );
  if (countMatch) {
    const map = {
      iki: 2,
      '2': 2,
      üç: 3,
      uc: 3,
      '3': 3,
      dört: 4,
      dort: 4,
      '4': 4,
      beş: 5,
      bes: 5,
      '5': 5,
    };
    const key = String(countMatch[1]);
    // "üç ay" alone is weak; require temporal/repeat framing nearby
    if (key && (countMatch[2] === 'ay' || countMatch[2] === 'ayda')) {
      if (!/her\s+ay|ay[ıi]n\s+\d|tekrar|mesaj|arad|yazd/i.test(t)) {
        return 0;
      }
    }
    return map[key] || Number(countMatch[1]) || 0;
  }
  if (/üçüncü\s+kez|ucuncu\s+kez/i.test(t)) return 3;
  if (/ikinci\s+kez/i.test(t)) return 2;
  if (/her\s+ay[ıi]n\s+\d{1,2}/i.test(t) && /(?:üç|uc|3)\s+ay/i.test(t)) return 3;
  return 0;
}

/**
 * Extract independent pattern evidence from message + recent user history.
 * Assistant turns never create new evidence.
 *
 * @param {{
 *   message?: string,
 *   history?: Array<{role?: string, content?: string}>,
 * }} input
 */
export function extractPatternEvidence(input = {}) {
  const message = String(input.message || '').trim();
  const history = Array.isArray(input.history) ? input.history : [];
  /** @type {Array<{ type: PatternEvidenceType, fingerprint: string, source: string }>} */
  const items = [];
  const seen = new Set();

  const push = (obs, { allowSimilar = false } = {}) => {
    if (!obs) return;
    const key = obs.fingerprint || '';
    if (!allowSimilar) {
      // Near-duplicate: share first 40 chars (same event rephrased)
      const coarse = key.slice(0, 40);
      if (
        coarse &&
        [...seen].some(
          (s) =>
            s.slice(0, 40) === coarse ||
            (coarse.length >= 24 && coarse.includes(s.slice(0, 24))),
        )
      ) {
        return;
      }
    }
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    items.push(obs);
  };

  // Prior user turns (not the current message)
  for (const turn of history.slice(-10)) {
    if (turn?.role !== 'user') continue;
    const content = String(turn.content || '').trim();
    if (!content) continue;
    // Skip pure asks that only pressure pattern language
    if (isPatternClaimAsk(content) && !OBSERVATION_CUE_RE.test(content) && !EXPLICIT_COUNT_RE.test(content)) {
      continue;
    }
    const embedded = countEmbeddedExamples(content);
    const obs = observationFromText(content);
    if (obs) {
      push(obs);
      // Rich multi-example narratives count as multiple independent observations
      if (embedded >= 2) {
        for (let i = 1; i < embedded; i += 1) {
          push(
            {
              type: obs.type,
              fingerprint: `multi:${i}:${obs.fingerprint.slice(0, 80)}`,
              source: obs.source,
            },
            { allowSimilar: true },
          );
        }
      }
    }
  }

  // Current message observations (beyond the ask itself)
  const currentObs = observationFromText(message);
  const embeddedNow = countEmbeddedExamples(message);
  if (currentObs) {
    push(currentObs);
    if (embeddedNow >= 2) {
      for (let i = 1; i < embeddedNow; i += 1) {
        push(
          {
            type: currentObs.type,
            fingerprint: `multi:${i}:${currentObs.fingerprint.slice(0, 80)}`,
            source: currentObs.source,
          },
          { allowSimilar: true },
        );
      }
    }
  } else if (embeddedNow >= 2 && OBSERVATION_CUE_RE.test(message)) {
    for (let i = 0; i < embeddedNow; i += 1) {
      push(
        {
          type: 'explicit_user_report',
          fingerprint: `embed:${i}:${fingerprintObservation(message)}`,
          source: 'explicit',
        },
        { allowSimilar: true },
      );
    }
  }

  const types = [...new Set(items.map((i) => i.type))];
  return {
    items,
    patternEvidenceCount: items.length,
    independentEvidenceCount: items.length,
    patternEvidenceType: types[0] || null,
    patternEvidenceTypes: types,
  };
}

/**
 * @param {{
 *   message: string,
 *   history?: Array<{role?: string, content?: string}>,
 *   followUpResolved?: boolean,
 *   referentialSufficient?: boolean,
 * }} input
 */
export function assessPatternClaimSufficiency(input = {}) {
  const message = String(input.message || '').trim();
  const history = input.history || [];
  const ask = isPatternClaimAsk(message);
  const definitional = isDirectPatternDefinitionAsk(message);
  const interpretationInvited = INTERPRETATION_INVITE_RE.test(trLower(message));

  const evidence = extractPatternEvidence({ message, history });
  const count = evidence.independentEvidenceCount;

  /** @type {PatternSufficiency} */
  let sufficiency = 'sufficient';
  let clarificationNeeded = false;
  let interpretationAllowed = true;
  let reason = 'not_pattern_ask';

  if (definitional) {
    return {
      version: PATTERN_CLAIM_SUFFICIENCY_VERSION,
      active: false,
      patternAsk: false,
      definitional: true,
      ...evidence,
      sufficiency: /** @type {PatternSufficiency} */ ('sufficient'),
      referentResolved: true,
      interpretationAllowed: false,
      clarificationNeeded: false,
      reason: 'direct_definition',
      question: null,
    };
  }

  if (!ask) {
    // Still expose evidence if user is narrating repeats without asking —
    // but do not activate claim gate.
    return {
      version: PATTERN_CLAIM_SUFFICIENCY_VERSION,
      active: false,
      patternAsk: false,
      definitional: false,
      ...evidence,
      sufficiency: count >= 3 ? 'sufficient' : count >= 1 ? 'partial' : 'insufficient',
      referentResolved: count > 0,
      interpretationAllowed: false,
      clarificationNeeded: false,
      reason: 'inactive',
      question: null,
    };
  }

  // Assistant-anchored follow-ups ("mesela", "ikincisi") — do not over-clarify.
  if (input.followUpResolved === true) {
    return {
      version: PATTERN_CLAIM_SUFFICIENCY_VERSION,
      active: true,
      patternAsk: true,
      definitional: false,
      ...evidence,
      sufficiency: count >= 3 ? 'sufficient' : count >= 1 ? 'partial' : 'partial',
      referentResolved: true,
      interpretationAllowed: count >= 2,
      clarificationNeeded: false,
      reason: 'assistant_followup_continuity',
      question: null,
    };
  }

  if (count <= 0) {
    sufficiency = 'insufficient';
    clarificationNeeded = true;
    interpretationAllowed = false;
    reason = 'pattern_ask_no_evidence';
  } else if (count === 1) {
    // One observation cannot establish a comparative pattern
    sufficiency = 'insufficient';
    clarificationNeeded = true;
    interpretationAllowed = false;
    reason = 'single_observation';
    // Explicit "üçüncü kez" / multi-count in the lone report upgrades
    if (
      evidence.items.some((i) => i.type === 'explicit_user_report') &&
      countEmbeddedExamples(message) >= 3
    ) {
      sufficiency = 'sufficient';
      clarificationNeeded = false;
      interpretationAllowed = true;
      reason = 'explicit_triple_report';
    } else if (
      evidence.items.some((i) => i.type === 'explicit_user_report') &&
      countEmbeddedExamples(message) >= 2
    ) {
      sufficiency = 'partial';
      clarificationNeeded = false;
      interpretationAllowed = false;
      reason = 'explicit_dual_report';
    } else if (
      evidence.items.some(
        (i) => i.type === 'repeated_behavior' || i.type === 'symbolic' || i.type === 'numerology',
      ) &&
      countEmbeddedExamples(
        [message, ...history.filter((h) => h?.role === 'user').map((h) => h.content || '')].join('\n'),
      ) >= 3
    ) {
      sufficiency = 'sufficient';
      clarificationNeeded = false;
      interpretationAllowed = true;
      reason = 'embedded_multi_example';
    }
  } else if (count === 2) {
    sufficiency = 'partial';
    clarificationNeeded = false;
    interpretationAllowed = false;
    reason = 'two_observations';
  } else {
    sufficiency = 'sufficient';
    clarificationNeeded = false;
    interpretationAllowed = true;
    reason = 'multi_independent_observations';
  }

  // Rich single-turn narratives: "Üç ilişkide de …" already expanded in extract
  if (sufficiency !== 'sufficient' && count >= 3) {
    sufficiency = 'sufficient';
    clarificationNeeded = false;
    interpretationAllowed = true;
    reason = 'multi_independent_observations';
  }

  if (sufficiency === 'sufficient' && interpretationInvited) {
    interpretationAllowed = true;
  } else if (sufficiency !== 'sufficient') {
    interpretationAllowed = false;
  }

  return {
    version: PATTERN_CLAIM_SUFFICIENCY_VERSION,
    active: true,
    patternAsk: true,
    definitional: false,
    ...evidence,
    sufficiency,
    referentResolved: count > 0 || input.referentialSufficient === true,
    interpretationAllowed,
    interpretationInvited,
    clarificationNeeded,
    reason,
    question: clarificationNeeded ? INSUFFICIENT_CLARIFY : null,
  };
}

/**
 * @param {ReturnType<typeof assessPatternClaimSufficiency>|null|undefined} assessment
 */
export function buildPatternClaimPromptLock(assessment) {
  if (!assessment?.active) return '';

  const lines = [
    '## PATTERN CLAIM CONTRACT (internal — do not print labels)',
    'PATTERN QUESTION ≠ PATTERN EXISTS. Asking whether something repeats is not evidence that it does.',
    `Observational sufficiency: ${assessment.sufficiency} (independentEvidenceCount=${assessment.independentEvidenceCount}).`,
    'Claim strength must not exceed sufficiency.',
    'PATTERN EXISTS ≠ WHY IT EXISTS. Do not auto-fill psychology, karma, destiny, astrology, or subconscious as cause.',
    'Keep epistemic layers separate: behavior / psychology / symbolic / astrology / numerology / coincidence.',
    'Qualifiers (olabilir/belki) do not make unsupported pattern or cause claims acceptable.',
  ];

  if (assessment.sufficiency === 'insufficient') {
    lines.push(
      'INSUFFICIENT: do NOT assert pattern existence, non-coincidence, subconscious cause, or life-cycle/karma explanations.',
      'Ask for comparable examples (what repeats: person type, timing, event, or user reaction).',
    );
  } else if (assessment.sufficiency === 'partial') {
    lines.push(
      'PARTIAL: you may note similarity or early signs. Do NOT say kesin örüntü, tesadüf değil, or tesadüften öte.',
      'Do not jump to psychological or spiritual causes.',
    );
  } else {
    lines.push(
      'SUFFICIENT: you may describe the repeated observation and name its basis (examples / sequence).',
      'Still do NOT invent cause (bilinçaltı, karma, kader, evren mesajı) unless user explicitly asks for that frame — and then keep it as hypothesis, separate from the observation.',
    );
  }

  if (!assessment.interpretationAllowed) {
    lines.push('Domain interpretation (psych/symbolic/astro) is not unlocked yet.');
  }

  return lines.join('\n');
}

/**
 * Detect premature pattern/cause assertions relative to sufficiency.
 * @param {string} reply
 * @param {ReturnType<typeof assessPatternClaimSufficiency>|null|undefined} assessment
 */
export function detectPrematurePatternClaims(reply, assessment) {
  const text = String(reply || '');
  /** @type {string[]} */
  const hits = [];
  if (!assessment?.active || !text.trim()) return hits;

  const hasExist = PATTERN_EXISTENCE_ASSERT_RES.some((re) => re.test(text));
  const hasNonCoin = NON_COINCIDENCE_ASSERT_RES.some((re) => re.test(text));
  const hasPsych = PSYCH_CAUSE_ASSERT_RES.some((re) => re.test(text));
  const hasSpirit = SPIRITUAL_CAUSE_ASSERT_RES.some((re) => re.test(text));
  const hasStrong = STRONG_PATTERN_ONLY_RES.some((re) => re.test(text));

  if (assessment.sufficiency === 'insufficient') {
    if (hasExist) hits.push('premature_pattern_existence');
    if (hasNonCoin) hits.push('premature_non_coincidence');
    if (hasPsych) hits.push('premature_psych_cause');
    if (hasSpirit) hits.push('premature_spiritual_cause');
  } else if (assessment.sufficiency === 'partial') {
    if (hasStrong || hasNonCoin) hits.push('overstrong_partial_pattern');
    if (hasPsych) hits.push('premature_psych_cause');
    if (hasSpirit) hits.push('premature_spiritual_cause');
  } else {
    // Sufficient: pattern OK; automatic cause still gated unless user invited a frame.
    if (hasPsych && hasSpirit && !assessment.interpretationInvited) {
      hits.push('epistemic_cause_conflation');
    } else if (hasPsych && !assessment.interpretationAllowed) {
      hits.push('premature_psych_cause');
    } else if (hasSpirit && !assessment.interpretationInvited) {
      hits.push('premature_spiritual_cause');
    }
    // Repeated observation does not prove non-random causality.
    if (hasNonCoin) hits.push('non_coincidence_overclaim');
  }

  return hits;
}

/**
 * Post-generation repair — semantic, not a global blacklist.
 * @param {string} reply
 * @param {{
 *   assessment?: ReturnType<typeof assessPatternClaimSufficiency>|null,
 *   casual?: boolean,
 * }} [opts]
 */
export function applyPatternClaimPostGuard(reply, opts = {}) {
  const original = typeof reply === 'string' ? reply : '';
  const assessment = opts.assessment || null;
  if (!original.trim() || opts.casual === true || !assessment?.active) {
    return { reply: original, hits: [], changed: false };
  }

  const hits = detectPrematurePatternClaims(original, assessment);
  if (!hits.length) {
    return { reply: original, hits: [], changed: false };
  }

  if (assessment.sufficiency === 'insufficient') {
    return {
      reply: assessment.question || INSUFFICIENT_CLARIFY,
      hits,
      changed: true,
    };
  }

  let text = original;

  if (assessment.sufficiency === 'partial') {
    // Strip strong / non-coincidence / cause sentences; keep mild similarity if present
    text = text.replace(/[^.!?…\n]+[.!?…]?/g, (sentence) => {
      if (STRONG_PATTERN_ONLY_RES.some((re) => re.test(sentence))) return '';
      if (NON_COINCIDENCE_ASSERT_RES.some((re) => re.test(sentence))) return '';
      if (PSYCH_CAUSE_ASSERT_RES.some((re) => re.test(sentence))) return '';
      if (SPIRITUAL_CAUSE_ASSERT_RES.some((re) => re.test(sentence))) return '';
      return sentence;
    });
    text = text.replace(/\s{2,}/g, ' ').trim();
    if (!text || text.length < 24) {
      text = PARTIAL_SOFTEN.trim();
    } else if (!/benzerlik|s[ıi]n[ıi]rl[ıi]|erken\s+[iİ][sş]aret|iki\s+[oö]rnek/i.test(text)) {
      text = `${text}${PARTIAL_SOFTEN}`;
    }
    return { reply: text, hits, changed: text !== original };
  }

  // Sufficient: remove uninvited cause conflation / non-coincidence overclaim; keep pattern observation
  text = text.replace(/[^.!?…\n]+[.!?…]?/g, (sentence) => {
    if (
      !assessment.interpretationAllowed &&
      PSYCH_CAUSE_ASSERT_RES.some((re) => re.test(sentence))
    ) {
      return '';
    }
    if (
      !assessment.interpretationInvited &&
      SPIRITUAL_CAUSE_ASSERT_RES.some((re) => re.test(sentence))
    ) {
      return '';
    }
    if (
      hits.includes('epistemic_cause_conflation') &&
      (PSYCH_CAUSE_ASSERT_RES.some((re) => re.test(sentence)) ||
        SPIRITUAL_CAUSE_ASSERT_RES.some((re) => re.test(sentence)))
    ) {
      return ' Gözlenen tekrar ile olası psikolojik veya sembolik okumaları ayrı tutmak gerekir; biri diğerinin kanıtı değildir.';
    }
    if (NON_COINCIDENCE_ASSERT_RES.some((re) => re.test(sentence))) {
      return ' Tekrarlayan gözlem var; bu tek başına rastgeleliği çürütmez veya metafizik neden kanıtlamaz.';
    }
    return sentence;
  });
  text = text.replace(/\s{2,}/g, ' ').trim();
  if (!text) {
    text =
      'Burada tekrarlayan bir yapı görülüyor; dayanak, anlattığın karşılaştırılabilir örneklerdeki ortak dizilim. Nedeni ayrı bir soru.';
  }

  return { reply: text, hits, changed: text !== original };
}
