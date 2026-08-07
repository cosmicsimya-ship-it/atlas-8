/**
 * Numerology analysis orchestrator — calculations + interpretation + depth guard.
 */
import {
  ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY,
  NUMEROLOGY_ENGINE_VERSION,
  DEPTH_LEVEL,
} from './methodology.js';
import { computeBirthNumerologyChart } from './birth-calculations.js';
import {
  computeNameNumerologyChart,
  analyzeNameBirthHarmony,
} from './name-calculations.js';
import { analyzeContradictions } from './contradictions.js';
import { buildNumerologyReply } from './reply-builder.js';
import { applyNumerologyDepthGuard } from './depth-guard.js';

/**
 * @param {string} message
 * @returns {1|2|3}
 */
export function resolveNumerologyDepth(message) {
  const t = String(message ?? '').toLocaleLowerCase('tr-TR');

  // L1: user asked only for the number / short fact
  if (
    /\b(k[ıi]saca|k[ıi]sa\s+anlat|özetle|k[ıi]sa\s+özet|briefly|short)\b/u.test(t)
  ) {
    return DEPTH_LEVEL.SHORT;
  }
  if (
    /(?:ya[sş]am\s+yol(?:u|um)?\s+say[ıi]m?\s*(?:kaç|nedir|ne)|life\s*path\s*(?:number\s*)?(?:kaç|nedir|ne|\?))/.test(
      t,
    ) ||
    /(?:say[ıi]m?\s+kaç|kaç\s+(?:olur|eder|çıkar))\b/.test(t)
  ) {
    // Pure number ask — unless they also demand analysis/yorum
    if (
      !/\b(detayl[ıi]|yorumla|analiz|derin|anlat|incele|tam\s+analiz)\b/u.test(t)
    ) {
      return DEPTH_LEVEL.SHORT;
    }
  }

  // L3: explicit deep / detailed analysis
  if (
    /detayl[ıi]|tam\s+analiz|derin(?:le[sş]tir|e|\s)|tamam[ıi]n[ıi]\s+g[oö]ster|raporla|rapor\s+ver|bilmedi[gğ]im|bilmedigim|full\s+analiz|ayr[ıi]nt[ıi]|deep\s+dive|her\s+katman/u.test(
      t,
    )
  ) {
    return DEPTH_LEVEL.DEEP;
  }

  // Default first reply: Atlas prose. "yorumla/anlat" alone is not a report request.
  return DEPTH_LEVEL.SHORT;
}

/**
 * @param {{
 *   birthDate: string,
 *   fullName?: string|null,
 *   message?: string,
 *   depth?: number,
 *   focus?: string|null,
 *   askedPastLife?: boolean,
 *   exploreMore?: boolean,
 *   layersAlreadyCovered?: string[],
 *   now?: Date,
 *   timeZone?: string,
 *   calendarYear?: number,
 *   skipGuard?: boolean,
 * }} input
 */
