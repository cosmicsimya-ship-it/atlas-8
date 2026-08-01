/**
 * Adapters: daily LayerResult / freeform findings → NormalizedLayer.
 * Does not mutate upstream engines.
 */

import { makeNormalizedLayer, validateNormalizedLayer } from './schema.js';
import { extractThemeIds } from './theme-lexicon.js';

/**
 * Adapt a daily-analysis LayerResult into synthesis schema.
 * Themes/interpretation must be supplied externally (daily engine keeps interpretation=null).
 * @param {object} layerResult
 * @param {{ themes?: string[], interpretation?: string|null, tensions?: string[], method?: string }} [overlay]
 * @returns {import('./schema.js').NormalizedLayer}
 */
export function fromDailyLayerResult(layerResult, overlay = {}) {
  const id = layerResult?.id ?? 'unknown-daily-layer';
  const computed = layerResult?.computedData ?? null;
  const themes = Array.isArray(overlay.themes)
    ? overlay.themes
    : extractThemeIds([
        overlay.interpretation,
        ...(Array.isArray(layerResult?.warnings) ? layerResult.warnings : []),
      ]);

  const computedKeys = computed && typeof computed === 'object' ? Object.keys(computed) : [];
  const visibilityComputed = computedKeys.slice(0, 12).map((k) => `computedData.${k}`);

  return makeNormalizedLayer({
    layerId: id,
    layerType: layerResult?.type ?? 'computed',
    source: layerResult?.source ?? 'daily-analysis',
    method: overlay.method ?? 'daily-analysis-layer',
    input: layerResult?.metadata ?? null,
    normalizedFacts: computed,
    themes,
    tensions: Array.isArray(overlay.tensions) ? overlay.tensions : [],
    cautions: Array.isArray(layerResult?.warnings) ? [...layerResult.warnings] : [],
    confidence: layerResult?.confidence ?? 'low',
    temporalScope: computed?.isoDate ?? computed?.localDate ?? overlay.temporalScope ?? null,
    citationsOrReferences: [
      { kind: 'layer', ref: id, note: layerResult?.source ?? undefined },
    ],
    interpretation: overlay.interpretation ?? null,
    limitations: [
      'Daily-analysis Faz A/B interpretation alanı null bırakılır; sentez temaları dışarıdan bağlanır.',
      ...(Array.isArray(overlay.limitations) ? overlay.limitations : []),
    ],
    status: layerResult?.status ?? 'error',
    visibility: {
      computed: visibilityComputed,
      interpreted: overlay.interpretation ? ['overlay.interpretation'] : [],
      symbolic: themes.length ? ['theme overlay / keyword extract'] : [],
    },
  });
}

/**
 * Freeform symbolic finding (astrology, numerology narrative, user context).
 * @param {object} finding
 * @returns {import('./schema.js').NormalizedLayer}
 */
export function fromSymbolicFinding(finding) {
  const themes = Array.isArray(finding?.themes)
    ? finding.themes
    : extractThemeIds([finding?.interpretation, finding?.summary, ...(finding?.themes ?? [])]);

  return makeNormalizedLayer({
    layerId: finding?.layerId ?? finding?.id ?? 'symbolic',
    layerType: finding?.layerType ?? finding?.type ?? 'symbolic',
    source: finding?.source ?? 'symbolic-finding',
    method: finding?.method ?? 'symbolic-reading',
    input: finding?.input ?? null,
    normalizedFacts: finding?.normalizedFacts ?? finding?.facts ?? null,
    themes,
    tensions: Array.isArray(finding?.tensions) ? finding.tensions : [],
    cautions: Array.isArray(finding?.cautions) ? finding.cautions : [],
    confidence: finding?.confidence ?? 'medium',
    temporalScope: finding?.temporalScope ?? null,
    citationsOrReferences: Array.isArray(finding?.citationsOrReferences)
      ? finding.citationsOrReferences
      : finding?.citation
        ? [{ kind: 'note', ref: String(finding.citation) }]
        : [],
    interpretation: finding?.interpretation ?? finding?.summary ?? null,
    limitations: Array.isArray(finding?.limitations)
      ? finding.limitations
      : ['Sembolik okuma; kesin kader veya bilimsel kanıt değildir.'],
    status: finding?.status ?? 'success',
    visibility: {
      computed: Array.isArray(finding?.visibility?.computed)
        ? finding.visibility.computed
        : finding?.normalizedFacts
          ? ['normalizedFacts (hesaplanan/aktarılan)']
          : [],
      interpreted: [
        ...(finding?.interpretation || finding?.summary ? ['interpretation/summary'] : []),
        ...(Array.isArray(finding?.visibility?.interpreted) ? finding.visibility.interpreted : []),
      ],
      symbolic: [
        'Sembolik katman',
        ...(Array.isArray(finding?.visibility?.symbolic) ? finding.visibility.symbolic : []),
      ],
    },
  });
}

/**
 * Ensure input is NormalizedLayer; adapt if needed.
 * @param {unknown} layer
 * @returns {import('./schema.js').NormalizedLayer}
 */
export function ensureNormalizedLayer(layer) {
  if (layer && typeof layer === 'object' && 'layerId' in layer && validateNormalizedLayer(layer).ok) {
    return /** @type {import('./schema.js').NormalizedLayer} */ (layer);
  }
  if (layer && typeof layer === 'object' && 'id' in layer && 'computedData' in layer) {
    return fromDailyLayerResult(layer);
  }
  return fromSymbolicFinding(layer && typeof layer === 'object' ? layer : { layerId: 'invalid' });
}
