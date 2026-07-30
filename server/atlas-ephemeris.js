// ═══════════════════════════════════════════════════════════════════════
// Ephemeris layer — verified sky positions via astronomy-engine
// Positions are NOT taken from LLM memory.
// ═══════════════════════════════════════════════════════════════════════

import {
  Body,
  Ecliptic,
  GeoVector,
  Illumination,
  MakeTime,
  MoonPhase,
  Observer,
  SearchHourAngle,
  SearchRiseSet,
} from 'astronomy-engine';

const SIGNS = [
  'Koç',
  'Boğa',
  'İkizler',
  'Yengeç',
  'Aslan',
  'Başak',
  'Terazi',
  'Akrep',
  'Yay',
  'Oğlak',
  'Kova',
  'Balık',
];

const PLANETS = [
  { body: Body.Sun, name: 'Güneş' },
  { body: Body.Moon, name: 'Ay' },
  { body: Body.Mercury, name: 'Merkür' },
  { body: Body.Venus, name: 'Venüs' },
  { body: Body.Mars, name: 'Mars' },
  { body: Body.Jupiter, name: 'Jüpiter' },
  { body: Body.Saturn, name: 'Satürn' },
  { body: Body.Uranus, name: 'Uranüs' },
  { body: Body.Neptune, name: 'Neptün' },
  { body: Body.Pluto, name: 'Plüton' },
];

/** Default analysis location when user does not specify (declared in output). */
export const DEFAULT_SKY_LOCATION = {
  name: 'İstanbul',
  latitude: 41.0082,
  longitude: 28.9784,
  timeZone: 'Europe/Istanbul',
};

/**
 * @param {number} longitudeDeg 0-360 ecliptic longitude
 */
export function longitudeToSignDegree(longitudeDeg) {
  let lon = longitudeDeg % 360;
  if (lon < 0) lon += 360;
  const signIndex = Math.floor(lon / 30);
  const degree = lon - signIndex * 30;
  return {
    sign: SIGNS[signIndex],
    signIndex,
    degree: Number(degree.toFixed(2)),
    longitude: Number(lon.toFixed(2)),
  };
}

/**
 * @param {import('astronomy-engine').AstroTime} time
 * @param {import('astronomy-engine').Body} body
 */
function eclipticLongitude(time, body) {
  const vec = GeoVector(body, time, true);
  const ecl = Ecliptic(vec);
  return ecl.elon;
}

/**
 * Classify moon phase from astronomy-engine MoonPhase elongation degrees.
 * 0=new, 90=first quarter, 180=full, 270=last quarter.
 * @param {number} phaseDeg
 * @returns {{ tr: string, en: string }}
 */
export function describeMoonPhaseByAngle(phaseDeg) {
  let a = phaseDeg % 360;
  if (a < 0) a += 360;
  if (a < 22.5 || a >= 337.5) return { tr: 'Yeni Ay', en: 'New Moon' };
  if (a < 67.5) return { tr: 'Hilal (büyüyen)', en: 'Waxing Crescent' };
  if (a < 112.5) return { tr: 'İlk Dördün', en: 'First Quarter' };
  if (a < 157.5) return { tr: 'Şişkin Ay (büyüyen)', en: 'Waxing Gibbous' };
  if (a < 202.5) return { tr: 'Dolunay', en: 'Full Moon' };
  if (a < 247.5) return { tr: 'Şişkin Ay (küçülen)', en: 'Waning Gibbous' };
  if (a < 292.5) return { tr: 'Son Dördün', en: 'Last Quarter' };
  return { tr: 'Hilal (küçülen)', en: 'Waning Crescent' };
}

/**
 * @param {number} phaseFraction illuminated fraction 0..1 (0=new, 1=full)
 * @param {number} [phaseDeg] optional MoonPhase elongation degrees
 * @returns {{ tr: string, en: string }}
 */