export function runNumerologyAnalysis(input) {
  const depth = input.depth ?? resolveNumerologyDepth(input.message || '');
  const birthChart = computeBirthNumerologyChart(input.birthDate, {
    now: input.now,
    timeZone: input.timeZone,
    calendarYear: input.calendarYear,
  });

  if (!birthChart.ok) {
    return {
      ok: false,
      error: birthChart.error,
      engineVersion: NUMEROLOGY_ENGINE_VERSION,
      methodologyId: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
      reply: 'Numeroloji için geçerli bir doğum tarihi gerekli. Gün.Ay.Yıl olarak paylaşabilirsin.',
      depth,
      guard: null,
    };
  }

  const nameChart = input.fullName
    ? computeNameNumerologyChart(input.fullName, {
        lifePathValue: birthChart.lifePath.value,
      })
    : { ok: false, error: 'MISSING_NAME' };

  const nameHarmony =
    nameChart.ok ? analyzeNameBirthHarmony(birthChart, nameChart) : null;
  const contradictions = analyzeContradictions(
    birthChart,
    nameChart.ok ? nameChart : null,
  );
  if (nameHarmony?.tensions?.length) {
    contradictions.tensions.push(
      ...nameHarmony.tensions.map((t) => ({
        pair: t.pair,
        numbers: t.numbers || [],
        tension: t.pair,
        reading: t.note,
      })),
    );
  }
  if (nameHarmony?.alignments?.length) {
    contradictions.alignments.push(...nameHarmony.alignments);
  }

  const buildOpts = {
    depth,
    focus: input.focus || null,
    askedPastLife: Boolean(input.askedPastLife),
    exploreMore: Boolean(input.exploreMore),
    layersAlreadyCovered: input.layersAlreadyCovered || [],
  };

  let reply = buildNumerologyReply(
    birthChart,
    nameChart.ok ? nameChart : null,
    contradictions,
    buildOpts,
  );

  let guard = null;
  if (!input.skipGuard) {
    guard = applyNumerologyDepthGuard(
      {
        reply,
        analysis: birthChart,
        depth,
        focus: input.focus || null,
        askedPastLife: Boolean(input.askedPastLife),
      },
      {
        requireDeep: depth >= DEPTH_LEVEL.DEEP,
        isFollowUp: Boolean(input.focus || input.exploreMore),
      },
    );

    // Never promote an intentional SHORT first reply into STANDARD/DEEP report.
    if (
      guard.shouldExpand &&
      !input.focus &&
      !input.exploreMore &&
      depth > DEPTH_LEVEL.SHORT
    ) {
      const expandedDepth = guard.recommendedDepth;
      reply = buildNumerologyReply(
        birthChart,
        nameChart.ok ? nameChart : null,
        contradictions,
        { ...buildOpts, depth: expandedDepth },
      );
      guard = applyNumerologyDepthGuard(
        {
          reply,
          analysis: birthChart,
          depth: expandedDepth,
          focus: null,
          askedPastLife: Boolean(input.askedPastLife),
        },
        { requireDeep: expandedDepth >= DEPTH_LEVEL.DEEP, isFollowUp: false },
      );
    }
  }

  return {
    ok: true,
    engineVersion: NUMEROLOGY_ENGINE_VERSION,
    methodologyId: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
    methodologyVersion: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyVersion,
    school: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.school,
    disclaimer: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.disclaimer,
    depth: guard?.recommendedDepth && guard.shouldExpand === false
      ? depth
      : depth,
    focus: input.focus || null,
    birthChart,
    nameChart: nameChart.ok ? nameChart : null,
    contradictions,
    reply,
    guard,
    layersAvailable: listAvailableLayers(birthChart, nameChart.ok ? nameChart : null),
  };
}

/**
 * @param {object} birthChart
 * @param {object|null} nameChart
 */
export function listAvailableLayers(birthChart, nameChart) {
  const layers = [
    'lifePath',
    'birthday',
    'monthVibration',
    'yearVibration',
    'masterPresence',
    'lifeCycles',
    'pinnacles',
    'challenges',
    'personalYear',
    'strengthsShadows',
    'relationships',
    'career',
    'karmicSymbolic',
    'repeatingMotifs',
    'missingVibrations',
    'contradictions',
    'development',
  ];
  if (nameChart?.ok) {
    layers.push(
      'expression',
      'soulUrge',
      'personality',
      'maturity',
      'nameBirthHarmony',
      'missingLetterVibrations',
    );
  }
  return layers;
}

/**
 * Compact verified data block for LLM injection (optional path).
 * @param {object} result — runNumerologyAnalysis result
 */
export function formatVerifiedNumerologyPersonalBlock(result) {
  if (!result?.ok || !result.birthChart?.ok) return '';
  const c = result.birthChart;
  const lines = [
    '## VERIFIED PERSONAL NUMEROLOGY DATA',
    `methodologyId: ${result.methodologyId}`,
    `school: ${result.school}`,
    `birthDate: ${c.birthDate}`,
    `lifePath: ${c.lifePath.display} | ${c.lifePath.formula}${c.lifePath.steps.length ? ' → ' + c.lifePath.steps.join(' → ') : ''}`,
    `birthday: ${c.birthday.display}`,
    `monthVibration: ${c.monthVibration.display}`,
    `yearVibration: ${c.yearVibration.display}`,
    `personalYear(${c.personalYear.calendarYear}): ${c.personalYear.display}`,
    `activeCycle: ${c.lifeCycles.activeCycle ? `${c.lifeCycles.activeCycle.name} #${c.lifeCycles.activeCycle.governingDisplay}` : 'n/a'}`,
    `pinnacles: ${c.pinnacles.map((p) => `${p.index}=${p.display}`).join(', ')}`,
    `challenges: ${c.challenges.map((ch) => `${ch.index}=${ch.display}`).join(', ')}`,
    `karmicDebts: ${c.karmicDebts.length ? c.karmicDebts.join(', ') : 'none'}`,
    `missingVibrations: ${c.missingVibrations.join(', ') || 'none'}`,
    'Kurallar: Hesapları değiştirme. Yorumu sayıdan ayır. Geçmiş yaşamı kesin gerçek gibi sunma. Kullanıcının bildiği tek sayıyı tekrar ederek bitirme.',
  ];
  if (result.nameChart?.ok) {
    const n = result.nameChart;
    lines.splice(
      lines.length - 1,
      0,
      `expression: ${n.expression.display}`,
      `soulUrge: ${n.soulUrge.display}`,
      `personality: ${n.personality.display}`,
    );
  }
  return lines.join('\n');
}
