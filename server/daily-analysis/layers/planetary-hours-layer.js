/**
 * Planetary hours — classical Chaldean method (traditional schedule, no interpretation).
 */
import { computeSunTimes } from '../../atlas-ephemeris.js';
import { makeLayerResult } from '../schema.js';
import { getCivilParts } from '../context.js';

/** Chaldean order */
const CHALDEAN = [
  { planet: 'Saturn', localizedPlanetName: 'Zühal' },
  { planet: 'Jupiter', localizedPlanetName: 'Müşteri' },
  { planet: 'Mars', localizedPlanetName: 'Mirrih' },
  { planet: 'Sun', localizedPlanetName: 'Güneş' },
  { planet: 'Venus', localizedPlanetName: 'Zühre' },
  { planet: 'Mercury', localizedPlanetName: 'Utârid' },
  { planet: 'Moon', localizedPlanetName: 'Kamer' },
];

/** Day ruler by weekday: 0=Sunday … 6=Saturday */
const DAY_RULERS = [
  CHALDEAN[3], // Sun
  CHALDEAN[6], // Moon
  CHALDEAN[2], // Mars
  CHALDEAN[5], // Mercury
  CHALDEAN[1], // Jupiter
  CHALDEAN[4], // Venus
  CHALDEAN[0], // Saturn
];

const WEEKDAY_SHORT_TO_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function rulerAt(dayRulerPlanet, hourIndex) {
  const start = CHALDEAN.findIndex((p) => p.planet === dayRulerPlanet);
  const idx = ((start < 0 ? 0 : start) + hourIndex) % 7;
  return CHALDEAN[idx];
}

function splitHours(start, end, count, dayRulerPlanet, hourOffset, period, timeZone, source) {
  const span = end.getTime() - start.getTime();
  const slice = span / count;
  const hours = [];
  for (let i = 0; i < count; i += 1) {
    const from = new Date(start.getTime() + i * slice);
    const to = new Date(start.getTime() + (i + 1) * slice);
    const body = rulerAt(dayRulerPlanet, hourOffset + i);
    hours.push({
      index: i + 1,
      period,
      startTime: from.toISOString(),
      endTime: to.toISOString(),
      startLocal: new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(from),
      endLocal: new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(to),
      planet: body.planet,
      localizedPlanetName: body.localizedPlanetName,
      rulerOfDay: dayRulerPlanet,
      source,
    });
  }
  return hours;
}

/**
 * @param {object} ctx
 * @param {import('../schema.js').LayerResult} [sunTimesLayer]
 */
export function buildPlanetaryHoursLayer(ctx, sunTimesLayer = null) {
  if (!ctx.hasCoordinates) {
    return makeLayerResult({
      id: 'planetary-hours',
      title: 'Gezegen Saatleri',
      type: 'traditional',
      source: 'Chaldean planetary hours',
      confidence: 'low',
      status: 'unavailable',
      computedData: { needsCoordinates: true },
      interpretation: null,
      warnings: [
        'Gezegen saatleri için koordinat gerekli; şehir tahmin edilmedi.',
        'Bu yöntem geleneksel bir hesap sistemidir; kesin sonuç veya dini zorunluluk iddiası değildir.',
      ],
      metadata: {
        timezone: ctx.timezone,
        error: ctx.coordinatesError || 'COORDINATES_MISSING',
      },
    });
  }

  let sunriseIso = sunTimesLayer?.computedData?.sunrise?.utcIso;
  let sunsetIso = sunTimesLayer?.computedData?.sunset?.utcIso;
  let nextSunriseIso = sunTimesLayer?.computedData?.nextSunrise?.utcIso;
  let civilDate = sunTimesLayer?.computedData?.civilDate ?? ctx.dateKey;

  if (!sunriseIso || !sunsetIso) {
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
        id: 'planetary-hours',
        title: 'Gezegen Saatleri',
        type: 'traditional',
        source: 'Chaldean planetary hours',
        confidence: 'low',
        status: sun.polarHint ? 'unavailable' : 'error',
        computedData: null,
        interpretation: null,
        warnings: [
          sun.error === 'SUNRISE_NOT_FOUND' || sun.error === 'SUNSET_NOT_FOUND'
            ? 'Güneş doğuş/batış olmadan gezegen saatleri hesaplanamaz.'
            : 'Gezegen saatleri hesaplanamadı.',
          'Bu yöntem geleneksel bir hesap sistemidir.',
        ],
        metadata: { error: sun.error ?? 'PLANETARY_HOURS_FAILURE', timezone: ctx.timezone },
      });
    }
    sunriseIso = sun.sunrise.utcIso;
    sunsetIso = sun.sunset.utcIso;
    nextSunriseIso = sun.nextSunrise?.utcIso ?? null;
    civilDate = sun.civilDate;
  }

  if (!nextSunriseIso) {
    return makeLayerResult({
      id: 'planetary-hours',
      title: 'Gezegen Saatleri',
      type: 'traditional',
      source: 'Chaldean planetary hours',
      confidence: 'low',
      status: 'error',
      computedData: {
        sunrise: sunriseIso,
        sunset: sunsetIso,
      },
      interpretation: null,
      warnings: [
        'Ertesi gün güneş doğuşu bulunamadı; gece saatleri hesaplanamadı.',
        'Bu yöntem geleneksel bir hesap sistemidir.',
      ],
      metadata: {
        error: 'NEXT_SUNRISE_NOT_FOUND',
        timezone: ctx.timezone,
        latitude: ctx.latitude,
        longitude: ctx.longitude,
      },
    });
  }

  const sunrise = new Date(sunriseIso);
  const sunset = new Date(sunsetIso);
  const nextSunrise = new Date(nextSunriseIso);
  const civil = getCivilParts(sunrise, ctx.timezone);
  const weekdayIndex = WEEKDAY_SHORT_TO_INDEX[civil.weekdayShort] ?? 0;
  const dayRuler = DAY_RULERS[weekdayIndex];
  const source = 'Chaldean planetary hours + astronomy-engine sun times';

  const dayHours = splitHours(
    sunrise,
    sunset,
    12,
    dayRuler.planet,
    0,
    'day',
    ctx.timezone,
    source,
  );
  const nightHours = splitHours(
    sunset,
    nextSunrise,
    12,
    dayRuler.planet,
    12,
    'night',
    ctx.timezone,
    source,
  );

  return makeLayerResult({
    id: 'planetary-hours',
    title: 'Gezegen Saatleri',
    type: 'traditional',
    source,
    confidence: 'medium',
    status: 'success',
    computedData: {
      civilDate,
      weekdayIndex,
      rulerOfDay: dayRuler.planet,
      localizedRulerOfDay: dayRuler.localizedPlanetName,
      chaldeanOrder: CHALDEAN.map((p) => p.planet),
      localizedChaldeanOrder: CHALDEAN.map((p) => p.localizedPlanetName),
      sunrise: sunriseIso,
      sunset: sunsetIso,
      nextSunrise: nextSunriseIso,
      dayHours,
      nightHours,
      hours: [...dayHours, ...nightHours],
    },
    interpretation: null,
    warnings: [
      'Bu yöntem geleneksel bir hesap sistemidir; kesin sonuç, dini zorunluluk veya olay garantisi iddiası değildir.',
    ],
    metadata: {
      timezone: ctx.timezone,
      latitude: ctx.latitude,
      longitude: ctx.longitude,
      algorithm: '12 day + 12 night equal divisions; Chaldean sequence',
      dateKey: ctx.dateKey,
    },
  });
}
