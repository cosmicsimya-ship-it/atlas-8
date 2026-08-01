/**
 * Day length layer — derived from sunrise/sunset (computed).
 */
import { computeSunTimes } from '../../atlas-ephemeris.js';
import { makeLayerResult } from '../schema.js';
import { formatDuration } from '../context.js';

/**
 * @param {object} ctx
 * @param {import('../schema.js').LayerResult} [sunTimesLayer]
 */
export function buildDayLengthLayer(ctx, sunTimesLayer = null) {
  if (!ctx.hasCoordinates) {
    return makeLayerResult({
      id: 'day-length',
      title: 'Gün Uzunluğu',
      type: 'computed',
      source: 'derived-from-sun-times',
      confidence: 'low',
      status: 'unavailable',
      computedData: { needsCoordinates: true },
      interpretation: null,
      warnings: ['Gün uzunluğu için koordinat gerekli; konum tahmin edilmedi.'],
      metadata: {
        timezone: ctx.timezone,
        error: ctx.coordinatesError || 'COORDINATES_MISSING',
      },
    });
  }

  const fromSun =
    sunTimesLayer?.status === 'success' || sunTimesLayer?.status === 'partial'
      ? sunTimesLayer.computedData
      : null;

  let todayMs = fromSun?.dayLength?.totalSeconds != null
    ? fromSun.dayLength.totalSeconds * 1000
    : null;
  let civilDate = fromSun?.civilDate ?? ctx.dateKey;

  if (todayMs == null) {
    const sun = computeSunTimes({
      when: ctx.date,
      latitude: ctx.latitude,
      longitude: ctx.longitude,
      timeZone: ctx.timezone,
      locationName: 'request',
      requireCoordinates: true,
    });
    if (!sun.ok) {
      return makeLayerResult({
        id: 'day-length',
        title: 'Gün Uzunluğu',
        type: 'computed',
        source: 'derived-from-sun-times',
        confidence: 'low',
        status: 'error',
        computedData: null,
        interpretation: null,
        warnings: ['Gün uzunluğu hesaplanamadı.'],
        metadata: { error: sun.error ?? 'DAY_LENGTH_FAILURE', timezone: ctx.timezone },
      });
    }
    todayMs = sun.dayLength.milliseconds;
    civilDate = sun.civilDate;
  }

  const yesterday = new Date(ctx.date.getTime() - 24 * 3600 * 1000);
  const prev = computeSunTimes({
    when: yesterday,
    latitude: ctx.latitude,
    longitude: ctx.longitude,
    timeZone: ctx.timezone,
    locationName: 'request',
    requireCoordinates: true,
  });

  let deltaSeconds = null;
  let seasonalTrend = null;
  if (prev.ok) {
    deltaSeconds = Math.round((todayMs - prev.dayLength.milliseconds) / 1000);
    if (deltaSeconds > 30) seasonalTrend = 'lengthening';
    else if (deltaSeconds < -30) seasonalTrend = 'shortening';
    else seasonalTrend = 'stable';
  }

  const duration = formatDuration(todayMs);

  return makeLayerResult({
    id: 'day-length',
    title: 'Gün Uzunluğu',
    type: 'computed',
    source: 'sunrise-to-sunset duration',
    confidence: 'high',
    status: prev.ok ? 'success' : 'partial',
    computedData: {
      totalSeconds: duration.totalSeconds,
      hours: duration.hours,
      minutes: duration.minutes,
      display: duration.display,
      isoLike: duration.isoLike,
      previousDayDeltaSeconds: deltaSeconds,
      seasonalChange: seasonalTrend,
      civilDate,
    },
    interpretation: null,
    warnings: prev.ok
      ? []
      : ['Önceki gün karşılaştırması hesaplanamadı.'],
    metadata: {
      timezone: ctx.timezone,
      latitude: ctx.latitude,
      longitude: ctx.longitude,
      algorithm: 'SearchRiseSet day span',
      dateKey: ctx.dateKey,
    },
  });
}