export function describeMoonPhase(phaseFraction, phaseDeg = null) {
  if (phaseDeg != null && Number.isFinite(phaseDeg)) {
    return describeMoonPhaseByAngle(phaseDeg);
  }
  const f = phaseFraction;
  if (f < 0.03) return { tr: 'Yeni Ay', en: 'New Moon' };
  if (f < 0.22) return { tr: 'Hilal', en: 'Crescent' };
  if (f < 0.28) return { tr: 'Dördün', en: 'Quarter' };
  if (f < 0.47) return { tr: 'Şişkin Ay', en: 'Gibbous' };
  if (f < 0.53) return { tr: 'Dolunay', en: 'Full Moon' };
  if (f < 0.72) return { tr: 'Şişkin Ay', en: 'Gibbous' };
  if (f < 0.78) return { tr: 'Dördün', en: 'Quarter' };
  if (f < 0.97) return { tr: 'Hilal', en: 'Crescent' };
  return { tr: 'Dolunay', en: 'Full Moon' };
}

const SYNODIC_MONTH_DAYS = 29.530588853;

/**
 * Detailed moon phase from astronomy-engine (Illumination + MoonPhase age).
 * @param {Date|string|number} [when]
 */
export function computeMoonPhaseDetails(when = new Date()) {
  const date = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: 'INVALID_DATE' };
  }
  try {
    const time = MakeTime(date);
    const illum = Illumination(Body.Moon, time);
    const phaseFraction = illum.phase_fraction;
    const phaseDeg = MoonPhase(date);
    const names = describeMoonPhaseByAngle(phaseDeg);
    const ageDays = (phaseDeg / 360) * SYNODIC_MONTH_DAYS;
    const illuminationPercent = Number((phaseFraction * 100).toFixed(2));

    const distNew = Math.min(Math.abs(phaseDeg), Math.abs(phaseDeg - 360)) / 180;
    const distFirst = Math.abs(phaseDeg - 90) / 180;
    const distFull = Math.abs(phaseDeg - 180) / 180;
    const distLast = Math.abs(phaseDeg - 270) / 180;
    const nearest = [
      { key: 'newMoon', distance: distNew },
      { key: 'firstQuarter', distance: distFirst },
      { key: 'fullMoon', distance: distFull },
      { key: 'lastQuarter', distance: distLast },
    ].sort((a, b) => a.distance - b.distance)[0];

    return {
      ok: true,
      whenIso: date.toISOString(),
      phaseName: names.en,
      localizedPhaseName: names.tr,
      phaseAngleDegrees: Number(phaseDeg.toFixed(2)),
      phaseFraction: Number(phaseFraction.toFixed(4)),
      illuminationPercent,
      ageDays: Number(ageDays.toFixed(2)),
      proximity: {
        nearest: nearest.key,
        distanceNorm: Number(nearest.distance.toFixed(4)),
        toNewMoon: Number(distNew.toFixed(4)),
        toFirstQuarter: Number(distFirst.toFixed(4)),
        toFullMoon: Number(distFull.toFixed(4)),
        toLastQuarter: Number(distLast.toFixed(4)),
      },
      metadata: {
        source: 'astronomy-engine',
        method: 'Illumination(Body.Moon) + MoonPhase elongation',
        approximateAccuracy: 'phase naming via elongation; illumination from ephemeris',
      },
    };
  } catch (err) {
    return { ok: false, error: err.message ?? 'MOON_PHASE_FAILURE' };
  }
}

/**
 * Format a Date in a timezone as HH:MM:SS (24h).
 * @param {Date} date
 * @param {string} timeZone
 */
