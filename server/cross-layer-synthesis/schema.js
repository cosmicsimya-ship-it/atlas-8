/**
 * Standard normalized layer contract for cross-layer synthesis.
 * Layers remain independent; synthesis consumes these shapes, not raw prose.
 */

export const CROSS_LAYER_SYNTHESIS_VERSION = 'atlas-cross-layer-synthesis-v1';

/** @typedef {'supporting'|'complementing'|'balancing'|'tension'|'independent'|'insufficient_data'|'contradictory'|'same_theme_different_angle'} RelationshipType */

/** @typedef {'high'|'medium'|'low'|'insufficient'} ConfidenceLabel */

/** @typedef {'computed'|'astronomical'|'calendar'|'numerology'|'astrology'|'quran'|'traditional'|'symbolic'|'user_context'|'unknown'} LayerType */

/**
 * @typedef {object} NormalizedLayer
 * @property {string} layerId
 * @property {LayerType|string} layerType
 * @property {string} source
 * @property {string} method
 * @property {object|null} input
 * @property {object|null} normalizedFacts
 * @property {string[]} themes
 * @property {string[]} tensions
 * @property {string[]} cautions
 * @property {ConfidenceLabel|string} confidence
 * @property {string|null} temporalScope
 * @property {Array<{kind:string,ref:string,note?:string}>} citationsOrReferences
 * @property {string|null} interpretation
 * @property {string[]} limitations
 * @property {'success'|'partial'|'unavailable'|'error'} status
 * @property {{computed:string[],interpreted:string[],symbolic:string[]}} visibility
 */

export const RELATIONSHIP_TYPES = Object.freeze([
  'supporting',
  'complementing',
  'balancing',
  'tension',
  'independent',
  'insufficient_data',
  'contradictory',
  'same_theme_different_angle',
]);

export const RELATIONSHIP_LABELS_TR = Object.freeze({
  supporting: 'Destekleyen',
  complementing: 'Tamamlayan',
  balancing: 'Dengeleyen',
  tension: 'Gerilim oluşturan',
  independent: 'Birbirinden bağımsız',
  insufficient_data: 'Yetersiz veri',
  contradictory: 'Çelişkili',
  same_theme_different_angle: 'Aynı temaya farklı açıdan yaklaşan',
});

/**
 * @param {Partial<NormalizedLayer> & { layerId: string }} partial
 * @returns {NormalizedLayer}
 */
export function makeNormalizedLayer(partial) {
  const status = partial.status ?? (partial.normalizedFacts == null && !partial.interpretation ? 'error' : 'success');
  return {
    layerId: partial.layerId,
    layerType: partial.layerType ?? 'unknown',
    source: partial.source ?? 'unknown',
    method: partial.method ?? 'unspecified',
    input: partial.input ?? null,
    normalizedFacts: partial.normalizedFacts ?? null,
    themes: Array.isArray(partial.themes) ? partial.themes.map(String) : [],
    tensions: Array.isArray(partial.tensions) ? partial.tensions.map(String) : [],
    cautions: Array.isArray(partial.cautions) ? partial.cautions.map(String) : [],
    confidence: partial.confidence ?? 'low',
    temporalScope: partial.temporalScope ?? null,
    citationsOrReferences: Array.isArray(partial.citationsOrReferences)
      ? partial.citationsOrReferences
      : [],
    interpretation: partial.interpretation ?? null,
    limitations: Array.isArray(partial.limitations) ? partial.limitations.map(String) : [],
    status,
    visibility: {
      computed: Array.isArray(partial.visibility?.computed) ? partial.visibility.computed.map(String) : [],
      interpreted: Array.isArray(partial.visibility?.interpreted)
        ? partial.visibility.interpreted.map(String)
        : [],
      symbolic: Array.isArray(partial.visibility?.symbolic) ? partial.visibility.symbolic.map(String) : [],
    },
  };
}

/**
 * @param {unknown} layer
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateNormalizedLayer(layer) {
  const errors = [];
  if (!layer || typeof layer !== 'object') {
    return { ok: false, errors: ['layer must be an object'] };
  }
  const required = [
    'layerId',
    'layerType',
    'source',
    'method',
    'themes',
    'tensions',
    'cautions',
    'confidence',
    'citationsOrReferences',
    'limitations',
    'status',
    'visibility',
  ];
  for (const key of required) {
    if (!(key in layer)) errors.push(`missing:${key}`);
  }
  if (!Array.isArray(layer.themes)) errors.push('themes must be array');
  if (!Array.isArray(layer.tensions)) errors.push('tensions must be array');
  if (!Array.isArray(layer.cautions)) errors.push('cautions must be array');
  if (!Array.isArray(layer.limitations)) errors.push('limitations must be array');
  if (!Array.isArray(layer.citationsOrReferences)) errors.push('citationsOrReferences must be array');
  if (layer.visibility == null || typeof layer.visibility !== 'object') {
    errors.push('visibility must be object');
  } else {
    for (const key of ['computed', 'interpreted', 'symbolic']) {
      if (!Array.isArray(layer.visibility[key])) errors.push(`visibility.${key} must be array`);
    }
  }
  return { ok: errors.length === 0, errors };
}
