/**
 * Gregorian numerology layer — deterministic digit sum only.
 */
import { numerologyDayNumber } from '../../atlas-numerology.js';
import { makeLayerResult } from '../schema.js';

/**
 * @param {object} ctx
 * @param {import('../schema.js').LayerResult} [gregorianLayer]
 */
export function buildGregorianNumerologyLayer(ctx, gregorianLayer = null) {
  const g = gregorianLayer?.computedData;
  const year = g?.year ?? ctx.civil?.year;
  const month = g?.month ?? ctx.civil?.month;
  const day = g?.day ?? ctx.civil?.day;

  if (![year, month, day].every((n) => Number.isFinite(Number(n)))) {
    return makeLayerResult({
      id: 'gregorian-numerology',
      title: 'Miladi Numeroloji',
      type: 'computed',
      source: 'digit-sum-reduce',
      confidence: 'low',
      status: 'error',
      computedData: null,
      interpretation: null,
      warnings: ['Miladi tarih eksik; numeroloji hesaplanamadı.'],
      metadata: { error: 'INVALID_DATE_INPUT' },
    });
  }

  const calc = numerologyDayNumber(year, month, day, {
    keepMaster: ctx.numerologyConfig?.keepMasterNumbers !== false,
    masterNumbers: ctx.numerologyConfig?.masterNumbers ?? [11, 22, 33],
  });

  return makeLayerResult({
    id: 'gregorian-numerology',
    title: 'Miladi Numeroloji',
    type: 'computed',
    source: 'digit-sum-reduce (gregorian)',
    confidence: 'high',
    status: 'success',
    computedData: {
      inputDate: calc.inputDate,
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
    warnings: [],
    metadata: {
      timezone: ctx.timezone,
      algorithm: calc.methodName,
      calendar: 'gregorian',
      dateKey: ctx.dateKey,
    },
  });
}
