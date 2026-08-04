/**
 * Numerology domain adapter — wraps existing engine; does not replace chat flow.
 * Dual-run safe: same calculate path as runNumerologyAnalysis / computeBirthNumerologyChart.
 */

import {
  ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY,
  NUMEROLOGY_ENGINE_VERSION,
  computeBirthNumerologyChart,
  runNumerologyAnalysis,
} from '../../numerology-engine/index.js';
import { resolveMethodology } from '../methodology-registry.js';
import { resolveDepthLevel } from '../depth.js';
import {
  createEmptyStructuredOutput,
  createNormalizedDomainRequest,
  validateStructuredAnalysisOutput,
} from '../schemas.js';

export const NUMEROLOGY_ADAPTER_VERSION = 'domain-core-numerology-adapter-v1';

/**
 * @param {import('../schemas.js').NormalizedDomainRequest|object} request
 * @param {{ birthDate?: string, fullName?: string|null, now?: Date, timeZone?: string }} [opts]
 */
export function adaptNumerologyRequest(request, opts = {}) {
  const normalized =
    request && request.requestId
      ? request
      : createNormalizedDomainRequest(request || {});

  const birthDate =
    opts.birthDate ||
    normalized.extracted?.birthDate ||
    normalized.memorySnapshot?.birthDate ||
    null;
  const fullName =
    opts.fullName ??
    normalized.extracted?.fullName ??
    normalized.memorySnapshot?.fullName ??
    null;

  return {
    normalized,
    birthDate: birthDate ? String(birthDate) : null,
    fullName: fullName ? String(fullName) : null,
  };
}

/**
 * Deterministic calculation only (no reply composition required for dual-run).
 * @param {{ birthDate: string, now?: Date, timeZone?: string, calendarYear?: number }} input
 */
export function calculateNumerologyViaAdapter(input) {
  const chart = computeBirthNumerologyChart(input.birthDate, {
    now: input.now,
    timeZone: input.timeZone,
    calendarYear: input.calendarYear,
  });
  return chart;
}

/**
 * Full analysis → StructuredAnalysisOutput (flagged / dual-run path).
 * @param {object} input
 * @returns {{ ok: boolean, output: import('../schemas.js').StructuredAnalysisOutput|null, direct: object, validation: {ok:boolean, errors:string[]} }}
 */
export function runNumerologyAdapter(input) {
  const started = Date.now();
  const { normalized, birthDate, fullName } = adaptNumerologyRequest(
    input.request || {},
    {
      birthDate: input.birthDate,
      fullName: input.fullName,
      now: input.now,
      timeZone: input.timeZone,
    },
  );

  if (!birthDate) {
    const empty = createEmptyStructuredOutput({
      engineId: 'atlas-numerology',
      engineVersion: NUMEROLOGY_ENGINE_VERSION,
      domain: 'numerology',
      intent: 'missing_birth_date',
      methodologyId: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
      rulesetVersion: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.rulesetVersion,
      selectionReason: 'default_methodology_for_numerology',
      channel: normalized.channel,
      depth: resolveDepthLevel({
        depthHint: normalized.depthHint,
        message: normalized.message,
      }),
      durationMs: Date.now() - started,
      input: { birthDate: null },
    });
    empty.warnings.push('MISSING_BIRTH_DATE');
    return {
      ok: false,
      output: empty,
      direct: { ok: false, error: 'MISSING_BIRTH_DATE' },
      validation: validateStructuredAnalysisOutput(empty),
    };
  }

  const direct = runNumerologyAnalysis({
    birthDate,
    fullName,
    message: normalized.message,
    now: input.now,
    timeZone: input.timeZone,
    depth: input.depth,
  });

  const resolved = resolveMethodology(
    'numerology',
    normalized.methodologyId || ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
  );
  const depth = resolveDepthLevel({
    depthHint: normalized.depthHint,
    message: normalized.message,
    engineDepth: direct.depth,
  });

  const output = createEmptyStructuredOutput({
    analysisId: `num_${started}`,
    engineId: 'atlas-numerology',
    engineVersion: NUMEROLOGY_ENGINE_VERSION,
    domain: 'numerology',
    intent: direct.ok ? 'full_birth_date_analysis' : 'validation_failed',
    methodologyId: resolved.methodology?.methodologyId,
    rulesetVersion: resolved.methodology?.rulesetVersion,
    selectionReason: resolved.selectionReason,
    channel: normalized.channel,
    depth,
    durationMs: Date.now() - started,
    input: {
      birthDate,
      fullName: fullName || null,
    },
  });

  if (direct.ok && direct.birthChart) {
    const bc = direct.birthChart;
    output.calculations.push(
      {
        calcId: 'life_path',
        label: 'Life Path',
        value: bc.lifePath?.value ?? null,
        trace: bc.lifePath?.trace ?? null,
        evidenceType: 'deterministic_calculation',
      },
      {
        calcId: 'birthday_number',
        label: 'Birthday Number',
        value: bc.birthdayNumber?.value ?? null,
        evidenceType: 'deterministic_calculation',
      },
      {
        calcId: 'personal_year',
        label: 'Personal Year',
        value: bc.personalYear?.value ?? null,
        evidenceType: 'deterministic_calculation',
      },
    );
    output.evidence.push({
      claim: `Life Path = ${bc.lifePath?.value}`,
      evidenceType: 'deterministic_calculation',
      methodologyId: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
      certainty: 'factual',
      sourceIds: ['src.numerology.pythagorean-profiles'],
    });
    output.sources.push({
      sourceId: 'src.numerology.pythagorean-profiles',
    });
    if (Array.isArray(direct.contradictions?.tensions)) {
      output.contradictions = direct.contradictions.tensions;
    }
  } else if (direct.error) {
    output.warnings.push(String(direct.error));
  }

  output.rendered.text = String(direct.reply || '');
  output.uncertainty = {
    interpretive: true,
    deterministicCore: Boolean(direct.ok),
  };

  return {
    ok: Boolean(direct.ok),
    output,
    direct,
    validation: validateStructuredAnalysisOutput(output),
  };
}

/**
 * Dual-run: adapter calc must equal direct engine calc.
 * @param {{ birthDate: string, now?: Date, timeZone?: string }} input
 */
export function dualRunNumerologyCalculations(input) {
  const viaAdapter = calculateNumerologyViaAdapter(input);
  const viaDirect = computeBirthNumerologyChart(input.birthDate, {
    now: input.now,
    timeZone: input.timeZone,
    calendarYear: input.calendarYear,
  });

  const equal =
    viaAdapter.ok === viaDirect.ok &&
    viaAdapter.lifePath?.value === viaDirect.lifePath?.value &&
    viaAdapter.birthdayNumber?.value === viaDirect.birthdayNumber?.value &&
    JSON.stringify(viaAdapter.lifePath?.trace) ===
      JSON.stringify(viaDirect.lifePath?.trace);

  return {
    equal,
    viaAdapter,
    viaDirect,
  };
}
