/**
 * Hijri numerology layer — separate from Gregorian (computed).
 */
import { numerologyHijriDayNumber } from '../../atlas-numerology.js';
import { makeLayerResult } from '../schema.js';

/**
 * @param {object} ctx
 * @param {import('../schema.js').LayerResult} [hijriLayer]
 */
export function buildHijriNumerologyLayer(ctx, hijriLayer = null) {
  const h = hijriLayer?.computedData;
  if (!h || ![h.year, h.month, h.day].every((n) => Number.isFinite(Number(n)))) {
    return makeLayerResult({
      id: 'hijri-numerology',
      title: 'Hicri Numeroloji',
      type: 'computed',
      source: 'digit-sum-reduce',
      confidence: 'low',
      status: hijriLayer?.status === 'error' ? 'error' : 'unavailable',
      computedData: null,
      interpretation: null,
      warnings: ['Hicri tarih olmadan hicri numeroloji hesaplanamaz.'],
      metadata: { error: 'HIJRI_DATE_REQUIRED' },
    });
  }

  const calc = numerologyHijriDayNumber(h.year, h.month, h.day, {
    keepMaster: ctx.numerologyConfig?.keepMasterNumbers !== false,
    masterNumbers: ctx.numerologyConfig?.masterNumbers ?? [11, 22, 33],
  });

  return makeLayerResult({
    id: 'hijri-numerology',
    title: 'Hicri Numeroloji',
    type: 'computed',
    source: 'digit-sum-reduce (hijri)',
    confidence: 'medium',
    status: 'success',
    computedData: {
      hijriDate: calc.inputDate,
      rawDigits: calc.rawDigits,
      calculationSteps: calc.calculationSteps,
      intermediateTotal: calc.intermediateTotal,
      reducedNumber: calc.reducedNumber,
      isMasterNumber: calc.isMasterNumber,
      methodName: calc.methodName,
      keepMasterNumbers: calc.keepMaster,
      masterNumbers: calc.masterNumbers,
    },
    interpretation: null,
    warnings: [
      'Hicri numeroloji, miladi numerolojiden ayrı hesaplanır.',
    ],
    metadata: {
      timezone: ctx.timezone,
      algorithm: calc.methodName,
      calendar: 'hijri',
      dateKey: ctx.dateKey,
    },
  });
}
