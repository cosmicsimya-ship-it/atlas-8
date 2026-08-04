import { SiderealTime, MakeTime } from 'astronomy-engine';
import { longitudeToSignParts, norm360 } from './constants.js';
import { meanObliquityDegrees } from './ephemeris-bodies.js';
import { NatalEngineErrorCode, natalError } from './errors.js';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/**
 * Local sidereal time in degrees [0,360) at geographic longitude.
 * @param {Date} utcDate
 * @param {number} longitudeDeg
 */
export function localSiderealDegrees(utcDate, longitudeDeg) {
  const gstHours = SiderealTime(MakeTime(utcDate));
  return norm360(gstHours * 15 + longitudeDeg);
}

/**
 * Midheaven (MC) ecliptic longitude from RAMC.
 * @param {number} ramcDeg
 * @param {number} obliquityDeg
 */
export function computeMidheaven(ramcDeg, obliquityDeg) {
  const ramc = ramcDeg * DEG;
  const eps = obliquityDeg * DEG;
  return norm360(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) * RAD);
}

/**
 * Ascendant ecliptic longitude.
 * @param {number} ramcDeg
 * @param {number} obliquityDeg
 * @param {number} latitudeDeg
 */
export function computeAscendant(ramcDeg, obliquityDeg, latitudeDeg) {
  const ramc = ramcDeg * DEG;
  const eps = obliquityDeg * DEG;
  const lat = latitudeDeg * DEG;
  // atan2(cos RAMC, −(sin RAMC cos ε + tan φ sin ε)) — equator/RAMC=0 → 90°
  const y = Math.cos(ramc);
  const x = -(Math.sin(ramc) * Math.cos(eps) + Math.tan(lat) * Math.sin(eps));
  return norm360(Math.atan2(y, x) * RAD);
}

/**
 * @param {string} body
 * @param {number} longitude
 */
function anglePoint(body, longitude) {
  const parts = longitudeToSignParts(longitude);
  return {
    body,
    longitude: Number(norm360(longitude).toFixed(6)),
    sign: parts.sign,
    degreeInSign: parts.degreeInSign,
    minuteInSign: parts.minuteInSign,
    secondInSign: parts.secondInSign,
    degreeInSignExact: Number(parts.degreeInSignExact.toFixed(4)),
    retrograde: false,
  };
}

/**
 * @param {Date} utcDate
 * @param {number} latitude
 * @param {number} longitude
 */
export function computeChartAngles(utcDate, latitude, longitude) {
  const ramc = localSiderealDegrees(utcDate, longitude);
  const eps = meanObliquityDegrees(utcDate);
  const asc = computeAscendant(ramc, eps, latitude);
  const mc = computeMidheaven(ramc, eps);
  return {
    ramc,
    obliquity: eps,
    angles: {
      ascendant: anglePoint('Ascendant', asc),
      descendant: anglePoint('Descendant', norm360(asc + 180)),
      midheaven: anglePoint('Midheaven', mc),
      imumCoeli: anglePoint('ImumCoeli', norm360(mc + 180)),
    },
  };
}

/**
 * @param {number} house
 * @param {number} longitude
 */
function cusp(house, longitude) {
  const parts = longitudeToSignParts(longitude);
  return {
    house,
    longitude: Number(norm360(longitude).toFixed(6)),
    sign: parts.sign,
    degreeInSign: parts.degreeInSign,
    minuteInSign: parts.minuteInSign,
    degreeInSignExact: Number(parts.degreeInSignExact.toFixed(4)),
  };
}

/**
 * Whole Sign houses.
 * @param {number} ascLongitude
 */
export function wholeSignCusps(ascLongitude) {
  const signStart = Math.floor(norm360(ascLongitude) / 30) * 30;
  return Array.from({ length: 12 }, (_, i) => cusp(i + 1, signStart + i * 30));
}

/**
 * Equal houses from Ascendant.
 * @param {number} ascLongitude
 */
export function equalHouseCusps(ascLongitude) {
  const asc = norm360(ascLongitude);
  return Array.from({ length: 12 }, (_, i) => cusp(i + 1, asc + i * 30));
}

/**
 * Convert house-cusp RA to ecliptic longitude (same spherical relation as MC).
 * @param {number} raDeg
 * @param {number} obliquityDeg
 */
function longitudeFromCuspRa(raDeg, obliquityDeg) {
  return computeMidheaven(raDeg, obliquityDeg);
}

/**
 * Declination of the ecliptic point whose RA equals raDeg.
 * @param {number} raDeg
 * @param {number} obliquityDeg
 */
function declinationOfEclipticRa(raDeg, obliquityDeg) {
  const lon = longitudeFromCuspRa(raDeg, obliquityDeg) * DEG;
  return Math.asin(Math.sin(obliquityDeg * DEG) * Math.sin(lon));
}

