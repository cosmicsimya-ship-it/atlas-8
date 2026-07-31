/**
 * Placeholder / non-ready layer outcomes — never fabricate readings.
 */

import { makeLayerOutcome } from '../schema.js';
import { LAYER_REQUIREMENTS } from '../capability.js';
import { makeNormalizedLayer } from '../normalize.js';

/**
 * @param {string} layerId
 * @param {{ eligible: boolean, missing: string[], readiness: string, runnable?: boolean }} capability
 * @param {object} [input]
 */
export function runPlaceholderLayer(layerId, capability, input = {}) {
  const label = LAYER_REQUIREMENTS[layerId]?.label ?? layerId;

  if (!capability.eligible) {
    const normalized = makeNormalizedLayer({
      layerId,
      source: 'placeholder',
      method: 'skip-missing-input',
      status: 'skipped',
      skipReason: `Eksik veri: ${capability.missing.join(', ')}`,
      limitations: ['Eksik alan uydurulmadı; katman atlandı.'],
      warnings: ['Eksik alan uydurulmadı; katman atlandı.'],
    });
    return makeLayerOutcome({
      id: layerId,
      title: label,
      status: 'skipped',
      eligible: false,
      skipReason: normalized.skipReason,
      warnings: normalized.warnings,
      normalized,
      metadata: { inputKeys: Object.keys(input || {}), readiness: capability.readiness },
    });
  }

  const status =
    capability.readiness === 'unavailable' ? 'unavailable' : 'planned';

  const normalized = makeNormalizedLayer({
    layerId,
    source: 'placeholder',
    method: 'not-ready',
    status,
    limitations: ['Katman hazır değil; sahte çıktı üretilmedi.'],
    warnings: ['Katman yol haritasında veya kullanılamaz; sahte çıktı üretilmedi.'],
  });

  return makeLayerOutcome({
    id: layerId,
    title: label,
    status,
    eligible: true,
    skipReason: null,
    warnings: normalized.warnings,
    normalized,
    metadata: { readiness: capability.readiness },
  });
}
