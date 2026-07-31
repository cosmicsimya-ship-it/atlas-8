/**
 * Layer runner dispatcher.
 */

import { LAYER_REQUIREMENTS } from '../capability.js';
import { makeLayerOutcome } from '../schema.js';
import { normalizeRunnerResult, makeNormalizedLayer } from '../normalize.js';
import { runPlaceholderLayer } from './placeholders.js';
import { runEbcedLayer } from './ebced-runner.js';
import { runEsmaLayer } from './esma-runner.js';

/**
 * @param {string} layerId
 * @param {{ eligible: boolean, missing: string[], readiness: string, runnable?: boolean }} capability
 * @param {object} input
 * @param {{ reducedDigit?: number|null, themes?: string[] }} [context]
 */
export function runSymbolicLayer(layerId, capability, input, context = {}) {
  if (!capability?.runnable) {
    return runPlaceholderLayer(layerId, capability || {}, input);
  }

  const label = LAYER_REQUIREMENTS[layerId]?.label ?? layerId;

  try {
    let runnerResult;
    if (layerId === 'ebced') {
      runnerResult = runEbcedLayer(input);
    } else if (layerId === 'esma') {
      runnerResult = runEsmaLayer(input, context);
    } else {
      return runPlaceholderLayer(layerId, { ...capability, runnable: false }, input);
    }

    const normalized = normalizeRunnerResult(runnerResult);
    return makeLayerOutcome({
      id: layerId,
      title: label,
      status: 'success',
      eligible: true,
      computed: {
        // Keep raw calc separate from interpretation
        calculatedData: normalized.calculatedData,
      },
      interpreted: {
        interpretation: normalized.interpretation,
        themes: normalized.themes,
        cautions: normalized.cautions,
        confidence: normalized.confidence,
        limitations: normalized.limitations,
      },
      normalized,
      warnings: [],
      metadata: {
        source: normalized.source,
        method: normalized.method,
        readiness: capability.readiness,
      },
    });
  } catch (err) {
    const normalized = makeNormalizedLayer({
      layerId,
      source: layerId,
      method: 'runner-exception',
      status: 'error',
      warnings: [err?.message ?? 'LAYER_EXCEPTION'],
      limitations: ['Katman hatası nedeniyle bu bölüm atlandı.'],
    });
    return makeLayerOutcome({
      id: layerId,
      title: label,
      status: 'error',
      eligible: true,
      warnings: normalized.warnings,
      normalized,
      metadata: { readiness: capability.readiness },
    });
  }
}
