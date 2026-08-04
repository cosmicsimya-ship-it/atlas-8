/**
 * Sunrise / sunset / solar noon layer.
 * Does NOT invent a city when coordinates are missing.
 */
import { computeSunTimes } from '../../atlas-ephemeris.js';
import { makeLayerResult } from '../schema.js';
import { formatDuration } from '../context.js';

/**
 * @param {object} ctx
 */
export function buildSunTimesLayer(ctx) {
  if (ctx.coordinatesError === 'COORDINATES_OUT_OF_RANGE' || ctx.coordinatesError === 'COORDINATES_INVALID') {
    return makeLayerResult({
      id: 'sun-times',
      title: 'Güneş Doğuş / Batış',
      type: 'astronomical',
      source: 'astronomy-engine',
      confidence: 'low',
      status: 'error',
      computedData: null,
      interpretation: null,
      warnings: ['Latitude/longitude geçersiz veya sınır dışı.'],
      metadata: { error: ctx.coordinatesError, timezone: ctx.timezone },
    });
  }

  if (!ctx.hasCoordinates) {
    return makeLayerResult({
      id: 'sun-times',
      title: 'Güneş Doğuş / Batış',
      type: 'astronomical',
      source: 'astronomy-engine',
      confidence: 'low',
      status: 'unavailable',
      computedData: {
        needsCoordinates: true,
        hint: 'latitude ve longitude sağlayın',
      },
      interpretation: null,
      warnings: [
        'Konum bilinmiyor; şehir tahmin edilmedi. Güneş doğuş/batış için koordinat gerekli.',
      ],
      metadata: {
        timezone: ctx.timezone,
        error: ctx.coordinatesError || 'COORDINATES_MISSING',
        dateKey: ctx.dateKey,
      },
    });
  }

  const sun = computeSunTimes({
    when: ctx.date,
    latitude: ctx.latitude,
    longitude: ctx.longitude,
    timeZone: ctx.timezone,
    locationName: 'request',
    requireCoordinates: true,
  });

  if (!sun.ok) {
    const polar = sun.polarHint || Math.abs(ctx.latitude) > 66;
    return makeLayerResult({
      id: 'sun-times',
      title: 'Güneş Doğuş / Batış',
      type: 'astronomical',
      source: 'astronomy-engine',
      confidence: 'low',
      status: polar ? 'unavailable' : 'error',
      computedData: {
        polarRegion: polar,
        error: sun.error,
      },
      interpretation: null,
      warnings: [
        polar
          ? 'Kutup bölgesi: güneş doğuş/batış bu tarihte hesaplanamayabilir (kutup günü/gecesi).'
          : 'Güneş doğuş/batış hesaplanamadı.',
      ],
      metadata: {
        error: sun.error ?? 'SUN_TIMES_FAILURE',
        timezone: ctx.timezone,
        latitude: ctx.latitude,
        longitude: ctx.longitude,
      },
    });
  }

  const day = formatDuration(sun.dayLength.milliseconds);
  const night = sun.nightLength
    ? formatDuration(sun.nightLength.milliseconds)
    : null;

  return makeLayerResult({
    id: 'sun-times',
    title: 'Güneş Doğuş / Batış',
    type: 'astronomical',
    source: 'astronomy-engine SearchRiseSet',
    confidence: 'high',
    status: sun.nextSunrise ? 'success' : 'partial',
    computedData: {
      sunrise: sun.sunrise,
      sunset: sun.sunset,
      solarNoon: sun.solarNoon,
      dayLength: day,
      nightLength: night,
      nextSunrise: sun.nextSunrise,
      polarDayOrNight: false,
      civilDate: sun.civilDate,
    },
    interpretation: null,
    warnings: sun.nextSunrise
      ? []
      : ['Ertesi gün güneş doğuşu bulunamadı; gece uzunluğu eksik olabilir.'],
    metadata: {
      timezone: ctx.timezone,
      latitude: ctx.latitude,
      longitude: ctx.longitude,
      algorithm: sun.metadata?.method,
      dateKey: ctx.dateKey,
    },
  });
}
