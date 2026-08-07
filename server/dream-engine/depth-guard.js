/**
 * Dream depth / surface-level guard.
 * Prevents single-symbol fortune dumps and absolute prophecy language.
 */

import { DEPTH_LEVEL } from './methodology.js';

/**
 * @typedef {{
 *   ok: boolean,
 *   score: number,
 *   maxScore: number,
 *   failedChecks: string[],
 *   passedChecks: string[],
 *   shouldExpand: boolean,
 *   needsBoundaryFix: boolean,
 *   recommendedDepth: number,
 * }} DepthGuardResult
 */

const UNCERTAINTY_PASS_RE =
  /sembolik|olas[ıi]l[ıi]k|yorumlay[ıi]c[ıi]|kesin\s+de[gğ]ildir|kesin\s+kehanet\s+de[gğ]il|bu\s+yorum\s+kesin\s+de[gğ]ildir/i;

const ABSOLUTE_CLAIM_RE =
  /kesin(?:likle)?\s+(?:olacak|ölecek|hastalan|gerçekleş)|mutlaka\s+olacak|ölüm\s+tarih|teşhis(?:im|iniz)?\s*:/i;

const FORTUNE_SINGLE_RE =
  /bu\s+rüya\s+kesin|anlam[ıi]\s+şudur\s*:|tek\s+anlam[ıi]|kehanet(?:im)?\s*:/i;

/**
 * @param {string} reply
 */
export function hasUncertaintyBoundary(reply) {
  return UNCERTAINTY_PASS_RE.test(String(reply || ''));
}

/**
 * @param {string} text
 * @param {RegExp[]} patterns
 */
function anyMatch(text, patterns) {
  const t = String(text || '');
  return patterns.some((re) => re.test(t));
}

/**
 * Detect shallow single-symbol dictionary dump.
 * @param {string} reply
 */
export function looksLikeSymbolDictionary(reply) {
  const t = String(reply || '');
  const bullets = (t.match(/^\s*[•\-*]\s+.+/gm) || []).length;
  const hasGenel = /genel\s+olarak|özetle\s+rüya|sonuç\s+olarak\s+rüya/i.test(t);
  const hasRelation = anyMatch(t, [
    /birlikte|katman|duygu|olay\s+[oö]rg|bütün|sentez|gerilim|[cç]eli[sş]ki/i,
  ]);
  if (bullets >= 4 && hasGenel && !hasRelation) return true;
  if (bullets >= 3 && t.length < 400 && !hasRelation) return true;
  if (FORTUNE_SINGLE_RE.test(t)) return true;
  return false;
}

/**
 * @param {{
 *   reply?: string,
 *   analysis?: object|null,
 *   depth?: number,
 *   focus?: string|null,
 * }} result
 * @param {{
 *   requireDeep?: boolean,
 *   isFollowUp?: boolean,
 *   minPassRatio?: number,
 * }} [context]
 * @returns {DepthGuardResult}
 */