export function formatLocalClock(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

/**
 * Civil sunrise / sunset and day length for a location (astronomy-engine SearchRiseSet).
 * @param {{
 *   when?: Date|string|number,
 *   latitude?: number,
 *   longitude?: number,
 *   elevationMeters?: number,
 *   locationName?: string,
 *   timeZone?: string,
 * }} [options]
 */
export function computeSunTimes(options = {}) {
  const requireCoordinates = options.requireCoordinates === true;
  if (
    requireCoordinates &&
    (options.latitude == null ||
      options.longitude == null ||
      !Number.isFinite(Number(options.latitude)) ||
      !Number.isFinite(Number(options.longitude)))
  ) {
    return { ok: false, error: 'COORDINATES_MISSING' };
  }

  const loc = {
    name: options.locationName ?? DEFAULT_SKY_LOCATION.name,
    latitude: options.latitude ?? DEFAULT_SKY_LOCATION.latitude,
    longitude: options.longitude ?? DEFAULT_SKY_LOCATION.longitude,
    timeZone: options.timeZone ?? DEFAULT_SKY_LOCATION.timeZone,
    elevationMeters: options.elevationMeters ?? 0,
  };

  const date = options.when instanceof Date ? options.when : new Date(options.when ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: 'INVALID_DATE', location: loc };
  }

  try {
    const observer = new Observer(loc.latitude, loc.longitude, loc.elevationMeters);
    // Start search slightly before local midnight so we get today's sunrise.
    const localParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: loc.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (t) => localParts.find((p) => p.type === t)?.value;
    const y = Number(get('year'));
    const m = Number(get('month'));
    const d = Number(get('day'));
    const civilNoonUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const searchStart = MakeTime(new Date(civilNoonUtc.getTime() - 6 * 3600 * 1000));

    const rise = SearchRiseSet(Body.Sun, observer, +1, searchStart, 1);
    if (!rise) {
      return {
        ok: false,
        error: 'SUNRISE_NOT_FOUND',
        location: loc,
        polarHint: Math.abs(loc.latitude) > 66,
      };
    }
    const set = SearchRiseSet(Body.Sun, observer, -1, rise, 1);
    if (!set) {
      return {
        ok: false,
        error: 'SUNSET_NOT_FOUND',
        location: loc,
        sunrise: { utcIso: rise.date.toISOString() },
        polarHint: Math.abs(loc.latitude) > 66,
      };
    }

    const dayLengthMs = set.date.getTime() - rise.date.getTime();
    const dayLengthHours = dayLengthMs / 3600000;

    let solarNoon = null;
    try {
      const ha = SearchHourAngle(Body.Sun, observer, 0, rise);
      if (ha?.time?.date) {
        solarNoon = {
          utcIso: ha.time.date.toISOString(),
          localClock: formatLocalClock(ha.time.date, loc.timeZone),
        };
      }
    } catch {
      const mid = new Date((rise.date.getTime() + set.date.getTime()) / 2);
      solarNoon = {
        utcIso: mid.toISOString(),
        localClock: formatLocalClock(mid, loc.timeZone),
        approximate: true,
      };
    }

    const nextRise = SearchRiseSet(Body.Sun, observer, +1, set, 1);
    let nightLength = null;
    if (nextRise) {
      const nightMs = nextRise.date.getTime() - set.date.getTime();
      const nightHours = nightMs / 3600000;
      nightLength = {
        milliseconds: nightMs,
        hours: Number(nightHours.toFixed(4)),
        display: `${Math.floor(nightHours)}s ${Math.round((nightHours % 1) * 60)}dk`,
      };
    }

    return {
      ok: true,
      location: loc,
      civilDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      sunrise: {
        utcIso: rise.date.toISOString(),
        localClock: formatLocalClock(rise.date, loc.timeZone),
      },
      sunset: {
        utcIso: set.date.toISOString(),
        localClock: formatLocalClock(set.date, loc.timeZone),
      },
      solarNoon,
      nextSunrise: nextRise
        ? {
            utcIso: nextRise.date.toISOString(),
            localClock: formatLocalClock(nextRise.date, loc.timeZone),
          }
        : null,
      dayLength: {
        milliseconds: dayLengthMs,
        hours: Number(dayLengthHours.toFixed(4)),
        display: `${Math.floor(dayLengthHours)}s ${Math.round((dayLengthHours % 1) * 60)}dk`,
      },
      nightLength,
      metadata: {
        source: 'astronomy-engine',
        method: 'SearchRiseSet(Body.Sun) — geometric rise/set (~ -0.566° refraction convention in library)',
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message ?? 'SUN_TIMES_FAILURE',
      location: loc,
    };
  }
}

/**
 * @param {{
 *   when?: Date|string|number,
 *   latitude?: number,
 *   longitude?: number,
 *   locationName?: string,
 *   timeZone?: string,
 * }} [options]
 */
export function buildEphemerisSnapshot(options = {}) {
  const loc = {
    name: options.locationName ?? DEFAULT_SKY_LOCATION.name,
    latitude: options.latitude ?? DEFAULT_SKY_LOCATION.latitude,
    longitude: options.longitude ?? DEFAULT_SKY_LOCATION.longitude,
    timeZone: options.timeZone ?? DEFAULT_SKY_LOCATION.timeZone,
  };

  const date = options.when instanceof Date ? options.when : new Date(options.when ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    return {
      ok: false,
      error: 'INVALID_DATE',
      metadata: { source: 'astronomy-engine', method: 'none' },
    };
  }

  try {
    const time = MakeTime(date);
    const positions = {};

    for (const { body, name } of PLANETS) {
      const lon = eclipticLongitude(time, body);
      const sd = longitudeToSignDegree(lon);
      positions[name] = {
        body: name,
        ...sd,
        display: `${sd.sign} ${sd.degree.toFixed(1)}°`,
      };
    }

    const moonIllum = Illumination(Body.Moon, time);
    const phaseFraction = moonIllum.phase_fraction;
    const phaseDeg = MoonPhase(date);
    const moonPhaseNames = describeMoonPhase(phaseFraction, phaseDeg);
    const moonPhase = moonPhaseNames.tr;

    // Retrograde: compare ecliptic longitude ~1 day apart
    const retrogrades = [];
    const later = MakeTime(new Date(date.getTime() + 24 * 3600 * 1000));
    for (const { body, name } of PLANETS) {
      if (name === 'Güneş' || name === 'Ay') continue;
      const lon0 = eclipticLongitude(time, body);
      const lon1 = eclipticLongitude(later, body);
      let delta = lon1 - lon0;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      if (delta < 0) retrogrades.push(name);
    }

    const sunTimes = computeSunTimes({
      when: date,
      latitude: loc.latitude,
      longitude: loc.longitude,
      locationName: loc.name,
      timeZone: loc.timeZone,
    });

    return {
      ok: true,
      whenIso: date.toISOString(),
      location: loc,
      sun: positions.Güneş,
      moon: {
        ...positions.Ay,
        phase: moonPhase,
        phaseEn: moonPhaseNames.en,
        phaseFraction: Number(phaseFraction.toFixed(3)),
      },
      planets: positions,
      retrogrades,
      sunTimes: sunTimes.ok
        ? {
            sunrise: sunTimes.sunrise,
            sunset: sunTimes.sunset,
            dayLength: sunTimes.dayLength,
            civilDate: sunTimes.civilDate,
          }
        : null,
      metadata: {
        source: 'astronomy-engine',
        method: 'geocentric ecliptic longitude (astronomy-engine)',
        precision: 'ephemeris-library',
        note:
          'Konumlar astronomy-engine ile hesaplanmıştır; model hafızasından uydurulmamıştır. Ay burcu gün içinde değişebilir.',
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message ?? 'EPHEMERIS_FAILURE',
      metadata: { source: 'astronomy-engine', method: 'failed' },
    };
  }
}

/**
 * @param {ReturnType<typeof buildEphemerisSnapshot>} sky
 */
export function formatEphemerisDataBlock(sky) {
  if (!sky?.ok) {
    return `## VERIFIED EPHEMERIS DATA
Gökyüzü konumları hesaplanamadı (${sky?.error ?? 'unknown'}). Gezegen/Ay konumlarını uydurma; belirsizliği belirt.`;
  }

  const lines = Object.values(sky.planets).map((p) => `- ${p.body}: ${p.display}`);
  const retro =
    sky.retrogrades.length > 0 ? sky.retrogrades.join(', ') : 'belirgin retro yok (hesaplanan örneklem)';

  return `## VERIFIED EPHEMERIS DATA (use only these positions)
Analiz anı (UTC): ${sky.whenIso}
Varsayılan konum: ${sky.location.name} (${sky.location.latitude}, ${sky.location.longitude}), ${sky.location.timeZone}
Güneş: ${sky.sun.display}
Ay: ${sky.moon.display} — faz: ${sky.moon.phase} (fraction ${sky.moon.phaseFraction})
Gezegenler:
${lines.join('\n')}
Retro (yaklaşık, 24s delta): ${retro}
Kaynak: ${sky.metadata.method}
${sky.metadata.note}
Kurallar:
- Bu blok dışından gezegen derecesi/burç uydurma.
- Konumu kullanıcıya açıkça belirt (varsayılan ${sky.location.name}).
- Kesin olay tahmini yapma; sembolik/yorumlayıcı çerçevede kal.`;
}