/**
 * Iterate Placidus cusp RA for houses 11, 12, 2, 3.
 * DSA = 90° + AD, AD = asin(tan φ tan δ).
 * 11: RAMC + DSA/3 ; 12: RAMC + 2·DSA/3
 * 3: RAMC + 180 − DSA/3 ; 2: RAMC + 180 − 2·DSA/3
 *
 * @param {number} ramc
 * @param {number} latDeg
 * @param {number} oblDeg
 * @param {11|12|2|3} house
 */
function iteratePlacidusRa(ramc, latDeg, oblDeg, house) {
  const lat = latDeg * DEG;
  const seed = { 11: 30, 12: 60, 2: 120, 3: 150 }[house];
  let ra = norm360(ramc + seed);

  for (let iter = 0; iter < 20; iter += 1) {
    const decl = declinationOfEclipticRa(ra, oblDeg);
    const x = Math.tan(lat) * Math.tan(decl);
    if (Math.abs(x) >= 1) {
      // Circumpolar / polar — equal-house-like fallback in RA
      return norm360(ramc + seed);
    }
    const ad = Math.asin(x);
    const dsa = Math.PI / 2 + ad;
    let next;
    if (house === 11) next = norm360(ramc + (dsa / 3) * RAD);
    else if (house === 12) next = norm360(ramc + ((2 * dsa) / 3) * RAD);
    else if (house === 3) next = norm360(ramc + 180 - (dsa / 3) * RAD);
    else next = norm360(ramc + 180 - ((2 * dsa) / 3) * RAD);

    const delta = Math.abs(norm360(next - ra + 180) - 180);
    ra = next;
    if (delta < 1e-5) break;
  }
  return ra;
}

/**
 * Full Placidus cusps.
 * @param {number} asc
 * @param {number} mc
 * @param {number} ramc
 * @param {number} obliquity
 * @param {number} latitude
 */
export function placidusCusps(asc, mc, ramc, obliquity, latitude) {
  const warnings = [];
  if (Math.abs(latitude) >= 66) {
    warnings.push('Placidus is unstable near polar latitudes; results may be unreliable.');
  }

  const c = new Array(13);
  c[1] = asc;
  c[10] = mc;
  c[7] = norm360(asc + 180);
  c[4] = norm360(mc + 180);

  for (const h of /** @type {const} */ ([11, 12, 2, 3])) {
    const ra = iteratePlacidusRa(ramc, latitude, obliquity, h);
    c[h] = longitudeFromCuspRa(ra, obliquity);
  }

  c[5] = norm360(c[11] + 180);
  c[6] = norm360(c[12] + 180);
  c[8] = norm360(c[2] + 180);
  c[9] = norm360(c[3] + 180);

  return {
    cusps: Array.from({ length: 12 }, (_, i) => cusp(i + 1, c[i + 1])),
    warnings,
  };
}

/**
 * @param {'placidus'|'whole-sign'|'equal'} houseSystem
 * @param {{ ascendant: { longitude: number }, midheaven: { longitude: number } }} angles
 * @param {number} ramc
 * @param {number} obliquity
 * @param {number} latitude
 */
export function computeHouseCusps(houseSystem, angles, ramc, obliquity, latitude) {
  const asc = angles.ascendant.longitude;
  const mc = angles.midheaven.longitude;

  if (houseSystem === 'whole-sign') {
    return { cusps: wholeSignCusps(asc), warnings: [] };
  }
  if (houseSystem === 'equal') {
    return { cusps: equalHouseCusps(asc), warnings: [] };
  }
  if (houseSystem === 'placidus') {
    return placidusCusps(asc, mc, ramc, obliquity, latitude);
  }
  throw natalError(NatalEngineErrorCode.UNSUPPORTED_HOUSE_SYSTEM, houseSystem);
}

/**
 * House number 1..12 for a longitude given cusp longitudes.
 * @param {number} longitude
 * @param {{ house: number, longitude: number }[]} cusps
 */
export function houseForLongitude(longitude, cusps) {
  if (!cusps?.length) return undefined;
  const lon = norm360(longitude);
  const sorted = [...cusps].sort((a, b) => a.house - b.house);
  for (let i = 0; i < 12; i += 1) {
    const a = sorted[i].longitude;
    const b = sorted[(i + 1) % 12].longitude;
    if (a < b || Math.abs(a - b) < 1e-10) {
      if (lon >= a - 1e-10 && lon < b - 1e-10) return sorted[i].house;
      // exact cusp → that house
      if (Math.abs(lon - a) < 1e-10) return sorted[i].house;
    } else {
      if (lon >= a - 1e-10 || lon < b - 1e-10) return sorted[i].house;
    }
  }
  return sorted[0].house;
}

/**
 * @param {object[]} points
 * @param {object[]} cusps
 */
export function assignHousesToPoints(points, cusps) {
  return points.map((p) => ({
    ...p,
    house: houseForLongitude(p.longitude, cusps),
  }));
}