export function applyDreamDepthGuard(result, context = {}) {
  const reply = String(result?.reply ?? '');
  const analysis = result?.analysis ?? null;
  const depth = result?.depth ?? DEPTH_LEVEL.STANDARD;
  const focus = result?.focus || null;
  const isFollowUp = Boolean(context.isFollowUp);
  const requireDeep = Boolean(context.requireDeep) || depth >= DEPTH_LEVEL.DEEP;
  const minPassRatio =
    context.minPassRatio ?? (requireDeep ? 0.75 : depth <= DEPTH_LEVEL.SHORT ? 0.35 : 0.65);

  /** @type {Array<{ id: string, weight: number, pass: boolean, skip?: boolean }>} */
  const checks = [];

  const dictionaryDump = looksLikeSymbolDictionary(reply);
  checks.push({
    id: 'not_symbol_dictionary',
    weight: 2.5,
    pass: !dictionaryDump && !ABSOLUTE_CLAIM_RE.test(reply),
  });

  checks.push({
    id: 'emotion_centered',
    weight: 2,
    pass: anyMatch(reply, [/duygu|his|korku|kayg[ıi]|huzur|özlem|umut/i]),
    skip: focus === 'clarify' || depth <= DEPTH_LEVEL.SHORT,
  });

  checks.push({
    id: 'multi_layer',
    weight: 2,
    pass: anyMatch(reply, [
      /katman|sembol|imge|olay\s+[oö]rg|anlat[ıi]|psikolojik|klasik|arketip|çizgi|vurgu|yapı/i,
    ]),
    skip: focus === 'clarify',
  });

  checks.push({
    id: 'symbol_relationships',
    weight: requireDeep ? 2.5 : 2,
    pass:
      Boolean(analysis?.combinations?.pairs?.length) ||
      anyMatch(reply, [/birlikte|\+|kombinasyon|ortak\s+tema/i]),
    skip: depth <= DEPTH_LEVEL.SHORT || focus === 'clarify' || focus === 'emotion',
  });

  checks.push({
    id: 'no_single_symbol_verdict',
    weight: 2,
    pass:
      !/tek\s+sembol(?:den|le)|yaln[ıi]zca\s+\w+\s+sembolü\s+yeter/i.test(reply) &&
      anyMatch(reply, [
        /bütün|birlikte|katman|tek\s+ba[sş][ıi]na\s+tek\s+bir\s+anlam\s+ta[sş][ıi]maz|tek\s+i[sş]aret\s+karar\s+vermez/i,
      ]),
    skip: focus === 'clarify' || depth <= DEPTH_LEVEL.SHORT,
  });

  checks.push({
    id: 'uncertainty_boundary',
    weight: 1.5,
    pass: hasUncertaintyBoundary(reply) && !ABSOLUTE_CLAIM_RE.test(reply),
    skip: focus === 'clarify',
  });

  checks.push({
    id: 'new_inference',
    weight: 1.5,
    pass: anyMatch(reply, [
      /bilinçalt|gizli|k[oö]r\s+nokta|geli[sş]im|psikolojik|bu\s+nedenle|as[ıi]l\s+vurgu/i,
    ]),
    skip: focus === 'clarify' || depth <= DEPTH_LEVEL.SHORT,
  });

  if (requireDeep) {
    checks.push({
      id: 'jung_or_classical',
      weight: 1.5,
      pass: anyMatch(reply, [/jung|arketip|shadow|anima|gölge|klasik|ibn\s*s[iî]r/i]),
    });
    checks.push({
      id: 'psychological_and_growth',
      weight: 1.5,
      pass:
        anyMatch(reply, [/psikolojik|bilinçalt|bastır|dönüşüm|yas|stres/i]) &&
        anyMatch(reply, [/geli[sş]im|uyan[ıi]k|davet|yön/i]),
    });
  }

  checks.push({
    id: 'not_prematurely_cut',
    weight: 1,
    pass: !(depth >= DEPTH_LEVEL.STANDARD && reply.length < 420 && !isFollowUp),
    skip: depth <= DEPTH_LEVEL.SHORT || Boolean(focus) || isFollowUp || focus === 'clarify',
  });

  const active = checks.filter((c) => !c.skip);
  let score = 0;
  let maxScore = 0;
  /** @type {string[]} */
  const failedChecks = [];
  /** @type {string[]} */
  const passedChecks = [];

  for (const c of active) {
    maxScore += c.weight;
    if (c.pass) {
      score += c.weight;
      passedChecks.push(c.id);
    } else {
      failedChecks.push(c.id);
    }
  }

  const ratio = maxScore > 0 ? score / maxScore : 1;
  const needsBoundaryFix = failedChecks.includes('uncertainty_boundary');
  // Default SHORT first replies must stay short — never promote to "## Rüya Analizi".
  const expandBlocked = depth <= DEPTH_LEVEL.SHORT && !requireDeep && !focus;
  const shouldExpand =
    !expandBlocked &&
    (ratio < minPassRatio ||
      failedChecks.includes('not_symbol_dictionary') ||
      (Boolean(focus) && focus !== 'clarify' && needsBoundaryFix));

  return {
    ok: !shouldExpand && !needsBoundaryFix,
    score,
    maxScore,
    failedChecks,
    passedChecks,
    shouldExpand,
    needsBoundaryFix,
    recommendedDepth:
      shouldExpand && !needsBoundaryFix
        ? Math.min(DEPTH_LEVEL.DEEP, Math.max(depth + 1, DEPTH_LEVEL.STANDARD))
        : depth,
  };
}
