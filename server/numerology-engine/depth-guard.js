/**
 * Numerology depth / surface-level guard.
 * Checks content coverage — not word count alone.
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
 *   recommendedDepth: number,
 * }} DepthGuardResult
 */

/**
 * @param {string} text
 * @param {RegExp[]} patterns
 */
function anyMatch(text, patterns) {
  const t = String(text || '');
  return patterns.some((re) => re.test(t));
}

/**
 * Scope checks against a reply (and optional structured analysis).
 * @param {{
 *   reply?: string,
 *   analysis?: object|null,
 *   depth?: number,
 *   focus?: string|null,
 *   askedPastLife?: boolean,
 * }} result
 * @param {{
 *   requireDeep?: boolean,
 *   isFollowUp?: boolean,
 *   minPassRatio?: number,
 * }} [context]
 * @returns {DepthGuardResult}
 */
export function applyNumerologyDepthGuard(result, context = {}) {
  const reply = String(result?.reply ?? '');
  const analysis = result?.analysis ?? null;
  const depth = result?.depth ?? DEPTH_LEVEL.STANDARD;
  const focus = result?.focus || null;
  const isFollowUp = Boolean(context.isFollowUp);
  const requireDeep = Boolean(context.requireDeep) || depth >= DEPTH_LEVEL.DEEP;
  const minPassRatio = context.minPassRatio ?? (requireDeep ? 0.75 : depth <= DEPTH_LEVEL.SHORT ? 0.4 : 0.65);

  /** @type {Array<{ id: string, weight: number, pass: boolean, skip?: boolean }>} */
  const checks = [];

  const onlySingleNumber =
    Boolean(analysis?.lifePath?.value) &&
    !anyMatch(reply, [
      /yaşam\s+döng|döngü|pinnacle|zirve|mücadele|kişisel\s+yıl|gölge|güçlü/i,
    ]) &&
    (reply.match(/\b\d{1,2}\b/g) || []).length <= 2 &&
    reply.length < 280;

  checks.push({
    id: 'not_only_single_number',
    weight: 2,
    pass: !onlySingleNumber,
  });

  checks.push({
    id: 'new_information',
    weight: 2,
    pass: anyMatch(reply, [
      /aktif|pasif|gölge|döngü|zirve|mücadele|kişisel\s+yıl|gelişim|çelişki|motif|titreşim|olgunlaş/i,
    ]),
  });

  const cycleOk =
    Boolean(analysis?.lifeCycles?.cycles?.length) &&
    anyMatch(reply, [/döngü|biçimlenme|üretim|hasat|yaş\s*aral|aktif\s+döng/i]);
  checks.push({
    id: 'life_cycle_covered',
    weight: depth <= DEPTH_LEVEL.SHORT ? 0.5 : 2,
    pass: depth <= DEPTH_LEVEL.SHORT ? true : cycleOk,
    skip: focus === 'master' || focus === 'karmic' || (isFollowUp && focus === 'period'),
  });

  checks.push({
    id: 'strength_and_shadow',
    weight: 1.5,
    pass: anyMatch(reply, [/güçlü/i]) && anyMatch(reply, [/gölge/i]),
  });

  checks.push({
    id: 'current_period',
    weight: 1.5,
    pass:
      Boolean(analysis?.personalYear?.value) &&
      anyMatch(reply, [/kişisel\s+yıl|şu\s+an|mevcut\s+dönem|aktif\s+(?:döngü|zirve|dönem)/i]),
    skip: focus === 'master' && !requireDeep,
  });

  checks.push({
    id: 'number_relationships',
    weight: requireDeep ? 2 : 1,
    pass: anyMatch(reply, [/çelişki|uyum|gerilim|birlikte|aynı\s+zamanda|oysa|buna\s+karşın/i]),
    skip: depth <= DEPTH_LEVEL.SHORT,
  });

  if (result?.askedPastLife || focus === 'karmic' || /geçmiş\s+yaşam|önceki\s+hayat|karmik/i.test(reply)) {
    checks.push({
      id: 'past_life_methodology_boundary',
      weight: 2,
      pass:
        anyMatch(reply, [/sembolik|doğrulamaz|kanıtlamaz|spiritüel\s+yorum|bilimsel/i]) &&
        !anyMatch(reply, [/kesin(?:likle)?\s+(?:önceki|geçmiş)\s+(?:hayat|yaşam)|ülkede\s+yaşadın|mesleğin\s+\w+\s+idi/i]),
    });
  }

  checks.push({
    id: 'methodology_stated',
    weight: 1,
    pass: anyMatch(reply, [
      /pythagorean|digit-sum|usta\s+sayı|metodoloji|ekol|atlas-pythagorean|korun/i,
    ]),
    skip: depth <= DEPTH_LEVEL.SHORT && !requireDeep,
  });

  checks.push({
    id: 'not_prematurely_cut',
    weight: 1,
    pass: !(depth >= DEPTH_LEVEL.STANDARD && reply.length < 400 && !isFollowUp),
    skip: depth <= DEPTH_LEVEL.SHORT || Boolean(focus),
  });

  if (analysis?.masterPresence?.length || /11|22|33/.test(reply)) {
    checks.push({
      id: 'master_with_reduced',
      weight: 1.5,
      pass: anyMatch(reply, [/11\/2|22\/4|33\/6|indirgen|temel\s+frekans|aktif.*pasif|pasif.*aktif/i]),
      skip: !analysis?.masterPresence?.length && depth <= DEPTH_LEVEL.SHORT,
    });
  }

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
  const shouldExpand = ratio < minPassRatio || failedChecks.includes('not_only_single_number');

  return {
    ok: !shouldExpand,
    score,
    maxScore,
    failedChecks,
    passedChecks,
    shouldExpand,
    recommendedDepth: shouldExpand
      ? Math.min(DEPTH_LEVEL.DEEP, Math.max(depth + 1, DEPTH_LEVEL.STANDARD))
      : depth,
  };
}
