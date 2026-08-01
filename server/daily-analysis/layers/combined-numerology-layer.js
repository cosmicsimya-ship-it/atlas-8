/**
 * Combined numerology — deterministic merge only (no LLM).
 */
import { numerologyUnifiedDayNumber } from '../../atlas-numerology.js';
import { makeLayerResult } from '../schema.js';

/**
 * @param {object} ctx
 * @param {import('../schema.js').LayerResult} gregorianNum
 * @param {import('../schema.js').LayerResult} hijriNum
 */
export function buildCombinedNumerologyLayer(ctx, gregorianNum, hijriNum) {
  if (
    gregorianNum?.status !== 'success' ||
    hijriNum?.status !== 'success' ||
    !gregorianNum.computedData ||
    !hijriNum.computedData
  ) {
    return makeLayerResult({
      id: 'combined-numerology',
      title: 'Birleşik Numeroloji',
      type: 'computed',
      source: 'sum-then-reduce',
      confidence: 'low',
      status: 'unavailable',
      computedData: null,
      interpretation: null,
      warnings: ['Miladi ve hicri numeroloji sonuçları olmadan birleşik hesap yapılamaz.'],
      metadata: { error: 'DEPENDENCY_UNAVAILABLE' },
    });
  }

  const unified = numerologyUnifiedDayNumber(
    { dayNumber: gregorianNum.computedData.reducedNumber },
    { dayNumber: hijriNum.computedData.reducedNumber },
    {
      keepMaster: ctx.numerologyConfig?.keepMasterNumbers !== false,
      masterNumbers: ctx.numerologyConfig?.masterNumbers ?? [11, 22, 33],
    },
  );

  if (!unified.ok) {
    return makeLayerResult({
      id: 'combined-numerology',
      title: 'Birleşik Numeroloji',
      type: 'computed',
      source: 'sum-then-reduce',
      confidence: 'low',
      status: 'error',
      computedData: null,
      interpretation: null,
      warnings: ['Birleşik numeroloji hesap hatası.'],
      metadata: { error: unified.error ?? 'COMBINED_FAILURE' },
    });
  }

  return makeLayerResult({
    id: 'combined-numerology',
    title: 'Birleşik Numeroloji',
    type: 'computed',
    source: 'sum-then-reduce',
    confidence: 'high',
    status: 'success',
    computedData: {
      gregorianNumber: unified.gregorianNumber,
      hijriNumber: unified.hijriNumber,
      combinedRawTotal: unified.combinedRawTotal,
      combinedReducedNumber: unified.combinedReducedNumber,
      calculationSteps: unified.calculationSteps,
      method: unified.method,
      isMasterNumber: unified.isMasterNumber,
      keepMasterNumbers: unified.keepMaster,
      masterNumbers: unified.masterNumbers,
    },
    interpretation: null,
    warnings: [],
    metadata: {
      timezone: ctx.timezone,
      algorithm: unified.method,
      dateKey: ctx.dateKey,
    },
  });
}
