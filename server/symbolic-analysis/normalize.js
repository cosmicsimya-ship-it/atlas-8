/**
 * Normalize layer runner outputs into the shared symbolic envelope.
 */

/**
 * @typedef {object} NormalizedSymbolicLayer
 * @property {string} layerId
 * @property {string} source
 * @property {string} method
 * @property {object|null} calculatedData
 * @property {string|null} interpretation
 * @property {string[]} themes
 * @property {string[]} cautions
 * @property {'high'|'medium'|'low'|'none'} confidence
 * @property {string[]} limitations
 * @property {'success'|'skipped'|'planned'|'unavailable'|'error'} status
 * @property {string|null} skipReason
 * @property {string[]} warnings
 */

/**
 * @param {Partial<NormalizedSymbolicLayer> & { layerId: string }} partial
 * @returns {NormalizedSymbolicLayer}
 */
export function makeNormalizedLayer(partial) {
  return {
    layerId: partial.layerId,
    source: partial.source ?? 'unknown',
    method: partial.method ?? 'unknown',
    calculatedData: partial.calculatedData ?? null,
    interpretation: typeof partial.interpretation === 'string' ? partial.interpretation : null,
    themes: Array.isArray(partial.themes) ? partial.themes.filter(Boolean) : [],
    cautions: Array.isArray(partial.cautions) ? partial.cautions.filter(Boolean) : [],
    confidence: partial.confidence ?? 'none',
    limitations: Array.isArray(partial.limitations) ? partial.limitations.filter(Boolean) : [],
    status: partial.status ?? 'error',
    skipReason: partial.skipReason ?? null,
    warnings: Array.isArray(partial.warnings) ? partial.warnings : [],
  };
}

/**
 * @param {object} runnerResult — output of a real runner
 * @returns {NormalizedSymbolicLayer}
 */
export function normalizeRunnerResult(runnerResult) {
  return makeNormalizedLayer({
    layerId: runnerResult.layerId,
    source: runnerResult.source,
    method: runnerResult.method,
    calculatedData: runnerResult.calculatedData ?? null,
    interpretation: runnerResult.interpretation ?? null,
    themes: runnerResult.themes,
    cautions: runnerResult.cautions,
    confidence: runnerResult.confidence ?? 'low',
    limitations: runnerResult.limitations,
    status: 'success',
  });
}
