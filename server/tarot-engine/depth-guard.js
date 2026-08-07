/**
 * Tarot depth / surface-level guard.
 * Prevents card-dictionary dumps without combination / intention analysis.
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
  /sembolik|olas[ıi]l[ıi]k|yorumlay[ıi]c[ıi]|kesin\s+kehanet\s+de[gğ]il|zihin\s+okuma\s+de[gğ]il/i;

const ABSOLUTE_CLAIM_RE =
  /kesin(?:likle)?\s+(?:seni\s+)?(?:arayacak|d[oö]necek|seviyor)|mutlaka\s+olacak/i;

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
 * Detect "card1 meaning / card2 meaning / genel olarak" dictionary pattern.
 * @param {string} reply
 */
export function looksLikeCardDictionary(reply) {
  const t = String(reply || '');
  const numberedCards = (t.match(/^\s*\d+\.\s+.+/gm) || []).length;
  const hasGenel =
    /genel\s+olarak|özetle|sonu[cç]\s+olarak\s+kartlar/i.test(t);
  const hasRelation = anyMatch(t, [
    /\bbirbir(?:ine|ini|leriyle)?\b|kombinasyon|\bgerilim\b|[cç]eli[sş]ki|ortak\s+tema|\bbirlikte\s+(?:okun|kur|çalış|konuş)/i,
  ]);
  const hasIntention = anyMatch(t, [/niyet|soru|a[cç][ıi]l[ıi]m[ıi]n\s+amac/i]);
  if (numberedCards >= 3 && hasGenel && !hasRelation) return true;
  if (numberedCards >= 3 && t.length < 450 && !hasRelation && !hasIntention) return true;
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
export function applyTarotDepthGuard(result, context = {}) {
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

  const dictionaryDump = looksLikeCardDictionary(reply);
  checks.push({
    id: 'not_card_dictionary',
    weight: 2.5,
    pass: !dictionaryDump,
  });

  checks.push({
    id: 'intention_centered',
    weight: 2,
    pass:
      Boolean(analysis?.intention) &&
      anyMatch(reply, [/niyet|soru|a[cç][ıi]l[ıi]m|amac[ıi]/i]),
    skip: focus === 'reveal' || depth <= DEPTH_LEVEL.SHORT,
  });

  checks.push({
    id: 'positions_used',
    weight: 1.5,
    pass:
      Boolean(analysis?.placed?.length) &&
      anyMatch(reply, [/pozisyon|katman|g[oö]r[uü]nen|gizli|y[uü]zey|alan/i]),
    // SHORT first replies are prose, not position reports.
    skip: focus === 'reveal' || depth <= DEPTH_LEVEL.SHORT,
  });

  checks.push({
    id: 'card_relationships',
    weight: requireDeep ? 2.5 : 2,
    pass:
      Boolean(analysis?.combinations?.pairs?.length) &&
      anyMatch(reply, [
        /birbir|kombinasyon|\+|birlikte|etkisi|ili[sş]ki|kom[sş]u/i,
      ]),
    skip: depth <= DEPTH_LEVEL.SHORT || focus === 'reveal' || focus === 'why_card',
  });

  checks.push({
    id: 'common_theme',
    weight: 1.5,
    pass: anyMatch(reply, [/ortak\s+tema|ana\s+tema|ortak\s+mesaj|hik[aâ]ye/i]),
    skip: depth <= DEPTH_LEVEL.SHORT || focus === 'reveal',
  });

  checks.push({
    id: 'contradictions_explained',
    weight: requireDeep ? 2 : 1.5,
    pass:
      Boolean(analysis?.contradictions?.tensions?.length) ||
      anyMatch(reply, [/[cç]eli[sş]ki|gerilim|neden\s+hem|oysa|buna\s+kar[sş][ıi]n/i]),
    skip: depth <= DEPTH_LEVEL.SHORT || focus === 'reveal',
  });

  checks.push({
    id: 'new_inference',
    weight: 2,
    pass: anyMatch(reply, [
      /gizli\s+dinamik|k[oö]r\s+nokta|bu\s+nedenle|as[ıi]l\s+vurgu|yeni\s+[cç][ıi]kar[ıi]m|geli[sş]im|ortak\s+[cç]izgi|gerilim/i,
    ]),
    skip: focus === 'reveal' || depth <= DEPTH_LEVEL.SHORT,
  });

  checks.push({
    id: 'synthesis_not_repeat',
    weight: 1.5,
    pass:
      anyMatch(reply, [/sonu[cç]|sentez|ana\s+mesaj/i]) &&
      !(/genel\s+olarak[\s\S]{0,80}kart\s+\d/i.test(reply)),
    skip: depth <= DEPTH_LEVEL.SHORT || focus === 'reveal',
  });

  checks.push({
    id: 'uncertainty_boundary',
    weight: 1,
    pass: hasUncertaintyBoundary(reply) && !ABSOLUTE_CLAIM_RE.test(reply),
    // Reveal is a card list only; short replies already carry a boundary in builder.
    skip: focus === 'reveal' || (depth <= DEPTH_LEVEL.SHORT && !requireDeep && !focus),
  });

  if (requireDeep) {
    checks.push({
      id: 'element_or_number_or_arcana',
      weight: 1.5,
      pass: anyMatch(reply, [
        /element|arkana|say[ıi]|ate[sş]|su\b|hava|toprak|major|minor|b[uü]y[uü]k\s+arkana/i,
      ]),
    });
    checks.push({
      id: 'blind_spot_and_growth',
      weight: 1.5,
      pass:
        anyMatch(reply, [/k[oö]r\s+nokta/i]) &&
        anyMatch(reply, [/geli[sş]im|y[oö]n|ad[ıi]m/i]),
    });
  }

  checks.push({
    id: 'not_prematurely_cut',
    weight: 1,
    pass: !(depth >= DEPTH_LEVEL.STANDARD && reply.length < 380 && !isFollowUp),
    skip: depth <= DEPTH_LEVEL.SHORT || Boolean(focus) || isFollowUp,
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
  // Default SHORT first replies must stay short — never promote to report format.
  const expandBlocked = depth <= DEPTH_LEVEL.SHORT && !requireDeep && !focus;
  const shouldExpand =
    !expandBlocked &&
    (ratio < minPassRatio ||
      failedChecks.includes('not_card_dictionary') ||
      // Focus paths: missing boundary must remediate (append), not silent-pass on ratio.
      (Boolean(focus) && needsBoundaryFix));

  return {
    ok: !shouldExpand && !needsBoundaryFix,
    score,
    maxScore,
    failedChecks,
    passedChecks,
    shouldExpand,
    needsBoundaryFix,
    recommendedDepth: shouldExpand && !needsBoundaryFix
      ? Math.min(DEPTH_LEVEL.DEEP, Math.max(depth + 1, DEPTH_LEVEL.STANDARD))
      : depth,
  };
}
