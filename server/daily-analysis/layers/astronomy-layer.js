/**
 * Astronomy / ephemeris layer — positions only, no astrological interpretation.
 */
import { buildEphemerisSnapshot } from '../../atlas-ephemeris.js';
import { makeLayerResult } from '../schema.js';

const PLANET_EN = {
  Güneş: 'Sun',
  Ay: 'Moon',
  Merkür: 'Mercury',
  Venüs: 'Venus',
  Mars: 'Mars',
  Jüpiter: 'Jupiter',
  Satürn: 'Saturn',
  Uranüs: 'Uranus',
  Neptün: 'Neptune',
  Plüton: 'Pluto',
};

/**
 * @param {object} ctx
 */
export function buildAstronomyLayer(ctx) {
  if (!ctx.hasCoordinates) {
    // Still computable geocentrically without location; mark partial if coords missing
  }

  const sky = buildEphemerisSnapshot({
    when: ctx.date,
    latitude: ctx.hasCoordinates ? ctx.latitude : undefined,
    longitude: ctx.hasCoordinates ? ctx.longitude : undefined,
    locationName: ctx.hasCoordinates ? 'request' : 'geocentric-default',
    timeZone: ctx.timezone,
  });

  if (!sky.ok) {
    return makeLayerResult({
      id: 'astronomy',
      title: 'Astronomik Veriler',
      type: 'astronomical',
      source: 'astronomy-engine',
      confidence: 'low',
      status: 'error',
      computedData: null,
      interpretation: null,
      warnings: ['Astronomi hesaplama hatası.'],
      metadata: {
        error: sky.error ?? 'EPHEMERIS_FAILURE',
        timezone: ctx.timezone,
      },
    });
  }

  const retroSet = new Set(sky.retrogrades || []);
  const planets = Object.values(sky.planets || {}).map((p) => ({
    name: PLANET_EN[p.body] || p.body,
    localizedName: p.body,
    eclipticLongitude: p.longitude,
    signClassification: p.sign,
    signDegree: p.degree,
    retrograde: retroSet.has(p.body),
    timestamp: sky.whenIso,
    source: 'astronomy-engine',
    note: 'Burç alanı yalnızca ekliptik boylamdan türetilmiş astronomik sınıflandırmadır; astrolojik yorum değildir.',
  }));

  return makeLayerResult({
    id: 'astronomy',
    title: 'Astronomik Veriler',
    type: 'astronomical',
    source: 'astronomy-engine',
    confidence: 'high',
    status: ctx.hasCoordinates ? 'success' : 'partial',
    computedData: {
      astronomicalTime: sky.whenIso,
      sun: planets.find((p) => p.name === 'Sun') ?? null,
      moon: {
        ...(planets.find((p) => p.name === 'Moon') ?? {}),
        phase: sky.moon?.phase,
        phaseEn: sky.moon?.phaseEn,
        phaseFraction: sky.moon?.phaseFraction,
      },
      planets,
      locationUsed: sky.location,
      coordinatesProvided: Boolean(ctx.hasCoordinates),
    },
    interpretation: null,
    warnings: [
      'Bu katman yalnızca astronomik veri üretir; astrolojik yorum içermez.',
      'Burç karşılıkları ekliptik boylam sınıflandırmasıdır.',
      ...(ctx.hasCoordinates
        ? []
        : ['Koordinat verilmedi; gezegen konumları jeosentrik hesaplandı, topocentric alanlar varsayılan konum kullanabilir.']),
    ],
    metadata: {
      timezone: ctx.timezone,
      algorithm: sky.metadata?.method,
      latitude: ctx.latitude,
      longitude: ctx.longitude,
      dateKey: ctx.dateKey,
    },
  });
}
