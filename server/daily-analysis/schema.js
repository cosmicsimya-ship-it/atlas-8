/**
 * Standard layer result contract for Daily Analysis Engine (Faz A+B).
 * interpretation is always null in this phase.
 */

export const DAILY_ANALYSIS_VERSION = 'atlas-daily-analysis-v1';

/** @typedef {'high'|'medium'|'low'} Confidence */
/** @typedef {'success'|'partial'|'unavailable'|'error'} LayerStatus */
/** @typedef {'computed'|'astronomical'|'calendar'|'traditional'} LayerType */

/**
 * @typedef {object} LayerResult
 * @property {string} id
 * @property {string} title
 * @property {LayerType|string} type
 * @property {string} source
 * @property {Confidence|string} confidence
 * @property {LayerStatus} status
 * @property {object|null} computedData
 * @property {null} interpretation
 * @property {string[]} warnings
 * @property {object} metadata
 */

/**
 * @param {Partial<LayerResult> & { id: string, title: string, type: string }} partial
 * @returns {LayerResult}
 */
export function makeLayerResult(partial) {
  const status = partial.status ?? (partial.computedData == null ? 'error' : 'success');
  return {
    id: partial.id,
    title: partial.title,
    type: partial.type,
    source: partial.source ?? 'unknown',
    confidence: partial.confidence ?? 'low',
    status,
    computedData: partial.computedData ?? null,
    interpretation: null,
    warnings: Array.isArray(partial.warnings) ? partial.warnings : [],
    metadata: {
      version: DAILY_ANALYSIS_VERSION,
      ...(partial.metadata && typeof partial.metadata === 'object' ? partial.metadata : {}),
    },
  };
}

/**
 * Minimal structural validation (no external schema lib).
 * @param {unknown} layer
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateLayerResult(layer) {
  const errors = [];
  if (!layer || typeof layer !== 'object') {
    return { ok: false, errors: ['layer must be an object'] };
  }
  const required = [
    'id',
    'title',
    'type',
    'source',
    'confidence',
    'status',
    'computedData',
    'interpretation',
    'warnings',
    'metadata',
  ];
  for (const key of required) {
    if (!(key in layer)) errors.push(`missing:${key}`);
  }
  if (layer.interpretation !== null) errors.push('interpretation must be null');
  if (!Array.isArray(layer.warnings)) errors.push('warnings must be array');
  if (layer.metadata == null || typeof layer.metadata !== 'object') {
    errors.push('metadata must be object');
  }
  const statuses = new Set(['success', 'partial', 'unavailable', 'error']);
  if (layer.status != null && !statuses.has(layer.status)) {
    errors.push(`invalid status:${layer.status}`);
  }
  return { ok: errors.length === 0, errors };
}

export const LAYER_IDS = Object.freeze([
  'gregorian-date',
  'hijri-date',
  'weekday',
  'moon-phase',
  'astronomy',
  'sun-times',
  'day-length',
  'gregorian-numerology',
  'hijri-numerology',
  'combined-numerology',
  'planetary-hours',
]);

export const DEFAULT_TIMEZONE = 'Europe/Istanbul';
export const DEFAULT_LOCALE = 'tr-TR';
