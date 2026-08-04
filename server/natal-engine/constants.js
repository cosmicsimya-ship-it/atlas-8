/** Shared natal astrology constants (English keys for structured output). */

export const ENGINE_ID = 'atlas-natal-astrology';
export const ENGINE_VERSION = '1.0.0';

export const ZODIAC_SIGNS = Object.freeze([
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]);

export const ZODIAC_SIGNS_TR = Object.freeze({
  Aries: 'Koç',
  Taurus: 'Boğa',
  Gemini: 'İkizler',
  Cancer: 'Yengeç',
  Leo: 'Aslan',
  Virgo: 'Başak',
  Libra: 'Terazi',
  Scorpio: 'Akrep',
  Sagittarius: 'Yay',
  Capricorn: 'Oğlak',
  Aquarius: 'Kova',
  Pisces: 'Balık',
});

export const SIGN_ELEMENTS = Object.freeze({
  Aries: 'Fire',
  Leo: 'Fire',
  Sagittarius: 'Fire',
  Taurus: 'Earth',
  Virgo: 'Earth',
  Capricorn: 'Earth',
  Gemini: 'Air',
  Libra: 'Air',
  Aquarius: 'Air',
  Cancer: 'Water',
  Scorpio: 'Water',
  Pisces: 'Water',
});

export const SIGN_MODALITIES = Object.freeze({
  Aries: 'Cardinal',
  Cancer: 'Cardinal',
  Libra: 'Cardinal',
  Capricorn: 'Cardinal',
  Taurus: 'Fixed',
  Leo: 'Fixed',
  Scorpio: 'Fixed',
  Aquarius: 'Fixed',
  Gemini: 'Mutable',
  Virgo: 'Mutable',
  Sagittarius: 'Mutable',
  Pisces: 'Mutable',
});

export const SIGN_POLARITIES = Object.freeze({
  Aries: 'Yang',
  Gemini: 'Yang',
  Leo: 'Yang',
  Libra: 'Yang',
  Sagittarius: 'Yang',
  Aquarius: 'Yang',
  Taurus: 'Yin',
  Cancer: 'Yin',
  Virgo: 'Yin',
  Scorpio: 'Yin',
  Capricorn: 'Yin',
  Pisces: 'Yin',
});

/** Traditional domicile rulers (tropical western). */
export const SIGN_RULERS = Object.freeze({
  Aries: 'Mars',
  Taurus: 'Venus',
  Gemini: 'Mercury',
  Cancer: 'Moon',
  Leo: 'Sun',
  Virgo: 'Mercury',
  Libra: 'Venus',
  Scorpio: 'Mars',
  Sagittarius: 'Jupiter',
  Capricorn: 'Saturn',
  Aquarius: 'Saturn',
  Pisces: 'Jupiter',
});

export const HOUSE_SYSTEMS = Object.freeze(['placidus', 'whole-sign', 'equal']);

export const ZODIAC_SYSTEMS = Object.freeze(['tropical', 'sidereal']);

export const AYANAMSA_TYPES = Object.freeze(['lahiri', 'fagan-bradley', 'raman']);

export const PLANET_BODIES = Object.freeze([
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
]);

export const NODE_BODIES = Object.freeze(['NorthNode', 'SouthNode']);

export const ANGLE_BODIES = Object.freeze(['Ascendant', 'Descendant', 'Midheaven', 'ImumCoeli']);

export const MAJOR_ASPECTS = Object.freeze([
  { aspect: 'conjunction', exactAngle: 0 },
  { aspect: 'sextile', exactAngle: 60 },
  { aspect: 'square', exactAngle: 90 },
  { aspect: 'trine', exactAngle: 120 },
  { aspect: 'opposition', exactAngle: 180 },
]);

export const MINOR_ASPECTS = Object.freeze([
  { aspect: 'semisextile', exactAngle: 30 },
  { aspect: 'semisquare', exactAngle: 45 },
  { aspect: 'quintile', exactAngle: 72 },
  { aspect: 'sesquiquadrate', exactAngle: 135 },
  { aspect: 'biquintile', exactAngle: 144 },
  { aspect: 'quincunx', exactAngle: 150 },
]);

export const MONTH_NAMES_TR = Object.freeze({
  ocak: 1,
  subat: 2,
  şubat: 2,
  mart: 3,
  nisan: 4,
  mayis: 5,
  mayıs: 5,
  haziran: 6,
  temmuz: 7,
  agustos: 8,
  ağustos: 8,
  eylul: 9,
  eylül: 9,
  ekim: 10,
  kasim: 11,
  kasım: 11,
  aralik: 12,
  aralık: 12,
});

/**
 * Normalize ecliptic longitude into [0, 360).
 * @param {number} deg
 */
export function norm360(deg) {
  let x = deg % 360;
  if (x < 0) x += 360;
  return x;
}

/**
 * Absolute angular separation on the circle (0..180).
 * @param {number} a
 * @param {number} b
 */
export function angularSeparation(a, b) {
  let d = Math.abs(norm360(a) - norm360(b)) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * @param {number} longitudeDeg
 */
export function longitudeToSignParts(longitudeDeg) {
  const lon = norm360(longitudeDeg);
  const signIndex = Math.floor(lon / 30);
  const degreeInSignFloat = lon - signIndex * 30;
  const degreeInSign = Math.floor(degreeInSignFloat);
  const minuteFloat = (degreeInSignFloat - degreeInSign) * 60;
  const minuteInSign = Math.floor(minuteFloat);
  const secondInSign = Math.round((minuteFloat - minuteInSign) * 60);
  return {
    longitude: lon,
    sign: ZODIAC_SIGNS[signIndex],
    signIndex,
    degreeInSign,
    minuteInSign,
    secondInSign: secondInSign === 60 ? 0 : secondInSign,
    degreeInSignExact: degreeInSignFloat,
  };
}
