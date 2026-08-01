/**
 * Moon phase layer — astronomical computed data only.
 */
import { computeMoonPhaseDetails } from '../../atlas-ephemeris.js';
import { makeLayerResult } from '../schema.js';

/**
 * @param {object} ctx
 */
export function buildMoonPhaseLayer(ctx) {
  const details = computeMoonPhaseDetails(ctx.date);
  if (!details.ok) {
    return makeLayerResult({
      id: 'moon-phase',
      title: 'Ay Evresi',
      type: 'astronomical',
      source: 'astronomy-engine',
      confidence: 'low',
      status: 'error',
      computedData: null,
      interpretation: null,
      warnings: ['Ay evresi hesaplanamadı.'],
      metadata: {
        error: details.error ?? 'MOON_PHASE_FAILURE',
        timezone: ctx.timezone,
      },
    });
  }

  return makeLayerResult({
    id: 'moon-phase',
    title: 'Ay Evresi',
    type: 'astronomical',
    source: 'astronomy-engine',
    confidence: 'high',
    status: 'success',
    computedData: {
      phaseName: details.phaseName,
      localizedPhaseName: details.localizedPhaseName,
      illuminationPercent: details.illuminationPercent,
      ageDays: details.ageDays,
      phaseFraction: details.phaseFraction,
      proximity: details.proximity,
      calculatedAt: details.whenIso,
    },
    interpretation: null,
    warnings: [
      'Yaklaşık doğruluk: faz ±~1%; ay yaşı elongasyondan türetilir.',
    ],
    metadata: {
      timezone: ctx.timezone,
      algorithm: details.metadata?.method,
      approximateAccuracy: details.metadata?.approximateAccuracy,
      dateKey: ctx.dateKey,
    },
  });
}
