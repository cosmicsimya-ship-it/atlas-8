import { Body, Ecliptic, GeoVector, MakeTime } from 'astronomy-engine';
import { longitudeToSignParts, norm360, PLANET_BODIES } from './constants.js';
import { NatalEngineErrorCode, natalError } from './errors.js';

const AE_BODY = Object.freeze({
  Sun: Body.Sun,
  Moon: Body.Moon,
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
  Uranus: Body.Uranus,
  Neptune: Body.Neptune,
  Pluto: Body.Pluto,
});

/**
 * Geocentric apparent ecliptic longitude (degrees) via astronomy-engine.
 * @param {Date} utcDate
 * @param {string} bodyName
 */
export function eclipticLongitudeOf(utcDate, bodyName) {
  const body = AE_BODY[bodyName];
  if (!body) {
    throw natalError(NatalEngineErrorCode.EPHEMERIS_CALCULATION_FAILED, `unknown body ${bodyName}`);
  }
  try {
    const time = MakeTime(utcDate);
    const vec = GeoVector(body, time, true);
    const ecl = Ecliptic(vec);
    return norm360(ecl.elon);
  } catch (err) {
    throw natalError(
      NatalEngineErrorCode.EPHEMERIS_CALCULATION_FAILED,
      `${bodyName}: ${err?.message || err}`,
    );
  }
}

/**
 * Retrograde if ecliptic longitude decreases over ~24h.
 * @param {Date} utcDate
 * @param {string} bodyName
 */
export function isRetrograde(utcDate, bodyName) {
  if (bodyName === 'Sun' || bodyName === 'Moon') return false;
  const lon0 = eclipticLongitudeOf(utcDate, bodyName);
  const later = new Date(utcDate.getTime() + 24 * 3600_000);
  const lon1 = eclipticLongitudeOf(later, bodyName);
  let delta = lon1 - lon0;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

/**
 * Mean lunar ascending node (Meeus-inspired). South node = north + 180°.
 * Documented as mean node (not true node).
 * @param {Date} utcDate
 */
export function meanLunarNodes(utcDate) {
  const jd = dateToJulianDay(utcDate);
  const T = (jd - 2451545.0) / 36525.0;
  let omega =
    125.0445479 -
    1934.1362891 * T +
    0.0020754 * T * T +
    (T * T * T) / 467441.0 -
    (T * T * T * T) / 60616000.0;
  const north = norm360(omega);
  const south = norm360(north + 180);
  return { north, south };
}

/**
 * @param {Date} date
 */
export function dateToJulianDay(date) {
  // Julian Date from Unix epoch
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Mean obliquity of the ecliptic (degrees), IAU-ish approximation.
 * @param {Date} utcDate
 */
export function meanObliquityDegrees(utcDate) {
  const T = (dateToJulianDay(utcDate) - 2451545.0) / 36525.0;
  const seconds =
    84381.448 - 46.815 * T - 0.00059 * T * T + 0.001813 * T * T * T;
  return seconds / 3600;
}

/**
 * @param {Date} utcDate
 * @param {{ moonUncertainty?: boolean }} [opts]
 */
export function computePlanetaryPositions(utcDate, opts = {}) {
  /** @type {import('./calculate.js').NatalPosition[]} */
  const points = [];
  for (const name of PLANET_BODIES) {
    const longitude = eclipticLongitudeOf(utcDate, name);
    const parts = longitudeToSignParts(longitude);
    points.push({
      body: name,
      longitude: Number(longitude.toFixed(6)),
      sign: parts.sign,
      degreeInSign: parts.degreeInSign,
      minuteInSign: parts.minuteInSign,
      secondInSign: parts.secondInSign,
      degreeInSignExact: Number(parts.degreeInSignExact.toFixed(4)),
      retrograde: isRetrograde(utcDate, name),
      house: undefined,
    });
  }

  const nodes = meanLunarNodes(utcDate);
  for (const [body, lon] of [
    ['NorthNode', nodes.north],
    ['SouthNode', nodes.south],
  ]) {
    const parts = longitudeToSignParts(lon);
    points.push({
      body,
      longitude: Number(lon.toFixed(6)),
      sign: parts.sign,
      degreeInSign: parts.degreeInSign,
      minuteInSign: parts.minuteInSign,
      secondInSign: parts.secondInSign,
      degreeInSignExact: Number(parts.degreeInSignExact.toFixed(4)),
      retrograde: body === 'NorthNode' || body === 'SouthNode' ? true : false,
      house: undefined,
      meta: { nodeType: 'mean' },
    });
  }

  if (opts.moonUncertainty) {
    const moon = points.find((p) => p.body === 'Moon');
    if (moon) moon.uncertainty = 'Moon may change sign within the day when birth time is unknown.';
  }

  return points;
}

/**
 * Rough check whether Moon could change sign during a UTC calendar day.
 * @param {string} birthDate YYYY-MM-DD
 */
export function moonMayChangeSignOnDate(birthDate) {
  const start = new Date(`${birthDate}T00:00:00Z`);
  const end = new Date(`${birthDate}T23:59:59Z`);
  const lon0 = eclipticLongitudeOf(start, 'Moon');
  const lon1 = eclipticLongitudeOf(end, 'Moon');
  const s0 = Math.floor(norm360(lon0) / 30);
  const s1 = Math.floor(norm360(lon1) / 30);
  return s0 !== s1;
}
